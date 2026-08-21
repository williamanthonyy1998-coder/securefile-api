# SecureFile Pricing & Upgrade Rules — 20 Aug 2026

## Packages

| Package | First user / month | Additional user / month | Included storage | Included features |
|---|---:|---:|---:|---|
| Basic | $10 | $5 | 5 GB | Core workspace |
| Advanced | $15 | $10 | 2 GB | File side-panel preview, Scanner, File/Folder Re-sharing, User File Rename |
| Premium | $25 | $12 | 2 GB | All package features: Preview, Scanner, Fax, Re-sharing, Rename, Post-office Mailing |
| Enterprise | Custom | Custom | Custom | Customer-selected add-ons |

Every package starts with **1 included user**. The first user is the Company Admin. Additional users receive the exact same package features as the selected package.

## Storage

Basic includes 5 GB. Advanced and Premium include 2 GB. Enterprise is custom. Additional storage is billed at $0.30/GB/month.

## Settings upgrades

A Company Admin can request a higher user count and/or higher storage from Settings. The active subscription is **not changed when the request is created**. A `SubscriptionChange` record is created and the customer is sent to payment. The new limits are applied only after payment is confirmed by the payment provider webhook.

This prevents a customer from getting extra seats/storage before payment approval.

## Upgrade example

Advanced with 1 user = $15/month. Advanced with 3 users = $35/month. Premium with 1 user = $25/month. Premium with 3 users = $49/month. Storage above the package's included storage adds $0.30/GB/month.
