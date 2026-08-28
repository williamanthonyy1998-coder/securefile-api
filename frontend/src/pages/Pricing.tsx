import {useMemo,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';

const ADDONS=[
  ['preview','File Side-panel Preview',5],
  ['scanner','Scanner',5],
  ['fax','Fax',5],
  ['reshare','File/Folder Re-sharing',1],
  ['rename','User File Rename',2],
  ['postal','Post-office Mailing',10]
] as const;

type Plan = {
  code: string;
  name: string;
  tag: string;
  users: number;
  gb: number;
  addons: Record<string, boolean>;
  desc: string;
  popular: boolean;
  includedGb: number;
  fixedMonthly: number;
  additionalUserMonthly: number;
};

const PLANS: Plan[] = [
  {
    code: 'STARTER',
    name: 'Basic',
    tag: 'Solo workspace',
    users: 1,
    gb: 5,
    addons: {
      preview: false,
      scanner: false,
      fax: false,
      reshare: false,
      rename: false,
      postal: false
    },
    desc: 'A secure starting point for one Company Admin, with 5 GB included storage.',
    popular: false,
    includedGb: 5,
    fixedMonthly: 10,
    additionalUserMonthly: 5
  },
  {
    code: 'BUSINESS',
    name: 'Advanced',
    tag: 'Most popular',
    users: 1,
    gb: 2,
    addons: {
      preview: true,
      scanner: true,
      fax: false,
      reshare: true,
      rename: true,
      postal: false
    },
    desc: 'The balanced package for a growing team, with 2 GB included storage.',
    popular: true,
    includedGb: 2,
    fixedMonthly: 15,
    additionalUserMonthly: 10
  },
  {
    code: 'PROFESSIONAL',
    name: 'Premium',
    tag: 'Full toolkit',
    users: 1,
    gb: 2,
    addons: {
      preview: true,
      scanner: true,
      fax: true,
      reshare: true,
      rename: true,
      postal: true
    },
    desc: 'Everything enabled for teams that need the complete platform, with 2 GB included storage.',
    popular: false,
    includedGb: 2,
    fixedMonthly: 25,
    additionalUserMonthly: 12
  }
];

function quote(users:number,gb:number,months:number,addons:Record<string,boolean>,includedGb=0){
  const user=10+Math.max(0,users-1)*5;
  const storage=Math.max(0,gb-includedGb)*.30;
  const add=ADDONS.reduce((sum,[key,,price])=>sum+(addons[key]?price*users:0),0);
  const monthly=user+storage+add;
  return {monthly,total:monthly*months};
}

export default function Pricing(){
 const nav=useNavigate();
 const[months,setMonths]=useState(1);
 const[customMonths,setCustomMonths]=useState(1);
 const[users,setUsers]=useState(1);
 const[gb,setGb]=useState(2);
 const[addons,setAddons]=useState<Record<string,boolean>>({});
 const[planUsers,setPlanUsers]=useState<Record<string,number>>({STARTER:1,BUSINESS:1,PROFESSIONAL:1});
 const custom=useMemo(()=>quote(users,gb,months,addons),[users,gb,months,addons]);
 const durationOptions=[1,3,6,12];
 function durationControl(){ return <div className="duration-control"><label>Subscription duration<select value={durationOptions.includes(months)?months:0} onChange={e=>{const v=Number(e.target.value); if(v===0){setMonths(Math.max(1,customMonths));} else setMonths(v);}}><option value={1}>1 month</option><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option><option value={0}>Custom</option></select></label>{!durationOptions.includes(months)&&<label>Number of months<input type="number" min="1" max="120" value={customMonths} onChange={e=>{const v=Math.max(1,Math.min(120,+e.target.value||1));setCustomMonths(v);setMonths(v)}}/></label>}<div className="duration-note"><strong>{months} month{months!==1?'s':''}</strong> selected · one upfront payment · no automatic monthly renewal</div></div> }


 function choosePlan(code:string){
   const plan=PLANS.find(p=>p.code===code)!;
   const selectedUsers=planUsers[plan.code] || plan.users;
   const q=new URLSearchParams({planCode:plan.code,users:String(selectedUsers),gb:String(plan.gb),months:String(months),addons:JSON.stringify(plan.addons)});
   nav(`/signup?${q}`);
 }

 return <div className="public">
  <div className="nav"><b>SecureFile</b><div><Link to="/">Home</Link><Link to="/login">Login</Link><Link className="btn small" to="/signup">Sign Up</Link></div></div>
  <div className="pricing-page">
   <div className="pricing-hero"><p className="eyebrow">Simple, usage-based pricing</p><h1>Choose a plan that fits your workspace.</h1><p>Basic, Advanced and Premium use fixed monthly rates. Enterprise uses transparent user, storage and add-on rates so you can build the workspace you need.</p></div>
   {durationControl()}<div className="pricing-grid">
    {PLANS.map(p=>{const selectedUsers=planUsers[p.code]||p.users;const q=p.fixedMonthly ? {monthly:p.fixedMonthly+Math.max(0,selectedUsers-p.users)*(p.additionalUserMonthly||5),total:(p.fixedMonthly+Math.max(0,selectedUsers-p.users)*(p.additionalUserMonthly||5))*months} : quote(selectedUsers,p.gb,months,p.addons,p.includedGb);return <div className={`plan-card ${p.popular?'featured':''}`} key={p.code}>
      {p.popular&&<div className="plan-badge">MOST POPULAR</div>}
      <div className="plan-head"><div><span className="plan-tag">{p.tag}</span><h2>{p.name}</h2></div><span className="plan-users">{selectedUsers} user{selectedUsers>1?'s':''}</span></div>
      <p className="plan-desc">{p.desc}</p>
      <div className="plan-price">${q.total.toFixed(2)}<small> total</small></div>
      <p className="plan-total">${q.monthly.toFixed(2)}/month × {months} month{months!==1?'s':''} · one upfront payment</p>
      <div className="custom-fields"><label>Total users <b>{selectedUsers}</b><input type="number" min={p.users} value={selectedUsers} onChange={e=>setPlanUsers({...planUsers,[p.code]:Math.max(p.users,+e.target.value||p.users)})}/></label><small className="muted">1 user included · +${p.additionalUserMonthly}/month for each additional user · all users receive this plan's features.</small></div><ul className="plan-list"><li>{p.users} included user{p.users>1?'s':''}</li><li>{p.gb} GB storage{p.includedGb ? ' included' : ''}</li>{ADDONS.filter(([k])=>p.addons[k]).map(([k,n])=><li key={k}>{n}</li>)}</ul>
      <button className="btn plan-btn" onClick={()=>choosePlan(p.code)}>Choose {p.name}</button>
    </div>})}
    <div className="plan-card custom-plan">
      <div className="plan-head"><div><span className="plan-tag">Build your own</span><h2>Enterprise</h2></div><span className="plan-users">Flexible</span></div>
      <p className="plan-desc">Pick exactly what your company needs. One user is always the Company Admin.</p>
      <div className="custom-fields">
       <label>Users <b>{users}</b><input type="number" min="1" value={users} onChange={e=>setUsers(Math.max(1,+e.target.value||1))}/></label>
       <label>Storage (GB) <b>{gb}</b><input type="number" min="1" value={gb} onChange={e=>setGb(Math.max(1,+e.target.value||1))}/></label>
       
      </div>
      <div className="custom-addon-list">{ADDONS.map(([k,n,p])=><label className="check" key={k}><input type="checkbox" checked={!!addons[k]} onChange={e=>setAddons({...addons,[k]:e.target.checked})}/>{n}<span>+${p}/user</span></label>)}</div>
      <div className="plan-price">${custom.total.toFixed(2)}<small> total</small></div>
      <p className="plan-total">${custom.monthly.toFixed(2)}/month × {months} month{months!==1?'s':''} · one upfront payment</p>
      <button className="btn plan-btn" onClick={()=>{const q=new URLSearchParams({planCode:'CUSTOM',users:String(users),gb:String(gb),months:String(months),addons:JSON.stringify(addons)});nav(`/signup?${q}`)}}>Build Enterprise Plan</button>
    </div>
   </div>
   <div className="pricing-note"><strong>Plan pricing:</strong> Basic $10/month · Advanced $15/month · Premium $25/month. Your selected duration multiplies the monthly rate. Enterprise custom pricing uses transparent user, storage and add-on rates.</div><div className="pricing-note"><strong>Billing:</strong> Choose how many months you want and pay the full selected period upfront. <span className="muted">There is no automatic monthly renewal under this plan model.</span></div><div className="pricing-note"><strong>Transparent custom rates:</strong> $10 for the first user/month · 5 GB is included with Basic · $5 each additional user/month · $0.30/GB/month for storage beyond the included plan allowance · add-ons are priced per user/month.</div>
  </div>
 </div>
}
