import { FormEvent, useEffect, useMemo, useState } from "react";
import { Building2, Edit3, Plus, RefreshCw, Search, Trash2, Users, HardDrive, ExternalLink, Check } from "lucide-react";
import { api } from "../lib/api";

type Company = {
  id: string; name: string; slug: string; contactEmail: string; businessIndustry?: string | null; businessDescription?: string | null; logoUrl?: string | null;
  storageLimitGb: number; storageUsedBytes?: string | number;
  subscription?: { planCode?: string; status?: string; users?: number; storageGb?: number; months?: number; priceCents?: number; addons?: Addons | null } | null;
  _count?: { users: number; files: number; folders: number };
};

type Addons = { preview:boolean; scanner:boolean; fax:boolean; reshare:boolean; rename:boolean; postal:boolean };

const ADDONS = [
  ["preview","File Side-panel Preview",5],
  ["scanner","Scanner",5],
  ["fax","Fax",5],
  ["reshare","File/Folder Re-sharing",1],
  ["rename","User File Rename",2],
  ["postal","Post-office Mailing",10],
] as const;

export default function SuperAdmin() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [industry, setIndustry] = useState("ALL");
  const [plan, setPlan] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({name:"", email:"", businessIndustry:"", businessDescription:"", planCode:"CUSTOM", storageGb:"15", users:"1", months:"1", adminName:"", adminEmail:"", adminPassword:"", addons:{preview:false,scanner:false,fax:false,reshare:false,rename:false,postal:false}});

  function applyPlan(code:string){
    const defaults:Record<string,{users:number,storageGb:number,addons:Addons}>= {
      STARTER:{users:1,storageGb:5,addons:{preview:false,scanner:false,fax:false,reshare:false,rename:false,postal:false}},
      BUSINESS:{users:1,storageGb:2,addons:{preview:true,scanner:true,fax:false,reshare:true,rename:true,postal:false}},
      PROFESSIONAL:{users:1,storageGb:2,addons:{preview:true,scanner:true,fax:true,reshare:true,rename:true,postal:true}},
      CUSTOM:{users:Number(form.users)||1,storageGb:Number(form.storageGb)||15,addons:form.addons}
    };
    const d=defaults[code]||defaults.CUSTOM;
    setForm({...form,planCode:code,users:String(d.users),storageGb:String(d.storageGb),addons:d.addons});
  }

  async function load() {
    setLoading(true); setError("");
    try { const data = await api("/super-admin/companies"); setCompanies(Array.isArray(data) ? data : []); }
    catch (e:any) { setError(e?.message || "Unable to load companies."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter(c => { const text=[c.name,c.contactEmail,c.slug,c.businessIndustry,c.businessDescription,c.subscription?.planCode].map(v=>String(v||'')).join(' ').toLowerCase(); return (!q || text.includes(q)) && (industry==='ALL' || String(c.businessIndustry||'Other')===industry) && (plan==='ALL' || String(c.subscription?.planCode||'CUSTOM')===plan); });
  }, [companies, query, industry, plan]);

  const totalUsers = companies.reduce((n,c)=>n+Number(c._count?.users||c.subscription?.users||0),0);
  const totalStorage = companies.reduce((n,c)=>n+Number(c.storageLimitGb||c.subscription?.storageGb||0),0);
  const planCounts = companies.reduce((a,c)=>{const k=String(c.subscription?.planCode||'CUSTOM');a[k]=(a[k]||0)+1;return a;},{} as Record<string,number>);
  const industryCounts = companies.reduce((a,c)=>{const k=String(c.businessIndustry||'Other');a[k]=(a[k]||0)+1;return a;},{} as Record<string,number>);

  function openCreate(){ setEditing(null); setForm({name:"",email:"",businessIndustry:"",businessDescription:"",planCode:"CUSTOM",storageGb:"5",users:"1",months:"1",adminName:"",adminEmail:"",adminPassword:"",addons:{preview:false,scanner:false,fax:false,reshare:false,rename:false,postal:false}}); setShowCreate(true); }
  function openEdit(c:Company){ setShowCreate(false); setEditing(c); setForm({name:c.name,email:c.contactEmail,businessIndustry:String(c.businessIndustry||''),businessDescription:String(c.businessDescription||''),planCode:String(c.subscription?.planCode||'CUSTOM'),storageGb:String(c.storageLimitGb),users:String(c.subscription?.users ?? c._count?.users ?? 1),months:String(c.subscription?.months ?? 1),adminName:"",adminEmail:"",adminPassword:"",addons:{preview:!!c.subscription?.addons?.preview,scanner:!!c.subscription?.addons?.scanner,fax:!!c.subscription?.addons?.fax,reshare:!!c.subscription?.addons?.reshare,rename:!!c.subscription?.addons?.rename,postal:!!c.subscription?.addons?.postal}}); }

  async function submit(e:FormEvent){
    e.preventDefault(); setSaving(true); setError("");
    try {
      if(editing){
        await api(`/super-admin/companies/${editing.id}`,{method:"PATCH",body:JSON.stringify({name:form.name,contactEmail:form.email,businessIndustry:form.businessIndustry,businessDescription:form.businessDescription,planCode:form.planCode,storageGb:Number(form.storageGb),users:Number(form.users),months:Number(form.months),addons:form.addons})});
      } else {
        await api("/super-admin/companies",{method:"POST",body:JSON.stringify({name:form.name,email:form.email,businessIndustry:form.businessIndustry,businessDescription:form.businessDescription,planCode:form.planCode,storageGb:Number(form.storageGb),users:Number(form.users),months:Number(form.months),addons:form.addons,adminName:form.adminName||undefined,adminEmail:form.adminEmail||undefined,adminPassword:form.adminPassword||undefined})});
      }
      setShowCreate(false); setEditing(null); await load();
    } catch(e:any){ setError(e?.message || "Unable to save company."); }
    finally { setSaving(false); }
  }

  async function remove(c:Company){
    if(!confirm(`Delete ${c.name}? This permanently removes the company and its data.`)) return;
    setError("");
    try { await api(`/super-admin/companies/${c.id}`,{method:"DELETE"}); await load(); }
    catch(e:any){ setError(e?.message || "Unable to delete company."); }
  }

  return <div className="super-companies">
    <div className="page-head">
      <div><p className="eyebrow">Platform Owner</p><h1>Companies</h1><p>Manage all customer companies, admins, users, storage and subscriptions.</p></div>
      <div className="sa-actions"><button className="btn secondary" onClick={load} disabled={loading}><RefreshCw size={15}/>Refresh</button><button className="btn" onClick={openCreate}><Plus size={16}/>Add Company</button></div>
    </div>

    {error && <div className="error" style={{marginBottom:18}}>{error}</div>}

    <div className="cards sa-stats">
      <div className="stat"><span><Building2 size={14}/> Companies</span><strong>{companies.length}</strong></div>
      <div className="stat"><span><Users size={14}/> Users</span><strong>{totalUsers}</strong></div>
      <div className="stat"><span><HardDrive size={14}/> Allocated storage</span><strong>{totalStorage} GB</strong></div>
      <div className="stat"><span>Plans</span><strong>{planCounts.STARTER||0} / {planCounts.BUSINESS||0} / {planCounts.PROFESSIONAL||0} / {planCounts.CUSTOM||0}</strong><small>Basic · Advanced · Premium · Enterprise</small></div>
    </div>

    <div className="panel sa-breakdown">
      <div className="breakdown-head"><div><p className="eyebrow">Enterpriseer intelligence</p><h2>Who is using SecureFile?</h2><p className="muted">See which industries are adopting the platform and which package they selected.</p></div></div>
      <div className="breakdown-grid">
        <div><h3>Plans</h3><div className="breakdown-pills">{[['STARTER','Basic'],['BUSINESS','Advanced'],['PROFESSIONAL','Premium'],['CUSTOM','Enterprise']].map(([k,n])=><button type="button" key={k} className={plan===k?'active':''} onClick={()=>setPlan(plan===k?'ALL':k)}><strong>{planCounts[k]||0}</strong><span>{n}</span></button>)}</div></div>
        <div><h3>Industries</h3><div className="breakdown-pills">{Object.entries(industryCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=><button type="button" key={k} className={industry===k?'active':''} onClick={()=>setIndustry(industry===k?'ALL':k)}><strong>{v}</strong><span>{k}</span></button>)}</div></div>
      </div>
    </div>

    <div className="panel">
      <div className="company-toolbar"><div className="company-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search companies, emails, industries or plans..."/></div><select value={industry} onChange={e=>setIndustry(e.target.value)}><option value="ALL">All industries</option>{Array.from(new Set(companies.map(c=>String(c.businessIndustry||"Other")))).sort().map(x=><option key={x} value={x}>{x}</option>)}</select><select value={plan} onChange={e=>setPlan(e.target.value)}><option value="ALL">All plans</option><option value="STARTER">Basic</option><option value="BUSINESS">Advanced</option><option value="PROFESSIONAL">Premium</option><option value="CUSTOM">Enterprise</option></select><span className="muted">{filtered.length} of {companies.length}</span></div>
      {loading ? <div className="data">Loading companies...</div> : filtered.length===0 ? <div className="empty-company"><Building2 size={34}/><h3>{companies.length ? "No matching companies" : "No companies yet"}</h3><p>{companies.length ? "Try another search." : "Create your first customer company to start managing tenants."}</p>{!companies.length && <button className="btn" onClick={openCreate}><Plus size={16}/>Create Company</button>}</div> :
      <div className="company-table-wrap"><table className="company-table"><thead><tr><th>Company</th><th>Admin / Contact</th><th>Business / Industry</th><th>Plan</th><th>Users</th><th>Storage</th><th>Subscription</th><th>Tenant URL</th><th>Actions</th></tr></thead><tbody>{filtered.map(c=><tr key={c.id}>
        <td><div className="company-name"><span className="company-avatar"><Building2 size={16}/></span><div><strong>{c.name}</strong><small>{c.id}</small></div></div></td>
        <td>{c.contactEmail}</td>
        <td><strong>{c.businessIndustry || "Other"}</strong>{c.businessDescription && <small className="industry-desc">{c.businessDescription}</small>}</td>
        <td><span className="plan-code">{{STARTER:"Basic",BUSINESS:"Advanced",PROFESSIONAL:"Premium",CUSTOM:"Enterprise"}[c.subscription?.planCode || "CUSTOM"] || "Enterprise"}</span>{c.subscription?.priceCents != null && <small className="industry-desc">${(Number(c.subscription.priceCents)/100).toFixed(2)} / {c.subscription.months || 1} mo</small>}</td>
        <td>{c._count?.users ?? 0} / {c.subscription?.users ?? c._count?.users ?? 1}</td>
        <td>{c.storageLimitGb} GB</td>
        <td><span className={`status-pill ${(c.subscription?.status||"none").toLowerCase()}`}>{c.subscription?.status || "Not billed"}</span></td>
        <td>
  <a
  href={`${window.location.origin}/t/${encodeURIComponent(c.slug)}`}
  target="_blank"
  rel="noreferrer"
>
  {window.location.host}/t/{c.slug}
  <ExternalLink size={13} />
</a>
</td>
        <td><div className="row-actions"><button className="icon-btn" title="Edit" onClick={()=>openEdit(c)}><Edit3 size={15}/></button><button className="icon-btn danger" title="Delete" onClick={()=>remove(c)}><Trash2 size={15}/></button></div></td>
      </tr>)}</tbody></table></div>}
    </div>

    {(showCreate || editing) && <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">{editing ? "Company settings" : "New tenant"}</p><h2>{editing ? "Edit Company" : "Create Company"}</h2></div><button type="button" className="close-btn" onClick={()=>{setShowCreate(false);setEditing(null)}}>×</button></div>
      <label>Company name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label>Contact email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <label>Business / Industry<input required value={form.businessIndustry} onChange={e=>setForm({...form,businessIndustry:e.target.value})}/></label>
      <label>What does this business do?<textarea rows={3} value={form.businessDescription} onChange={e=>setForm({...form,businessDescription:e.target.value})}/></label>
      <label>Plan<select value={form.planCode} onChange={e=>applyPlan(e.target.value)}><option value="STARTER">Basic</option><option value="BUSINESS">Advanced</option><option value="PROFESSIONAL">Premium</option><option value="CUSTOM">Enterprise</option></select></label>
      <label>Users included<input required type="number" min="1" step="1" value={form.users} onChange={e=>setForm({...form,users:e.target.value})}/></label><label>Storage limit (GB)<input required type="number" min="1" value={form.storageGb} onChange={e=>setForm({...form,storageGb:e.target.value})}/></label>
      <div className="modal-section">Subscription</div>
      <label>Subscription months<select value={form.months} onChange={e=>setForm({...form,months:e.target.value})}>{[1,3,6,12,24,36].map(m=><option key={m} value={m}>{m} month{m>1?"s":""}</option>)}</select></label>
      <div className="addon-title">Add-ons <span>Select the features included in this company plan.</span></div>
      <div className="addon-grid">{ADDONS.map(([key,name,price])=><label className="addon-option" key={key}>
        <input type="checkbox" checked={!!form.addons[key]} onChange={e=>setForm({...form,addons:{...form.addons,[key]:e.target.checked}})}/>
        <span className="addon-copy"><strong>{name}</strong><small>${price}/user/month</small></span>
        <span className="addon-check"><Check size={14}/></span>
      </label>)}</div>
      {!editing && <><div className="modal-section">Optional Company Admin</div><label>Admin name<input value={form.adminName} onChange={e=>setForm({...form,adminName:e.target.value})}/></label><label>Admin email<input type="email" value={form.adminEmail} onChange={e=>setForm({...form,adminEmail:e.target.value})}/></label><label>Temporary password<input type="password" minLength={12} value={form.adminPassword} onChange={e=>setForm({...form,adminPassword:e.target.value})}/></label></>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>{setShowCreate(false);setEditing(null)}}>Cancel</button><button className="btn" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create company"}</button></div>
    </form></div>}
  </div>;
}
