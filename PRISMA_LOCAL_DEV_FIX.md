# Prisma local development fix

The backend uses its own `backend/node_modules/@prisma/client`, and the schema lives in `backend/prisma/schema.prisma`. The backend `dev` script now explicitly runs:

`npm run db:generate && tsx watch src/server.ts`

Root DB commands delegate to backend scripts so there is one Prisma source of truth.

Run from the repository root:

```cmd
npm run dev
```

Or rebuild dependencies if needed:

```cmd
npm run install:all
npm run dev
```
