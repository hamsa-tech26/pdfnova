# Task 203 — One candidate with all browser-local V1 privacy controls

2026-11-04 (IST). Integration into open draft PR #166 only. Base production Release 194: `c3d7a09bf3ee80aad8be81e863978084d62cd591`.

## Inherited independent evidence

- PR #164 live network-privacy audit: two synthetic browser-only observer tests covering Magic Drop/backup and redaction/protection.
- PR #165 confirmed saved-PDF removal action: confirmation, cancellation, persistence across reload, mobile/keyboard confirmation, backup restoration.
- PR #167 independently verified Dashboard recent-history and intelligence-cache clearing; explicit synthetic records proved both stores can be cleared while saved PDFs remain. Final exact head `46319af05eb11c354cfdab080b3dbe5af651d881`, Validate PASS and Browser 101/101 PASS. The browser suite on this combined candidate should include 102 cases (101 from PR #166 plus this independent new test).

## Combined scope, safety, and required gates

- Add `e2e/workspace-retention-surfaces.e2e.mjs` and its bounded evidence note unchanged from PR #167 into PR #166.
- Preserve existing product deletion UI and all previous network/PDF-output assertions. Keep deployment disabled on PR #164, #165, #166 and #167 branches.
- Run fresh exact-head Validate (unit/OCR/TypeScript/lint/build/audits), Browser Reliability 102/102 expected, and 15-test live synthetic acceptance against **currently deployed Release 194**. Count only actual results.
- Recheck Vercel: no branch preview/production deployment; retain Release 194 READY and Release 193 rollback.
- Do not merge/deploy without owner exact-commit authorization and post-release smoke.

## Remaining blockers (not accepted)

- These are synthetic browser tests and partial network observations; not broad real-document acceptance, physical mobile/screen-reader evidence, comprehensive transformed-data egress coverage, or independent penetration testing.
- General 31-tool real-document outputs, stored data on other devices/tabs and complete retention erasure are unverified.
- PDF-to-Excel research PR #152 is on hold for official BLS source HTTP 403; do not merge or bypass research gates.
- Engine V4 Stable external certification remains 0/20; full dependency tree still reports 16 moderate dev-tooling advisories at the last verified snapshot. No V1 acceptance is claimed.

**Release decision: DRAFT / NO MERGE / NO DEPLOY until full combined CI and exact-head review.**
