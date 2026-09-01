# Universal Scanner Bridge Update — 2026-09-01

The Windows bridge is no longer WIA-only.

## Backend order
- AUTO: native WIA first, then TWAIN fallback through NAPS2.
- WIA: native Windows Image Acquisition.
- TWAIN: NAPS2 command-line backend.
- eSCL: NAPS2 network scanner backend when the device exposes eSCL.

## Why NAPS2 is used
Windows scanners commonly expose WIA and/or manufacturer TWAIN drivers. NAPS2 supports WIA, TWAIN and eSCL and exposes a command-line interface, so SecureFile can keep the scanner workflow inside the browser while the local bridge performs the privileged hardware operation.

## Installation
Install the manufacturer's official Windows driver and NAPS2 8.3.2 or newer on the scanner PC. Then start `start-windows.bat`.

The SecureFile page now has:
- Scanner/device selector
- Driver selector (Auto, WIA, TWAIN, eSCL)
- Refresh scanners
- Existing ADF/flatbed/duplex/DPI/color settings

## Compatibility
This is designed for broad compatibility across Canon, Brother, HP, Epson, Fujitsu/Ricoh, Kodak Alaris and other scanners that expose a Windows-supported WIA/TWAIN/eSCL interface. It cannot bypass a manufacturer that provides no compatible Windows driver/protocol.
