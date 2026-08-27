import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { errors } from './middleware/error';

import auth from './routes/auth';
import companies from './routes/companies';
import users from './routes/users';
import files from './routes/files';
import folders from './routes/folders';
import sharing from './routes/sharing';
import workspace from './routes/workspace';
import subscriptions from './routes/subscriptions';
import superAdmin from './routes/superAdmin';
import publicRoutes from './routes/public';
import search from './routes/search';
import integrations from './routes/integrations';
import trash from './routes/trash';
import cron from './routes/cron';
import fax from './routes/fax';
import { taskAndTrashSweep } from './services/taskWorker';
import { realtimeEvents } from './services/realtime';

import { subscriptionSweep } from './services/subscriptionWorker';
import { emailConfigured } from './services/email';
import { faxConfigured } from './services/fax';
import { remoteStorageConfigured } from './services/storage';

const app = express();

app.set('trust proxy', 1);

app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value
);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(compression());

// CORS
// Keep the API usable from the production web app, local Vite development,
// and any additional origins explicitly configured in CORS_ORIGINS.
// IMPORTANT: never throw from the CORS origin callback for a browser
// preflight request. Throwing here turns a normal OPTIONS request into a
// 500 response and the browser reports it as "Failed to fetch".
const configuredOrigins = env.CORS_ORIGINS
  .split(',')
  .map((x) => x.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  'https://securefile-api-lkxs.vercel.app',
  'https://securefile-api.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

const corsOptions: cors.CorsOptions = {
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-Tenant-Slug',
],
  origin: (origin, cb) => {
    // Non-browser requests (curl, server-to-server, health checks).
    if (!origin) return cb(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');

    // Development is intentionally permissive.
    if (env.NODE_ENV !== 'production') {
      return cb(null, true);
    }

    // Production: allow only configured/known application origins.
    if (allowedOrigins.has(normalizedOrigin)) {
      return cb(null, true);
    }

    // Do NOT throw here. A rejected origin must not crash the serverless
    // function. The browser will simply receive no CORS permission.
    return cb(null, false);
  },
};

app.use(cors(corsOptions));

// Explicit preflight handling. This guarantees OPTIONS /api/* is answered
// before auth/rate-limit/router middleware is evaluated.
app.options(/.*/, cors(corsOptions));

app.use(
  '/api/subscriptions/stripe-webhook',
  express.raw({
    type: 'application/json',
    limit: '1mb',
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  auth
);

app.use('/api/public', publicRoutes);
app.use('/api/search', search);
app.use('/api/companies', companies);
app.use('/api/users', users);
app.use('/api/files', files);
app.use('/api/folders', folders);
app.use('/api/sharing', sharing);
app.use('/api/workspace', workspace);
app.use('/api/subscriptions', subscriptions);
app.use('/api/super-admin', superAdmin);
app.use('/api/integrations', integrations);
app.use('/api/trash', trash);
app.use('/api/workspace/trash', trash);
app.use('/api/cron', cron);
app.use('/api/fax', fax);
app.get('/api/realtime', realtimeEvents);

app.get('/api/maintenance/sweep', async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
    await subscriptionSweep();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.get(['/healthz', '/api/healthz'], (_req, res) => {
  res.json({
    ok: true,
    emailConfigured: emailConfigured(),
    emailProvider: env.EMAIL_PROVIDER,
    stripeConfigured: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
    faxConfigured: faxConfigured(),
    faxWebhookConfigured: Boolean(env.PHAXIO_CALLBACK_URL && (env.PHAXIO_CALLBACK_TOKEN || env.FAX_WEBHOOK_SECRET)),
    remoteStorageConfigured,
    realtime: 'sse-with-db-polling',
  });
});

app.use(errors);

if (process.env.VERCEL !== '1') {
  app.listen(env.PORT, () => {
    console.log(`SecureFile API listening on ${env.PORT}`);
  });

  const runSweep = () => Promise.all([subscriptionSweep(), taskAndTrashSweep()]).catch(console.error);

  runSweep();

  setInterval(runSweep, 60 * 60 * 1000);
}

export default app;
export { app };