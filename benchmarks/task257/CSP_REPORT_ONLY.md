# Task 257 — CSP report-only compatibility exploration

**DRAFT / NO MERGE / NO DEPLOY.** Source `4d41cdf36c2319f59ec8b5c35d4a999799010802`; no production runtime modifications.

A scoped Playwright Chromium synthetic PDF-to-Excel test inserts a **report-only** CSP header *only into the local test browser's intercepted HTML response* and records aggregated `securitypolicyviolation` events. No enforcement, no external reporting endpoint, no user documents, and no changes to the deployed Vercel project. Synthetic input triggers browser-local PDF setup.

The candidate policy constrains scripts/connect to self and permits blob workers and data/blob images. Output is grouped directive/origin/count only, without request paths, PDF bytes, cookies, or raw URLs. This evidence is **not** approval for production CSP; Next.js inline scripts, analytics, PDF.js workers, OCR and other tools need broader verification. A single successful synthetic Chromium route is not all-31-tool or physical-iPhone certification.

Require exact-head `Production CSP Report-Only Observation`, `Validate`, `Browser Reliability Smoke`. If the test fails, investigate without weakening existing privacy controls. Engine V4 Stable remains 0/20; Release 216 remains paused; automatic Vercel builds and previews stay held.

## Task 263 — 31-tool entry-page inventory

Extended the original report-only test to **all 31 registered public tool entry routes**, checking that the static candidate policy is inserted into each HTML document in a synthetic Chromium browser. The test only observes each route's initial scripts/resources, not file conversion or actual user documents. It records **route, aggregate directive/destination/count** and deliberately omits full URLs, query strings, cookies, PDF bytes, personal identifiers and stored customer data. Insertion of policy remains **browser-only and report-only**, with no external reporting endpoint.

Original Task 257 PDF-to-Excel synthetic-input run: **4 inline script events and 1 Next.js static-chunk eval event** under `script-src 'self'`. These are evidence that the exact strict candidate is **not ready for enforcement**, not a security breach. Do not blindly add `unsafe-inline`/`unsafe-eval` to production. New entry-page observations will distinguish which routes require nonce/hash or bundled worker investigation. Results are diagnostic only; further document-processing and WebKit coverage remain before any proposed policy change.

Run `Production CSP Report-Only Observation`, `Validate` and `Browser Reliability Smoke` at the exact new head. No runtime modifications, merge, previews or Release 216 deployment.


## Task 264 — privacy-safe CSP source attribution

Extended the 31-entry-page observation to classify each report-only event using a fixed source-category allowlist: `page-inline`, `next-static`, `next-runtime`, `same-origin-other`, `external`, `blob-worker-or-script`, or `unknown`. A numeric source line is retained only as a diagnostic. Raw `sourceFile` values, source URLs, host/path/query strings, request payloads and document content are never written to the report.

This distinguishes Next.js page bootstrap from same-origin static/runtime script events without turning CSP diagnostics into a URL or document-content log. The candidate policy remains browser-injected **report-only**; this task does not add a production header, collector, nonce, hash, exemption, or enforcement change.

Require exact-head `Production CSP Report-Only Observation`, `Validate`, and `Browser Reliability Smoke`. Task 264 remains diagnostic only: it does not prove processing-time worker/connect compatibility or Linux WebKit compatibility. Release 216 remains paused and Engine V4 Stable remains 0/20.


## Task 265 — Linux WebKit report-only entry-page parity

Added a second Playwright configuration using Linux WebKit at a 390×844 viewport. It reuses the same synthetic-only report-only suite as Chromium: one PDF-to-Excel page initialization with a synthetic PDF upload, followed by the registered public entry-page inventory. Each page must return HTTP 200 and receive the browser-intercepted candidate `Content-Security-Policy-Report-Only` header. Event output retains only the Task 264 allowlisted source category, directive, disposition, destination class and numeric line; no raw source URL, request body, PDF bytes or user document is recorded.

The workflow uses the already-deployed `https://kukureku.com`; it does not create a Vercel preview or deploy. Linux Playwright WebKit at a mobile-sized viewport is **not** a physical iPhone. This is startup/entry-page coverage only: it does not certify all 31 tools' processing-time worker/connect paths, real customer PDFs, or strict CSP enforcement. Task 266 remains the next priority for bounded synthetic PDF-to-Excel processing-time worker/connect observation.

Require exact-head `Production CSP Report-Only WebKit Observation`, Chromium `Production CSP Report-Only Observation`, `Validate` and `Browser Reliability Smoke`. Release 216 remains paused; Engine V4 Stable remains 0/20.
