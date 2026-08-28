# SecureFile Vercel backend fix

## Backend Vercel project

Use the existing `securefile-api` Vercel project and set:

- Root Directory: `backend`
- Framework Preset: `Other`
- Build Command: leave empty
- Output Directory: leave empty
- Install Command: `npm install --include=dev`

The backend now has exactly one Vercel Serverless Function at `api/[...path].ts`.
Do not add a `functions` pattern for `api/index.ts` and do not configure `public` as the output directory.

After pushing this commit, deploy the latest `main` branch to Production.

## Frontend Vercel project

Use the `frontend` directory as Root Directory.

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

The frontend proxies `/api/*` to `https://securefile-api.vercel.app/api/*`.

## Required production variables

Backend:
- `NODE_ENV=production`
- `DATABASE_URL=...`
- `DIRECT_URL=...` (if your Prisma schema requires it)
- `JWT_SECRET=...`
- `CORS_ORIGINS=https://YOUR-FRONTEND-DOMAIN`
- other existing service variables

Frontend:
- `VITE_API_URL=/api`
- `VITE_DIRECT_UPLOAD=false` (until direct storage is configured)

## Test after deployment

Open:

`https://securefile-api.vercel.app/api/healthz`

It must return JSON beginning with `{"ok":true...}`.

Then open the frontend and login. The browser Network request should be:

`POST /api/auth/login`

and it must return the API's JSON response, not `index.html` and not HTTP 405.
