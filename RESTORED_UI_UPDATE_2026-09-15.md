SecureFile restored professional UI build.

Base: full professional/auth/dashboard/user-management source with avatar + 2FA support.
Restored: AuthShell auth pages, dashboard/sidebar/topbar styling, user profile photo, 2FA QR setup, role/plan display rules, page-specific skeleton loaders, sticky folder/settings navigation, compact Socket.IO notification center/toast, and professional modal styling.
Notification transport: Socket.IO only for workspace notifications; legacy SSE realtime notification route/service removed.
No .env files are included in this ZIP. Keep your existing environment files.
No database reset is required for this UI merge.
