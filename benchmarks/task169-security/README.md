# Task 169: Vitest development dependency remediation

Baseline: `c55ea065a8c3435fbb7f301dde2a943c4495efc5`, verified as GitHub
`main` and Vercel's READY production deployment
`dpl_7viFHtRoyBvrg7WUSwSjFsc4Kkji` on 2026-10-23. This repository's
package name is `kukureku`; no separate PDFNova product was modified.

## Engineering ledger

| Work | Root cause | Changed files | Measurement / regressions | Status |
| --- | --- | --- | --- | --- |
| Task 169 Phase 1 | Vitest 4.1.11 resolves vulnerable @vitest/mocker | package.json, package-lock.json | Two moderate full-tree findings before; zero after. All 703 unit tests and 145 explicit OCR regressions pass. | Implemented; draft review only |
| Development deployment safety | Git integration can build pushed branches | vercel.json | This branch is disabled before its first push. | Implemented |

Vitest and its seven `@vitest/*` companions move from 4.1.11 to 4.1.12.
The direct dependency is exactly pinned. Advisory IDs:
`GHSA-qxg6-89mg-rqv8` (manual mock registration injection) and
`GHSA-xp26-3454-mjgp` (Windows redirect allowlist traversal).
The previous patch `622d062` is absent locally and GitHub returns 422 for it;
this fix was rebuilt from verified production main.

The lockfile was regenerated with npm 11.9.0; non-Vitest entries were retained
from the baseline to avoid unrelated Chai/tinyrainbow updates or platform
metadata churn. A subsequent clean `npm ci --no-audit --no-fund` succeeds.
Every non-Vitest lock entry, including all production packages, is unchanged.
Next.js and eslint-config-next remain exactly 16.4.2; Vite remains 8.2.4.
No advisory suppression or audit threshold change.

## Executed verification

- Full npm audit: **0** reported vulnerabilities after clean installation.
- Production npm audit (`--omit=dev`): **0** reported vulnerabilities.
- Unit tests: **139 files / 703 tests PASS**.
- Explicit OCR / Phase 10.14 regressions: **145 tests PASS**.
- ESLint: **0 errors**, **25 pre-existing warnings**.
- Production build (Next.js 16.4.2): **PASS**.
- TypeScript (`tsc --noEmit` after build): **PASS**.
- Next.js/Vite baseline checks, 31-tool registry, scoped output-evidence
  completeness, generated golden source invariants, whitespace checks: PASS.
- Production-build browser smoke and draft-PR CI results are recorded in the PR
  after execution; do not infer their result from the unit tests.

## Production observations and limitations

Vercel's project aliases include kukureku.com and www.kukureku.com; the latest
production deployment maps to the baseline SHA above. The 24-hour runtime error
query returns no errors. This is a bounded log observation, not availability
or global reliability certification.

Direct custom-domain HTTPS and Hugging Face corpus requests are denied by the
environment proxy with CONNECT 403. The rollback-filter query separately
returns an authenticated Vercel authorization error: GET /v7/deployments,
resource `deploymentRollback`, request
`bom1:sfo1::j72nq-1792742801320-001f429ffc8a`. Ordinary deployment listing
succeeds and reports rollback candidates; that does not establish mutation
permission. No Vercel CLI or Vercel token binding is available for the mapped
fallback. No rollback was attempted.

PR #117 and issues #38, #55, #70, #75 were inspected. Existing localization
results remain historical: development 6/6, exposed regression 6/8 with two
misses and one unmatched prediction. Original PDFs and source/reference image
identity are unavailable locally. No speculative detector change, fresh
held-out accuracy claim, cell correctness claim, or qualification credit is
made. Existing 31-tool evidence is scoped synthetic coverage, not completion
of real-world acceptance. Engine V4 Stable remains **0/20**.

No merge, preview deployment or production deployment is authorized by this
change. The next source-accuracy task is visual adjudication of Samples 5,
8 and 9 using authorized originals and verified reference transforms, followed
by independent cell/output references and genuinely untouched documents.
