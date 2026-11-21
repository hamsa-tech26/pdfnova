# Task 273 — Merge PDF ordering, output integrity and CSP egress

**DRAFT / NO MERGE / NO DEPLOY.** Test-only continuation after Task 272 protect/unlock acceptance.

## Scope
- Generate three independent one-page synthetic PDFs with unique markers in ephemeral CI.
- Exercise live browser-local `/merge-pdf`; upload all three files, reorder C to the first position using the real Move Up controls, and merge the selected sequence **C → A → B**.
- Independently inspect the downloaded PDF with pdf-lib and PDF.js; require exactly three pages, A4/Letter dimensions as expected, and all three markers exactly once in the user-selected order.
- Observe only resource type/method/origin categories and outbound write-body matches for each source PDF, base64 and marker. Never log raw URLs, request bodies or PDF bytes.
- Inject candidate CSP only as a document-scoped **Report-Only** header; no external report collector or enforcement.
- Run Chromium and Linux Playwright WebKit at 390×844.

## Privacy and release boundaries
- Synthetic source PDFs only; no customer/private files, credentials or persistent CI document data.
- No application runtime, merge engine, storage, production CSP, upload endpoint or content changes.
- Direct source-byte/base64/marker scans do not exclude transformed/encrypted egress. Linux WebKit is not physical iPhone certification.
- This complements, but does not replace, the earlier mobile page-integrity merge tests.

**DRAFT / NO MERGE / NO DEPLOY.** Preserve the existing READY production deployment and Vercel automatic-deployment hold. Release 216 remains paused; Engine V4 Stable remains 0/20. No paid services or external storage.
