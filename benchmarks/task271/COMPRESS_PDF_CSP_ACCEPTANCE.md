# Task 271 — Compress PDF output fidelity, image-only rasterization and CSP egress

**DRAFT / NO MERGE / NO DEPLOY.** Test-only continuation after Task 270's Word-to-PDF acceptance.

## Scope
- Synthetic text PDF: two pages, repeated compressible content, unique page-boundary markers. Exercise Medium compression, download the real output, independently parse it with pdf-lib and PDF.js, require both pages and exact-once marker order, and require a smaller output.
- Synthetic image-only PDF: deterministic high-entropy PNG embedded in a one-page PDF, no text or annotations. Exercise High compression, independently parse the downloaded output, require one page, no text/annotations, smaller output, and the product's explicit rasterization warning. This verifies that the app signals the loss of selectable text and non-page structures for its visual-compression path.
- Observe only resource type/method/origin category and outbound write-request body matches for source PDF bytes, base64, signature and known markers. Do not log URLs, headers, bodies, source bytes or customer data.
- Inject the candidate CSP only as a document-scoped **Report-Only** response header. No external collector or policy enforcement.
- Run both cases independently in Chromium and Linux Playwright WebKit at 390×844.

## Release and privacy boundaries
- Synthetic fixtures generated inside ephemeral GitHub Actions only; no user uploads or persistent documents.
- No Next.js app, compression engine, runtime, data store, production CSP, upload endpoint or site content changes.
- Linux WebKit is not physical iPhone certification. Direct byte/base64/signature/marker scans do not prove absence of transformed or encrypted egress. The synthetic image case does not certify visual quality or OCR preservation.
- Require both browser workflows to pass at the exact head. Keep this research branch excluded from Vercel automatic deployment.

**DRAFT / NO MERGE / NO DEPLOY.** Preserve the existing READY production deployment and Vercel automatic-deployment hold. Release 216 remains paused; Engine V4 Stable remains 0/20. No paid services or external storage.
