# Task 199 — Kukureku V1 readiness evidence checkpoint

Date: 2026-11-02 (IST). Branch: `test/task199-v1-network-privacy-acceptance`.

## Release boundary

- Base production commit: `c3d7a09bf3ee80aad8be81e863978084d62cd591` (Release 194). Its Vercel production deployment was observed READY before this work.
- This branch is test-only and deployment-disabled in `vercel.json`. It must not merge or deploy until exact-head validation, live-domain browser acceptance, and owner review.
- Draft PDF-to-Excel PR #152, unrelated OCR/V4 research, and Smart Scanner PR #129 remain excluded.
- No private/customer PDF data enters GitHub CI, logs or artifacts. The added source PDFs are created from fictional markers within the runner.

## Measured baseline

- `npm ci --no-audit --no-fund`: succeeded (446 locked packages installed at this checkpoint).
- `npm test -- --reporter=dot`: **715/715 unit tests passed in 139 suites** after granting temporary-directory write access. The first read-only attempt failed before running tests and must not be counted as product test failures.
- `npx tsc --noEmit --incremental false`: PASS.
- `npm run check:tools`: PASS, **31** routes/metadata registrations.
- `npm run check:output-evidence`: PASS, **14 PASS / 17 PASS_WITH_WARNING / 0 FAILED** scoped synthetic output claims. This is not 31/31 independently reviewed real-document acceptance.
- `npm audit --omit=dev --json`: **0 production vulnerabilities**.
- Full `npm audit --json`: **18 moderate development-tooling findings**, zero high/critical. Affected transitive `minimatch` copies include 3.1.5 and 10.2.6. This differs from an earlier 16-finding report and needs a current compatible remediation review; no `--force` change was made.
- New local-host Playwright preflight: **2/2 PASS** after exercising Magic Drop upload, ZIP backup, redaction export, and password-protection export. The redaction/protection test saw **70 observable requests, 0 write requests, 0 direct source disclosures**. The test checks original bytes, `%PDF-`, direct base64 and a synthetic marker in URLs/request bodies; it does **not** detect transformed/encrypted leakage or service-worker paths.
- Direct `https://kukureku.com` testing from this runner failed at navigation with `ERR_EMPTY_RESPONSE` before any app code or assertions executed. This is an environment access blocker, not a confirmed product failure. **Hosted exact-head live acceptance remains REQUIRED.**

## Ten target ledger (never infer PASS from an unrun check)

| # | V1 target | Status at this checkpoint | Evidence / next gate |
| --- | --- | --- | --- |
| 1 | Per-tool actual downloaded-file acceptance | INCOMPLETE | Registry 31/31 and internal output evidence 14/17; #57 requires source/output checks for all applicable tools. |
| 2 | Privacy and outbound document-data audit | IN PROGRESS | New synthetic upload/backup/redact/protect browser tests 2/2 local; hosted live run pending, transformed payloads not covered. |
| 3 | Security headers and file/resource limits | INCOMPLETE | Existing live V1 smoke checks header presence; full CSP efficacy, XSS, ZIP/PDF bombs and large inputs remain untested. |
| 4 | Mobile and accessibility | INCOMPLETE | Earlier 100/100 browser regression evidence; physical mobile/browser and screen-reader audit not completed. |
| 5 | Independent exported-file readers | PARTIAL | Existing live redaction, password, backup, forms and XLSX synthetic cases; all-format third-party corpus not complete. |
| 6 | Development dependency advisories | OPEN | 18 moderate dev-tooling; 0 production vulnerabilities. Investigate compatible repair without forcing major upgrades. |
| 7 | PDF-to-Excel original-source review | BLOCKED | PR #152 still draft/NO-GO; required BLS source replay received HTTP 403. No bypass, unqualified auto-export, or broad V4 claim. |
| 8 | Public feature claims and known limits | INCOMPLETE | Privacy page discloses unencrypted backups and analytics; cross-tool OCR/XLSX/compression/signature messaging needs final review. |
| 9 | Final V1 Go/No-Go report | NO-GO | Essential privacy, real-file, mobile and security acceptance still incomplete; Engine V4 certification separately 0/20. |
| 10 | Controlled production release | NOT STARTED | Branch is deployment-disabled; require hosted live evidence, exact-head CI, owner decision and rollback plan before merge. |

## Acceptance gates for Task 199

1. Exact-branch fresh Validate and Browser Reliability Smoke must pass.
2. Hosted `production-live-acceptance.yml` must run the two new tests against **deployed** `https://kukureku.com` plus the existing permanent synthetic acceptance suite. The expected suite count rises from 13 to **15**, but no count is credited until recorded by CI.
3. A failure involving observable source material in network requests is a privacy blocker. No suppression, allowlist or weakening to obtain green. Inspect only synthetic diagnostic counts, not user document bytes.
4. If CI succeeds, report this as *bounded browser request-body privacy evidence*, not a completed independent security audit or V1 launch certification.
5. Leave production Release 194 READY and preserve its predecessor as a rollback candidate. Do not merge this test-only PR automatically.
