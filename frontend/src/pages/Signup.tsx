import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

const PLAN_NAMES: Record<string,string> = { STARTER:"Basic", BUSINESS:"Advanced", PROFESSIONAL:"Premium", CUSTOM:"Enterprise" };
const EXTRA_USER_RATE: Record<string,number> = { STARTER:5, BUSINESS:10, PROFESSIONAL:12, CUSTOM:5 };

export default function Signup(){
  const [sp] = useSearchParams();
  const planCode = (sp.get("planCode") || "CUSTOM").toUpperCase();
  const fixed = planCode !== "CUSTOM";
  const parsed = (()=>{ try { return JSON.parse(sp.get("addons") || "{}"); } catch { return {}; } })();
  const [form,setForm] = useState({
    companyName:"", companyEmail:"", businessIndustry:"", businessDescription:"",
    adminName:"", adminEmail:"", password:"", planCode,
    users:+(sp.get("users") || 1), storageGb:+(sp.get("gb") || 5), months:Math.max(1,Math.min(120,+(sp.get("months") || 1))), addons:parsed
  });
  const [err,setErr] = useState("");
  const [ok,setOk] = useState("");
  async function submit(e:FormEvent){
    e.preventDefault(); setErr(""); setOk("");
    try {
      const d = await api("/auth/signup",{method:"POST",body:JSON.stringify(form)});
      if(d.checkout?.checkoutUrl){ setOk("Workspace reserved. Redirecting you to secure Stripe checkout…"); setTimeout(()=>{window.location.href=d.checkout.checkoutUrl},500); return; }
      const q=new URLSearchParams({planCode,users:String(form.users),gb:String(form.storageGb),months:String(form.months),addons:JSON.stringify(form.addons||{})});
      if(d.verificationUrl) q.set('verify',d.verificationUrl);
      window.location.href=`/checkout-preview?${q.toString()}`;
    } catch(e:any){ setErr(e.message); }
  }
  return <div className="auth"><form onSubmit={submit} className="form-card">
    <p className="eyebrow">SecureFile {PLAN_NAMES[planCode] || "Enterprise"} plan</p>
    <h1>Create your company</h1>
    <p className="muted">{fixed ? `Your ${PLAN_NAMES[planCode]} package is preconfigured. Your verified admin email becomes the login for this workspace.` : "Configure your own users, storage and add-ons. A verified email is required before the workspace can be activated."}</p>
    {err && <div className="error">{err}</div>}{ok && <div className="success">{ok}</div>}
    <label>Company name<input required value={form.companyName} onChange={e=>setForm({...form,companyName:e.target.value})}/></label>
    <label>Company email<input required type="email" autoComplete="organization" value={form.companyEmail} onChange={e=>setForm({...form,companyEmail:e.target.value})}/></label>
    <label>Business / Industry<input required placeholder="e.g. Medical Billing, Law Firm, Real Estate" value={form.businessIndustry} onChange={e=>setForm({...form,businessIndustry:e.target.value})}/></label>
    <label>What does your business do?<textarea rows={3} placeholder="Briefly describe the business or work this SecureFile workspace will be used for." value={form.businessDescription} onChange={e=>setForm({...form,businessDescription:e.target.value})}/></label>
    <label>Admin name<input required value={form.adminName} onChange={e=>setForm({...form,adminName:e.target.value})}/></label>
    <label>Admin email<input required type="email" autoComplete="email" value={form.adminEmail} onChange={e=>setForm({...form,adminEmail:e.target.value})}/></label>
    <label>Password<input required type="password" minLength={10} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
    <div className="grid2"><label>Users<input type="number" min={1} value={form.users} onChange={e=>setForm({...form,users:Math.max(1,+e.target.value||1)})}/><small className="muted">{fixed ? `1 user is included. Additional users: +$${EXTRA_USER_RATE[planCode] || 5}/user/month. All users receive the ${PLAN_NAMES[planCode]} features.` : ''}</small></label><label>Storage GB<input type="number" min="1" disabled={fixed} value={form.storageGb} onChange={e=>setForm({...form,storageGb:+e.target.value})}/></label></div>
    <div className="grid2"><label>Subscription duration<select value={([1,3,6,12].includes(form.months)?String(form.months):"custom")} onChange={e=>{const v=e.target.value==="custom"?Math.max(1,form.months):Number(e.target.value);setForm({...form,months:v})}}><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option><option value="custom">Custom</option></select></label>{![1,3,6,12].includes(form.months)&&<label>Number of months<input type="number" min="1" max="120" value={form.months} onChange={e=>setForm({...form,months:Math.max(1,Math.min(120,+e.target.value||1))})}/></label>}</div>
    <div className="muted">{fixed ? "Plan features and limits are included automatically." : "Enterprise add-ons are selected on the pricing page."} Selected duration: <strong>{form.months} month{form.months!==1?'s':''}</strong>. The full period is paid upfront; there is no automatic monthly renewal.</div>
    <button className="btn">Create Workspace & Continue</button><Link to="/pricing">Back to pricing</Link>
  </form></div>;
}
