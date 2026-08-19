import crypto from 'node:crypto';
import {Router} from 'express';
import {db} from '../db';
import {auth,AuthedRequest,role} from '../middleware/auth';
import {createCheckoutSession,verifyStripeSignature} from '../services/payment';
import {env} from '../config/env';
import {calculatePrice,addonSchema} from '../services/pricing';

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

r.post('/checkout',auth,role('COMPANY_ADMIN'),async(req:AuthedRequest,res,next)=>{
  try {
    const companyId=req.user!.companyId!;
    const s=await db.subscription.findUnique({where:{companyId},include:{company:{select:{contactEmail:true,name:true}}}});
    if(!s) return res.status(404).json({error:'Subscription not found'});
    const users=Math.max(1,Number(req.body.users)||s.users);
    const storageGb=Math.max(1,Number(req.body.storageGb)||s.storageGb);
    const months=Math.max(1,Number(req.body.months)||s.months);
    const addons=addonSchema.parse(req.body.addons||s.addons||{});
    const quote=calculatePrice(users,storageGb,months,addons);
    await db.subscription.update({where:{id:s.id},data:{users,storageGb,months,priceCents:quote.amountCents,addons}});
    const checkout=await createCheckoutSession({
      companyId, email:s.company.contactEmail, amountCents:quote.amountCents,
      description:`${s.company.name} — ${users} users, ${storageGb} GB, ${months} months`,
      metadata:{companyId,subscriptionId:s.id,users:String(users),storageGb:String(storageGb),months:String(months),priceCents:String(quote.amountCents),addons:JSON.stringify(addons)}
    });
    res.json({...checkout,quote});
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
    if(event.type==='checkout.session.completed'){
      const session=event.data.object;
      if(session.payment_status!=='paid')return res.json({received:true});
      const companyId=session.metadata?.companyId;
      const subscriptionId=session.metadata?.subscriptionId;
      if(companyId&&subscriptionId){
        const current=await db.subscription.findUnique({where:{id:subscriptionId}});
        if(current){
          const starts=new Date();
          const expires=new Date(starts.getTime()+current.months*30*86400000);
          const users=Number(session.metadata?.users)||current.users;
          const storageGb=Number(session.metadata?.storageGb)||current.storageGb;
          const months=Number(session.metadata?.months)||current.months;
          const priceCents=Number(session.metadata?.priceCents)||current.priceCents;
          const addons=session.metadata?.addons?addonSchema.parse(JSON.parse(session.metadata.addons)):((current.addons||{}) as any);
          await db.$transaction([
            db.subscription.update({where:{id:subscriptionId},data:{users,storageGb,months,priceCents,status:'ACTIVE',startsAt:starts,expiresAt:expires,provider:'stripe',providerRef:session.id,addons}}),
            db.company.update({where:{id:companyId},data:{storageLimitGb:storageGb}})
          ]);
        }
      }
    }
    res.json({received:true});
  }catch(e){console.error(e);res.status(500).send('Webhook processing failed')}
});

export default r;
