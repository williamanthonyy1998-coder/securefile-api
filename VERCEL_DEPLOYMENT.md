# SecureFile Vercel deployment

This repository is deployed as two Vercel projects from the same Git repository.

## Backend project
- Root Directory: `backend`
- Framework Preset: `Express`
- Build Command: `prisma generate --schema prisma/schema.prisma`
- Output Directory: **blank**
- Install Command: `npm install --include=dev`
- Production `CORS_ORIGINS`: the frontend production URL

The backend exports the Express app from `backend/src/server.ts`. No `api/` wrapper is required for current Vercel Express deployments.

## Frontend project
- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`
- `VITE_API_URL`: `/api`

`frontend/vercel.json` proxies `/api/*` to the backend production domain before the SPA fallback.

## Local environment
The Prisma schema requires both `DATABASE_URL` and `DIRECT_URL`. Add both to the root `.env` for local database commands.
