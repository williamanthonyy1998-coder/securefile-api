# SecureFile session + preview fix

- Access JWT lifetime is 7 days.
- Private preview uses the authenticated `/files/:id/preview` endpoint and a browser Blob URL instead of a 5-minute Supabase signed URL.
- Private downloads continue through the authenticated `/files/:id/download` endpoint.
- No database reset or migration is required.
- Source code remains TypeScript; backend package metadata is aligned with the existing CommonJS TypeScript build so compiled JS is not treated as ESM.
