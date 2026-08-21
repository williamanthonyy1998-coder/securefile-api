# Scanner + Fax Update — 2026-08-21

## Scanner

1. Physical Windows WIA scanner is supported through `scanner-bridge/`.
2. Scanner page now has two modes:
   - Connected Scanner
   - Mobile Camera
3. Connected Scanner supports ADF, Flatbed, page count, DPI, color mode and duplex.
4. The scanner bridge combines all pages into one PDF.
5. User can give the final PDF a name before saving.
6. Mobile Camera captures page-by-page, lets the user remove/review captured pages, and saves all captured pages as one PDF.
7. Scanner-created PDFs are stored as normal SecureFile files with source `SCAN` and consume company storage.

## Fax

1. Fax jobs are stored in the database and no longer fail because scanner/fax models are missing.
2. Outbound fax requires `FAX_PROVIDER_URL`, `FAX_PROVIDER_API_KEY` and `FAX_FROM_NUMBER`.
3. SecureFile sends a provider-neutral JSON contract to the configured fax adapter.
4. Job statuses are recorded as QUEUED, SENDING, SENT or FAILED.
5. Incoming fax webhook stores the fax in Files and records a RECEIVED job.
6. Fax is only available to plans with the fax entitlement.

## Database

A dedicated migration creates `ScanJob`, `FaxJob`, `ScanJobStatus` and `FaxJobStatus`/`FaxDirection` structures. Existing data is not reset.
