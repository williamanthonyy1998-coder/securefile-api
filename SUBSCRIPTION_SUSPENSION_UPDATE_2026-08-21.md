# SecureFile Subscription Suspension Update — 2026-08-21

## Final lifecycle behavior

- Option A billing remains one-time upfront payment for the selected number of months.
- Customer cancellation is immediate: subscription status becomes `SUSPENDED`.
- Workspace/company data is preserved.
- Suspended users can log in and open Settings so they can renew.
- Protected work actions are blocked at the API layer while suspended/expired.
- File preview, signed read URLs, and downloads are blocked while suspended/expired.
- Uploads, folder changes, sharing, requests/approvals, tasks, chat, email, scanner, fax, user management, trash restore/delete, and other protected write actions remain gated by the subscription middleware.
- Public share downloads are also blocked when the owning workspace is suspended/expired.
- Renewal is allowed from Settings even while suspended.
- Capacity increases (users/storage) remain pending until a successful Stripe payment webhook confirms the transaction.
- Preview billing mode never applies a fake payment, access restoration, or capacity increase.
- Successful Stripe webhook remains the authoritative activation/update event.
- Removed a duplicate Personal Folder creation in the user invitation flow.

## Production note

Set `BILLING_MODE=preview` for local/demo mode without Stripe. Set `BILLING_MODE=stripe` only after Stripe secret/webhook keys and production email configuration are present.
