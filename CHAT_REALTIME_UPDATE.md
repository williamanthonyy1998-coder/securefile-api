# SecureFile Chat Realtime Update

Implemented on the current base project:

- Socket.IO chat connection with automatic reconnect.
- Real-time new messages without refresh/polling.
- Typing indicator with server-side room authorization and no DB lookup per keystroke.
- Online/offline presence per company, including multi-tab/device safe offline detection.
- Sent check, delivered double-grey check, and read double-blue check.
- Read receipts persisted using existing ConversationParticipant.lastReadAt; no schema change required.
- Messages are delivered to the recipient's private Socket.IO room even when they are viewing another module.
- Chat navigation highlights when a new chat/email activity arrives.
- Existing HTTP message endpoint remains as a fallback for clients where Socket.IO is unavailable.
- Company isolation is maintained for presence and conversation authorization.

The frontend loads Socket.IO client 4.8.1 from the official CDN. Production should set VITE_SOCKET_URL to the public HTTPS/WSS API host.
