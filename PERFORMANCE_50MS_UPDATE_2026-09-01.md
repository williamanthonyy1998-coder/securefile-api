# SecureFile Performance Update — 2026-09-01

## What changed

- Removed Express ETag/304 negotiation for API responses. The browser now does not repeatedly wait for conditional GETs that return 304.
- Added a short-lived, authenticated server read cache (5 seconds) for protected JSON GET endpoints. Cache keys are user + exact URL, and every authenticated write clears the cache.
- Notifications and binary preview/download endpoints are excluded from the read cache.
- Added persistent per-tab `sessionStorage` GET caching in the frontend (60 seconds fresh, 10 minutes stale) so navigation/reloads can render previously loaded workspace data without waiting on the remote database.
- Added request de-duplication for simultaneous identical GET requests.
- Frontend API requests explicitly use `cache: no-store` so browser HTTP cache/ETag behavior cannot reintroduce 304 latency.
- Optimized folder/file authorization paths: admins no longer traverse share permissions for tenant-wide reads; share checks use `findFirst` with the required permission directly.
- Added database indexes for common file/folder/share listing and access lookups.
- Reduced `/companies/me` to a narrow select rather than returning the complete company/subscription record.

## Important performance expectation

A remote PostgreSQL round trip cannot be mathematically guaranteed to finish under 50 ms from every user's browser. The project now targets sub-50 ms responses for warm cached API reads and instant UI rendering from the frontend cache. Uncached database reads can still be slower when the database/provider is geographically distant or cold.

For a true consistently low-latency production target, deploy the API and PostgreSQL in the same/nearby region and keep the database connection warm.

## Base project

This update was made directly on the latest `securefile-production-user-management-order-updated.zip` supplied as the project's current base.
