import crypto from 'node:crypto';
import {env} from '../config/env';
export async function createCheckoutSession(input:{companyId:string;email:string;amountCents:number;description:string;metadata:Record<string,string>}){
 if(!env.STRIPE_SECRET_KEY) return {provider:'manual',checkoutUrl:null,warning:'Stripe is not configured'};
 const params=new URLSearchParams();
 params.set('mode','payment'); params.set('customer_email',input.email); params.set('line_items[0][price_data][currency]','usd');
 params.set('line_items[0][price_data][product_data][name]','SecureFile Subscription'); params.set('line_items[0][price_data][product_data][description]',input.description);
 params.set('line_items[0][price_data][unit_amount]',String(input.amountCents)); params.set('line_items[0][quantity]','1');
 params.set('success_url',env.STRIPE_SUCCESS_URL||`${env.APP_URL}/payment/success`); params.set('cancel_url',env.STRIPE_CANCEL_URL||`${env.APP_URL}/payment/cancel`);
 for(const [k,v] of Object.entries(input.metadata)) params.set(`metadata[${k}]`,v);
 const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body:params});
 const data:any=await r.json(); if(!r.ok) throw new Error(data?.error?.message||'Payment provider error'); return {provider:'stripe',checkoutUrl:data.url,id:data.id};
}
export function verifyStripeSignature(rawBody:Buffer,signature:string,secret:string){
 const parts=Object.fromEntries(signature.split(',').map(x=>x.split('=')));
 const timestamp=parts.t; const v1=parts.v1; if(!timestamp||!v1) return false;
 const age=Math.abs(Date.now()/1000-Number(timestamp)); if(age>300) return false;
 const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
 const a=Buffer.from(expected,'hex'), b=Buffer.from(v1,'hex');
 return a.length===b.length && crypto.timingSafeEqual(a,b);
}
