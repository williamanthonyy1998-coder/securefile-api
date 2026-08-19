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

export const env = z.object({
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
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_SUCCESS_URL: optionalUrl,
  STRIPE_CANCEL_URL: optionalUrl,
  AI_API_KEY: optionalString,
  AI_BASE_URL: optionalUrl,
  AI_MODEL: optionalString,
  OBJECT_STORAGE_ENDPOINT: optionalUrl,
  OBJECT_STORAGE_BUCKET: optionalString,
  OBJECT_STORAGE_ACCESS_KEY: optionalString,
  OBJECT_STORAGE_SECRET_KEY: optionalString,
  FAX_WEBHOOK_SECRET: optionalString,
  POSTAL_API_KEY: optionalString,
  POSTAL_API_URL: optionalUrl,
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_STORAGE_BUCKET: z.string().default('securefile')
}).parse(process.env);
