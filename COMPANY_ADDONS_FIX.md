# Company Add-ons Fix

Super Admin Company create/edit now supports the same paid add-ons as the public pricing flow:

- File Side-panel Preview — $5/user/month
- Scanner — $5/user/month
- Fax — $5/user/month
- File/Folder Re-sharing — $1/user/month
- User File Rename — $2/user/month
- Post-office Mailing — $10/user/month

The selected add-ons are persisted in `Subscription.addons` and included in the subscription price calculation. Editing a company loads its existing add-ons and allows Super Admin to change them.

No new database column is required because `Subscription.addons` is already a JSON field in the Prisma schema.
