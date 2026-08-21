# Website / Software Structure Update

SecureFile is now organized into three top-level applications:

- `backend/` — Express API and server-side business logic.
- `frontend/` — authenticated SecureFile software/workspace UI.
- `website/` — separate public marketing and pricing website.

The public website runs on port 5174 during local development and can be deployed separately from the software frontend. Set `VITE_APP_URL` in `website/.env` to the URL of the software frontend/login app.

## Personal folders

Every company user has exactly one logical personal folder. Personal folders are private to their owner. Company admins do not automatically see another user's personal folder or its files. Access can only be granted explicitly through a share/permission.

Shared/company folders remain visible according to the existing company and permission rules.

For existing databases after the schema update, run:

```bash
npm run db:push
npm run db:backfill-personal
```

`npm run dev` also runs the backfill automatically before starting the three local apps.
