# Completion roadmap

This source tree covers the core application workflow and the integration boundaries. Before calling the service production-ready, finish and verify:

1. Email verification and invitation delivery with a real transactional provider.
2. Password reset tokens with database persistence and expiry.
3. Stripe Checkout + signed webhook verification + renewal events.
4. S3 object storage and signed downloads.
5. Complete permission inheritance for folders and nested resources.
6. File preview handlers for supported document/image types.
7. Public share route with token, password, expiry and revocation.
8. Approval-to-permission workflow.
9. Group chat and attachments.
10. Scanner/fax provider integration.
11. AI provider integration with tenant-safe context.
12. Automated unit/integration/e2e tests and security testing.
13. Observability, backups, disaster recovery and deployment hardening.
