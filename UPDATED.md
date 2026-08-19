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
- `Subscription.addons` exists in `prisma/schema.prisma`.
- Root Prisma Client is the intended client; the project does not rely on a second generated client inside `backend/node_modules`.
- `npm run db:generate` always targets the root schema.
- `npm run db:migrate` is mapped to `prisma db push` because the uploaded source package did not contain its previous migration history. This prevents the missing-local-migration drift problem seen in the uploaded project.
- `npm run db:validate` is available.

## Environment / seed
- Root `.env` is the source of truth.
- `.env.example` is included.
- The seed script loads the root `.env` reliably and requires a 12+ character Super Admin password.
- Real `.env` and `node_modules` are intentionally not included in the delivery archive.

## No Docker
Docker is not required.
