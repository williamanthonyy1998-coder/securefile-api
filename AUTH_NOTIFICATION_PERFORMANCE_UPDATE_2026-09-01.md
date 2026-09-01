# Auth / Notification / Performance Update

- 7-day JWT sessions.
- Stateless auth middleware for normal API requests.
- Login includes plan/addon metadata.
- No notification polling; SSE push + reconnect sync only.
- Browser GET dedupe/cache with write invalidation.
- Dashboard stats query reduced.
