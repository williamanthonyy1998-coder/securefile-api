# SecureFile Subscription Lifecycle — Option A

- Customer chooses 1–120 months and pays the entire selected period once.
- There is no automatic monthly renewal.
- A successful Stripe webhook is the only production authority that activates/renews access and applies paid capacity changes.
- On expiry, the subscription becomes `SUSPENDED` and the workspace remains viewable but write/download actions are blocked.
- The Company Admin can open Settings while suspended and purchase a new upfront renewal. Existing plan, users, storage and add-ons are restored after the payment webhook succeeds.
- Company Admin can purchase additional users/storage while active. The paid capacity change is applied only after the payment webhook succeeds.
- Cancellation means “do not renew”; paid access remains available until the existing expiry date. There is no automatic renewal to stop in Option A.
- A cancellation can be reversed before expiry.
- The UI shows a view-only banner after expiry with a Settings → Renew action.
