import {Request,Response,NextFunction} from 'express';
export function errors(err:any,_req:Request,res:Response,_next:NextFunction){console.error(err);const status=Number(err?.status)||500;res.status(status).json({error:status===500?'Internal server error':String(err?.message||'Request failed')});}
