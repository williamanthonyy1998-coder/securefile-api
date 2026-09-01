# SecureFile — Realtime Notifications + Browser Scanner Update

## Notifications

- Notification center now returns and displays **unread notifications only**.
- Reading a notification removes it immediately from the notification list.
- **Read all** clears the notification list immediately.
- Read/read-all state is pushed to other active SecureFile browser sessions over the same realtime SSE channel.
- New notifications are delivered immediately on the active API instance.
- A 2-second server-side database fallback keeps realtime delivery working across separate API instances/serverless executions.
- The frontend has a 3-second reconciliation fallback so a notification read in another tab/server instance disappears automatically.
- Browser EventSource reconnects automatically if the realtime connection drops.
- No database reset or schema change is required for this update.

## Scanner

- Windows scanner bridge now has explicit browser CORS + Chrome Private Network Access support for HTTPS SecureFile deployments.
- Bridge exposes `/health` and `/devices` diagnostics.
- WIA scanner output is explicitly requested as JPEG.
- If a scanner driver ignores the requested JPEG format, the bridge uses the WIA Convert filter to convert the image to JPEG before sending it to the browser.
- ADF supports 1–100 pages per batch; the browser can use **Scan More Pages** for additional batches.
- Flatbed remains one page per scan.
- Duplex is requested when enabled and supported by the WIA driver.
- The bridge has a longer scan timeout so large batches are not killed by a short HTTP timeout.
- Scanner failures now return clearer diagnostics for missing WIA devices, empty scans, and non-JPEG output.

## Run locally

### Main project

```bat
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix website install
npm run dev
```

### Windows scanner bridge

On the same Windows PC that has the physical scanner installed:

```bat
cd scanner-bridge
npm install
npm start
```

Keep that command window open while scanning.

Default bridge URL:

`http://127.0.0.1:8765`

Then open SecureFile in Chrome on the same Windows PC and go to **Scan Documents → Check connection → Start Scan**.

For production, keep:

`VITE_SCANNER_BRIDGE_URL=http://127.0.0.1:8765`

The browser and physical scanner must be on the same Windows workstation because browsers cannot directly control arbitrary WIA/TWAIN USB scanners.
