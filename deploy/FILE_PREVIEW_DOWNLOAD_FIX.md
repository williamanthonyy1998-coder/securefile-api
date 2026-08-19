# File Preview / Download Path Fix

Fixed the Windows `res.sendFile` error:
`TypeError: path must be absolute or specify root to res.sendFile`.

`UPLOAD_DIR` is now normalized to an absolute path during environment parsing. This applies consistently to authenticated file download/preview and other storage operations.

The authenticated download endpoint preserves the original uploaded filename via `Content-Disposition`.
