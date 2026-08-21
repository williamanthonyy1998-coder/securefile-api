# SecureFile – Real-time Production Setup

SecureFile now uses a persistent Server-Sent Events (SSE) connection for authenticated users. Database notifications, internal mail delivery and chat/group activity can update the open dashboard immediately without manual refresh.

## 1. Real email delivery

Set these in the project-root `.env`:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM=SecureFile <no-reply@your-verified-domain.com>
```

Use a sender domain that is verified with your email provider. In development, `EMAIL_PROVIDER=console` only prints emails to the backend terminal.

## 2. Realtime API

The frontend automatically opens:

`/api/realtime/events?token=<access-token>`

The stream sends:

- `notification` – access requests, task reminders, shares, etc.
- `mail.received` – internal SecureFile mailbox mail.
- heartbeat comments every 25 seconds.

The browser automatically reconnects if the connection drops.

## 3. Production reverse proxy

Do not buffer the SSE endpoint. For Nginx, the location should include:

```nginx
location /api/realtime/events {
    proxy_pass http://securefile_api;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
}
```

Use HTTPS in production.

## 4. Real payments

Keep Stripe webhook processing enabled. The payment provider must call:

`POST /api/subscriptions/stripe-webhook`

with the Stripe signature. Only a verified paid checkout activates a subscription.

## 5. External inbound email

Configure your inbound mail provider to POST received messages to:

`POST /api/integrations/email/inbound`

with the `x-inbound-email-secret` header matching:

```env
INBOUND_EMAIL_SECRET=change-this-to-a-long-random-secret
```

## 6. Important scaling note

The current realtime connection registry is in-memory. This is correct for a single API instance (the normal first production deployment). If you later run multiple API instances behind a load balancer, add a shared Redis pub/sub layer so an event created on instance A reaches users connected to instance B.

## 7. Browser notifications

When the SecureFile page is open, incoming realtime activity appears immediately as an in-app toast. If the browser grants notification permission, the same event also produces a browser notification.

For notifications when the browser/tab is completely closed, Web Push with a service worker and VAPID keys is the next production layer.
