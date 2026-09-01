# SecureFile Mobile Scanner Update — 2026-09-01

## What changed
- Desktop/Windows scanner workflow remains intact.
- On screens <= 600px, the Windows scanner panel is replaced by a dedicated Mobile Scanning panel.
- Mobile camera scanning uses the rear/environment camera through `getUserMedia()` over HTTPS.
- Users can capture multiple pages, review/reorder/remove them, and save the complete draft as one PDF using the existing SecureFile upload flow.
- Flash/torch control is shown when the phone browser exposes the torch capability.
- Added a Web Bluetooth option for BLE scanners. The browser connects to a BLE GATT device and listens for JPEG image data on notifiable/readable characteristics.

## Bluetooth compatibility note
There is no universal browser standard for document-scanner Bluetooth image transfer. Many scanners use proprietary Bluetooth profiles or classic Bluetooth serial protocols that Chrome mobile cannot access as a document-image stream. SecureFile therefore only receives Bluetooth scans when the device exposes scan data through a browser-readable BLE GATT characteristic. The phone camera scanner is the universal mobile fallback.

## Browser requirements
- Camera: HTTPS/secure context and camera permission.
- Web Bluetooth: supported browser/device, Bluetooth enabled, and a BLE scanner exposing a GATT data characteristic.
- On iPhone/iPad, Web Bluetooth support is limited; use the camera scanner unless the installed browser/device explicitly supports Web Bluetooth.

## Existing desktop scanner
The Windows WIA Scanner Bridge is unchanged and continues to handle WIA scanners, ADF, flatbed, duplex where exposed by the driver, DPI, and color modes.
