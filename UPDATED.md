# SecureFile — Update Notes

This package is based on the uploaded `securefile-production(3).zip` and includes the requested corrections.

## File module
- Download uses the stored/original file name through `Content-Disposition`.
- Backend file paths are resolved to absolute paths before `sendFile`.
- File name single click opens side preview.
- File name double click opens `/files/:id/view`.
- Dedicated File Viewer supports image/PDF rendering and download fallback for unsupported browser formats.
- Side preview and File Viewer include zoom out, zoom in and reset.
- Preview object URLs are cleaned up.

## User Management
- Company Admin can invite Employees and Clients.
- Purchased seats are enforced.
- Invitation flow creates an invitation token.
- Invited users must accept the invitation and create their password before activation.
- Invited accounts cannot be activated by simply clicking the status action.
- Active users can be suspended; suspended users can be activated.
- Folder permissions are company-scoped.

## Super Admin
- Super Admin opens directly on Companies.
- Company creation supports users, storage, subscription months and add-ons.
- Company Admin consumes one purchased seat when created.
- Tenant URL generation works correctly for localhost subdomains and normal domains.
- Add-on selections are stored in the Subscription JSON field.

## Prisma / database
- `Subscription.addons` exists in `backend/prisma/schema.prisma`.
- Backend Prisma Client is the intended client; root DB commands delegate to backend scripts.
- `npm run db:generate` targets the backend schema through `npm --prefix backend run db:generate`.
- `npm run db:sync` runs the backend safe DB sync helper.

## Environment / seed
- Backend Prisma files are the source of truth.
- `.env.example` is included.
- The seed script requires a 12+ character Super Admin password.
- Real `.env` and `node_modules` are intentionally not included in the delivery archive.

## No Docker
Docker is not required.
