import express from 'express';
import cors from 'cors';
import {execFile} from 'node:child_process';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const app=express();
app.use(cors({origin:true,methods:['GET','POST','OPTIONS'],allowedHeaders:['Content-Type']}));
app.use((req,res,next)=>{res.setHeader('Access-Control-Allow-Private-Network','true');next();});
app.use(express.json({limit:'200mb'}));
const port=Number(process.env.SCANNER_BRIDGE_PORT||8765);
const script=path.join(process.cwd(),'scan.ps1');

app.get('/health',(_req,res)=>res.json({ok:true,platform:process.platform,provider:'Windows WIA',scannerReady:process.platform==='win32'}));
app.get('/devices',(_req,res)=>res.json({devices:[],note:'SecureFile checks the installed WIA scanner when a scan starts.'}));
app.post('/scan',async(req,res)=>{
  if(process.platform!=='win32') return res.status(501).json({error:'The SecureFile WIA bridge requires Windows.'});
  const id=crypto.randomUUID();
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),`securefile-scan-${id}-`));
  const output=path.join(dir,'result.json');
  const source=String(req.body?.source||'ADF').toUpperCase()==='FLATBED'?'FLATBED':'ADF';
  const settings={pages:Math.max(1,Math.min(source==='FLATBED'?1:100,Number(req.body?.pages)||1)),resolutionDpi:Math.max(75,Math.min(600,Number(req.body?.resolutionDpi)||300)),colorMode:String(req.body?.colorMode||'COLOR'),duplex:Boolean(req.body?.duplex),source};
  try{
    await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-OutputJson',output,'-Pages',String(settings.pages),'-ResolutionDpi',String(settings.resolutionDpi),'-ColorMode',settings.colorMode,'-Duplex',String(settings.duplex),'-Source',settings.source],{windowsHide:true,maxBuffer:1024*1024*10},(err,stdout,stderr)=>err?reject(new Error(stderr||stdout||err.message)):resolve(stdout)));
    const raw=JSON.parse(await fs.readFile(output,'utf8'));
    const pages=[];
    for(const imagePath of raw.files||[]){
      const bytes=await fs.readFile(imagePath);
      pages.push({name:path.basename(imagePath),mimeType:'image/jpeg',data:bytes.toString('base64')});
    }
    if(!pages.length) throw new Error('Scanner returned no pages.');
    res.json({pages,scannedPages:pages.length,source:'WIA_SCANNER',resolutionDpi:settings.resolutionDpi,colorMode:settings.colorMode,duplex:settings.duplex});
  }catch(e){res.status(500).json({error:e.message||'Scanner failed'});}
  finally{await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});}
});
app.listen(port,'127.0.0.1',()=>console.log(`SecureFile Scanner Bridge listening on http://127.0.0.1:${port}`));
