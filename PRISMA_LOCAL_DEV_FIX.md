# Prisma local development fix

The backend uses its own `backend/node_modules/@prisma/client`, while the schema is in the repository-level `prisma/schema.prisma`. The backend `dev` script now explicitly runs:

`prisma generate --schema ../prisma/schema.prisma && tsx watch src/server.ts`

This prevents `@prisma/client did not initialize yet` when the root `db:generate` generated a different client copy.

Run from the repository root:

```cmd
npm run dev
```

Or rebuild dependencies if needed:

```cmd
npm run install:all
npm run dev
```
