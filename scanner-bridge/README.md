# SecureFile Scanner Bridge (Windows WIA)

This optional local service connects a Windows WIA-compatible physical scanner to SecureFile. The browser cannot directly control arbitrary USB/TWAIN/WIA scanners, so the bridge runs on the Windows workstation where the scanner is installed.

## Install

```bat
cd scanner-bridge
npm install
npm start
```

It listens on `http://127.0.0.1:8765`.

Set the main project's `.env`:

`SCANNER_BRIDGE_URL=http://127.0.0.1:8765`

## Scanner modes

- **ADF:** scans the requested number of pages from the automatic document feeder and combines them into one PDF.
- **Flatbed:** scans one page at a time from the flatbed.
- **Duplex:** uses both sides when the scanner driver supports WIA duplex handling.

The SecureFile Scanner module also has a **Mobile Camera** mode. On a phone, the user can capture pages one-by-one, reorder/remove them, give the final PDF a name, and save all captured pages as one PDF. No scanner-app PDF upload is required.

## SecureFile browser workflow

The SecureFile web app connects to this bridge from the browser. The user can:

1. Connect the physical WIA scanner to the Windows PC.
2. Open SecureFile in Chrome on that same PC.
3. Scan one or more ADF batches (up to 100 pages per batch) or use the flatbed.
4. Review, remove, and reorder scanned pages.
5. Give the final PDF any filename and choose a visible destination folder.
6. SecureFile creates one PDF on the server and stores it as a private `SCAN` file owned by that user.

The file is not visible to other company users unless the owner/admin shares it or grants permission through SecureFile's existing access controls.


## Windows quick start

1. Install the scanner's official Windows WIA driver.
2. Connect and power on the scanner.
3. On the same Windows PC, double-click `start-windows.bat`.
4. Keep that black command window running while scanning.
5. Open SecureFile in Chrome on that same PC.
6. Open **Scan Documents** and click **Check connection**.
7. When it says `Scanner bridge connected`, click **Start Scan**.

If SecureFile still says the bridge is disconnected, open `http://127.0.0.1:8765/health` in Chrome on that PC. If that page does not return JSON, the bridge is not running or Windows/Node is blocking it.
