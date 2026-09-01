# SecureFile Mobile Scanner + Mobile Navigation Update

## Mobile layout
- At <=600px, the desktop fixed/collapsed sidebar is replaced with an off-canvas mobile drawer.
- The main app uses the full viewport width.
- A hamburger button opens the full navigation drawer.
- Tapping the backdrop or any navigation item closes the drawer.
- Logout remains inside the drawer at the bottom.

## Scan Documents on mobile
- Windows physical scanner controls remain desktop-only.
- Mobile users see the dedicated phone scanning area.
- Phone camera scanner uses the rear camera, supports multiple captured pages, optional torch control, page preview/reorder/remove, and saves the same combined PDF workflow.
- Bluetooth scanner option remains available for compatible BLE/GATT scanners supported by the mobile browser.

## Important browser limitations
- Camera scanning requires HTTPS (localhost is also allowed by browsers).
- Web Bluetooth is browser/device dependent. Chrome on Android is the primary target for BLE GATT scanners.
- Bluetooth scanners using proprietary/classic Bluetooth protocols cannot be made universally readable by a normal mobile browser without a vendor SDK/native bridge.

## Run
1. Extract this project.
2. Run the existing backend/frontend setup exactly as before.
3. For mobile, open the deployed HTTPS SecureFile URL on the phone.
4. Go to Scan Documents. The physical Windows scanner panel will not be shown on mobile; use Phone Camera or Bluetooth Scanner.
