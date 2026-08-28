# SecureFile real-time architecture

Browser -> authenticated SSE stream -> Express API -> realtime event hub.

Database writes remain the source of truth. SSE is only the delivery channel; refreshing the page always reloads the authoritative database state.

Notification flow:
1. A route performs its normal database operation.
2. `notify()` stores a durable Notification row.
3. `notify()` immediately emits the same event to the user's open SSE connections.
4. The frontend shows an in-app toast, updates the badge, and refreshes the active chat/mail screen.
5. If browser notification permission is granted, a native browser notification is also shown.

Email flow:
1. SecureFile sends the email through the configured provider.
2. For an internal SecureFile user, the email is mirrored into EmailMessage.
3. The recipient gets a realtime `mail.received` event.

This means realtime delivery does not replace database persistence.
