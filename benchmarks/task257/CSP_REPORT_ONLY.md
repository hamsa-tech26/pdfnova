# Task 257 — CSP report-only compatibility exploration

**DRAFT / NO MERGE / NO DEPLOY.** Source `4d41cdf36c2319f59ec8b5c35d4a999799010802`; no production runtime modifications.

A scoped Playwright Chromium synthetic PDF-to-Excel test inserts a **report-only** CSP header *only into the local test browser's intercepted HTML response* and records aggregated `securitypolicyviolation` events. No enforcement, no external reporting endpoint, no user documents, and no changes to the deployed Vercel project. Synthetic input triggers browser-local PDF setup.

The candidate policy constrains scripts/connect to self and permits blob workers and data/blob images. Output is grouped directive/origin/count only, without request paths, PDF bytes, cookies, or raw URLs. This evidence is **not** approval for production CSP; Next.js inline scripts, analytics, PDF.js workers, OCR and other tools need broader verification. A single successful synthetic Chromium route is not all-31-tool or physical-iPhone certification.

Require exact-head `Production CSP Report-Only Observation`, `Validate`, `Browser Reliability Smoke`. If the test fails, investigate without weakening existing privacy controls. Engine V4 Stable remains 0/20; Release 216 remains paused; automatic Vercel builds and previews stay held.
