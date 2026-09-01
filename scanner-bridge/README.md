# SecureFile Universal Scanner Bridge (Windows)

The bridge connects SecureFile to Windows scanners through multiple interfaces instead of assuming every scanner is WIA-only.

## Supported interfaces

- **WIA** — direct Windows Image Acquisition fallback.
- **TWAIN** — through NAPS2 on Windows.
- **eSCL** — through NAPS2 for compatible modern network scanners.
- **ADF / flatbed / duplex**, when the selected scanner/driver exposes the capability.
- Multiple pages (up to 100 per batch in the SecureFile UI).

NAPS2 officially supports WIA, TWAIN and eSCL on Windows, and its CLI can enumerate devices and select a driver/device for scanning. citeturn0search0turn0search2

## Windows setup

1. Install the scanner manufacturer's Windows driver/software.
2. Install **NAPS2** on the scanner PC for the broadest compatibility (WIA/TWAIN/eSCL).
3. Connect/power on the scanner.
4. Run `start-windows.bat`.
5. Open SecureFile on that same Windows PC.
6. Go to **Scan Documents** and click **Refresh scanners**.
7. Select the actual scanner and driver (`Auto`, `WIA`, `TWAIN`, or `eSCL`).
8. Select ADF/Flatbed, DPI, color mode and duplex, then **Start Scan**.

The bridge still has direct WIA fallback if NAPS2 is not installed. For TWAIN/eSCL, NAPS2 is required.

## Important limitation

No browser bridge can honestly guarantee every scanner model. Compatibility depends on the Windows/vendor driver or network protocol exposed by the hardware. NAPS2's own documentation recommends switching between WIA and TWAIN if a device is not visible, and eSCL is intended for modern network scanners. citeturn0search1turn0search2
