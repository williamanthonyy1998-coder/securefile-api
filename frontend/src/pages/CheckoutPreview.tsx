import {Link,useSearchParams} from "react-router-dom";

const names:any={STARTER:"Basic",BUSINESS:"Advanced",PROFESSIONAL:"Premium",CUSTOM:"Enterprise"};
const rates:any={STARTER:10,BUSINESS:15,PROFESSIONAL:25,CUSTOM:10};
export default function CheckoutPreview(){
 const [sp]=useSearchParams();
 const code=(sp.get("planCode")||"CUSTOM").toUpperCase();
 const users=Number(sp.get("users")||1); const gb=Number(sp.get("gb")||5); const months=Math.max(1,Number(sp.get("months")||1));
 const addons=(()=>{try{return JSON.parse(sp.get("addons")||"{}")}catch{return {}}})();
 const extraUser=code==="BUSINESS"?10:code==="PROFESSIONAL"?12:5;
 const addonRates:any={preview:5,scanner:5,fax:5,reshare:1,rename:2,postal:10};
 const addonMonthly=Object.entries(addons).reduce((sum,[k,v])=>sum+(v?(addonRates[k]||0)*users:0),0);
 const monthly=code!=="CUSTOM" ? rates[code]+Math.max(0,users-1)*extraUser+Math.max(0,gb-(code==='STARTER'?5:2))*.30 : 10+Math.max(0,users-1)*5+Math.max(0,gb-0)*.30+addonMonthly;
 const total=monthly*months; const verify=sp.get("verify");
 return <div className="auth"><div className="form-card" style={{maxWidth:620}}><p className="eyebrow">SecureFile checkout</p><h1>Review your purchase</h1><div className="notice"><b>Billing preview mode</b><p style={{margin:'8px 0 0'}}>Stripe is not connected yet. This preview shows the real one-time checkout structure. No card is charged while preview mode is active.</p></div><div style={{marginTop:18,border:'1px solid #e5e9f0',borderRadius:12,padding:18}}><div style={{display:'flex',justifyContent:'space-between',gap:16}}><b>{names[code]||'Enterprise'} plan</b><b>${total.toFixed(2)} total</b></div><p className="muted">{users} user{users!==1?'s':''} · {gb} GB storage · {months} month{months!==1?'s':''}</p><hr/><div className="grid2"><div><small className="muted">Monthly rate</small><strong>${monthly.toFixed(2)}</strong></div><div><small className="muted">Upfront total</small><strong>${total.toFixed(2)}</strong></div></div><label style={{marginTop:14}}>Card number<input placeholder="Stripe will provide secure card fields" disabled /></label><div className="grid2"><label>Expiry<input placeholder="MM / YY" disabled /></label><label>CVC<input placeholder="•••" disabled /></label></div><button className="btn" disabled style={{opacity:.55}}>Pay ${total.toFixed(2)} upfront — Stripe later</button></div>{verify&&<div className="success" style={{marginTop:16}}><b>Email verification is ready for this preview.</b><p style={{margin:'8px 0'}}>Verify the admin email to continue the free preview.</p><a className="btn secondary" href={verify}>Verify email</a></div>}<p className="muted" style={{marginTop:16}}>Option A: the customer pays the entire selected period once. Access expires after the selected number of months and does not auto-renew.</p><Link to="/pricing">Back to pricing</Link></div></div>;
}
