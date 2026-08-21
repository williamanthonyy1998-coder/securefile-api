# SecureFile Pricing & Capacity Update

## Packages
- Basic: $10/month, 1 included user, 5 GB included, +$5/month per additional user.
- Advanced: $15/month, 1 included user, 2 GB included, +$10/month per additional user. Includes Preview, Scanner, File/Folder Re-sharing and User File Rename.
- Premium: $25/month, 1 included user, 2 GB included, +$12/month per additional user. Includes all package add-ons: Preview, Scanner, Fax, Re-sharing, Rename and Post-office Mailing.
- Additional storage: $0.30/GB/month beyond the package's included storage.

## Capacity upgrades
Company Admin can open Settings and increase purchased users and/or storage. The current subscription remains unchanged until payment is successfully approved. Stripe checkout metadata carries the pending capacity, and the webhook applies the new users/storage only after `checkout.session.completed` with `payment_status=paid`.

## Feature entitlements
Additional users inherit the selected package's feature set. Entitlements are enforced by the API and reflected in the workspace navigation.
