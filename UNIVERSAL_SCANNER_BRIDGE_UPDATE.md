# Universal Scanner Bridge Update

This update replaces the previous WIA-only assumptions with a device-aware bridge.

### Desktop Windows
- Refresh and select a real scanner device.
- Driver options: Auto, WIA, TWAIN, eSCL/Network.
- Direct WIA fallback remains available.
- NAPS2 is detected automatically from standard Windows installation locations or PATH.
- NAPS2 device enumeration covers WIA, TWAIN and eSCL.
- Auto mode can fall back from direct WIA to NAPS2 WIA/TWAIN/eSCL when a compatible device is exposed.
- ADF, flatbed, duplex, DPI and color settings are passed through.

NAPS2 documents WIA/TWAIN/eSCL support and CLI device selection. Install it on the Windows scanner PC for the broadest compatibility. urlNAPS2 Windows scanning documentationhttps://www.naps2.com/windows-scanning

### Mobile
The existing mobile flow remains:
- Phone rear-camera scanning
- Multiple pages in one draft
- Remove/reorder pages
- BLE scanner option where the device exposes browser-readable GATT scan data
- Same final PDF save flow

### Important
A universal bridge cannot bypass missing/unsupported vendor drivers. A scanner must expose WIA/TWAIN/eSCL (or another supported interface) through Windows/network. NAPS2 itself recommends trying WIA or TWAIN when a device is not listed and uses eSCL for modern network scanners. urlNAPS2 profile settingshttps://www.naps2.com/doc/profile-settings
