# SecureFile Option A — Upfront Period Billing

Customers choose a subscription duration (1, 3, 6, 12, or a custom number of months up to 120). The displayed monthly rate is multiplied by the selected number of months and the full amount is paid once. There is no automatic monthly renewal.

## Preview mode
`BILLING_MODE=preview` shows the checkout summary and disabled card fields. No fake payment is recorded.

## Stripe mode
`BILLING_MODE=stripe` creates a Stripe Checkout Session with `mode=payment` and a single line item for the full upfront amount. The Stripe webhook activates the workspace and sets `expiresAt` to the selected number of months.

## Example
Basic = $10/month. Customer selects 6 months. Checkout total = $60. The workspace expires after the selected period unless the customer purchases another period.
