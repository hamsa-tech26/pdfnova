# Task 274 — Split PDF page-range validation, output integrity and CSP egress

**DRAFT / NO MERGE / NO DEPLOY.** Test-only continuation after Task 273 merge acceptance.

## Scope
- Generate a four-page synthetic PDF with a unique marker on each page inside ephemeral CI.
- Exercise live browser-local `/split-pdf`; submit invalid range `1,5` and require a visible range error with **zero downloads**, then submit valid range `1,3-4`.
- Independently inspect the actual downloaded PDF with pdf-lib and PDF.js; require exactly three pages, preserved 612×792 pt page sizes and markers from source pages 1, 3, 4 exactly once in order.
- Observe only resource type/method/origin categories and outbound write-body matches for original PDF bytes, base64, signature and markers. Never log raw URLs, request bodies or PDF bytes.
- Inject candidate CSP only as a document-scoped **Report-Only** header; no external collector or enforcement.
- Run Chromium and Linux Playwright WebKit at 390×844.

## Privacy and release boundaries
- Synthetic source PDF only; no customer/private documents, credentials or persistent CI document data.
- No application runtime, split engine, storage, production CSP or upload endpoint changes.
- Direct source-byte/base64/marker scans do not exclude transformed/encrypted egress. Linux WebKit is not physical iPhone certification.
- This supplements the prior page-integrity and extraction checks.

**DRAFT / NO MERGE / NO DEPLOY.** Preserve the existing READY production deployment and Vercel automatic-deployment hold. Release 216 remains paused; Engine V4 Stable remains 0/20. No paid services or external storage.
