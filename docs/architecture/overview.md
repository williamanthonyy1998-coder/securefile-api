# Architecture

Public website/pricing is the entry point. Signup creates a tenant/company and its Company Admin. The API uses a tenant id on every company-owned resource. Authorization is checked server-side. Super Admin is a platform role and is not treated as a normal company user.

Production topology without Docker:
Browser -> Nginx/HTTPS -> Node.js API + static frontend -> PostgreSQL
File storage: S3-compatible object storage recommended for production.

Tenant rule: every query touching company-owned data must include the authenticated user's companyId unless the role is SUPER_ADMIN.
