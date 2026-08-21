import crypto from 'node:crypto';
import {Router} from 'express';
import {db} from '../db';
import {auth,AuthedRequest,role} from '../middleware/auth';
import {createCheckoutSession,verifyStripeSignature,setStripeSubscriptionCancelAtPeriodEnd,cancelStripeSubscription} from '../services/payment';
import {env} from '../config/env';
import {calculatePrice,addonSchema,getPlan,pricePlan} from '../services/pricing';

const r=Router();

r.get('/me',auth,async(req:AuthedRequest,res)=>{
  if(!req.user?.companyId) return res.status(400).json({error:'No company'});
  res.json(await db.subscription.findUnique({where:{companyId:req.user.companyId}}));
});

r.post('/quote',async(req,res,next)=>{
  try {
    res.json(calculatePrice(Number(req.body.users),Number(req.body.storageGb),Number(req.body.months),addonSchema.parse(req.body.addons||{})));
  } catch(e){next(e)}
});

r.post('/change-quote',auth,role('COMPANY_ADMIN'),async(req:AuthedRequest,res,next)=>{
  try {
    const companyId=req.user!.companyId!;
    const s=await db.subscription.findUnique({where:{companyId}});
    if(!s)return res.status(404).json({error:'Subscription not found'});
    const users=Math.max(s.users,Number(req.body.users)||s.users);
    const storageGb=Math.max(s.storageGb,Number(req.body.storageGb)||s.storageGb);
    const months=Math.max(1,Math.min(120,Number(req.body.months)||1));
    const plan=getPlan(s.planCode);
    const addons=addonSchema.parse(plan?.addons ?? s.addons ?? {});
    const quote=plan ? pricePlan(plan.code,months,users,storageGb) : calculatePrice(users,storageGb,months,addons,Number(s.storageGb)||0);
    res.json({quote,current:{users:s.users,storageGb:s.storageGb,planCode:s.planCode,addons}});
  }catch(e){next(e)}
});

r.post('/cancel',auth,role('COMPANY_ADMIN'),async(req:AuthedRequest,res,next)=>{try{
  const companyId=req.user!.companyId!; const s=await db.subscription.findUnique({where:{companyId}});
  if(!s)return res.status(404).json({error:'Subscription not found.'});
  if(s.status==='SUSPENDED'||(s.expiresAt&&s.expiresAt<=new Date()))return res.status(400).json({error:'This subscription has already expired. Renew it to restore access.'});

  // SecureFile Option A is upfront, non-recurring billing. Cancellation is an
  // immediate customer-requested suspension: the workspace and all data remain
  // preserved, but protected workspace actions stop immediately. Renewal from
  // Settings is still allowed and payment is the only authority that restores
  // access. Legacy recurring Stripe subscriptions are canceled immediately too.
  let stripeCanceled=false;
  if(s.stripeSubscriptionId?.startsWith('sub_')){
    const updated:any=await cancelStripeSubscription(s.stripeSubscriptionId).catch(()=>null);
    stripeCanceled=Boolean(updated);
  }
  await db.subscription.update({where:{id:s.id},data:{status:'SUSPENDED',cancelAtPeriodEnd:false}});
  const {notify}=await import('../services/notify'); const users=await db.user.findMany({where:{companyId,status:{not:'SUSPENDED'}},select:{id:true}});
  for(const u of users)await notify(u.id,'Subscription canceled','Your SecureFile workspace is now suspended. Your data is preserved. Renew from Settings to restore full access.',companyId);
  res.json({ok:true,status:'SUSPENDED',stripeCanceled});
}catch(e){next(e)}});

r.post('/reactivate',auth,role('COMPANY_ADMIN'),async(req:AuthedRequest,res,next)=>{try{
  const companyId=req.user!.companyId!; const s=await db.subscription.findUnique({where:{companyId}});
  if(!s)return res.status(404).json({error:'Subscription not found.'});
  if(s.status==='SUSPENDED'||(s.expiresAt&&s.expiresAt<=new Date()))return res.status(400).json({error:'This subscription has already expired. Use Renew Subscription instead.'});
  if(s.stripeSubscriptionId?.startsWith('sub_'))await setStripeSubscriptionCancelAtPeriodEnd(s.stripeSubscriptionId,false);
  await db.subscription.update({where:{id:s.id},data:{cancelAtPeriodEnd:false}});
  const {notify}=await import('../services/notify'); const users=await db.user.findMany({where:{companyId,status:{not:'SUSPENDED'}},select:{id:true}});
  for(const u of users)await notify(u.id,'Subscription reactivated','Your current paid SecureFile period will continue normally.',companyId);
  res.json({ok:true,cancelAtPeriodEnd:false});
}catch(e){next(e)}});

r.post('/checkout',auth,role('COMPANY_ADMIN'),async(req:AuthedRequest,res,next)=>{
  try {
    const companyId=req.user!.companyId!;
    const s=await db.subscription.findUnique({where:{companyId},include:{company:{select:{contactEmail:true,name:true}}}});
    if(!s)return res.status(404).json({error:'Subscription not found'});
    // Renewals are allowed after expiry/suspension. Payment webhook is the only authority that restores access.
    const requestedPlan=String(req.body.planCode||s.planCode||'CUSTOM').toUpperCase();
    const plan=requestedPlan==='CUSTOM'?null:getPlan(requestedPlan);
    const users=Math.max(1,Number(req.body.users)||s.users);
    if(users < s.users) return res.status(400).json({error:`You cannot reduce purchased users here. Current users: ${s.users}.`});
    const storageGb=plan ? Math.max(plan.storageGb,Number(req.body.storageGb)||s.storageGb) : Math.max(s.storageGb,Number(req.body.storageGb)||s.storageGb);
    if(storageGb < s.storageGb) return res.status(400).json({error:`You cannot reduce storage here. Current storage: ${s.storageGb} GB.`});
    const months=Math.max(1,Math.min(120,Number(req.body.months)||1));
    const addons=addonSchema.parse(plan?.addons ?? s.addons ?? {});
    const quote=plan ? pricePlan(plan.code,months,users,storageGb) : calculatePrice(users,storageGb,months,addons,Number(s.storageGb)||0);
    const checkout=await createCheckoutSession({
      companyId,email:s.company.contactEmail,totalAmountCents:quote.amountCents,
      description:`${s.company.name} — ${plan?.name||'Enterprise'} ${s.status==='ACTIVE'?'capacity upgrade':'renewal'}: ${users} users, ${storageGb} GB, ${months} month${months===1?'':'s'} upfront`,
      metadata:{companyId,subscriptionId:s.id,planCode:plan?.code||s.planCode||'CUSTOM',users:String(users),storageGb:String(storageGb),months:String(months),priceCents:String(quote.amountCents),totalPriceCents:String(quote.amountCents),addons:JSON.stringify(addons),changeType:s.status==='ACTIVE'?'UPGRADE':'RENEWAL'}
    });
    await db.subscription.update({where:{id:s.id},data:{pendingPlanCode:plan?.code||s.planCode||'CUSTOM',pendingUsers:users,pendingStorageGb:storageGb,pendingMonths:months,pendingPriceCents:quote.amountCents,pendingAddons:addons,pendingCheckoutId:checkout.id||null}});
    res.json({...checkout,quote,pending:{users,storageGb,months,planCode:plan?.code||s.planCode||'CUSTOM'}});
  }catch(e){next(e)}
});
r.post('/stripe-webhook',async(req,res)=>{
  if(!env.STRIPE_WEBHOOK_SECRET)return res.status(503).send('Webhook not configured');
  const sig=String(req.headers['stripe-signature']||'');
  const raw=req.body as Buffer;
  if(!Buffer.isBuffer(raw)||!verifyStripeSignature(raw,sig,env.STRIPE_WEBHOOK_SECRET))return res.status(400).send('Invalid signature');
  let event:any; try{event=JSON.parse(raw.toString('utf8'))}catch{return res.status(400).send('Invalid JSON')}
  try {
    const inserted = await db.$queryRaw<Array<{id:string}>>`
      INSERT INTO "PaymentEvent" ("id","provider","eventId","eventType","createdAt")
      VALUES (${crypto.randomUUID()}, 'stripe', ${String(event.id)}, ${String(event.type)}, NOW())
      ON CONFLICT ("eventId") DO NOTHING
      RETURNING "id"
    `;
    if (!inserted.length) return res.json({received:true,duplicate:true});

    const obj=event.data?.object||{};
    const metadata=obj.metadata||{};
    const companyId=String(metadata.companyId||'');
    const subscriptionId=String(metadata.subscriptionId||'');

    if(event.type==='checkout.session.completed'){
      if(obj.payment_status!=='paid' && obj.mode!=='subscription') return res.json({received:true,pending:true});
      if(companyId&&subscriptionId){
        const current=await db.subscription.findUnique({where:{id:subscriptionId}});
        if(current){
          const starts=new Date();
          const users=Number(metadata.users)||current.users;
          const storageGb=Number(metadata.storageGb)||current.storageGb;
          const months=Number(metadata.months)||1;
          const totalPriceCents=Number(metadata.totalPriceCents)||Number(obj.amount_total)||current.priceCents;
          const addons=metadata.addons?addonSchema.parse(JSON.parse(metadata.addons)):((current.addons||{}) as any);
          const newCustomerId=String(obj.customer||'');
          const expires=new Date(starts.getTime()+months*30*24*60*60*1000);
          await db.$transaction([
            db.subscription.update({where:{id:subscriptionId},data:{planCode:String(metadata.planCode||current.planCode),users,storageGb,months,priceCents:totalPriceCents,status:'ACTIVE',startsAt:starts,expiresAt:expires,provider:'stripe',providerRef:String(obj.id),stripeCustomerId:newCustomerId||current.stripeCustomerId,stripeSubscriptionId:null,billingInterval:'one-time',cancelAtPeriodEnd:false,addons,pendingPlanCode:null,pendingUsers:null,pendingStorageGb:null,pendingMonths:null,pendingPriceCents:null,pendingAddons:null,pendingCheckoutId:null}}),
            db.company.update({where:{id:companyId},data:{storageLimitGb:storageGb}})
          ]);
          const usersToNotify=await db.user.findMany({where:{companyId,status:{not:'SUSPENDED'}},select:{id:true}});
          const {notify}=await import('../services/notify');
          for(const u of usersToNotify) await notify(u.id,'Payment successful',`Your SecureFile access is active for ${months} month${months===1?'':'s'} after your upfront payment of $${(totalPriceCents/100).toFixed(2)}.`,companyId);
        }
      }
    } else if(event.type==='invoice.paid') {
      const stripeSubId=String(obj.subscription||'');
      if(stripeSubId){
        const current=await db.subscription.findFirst({where:{stripeSubscriptionId:stripeSubId}});
        if(current){
          const periodEnd=Number(obj.lines?.data?.[0]?.period?.end||0);
          await db.subscription.update({where:{id:current.id},data:{status:'ACTIVE',expiresAt:periodEnd?new Date(periodEnd*1000):new Date(Date.now()+31*86400000),provider:'stripe',cancelAtPeriodEnd:Boolean(obj.cancel_at_period_end||false)}});
          const {notify}=await import('../services/notify');
          const users=await db.user.findMany({where:{companyId:current.companyId,status:{not:'SUSPENDED'}},select:{id:true}});
          for(const u of users) await notify(u.id,'Subscription renewed','Your monthly SecureFile payment was received successfully.',current.companyId);
        }
      }
    } else if(event.type==='invoice.payment_failed') {
      const stripeSubId=String(obj.subscription||'');
      if(stripeSubId){
        const current=await db.subscription.findFirst({where:{stripeSubscriptionId:stripeSubId}});
        if(current){
          await db.subscription.update({where:{id:current.id},data:{status:'PAST_DUE'}});
          const {notify}=await import('../services/notify');
          const users=await db.user.findMany({where:{companyId:current.companyId,status:{not:'SUSPENDED'}},select:{id:true}});
          for(const u of users) await notify(u.id,'Payment failed','Your SecureFile subscription payment failed. Please update your payment method to avoid service interruption.',current.companyId);
        }
      }
    } else if(event.type==='customer.subscription.updated') {
      const stripeSubId=String(obj.id||'');
      const current=stripeSubId?await db.subscription.findFirst({where:{stripeSubscriptionId:stripeSubId}}):null;
      if(current){
        const statusMap:any={active:'ACTIVE',past_due:'PAST_DUE',unpaid:'PAST_DUE',canceled:'CANCELED',incomplete:'PENDING',incomplete_expired:'SUSPENDED',paused:'PAST_DUE'};
        const mapped=String(statusMap[obj.status]||current.status) as any;
        const periodEnd=Number(obj.current_period_end||0);
        await db.subscription.update({where:{id:current.id},data:{status:mapped,expiresAt:periodEnd?new Date(periodEnd*1000):current.expiresAt,cancelAtPeriodEnd:Boolean(obj.cancel_at_period_end||false)}});
      }
    } else if(event.type==='customer.subscription.deleted') {
      const stripeSubId=String(obj.id||'');
      const current=stripeSubId?await db.subscription.findFirst({where:{stripeSubscriptionId:stripeSubId}}):null;
      if(current){
        await db.subscription.update({where:{id:current.id},data:{status:'CANCELED',cancelAtPeriodEnd:false}});
        const {notify}=await import('../services/notify');
        const users=await db.user.findMany({where:{companyId:current.companyId,status:{not:'SUSPENDED'}},select:{id:true}});
        for(const u of users) await notify(u.id,'Subscription canceled','Your SecureFile subscription has been canceled.',current.companyId);
      }
    }
    res.json({received:true});
  }catch(e){console.error(e);res.status(500).send('Webhook processing failed')}
});
export default r;
