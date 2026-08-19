# Security checklist

- Passwords hashed with bcrypt.
- Short-lived JWT access token.
- Helmet, CORS and rate limiting enabled.
- Server-side tenant scoping in company routes.
- Resource ownership/share checks for file downloads/deletes.
- Upload size limit.
- Never trust client-supplied company IDs.
- Use signed object-storage URLs for production files.
- Add malware scanning and file-type policy before exposing arbitrary uploads publicly.
- Add refresh-token rotation, email verification, password-reset tokens with expiry, CSRF strategy where cookie auth is used, and full audit coverage before production launch.
