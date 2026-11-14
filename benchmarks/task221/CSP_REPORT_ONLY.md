# Task 221 — CSP report-only and browser compatibility investigation

**Scope: diagnostic only; draft, no merge/deploy authority.** Existing enforced
frame-ancestor, base-uri, object-src and form-action rules remain unchanged.

## Why report-only first?
The live CSP has no enforced script-src/connect-src/worker-src controls.
A rigid policy could break Next.js hydration, browser-local PDF.js workers,
Tesseract WASM, data/blob image previews, downloads or Vercel Analytics.
This candidate adds a **Content-Security-Policy-Report-Only** header, which
observes violations but blocks nothing. Report-only MUST NOT be described
as preventing exfiltration or XSS.

The browser test observes securitypolicyviolation events on the homepage,
PDF-to-Excel and Redact PDF without capturing document contents, request
bodies, URL paths or private query strings. It emits aggregate
directive/protocol counts. It does NOT prove the policy is safe to enforce.

## Acceptance before any enforced policy
1. Compare report-only results on release builds in Chromium and actual
   iPhone Chrome/WebKit; include synthetic PDF-to-Excel, OCR, redaction,
   offline modes, import/export, image preview and workspace backup.
2. Inventory required third-party origins (including optional Vercel
   analytics). Never permit wildcards merely to silence failures.
3. Keep PDF processing in the browser and verify no PDF contents in
   outgoing third-party requests with an independent network observer.
4. Build a nonce/hash strategy if removing unsafe-inline from Next.js
   bootstrap scripts; consider WASM and blob workers separately.
5. Remove report-only once an **enforced** policy has genuinely passed
   cross-browser and no-regression checks.
6. Publish only after exact-commit tests and production rollback review.

No third-party violation reporting service is enabled, so this adds
no paid API, no user document uploads and no extra observability egress.
