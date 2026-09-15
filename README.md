SecureFile — Dashboard Team Presence Update

Merge these files into the existing project:
- frontend/src/pages/Dashboard.tsx
- frontend/src/styles/features.css
- backend/src/sockets/socket.server.ts

Changes:
- Dashboard team avatars are circular.
- Green presence dot only when the user is actually online through Socket.IO.
- Offline users show a grey dot.
- Added a Socket.IO presence snapshot request so an already-connected dashboard gets an accurate initial presence state.
- No other dashboard/team functionality intentionally changed.
