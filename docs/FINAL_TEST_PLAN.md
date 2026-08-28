# SecureFile local acceptance test

Run from project root:

1. `npm run install:all`
2. `npm run db:generate`
3. Configure `.env`.
4. Seed Super Admin.
5. `npm run dev`.

Test in this order:

### Public
- Home
- Pricing
- User/storage/month selection
- Add-ons
- Signup
- Email verification
- Payment pending/manual or Stripe checkout

### Super Admin
- Login
- Companies list
- Create company
- Set users
- Set storage
- Set months
- Select add-ons
- Optional Company Admin
- Edit company
- Change seat allocation
- Change add-ons
- Delete company

### Company Admin
- Login
- Dashboard
- User Management
- Invite Employee/Client
- Edit user
- Suspend/activate
- Resend invitation
- Folder permissions
- Seat-limit enforcement
- Files
- Upload
- Folder create
- Rename
- Delete
- Preview entitlement
- Download
- Internal sharing
- Public sharing
- Share permissions
- Share expiry/password
- Requests
- Approvals
- Assigning Works
- Solution upload
- Chat/groups
- Scanner entitlement
- Fax entitlement
- Settings

### Tenant isolation
Create two companies and verify:
- Company A cannot list Company B users.
- Company A cannot read Company B files/folders.
- Company A cannot use Company B shares/requests/tasks.
- Company A cannot manipulate Company B IDs through API calls.

### Production gates
Before public launch configure and test:
- real email provider
- Stripe webhook
- S3-compatible object storage
- scanner bridge
- fax provider
- postal provider
- AI provider
- wildcard DNS/TLS
- PostgreSQL backups
- monitoring/logging
- automated integration/e2e/security tests
