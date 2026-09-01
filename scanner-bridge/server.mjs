import express from 'express';
import cors from 'cors';
import {execFile} from 'node:child_process';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const app = express();
const port = Number(process.env.SCANNER_BRIDGE_PORT || 8765);
const host = process.env.SCANNER_BRIDGE_HOST || '127.0.0.1';
const script = path.join(process.cwd(), 'scan.ps1');

app.use(cors({ origin: true, methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','X-SecureFile-Scanner'], optionsSuccessStatus: 204 }));
app.use((req,res,next)=>{ res.setHeader('Access-Control-Allow-Private-Network','true'); res.setHeader('Cache-Control','no-store'); next(); });
app.use(express.json({limit:'300mb'}));

function runPowerShell(args, timeout = 15 * 60 * 1000) {
  return new Promise((resolve,reject)=>{
    execFile('powershell.exe', args, {windowsHide:true,maxBuffer:1024*1024*50,timeout}, (err,stdout,stderr)=>{
      if(err) return reject(new Error((stderr || stdout || err.message || 'PowerShell scanner operation failed').trim()));
      resolve(String(stdout || '').trim());
    });
  });
}

function findNaps2() {
  const candidates = [
    process.env.NAPS2_CONSOLE,
    'C:\\Program Files\\NAPS2\\NAPS2.Console.exe',
    'C:\\Program Files (x86)\\NAPS2\\NAPS2.Console.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'NAPS2', 'NAPS2.Console.exe')
  ].filter(Boolean);
  return new Promise(resolve=>{
    const check=(i)=>{
      if(i>=candidates.length){
        execFile('where.exe',['NAPS2.Console.exe'],{windowsHide:true},(err,stdout)=>resolve(err?null:String(stdout||'').split(/\r?\n/).find(Boolean)||null));
        return;
      }
      fs.access(candidates[i]).then(()=>resolve(candidates[i])).catch(()=>check(i+1));
    };
    check(0);
  });
}

function normalizeSettings(body={}) {
  const source = String(body.source||'ADF').toUpperCase()==='FLATBED'?'FLATBED':'ADF';
  const driverRaw=String(body.driver||'AUTO').toLowerCase();
  const driver=['auto','wia','twain','escl'].includes(driverRaw)?driverRaw:'auto';
  return {
    source,
    pages:Math.max(1,Math.min(source==='FLATBED'?1:100,Number(body.pages)||1)),
    resolutionDpi:Math.max(75,Math.min(1200,Number(body.resolutionDpi)||300)),
    colorMode:['COLOR','GRAY','BW'].includes(String(body.colorMode||'').toUpperCase())?String(body.colorMode).toUpperCase():'COLOR',
    duplex:source==='ADF'&&Boolean(body.duplex),
    driver,
    device:body.device ? String(body.device) : '',
    deviceName:body.deviceName ? String(body.deviceName) : ''
  };
}

function parseNaps2Devices(text, driver){
  const lines=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  return lines.filter(line=>!/^available devices:?$/i.test(line)&&!/^devices:?$/i.test(line)).map(name=>({id:`${driver}:${name}`,name,driver,source:'NAPS2'}));
}

app.get('/health', async (_req,res)=>{
  const naps2=process.platform==='win32'?await findNaps2():null;
  res.json({ok:true,platform:process.platform,provider:naps2?'NAPS2 + WIA':'Windows WIA',scannerReady:process.platform==='win32',naps2Installed:Boolean(naps2),bridgeVersion:'3.0.0'});
});

app.get('/devices', async (_req,res)=>{
  if(process.platform!=='win32') return res.status(501).json({devices:[],error:'The SecureFile scanner bridge requires Windows.'});
  const devices=[];
  try {
    const output=await runPowerShell(['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-ListDevices'],30000);
    const parsed=JSON.parse(output||'{"devices":[]}');
    for(const d of parsed.devices||[]) devices.push({...d,driver:'wia',source:'WIA'});
  } catch {}
  const naps2=await findNaps2();
  if(naps2){
    for(const driver of ['wia','twain','escl']){
      try {
        const out=await new Promise((resolve,reject)=>execFile(naps2,['--listdevices','--driver',driver],{windowsHide:true,maxBuffer:1024*1024,timeout:30000},(err,stdout,stderr)=>err?reject(new Error(stderr||stdout||err.message)):resolve(stdout)));
        devices.push(...parseNaps2Devices(out,driver));
      } catch {}
    }
  }
  const unique=[];const seen=new Set();
  for(const d of devices){const key=`${d.driver}|${d.name}`.toLowerCase();if(!seen.has(key)){seen.add(key);unique.push(d);}}
  res.json({devices:unique,naps2Installed:Boolean(naps2),drivers:naps2?['AUTO','WIA','TWAIN','ESCL']:['AUTO','WIA']});
});

async function scanWithWia(settings,dir){
  const output=path.join(dir,'result.json');
  const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-OutputJson',output,'-Pages',String(settings.pages),'-ResolutionDpi',String(settings.resolutionDpi),'-ColorMode',settings.colorMode,'-Duplex',String(settings.duplex),'-Source',settings.source];
  if(settings.device) args.push('-DeviceId',settings.device);
  await runPowerShell(args);
  const raw=JSON.parse(await fs.readFile(output,'utf8'));
  return raw.files||[];
}

async function scanWithNaps2(settings,dir,naps2){
  if(!settings.device) throw new Error('Select a scanner device before scanning.');
  const driver=settings.driver==='auto'?'wia':settings.driver;
  const source=settings.duplex?'duplex':settings.source==='FLATBED'?'glass':'feeder';
  const bitdepth=settings.colorMode==='GRAY'?'gray':settings.colorMode==='BW'?'bw':'color';
  const files=[];
  const maxPages=settings.source==='FLATBED'?1:settings.pages;
  // Scan one logical batch at a time. This lets us return individual page images to the browser
  // while still using NAPS2's WIA/TWAIN/eSCL device abstraction.
  for(let i=1;i<=maxPages;i++){
    const prefix=path.join(dir,`page-${String(i).padStart(4,'0')}`);
    const output=`${prefix}.jpg`;
    const args=['-o',output,'--noprofile','--driver',driver,'--device',settings.device,'--source',source,'--dpi',String(settings.resolutionDpi),'--bitdepth',bitdepth,'--jpegquality','92','-f'];
    try {
      await new Promise((resolve,reject)=>execFile(naps2,args,{windowsHide:true,maxBuffer:1024*1024*10,timeout:5*60*1000},(err,stdout,stderr)=>err?reject(new Error((stderr||stdout||err.message||'NAPS2 scan failed').trim())):resolve(stdout)));
    } catch(err){
      if(files.length) break;
      throw err;
    }
    const candidates=(await fs.readdir(dir)).filter(n=>n.toLowerCase().endsWith('.jpg')).sort();
    const newFiles=candidates.filter(n=>!files.some(f=>path.basename(f)===n));
    for(const name of newFiles) files.push(path.join(dir,name));
    if(settings.source==='FLATBED') break;
    if(!newFiles.length) break;
  }
  return files;
}

app.post('/scan', async(req,res)=>{
  if(process.platform!=='win32') return res.status(501).json({error:'The SecureFile scanner bridge requires Windows.'});
  const id=crypto.randomUUID();
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),`securefile-scan-${id}-`));
  const settings=normalizeSettings(req.body);
  try {
    const naps2=await findNaps2();
    let files=[]; let usedDriver=settings.driver;
    if(settings.driver==='twain'||settings.driver==='escl'){
      if(!naps2) throw new Error('NAPS2 is required for TWAIN/eSCL scanners. Install NAPS2 on this Windows PC, then restart the Scanner Bridge.');
      files=await scanWithNaps2(settings,dir,naps2); usedDriver=settings.driver;
    } else if(settings.driver==='wia') {
      try {
        files=await scanWithWia(settings,dir); usedDriver='wia';
      } catch (wiaError) {
        // If Auto selected a WIA device and direct WIA fails, retry through NAPS2.
        // This gives TWAIN-capable manufacturer drivers a practical fallback without changing the UI.
        if(settings.driver!=='auto' || !naps2 || !settings.deviceName) throw wiaError;
        const fallbackNames=['wia','twain'];
        let lastError=wiaError;
        for(const fallback of fallbackNames){
          try { const fallbackSettings={...settings,driver:fallback,device:settings.deviceName}; files=await scanWithNaps2(fallbackSettings,dir,naps2); usedDriver=fallback; break; }
          catch(e){ lastError=e; }
        }
        if(!files.length) throw lastError;
      }
    } else {
      // AUTO: prefer direct WIA when an actual WIA device id is available, then fall back to NAPS2 WIA/TWAIN.
      if(settings.device){
        try { files=await scanWithWia(settings,dir); usedDriver='wia'; }
        catch(wiaError){
          if(!naps2 || !settings.deviceName) throw wiaError;
          let lastError=wiaError;
          for(const fallback of ['wia','twain','escl']){
            try { const fallbackSettings={...settings,driver:fallback,device:settings.deviceName}; files=await scanWithNaps2(fallbackSettings,dir,naps2); usedDriver=fallback; break; }
            catch(e){ lastError=e; }
          }
          if(!files.length) throw lastError;
        }
      } else if(naps2 && settings.deviceName){
        let lastError=new Error('No scanner device selected.');
        for(const fallback of ['wia','twain','escl']){
          try { const fallbackSettings={...settings,driver:fallback,device:settings.deviceName}; files=await scanWithNaps2(fallbackSettings,dir,naps2); usedDriver=fallback; break; }
          catch(e){ lastError=e; }
        }
        if(!files.length) throw lastError;
      }
    }
    const pages=[];
    for(const imagePath of files){
      const bytes=await fs.readFile(imagePath);
      if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8) continue;
      pages.push({name:path.basename(imagePath),mimeType:'image/jpeg',data:bytes.toString('base64')});
    }
    if(!pages.length) throw new Error('Scanner returned no pages. Check the feeder/flatbed, selected device, and scanner driver.');
    res.json({pages,scannedPages:pages.length,source:'WINDOWS_SCANNER',driver:usedDriver,device:settings.device||null,resolutionDpi:settings.resolutionDpi,colorMode:settings.colorMode,duplex:settings.duplex});
  } catch(error){
    res.status(500).json({error:error?.message||'Scanner failed. Check the scanner, driver, and Windows scanner service.'});
  } finally { await fs.rm(dir,{recursive:true,force:true}).catch(()=>{}); }
});

app.listen(port,host,()=>console.log(`SecureFile Universal Scanner Bridge listening on http://${host}:${port}`));
