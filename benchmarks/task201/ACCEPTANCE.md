# Task 201 — Combined Kukureku V1 privacy/retention candidate

Date: 2026-11-03 (IST). Draft only, no merge or production deployment.

## Exact source inputs

- Release 194 production base: `c3d7a09bf3ee80aad8be81e863978084d62cd591`.
- Privacy/network tests: PR #164 exact head `0ed041b4c4bd80fe021916c4d76bf698e582257f`, 15/15 live synthetic acceptance, Validate and Browser Reliability green.
- Confirmed workspace deletion UI: PR #165 exact head `855834ccab983617d930425f72fec537211ec202`, 101/101 hosted browser and Validate green.
- This candidate combines those two verified scopes, preserving both source histories by exact content blobs. No broader PDF-to-Excel PR #152, Engine V4 research, Smart Scanner, payment/auth or customer files.

## Safety and release gate

1. Deployment disabled on the two source branches and this integration branch in `vercel.json`; no preview/production build may be triggered by branch creation.
2. Run fresh exact-head Validate (unit, OCR, TypeScript, lint, build, registry, audits), Browser Reliability Smoke including mobile/keyboard deletion, and the live-production 15-test synthetic acceptance against the **existing Release 194 website**.
3. Record actual workflow job counts and failures. Do not credit historical source-branch test results as integration-commit passes.
4. Review both scopes together for the prospective one-deployment release; preserve Release 194 READY and Release 193 rollback.
5. The full 31-tool real-document matrix, 18 moderate dev tooling advisories, privacy threat model, physical-mobile accessibility, and independent V4 Stable 0/20 remain open. Do not declare V1 accepted based solely on this batch.
6. Do not merge or deploy without exact-commit review and the product owner's release authorization. A no-go is the correct result if any gate fails.

## Change inventory

- Adds live document-data egress observation for Magic Drop upload, backup, redaction and Protect PDF using synthetic files.
- Adds a confirmation-gated browser-saved-PDF deletion UI with separate warnings for downloads, recent activity and indexed text, plus mobile keyboard and recovery checks.
- Adds only test selection/workflow/evidence documentation and deployment-guard entries otherwise.
