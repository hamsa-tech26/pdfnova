# Task 253 — Public security-header baseline

**DRAFT / NO MERGE / NO DEPLOY.** Production source: `4d41cdf36c2319f59ec8b5c35d4a999799010802`. Release 216 is paused.

Tests all **31 registered public tool routes**, the homepage and Workspace Health (33 total) using only GET and no user document. Require HTTP 200, `nosniff`, `DENY`, referrer and permissions policies, plus existing CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`. Tests fail closed if baseline headers are lost.

**Known CSP hardening gap, not an observed breach:** The current source has no `script-src`, `connect-src` or `worker-src` restriction. Before adding, inventory all Next.js scripts, PDF/Blob/WASM workers, OCR assets and analytics, and run complete 31-tool and full browser acceptance. A sudden global `default-src 'none'` would risk disabling processing. Header regression success alone does not prove privacy, data exfiltration resistance, forensic sanitization, or a full penetration test.

Dedicated test plus Validate and Browser Reliability Smoke must pass on the exact head. No release, Vercel preview, paid services, customer uploads or certification claim. Formal V4 Stable remains 0/20.
