import crypto from 'node:crypto';
import { env } from '../config/env';

async function stripeRequest(path:string, params:URLSearchParams, method='POST') {
  if(!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to the production environment.');
  const r=await fetch(`https://api.stripe.com/v1/${path}`,{method,headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:method==='GET'?undefined:params});
  const data:any=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error?.message||`Stripe API error (${r.status})`);
  return data;
}

/** Creates a one-time Stripe Checkout payment for the full selected period. */
export async function createCheckoutSession(input:{companyId:string;email:string;totalAmountCents:number;description:string;metadata:Record<string,string>}){
  if(env.BILLING_MODE !== 'stripe') return {provider:'preview',checkoutUrl:null,id:null,mode:'preview',subscriptionId:null,customerId:null,warning:'Payment preview only: Stripe is not connected, so no card is charged and no access or capacity change is applied.'};
  if(!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY before accepting payments.');
  if(input.totalAmountCents<50) throw new Error('Stripe payment amount must be at least $0.50.');
  const params=new URLSearchParams();
  params.set('mode','payment');
  params.set('customer_email',input.email);
  params.set('line_items[0][price_data][currency]','usd');
  params.set('line_items[0][price_data][product_data][name]','SecureFile — Selected Plan Period');
  params.set('line_items[0][price_data][product_data][description]',input.description);
  params.set('line_items[0][price_data][unit_amount]',String(input.totalAmountCents));
  params.set('line_items[0][quantity]','1');
  params.set('success_url',env.STRIPE_SUCCESS_URL||`${env.APP_URL}/payment/success`);
  params.set('cancel_url',env.STRIPE_CANCEL_URL||`${env.APP_URL}/payment/cancel`);
  for(const [k,v] of Object.entries(input.metadata)) params.set(`metadata[${k}]`,v);
  const data:any=await stripeRequest('checkout/sessions',params);
  return {provider:'stripe',checkoutUrl:data.url,id:data.id,mode:data.mode,subscriptionId:null,customerId:data.customer||null};
}

export async function cancelStripeSubscription(subscriptionId:string){
  if(!env.STRIPE_SECRET_KEY || !subscriptionId || !subscriptionId.startsWith('sub_')) return null;
  const params=new URLSearchParams();
  return stripeRequest(`subscriptions/${encodeURIComponent(subscriptionId)}`,params,'DELETE');
}

export function verifyStripeSignature(rawBody:Buffer,signature:string,secret:string){
 const parts=signature.split(',').reduce((acc,p)=>{const [k,...rest]=p.split('='); if(k&&!acc[k]) acc[k]=rest.join('='); return acc as Record<string,string>},{} as Record<string,string>);
 const timestamp=parts.t; const v1=parts.v1; if(!timestamp||!v1) return false;
 const age=Math.abs(Date.now()/1000-Number(timestamp)); if(!Number.isFinite(age)||age>300) return false;
 const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
 const a=Buffer.from(expected,'hex'), b=Buffer.from(v1,'hex');
 return a.length===b.length && crypto.timingSafeEqual(a,b);
}

export async function setStripeSubscriptionCancelAtPeriodEnd(subscriptionId:string,cancel:boolean){
  if(!env.STRIPE_SECRET_KEY || !subscriptionId || !subscriptionId.startsWith('sub_')) throw new Error('Stripe subscription is not configured.');
  const params=new URLSearchParams(); params.set('cancel_at_period_end',cancel?'true':'false');
  return stripeRequest(`subscriptions/${encodeURIComponent(subscriptionId)}`,params,'POST');
}
