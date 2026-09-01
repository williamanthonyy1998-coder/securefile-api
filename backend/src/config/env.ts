import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Backend is launched from /backend. Load the project-root .env first/fallback
// so npm --prefix backend works without duplicating secrets into backend/.env.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: true });

const optionalUrl = z.preprocess(
  value => value === '' || value === undefined ? undefined : value,
  z.string().url().optional()
);
const optionalString = z.preprocess(
  value => value === '' ? undefined : value,
  z.string().optional()
);

const parsed = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  APP_URL: z.string().url().default('http://localhost:5173'),
  PUBLIC_APP_DOMAIN: z.string().default('securefile.com'),
  UPLOAD_DIR: z.string().default('./storage/uploads').transform(value => path.resolve(process.cwd(), value)),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(250),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  EMAIL_PROVIDER: z.enum(['console','resend']).default('console'),
  EMAIL_FROM: z.string().email().default('no-reply@securefile.com'),
  RESEND_API_KEY: optionalString,
  BILLING_MODE: z.enum(['preview','stripe']).default('preview'),
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_SUCCESS_URL: optionalUrl,
  STRIPE_CANCEL_URL: optionalUrl,
  AI_API_KEY: optionalString,
  AI_BASE_URL: optionalUrl,
  AI_MODEL: optionalString,
  AI_PROVIDER: z.enum(['openai','openai-compatible']).default('openai-compatible'),
  AI_WEB_SEARCH_ENABLED: z.preprocess(value => { if (value === undefined || value === '') return true; if (typeof value === 'string') return value.toLowerCase() === 'true'; return value; }, z.boolean()),
  OBJECT_STORAGE_ENDPOINT: optionalUrl,
  OBJECT_STORAGE_BUCKET: optionalString,
  OBJECT_STORAGE_ACCESS_KEY: optionalString,
  OBJECT_STORAGE_SECRET_KEY: optionalString,
  PHAXIO_API_KEY: optionalString,
  PHAXIO_API_SECRET: optionalString,
  PHAXIO_BASE_URL: z.string().url().default('https://api.phaxio.com/v2.1'),
  PHAXIO_CALLBACK_URL: optionalUrl,
  PHAXIO_CALLBACK_TOKEN: optionalString,
  FAX_WEBHOOK_SECRET: optionalString,
  INBOUND_EMAIL_SECRET: optionalString,
  POSTAL_API_KEY: optionalString,
  POSTAL_API_URL: optionalUrl,
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_STORAGE_BUCKET: z.string().default('securefile'),
  CRON_SECRET: optionalString
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== 'production') return;
  if (value.BILLING_MODE === 'stripe' && (value.EMAIL_PROVIDER !== 'resend' || !value.RESEND_API_KEY)) ctx.addIssue({code:'custom',path:['RESEND_API_KEY'],message:'Stripe production billing requires production email configuration.'});
  if (value.BILLING_MODE === 'stripe' && (!value.STRIPE_SECRET_KEY || !value.STRIPE_WEBHOOK_SECRET)) ctx.addIssue({code:'custom',path:['STRIPE_SECRET_KEY'],message:'Stripe billing mode requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.'});
  if (!value.CRON_SECRET) ctx.addIssue({code:'custom',path:['CRON_SECRET'],message:'Production requires CRON_SECRET.'});
  if (!value.SUPABASE_URL || !value.SUPABASE_SERVICE_ROLE_KEY || !value.SUPABASE_STORAGE_BUCKET) ctx.addIssue({code:'custom',path:['SUPABASE_URL'],message:'Production requires private Supabase Storage configuration.'});
  if (value.APP_URL.includes('localhost')) ctx.addIssue({code:'custom',path:['APP_URL'],message:'Production APP_URL cannot point to localhost.'});
  if (value.CORS_ORIGINS.includes('localhost')) ctx.addIssue({code:'custom',path:['CORS_ORIGINS'],message:'Production CORS_ORIGINS cannot include localhost.'});
});

export const env = parsed.parse(process.env);
