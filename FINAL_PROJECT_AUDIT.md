# SecureFile — Final Source Audit (current archive)

This revision was reviewed from the uploaded `securefile-production.zip`.

## Core company workspace
- Dashboard and tenant statistics
- Files and folders
- Upload/download/preview
- File rename/delete
- Folder create/rename/delete
- File/folder sharing
- Internal and public shares
- Share permissions and expiry/password
- Permission-aware tenant isolation
- User management with invitations
- User edit/status/remove
- Folder permissions per employee/client
- Seat-limit display and enforcement
- Requests and approvals
- Assigning Works/tasks and solution upload
- Direct/group chat
- Notifications API
- Scanner/Fax entitlement boundaries
- AI provider boundary
- Company/subscription settings

## Super Admin
- Company listing/search
- Create/edit/delete company
- User-seat allocation
- Storage allocation
- Subscription duration
- Add-ons
- Pricing calculation
- Optional Company Admin creation
- Existing-company seat reduction protection

## Pricing
- $10 first/base user/month
- $5 each additional user/month
- $0.30/GB/month
- Preview $5/user/month
- Scanner $5/user/month
- Fax $5/user/month
- Re-sharing $1/user/month
- Rename $2/user/month
- Post-office $10/user/month

## Security
- Server-side authorization
- Tenant scoping
- Password hashing
- Hashed invitation/reset/verification tokens
- Private upload storage
- Upload size limits
- Storage quota enforcement
- Public share random tokens stored hashed
- Optional public-share password and expiry
- Stripe signature verification boundary
- Subscription entitlement checks

## Database correction
`Subscription.addons` is part of the current Prisma schema.
`PaymentEvent` is part of the current Prisma schema.

The uploaded archive did not contain the migration history that exists in the user's current PostgreSQL database. Do not run `prisma migrate reset` against an existing database. For the existing development database, synchronize the current schema with the already-existing data using the controlled Prisma workflow described in the README.

## External provider configuration
Real production integrations still require the customer's own credentials/configuration:
- PostgreSQL
- transactional email
- Stripe
- S3-compatible object storage
- scanner bridge/provider
- fax provider
- postal provider
- AI provider

No provider credential is fabricated in the source.
No Docker dependency is introduced.
