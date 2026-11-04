# Task 204 — Post-release live saved-PDF deletion acceptance

2026-11-04 IST. Base: Release 195 production SHA `1b25dc6fe74c9ba0bac1b337e0e46b9254aba241`. Deployments for branch `test/task204-postrelease-saved-pdf-deletion` disabled in `vercel.json`.

## Verification target
- Use the **already deployed** public `kukureku.com` domain with a fresh isolated Playwright browser and one fictional in-run PDF.
- Verify actual Workspace Health **Delete all saved PDFs** control is present on mobile 390 px.
- Take a private-in-run ZIP backup; show a cancel leaves the file; confirm deletion using the keyboard; verify empty storage after reload; restore the saved version only via an explicit backup user action.
- Check the user-facing warning that external downloads are not deleted.
- No real user file, persisted login or secret, payment, analytics data dump, or server-side mutation beyond ordinary synthetic browser traffic.

## Mandatory acceptance
- New workflow job `Production Live PDF-to-Excel Acceptance` should execute the new live case (16 tests expected total) against the currently live deployment. Count it only if the exact-head CI is green.
- Full Validate and Browser Reliability Smoke (baseline 102 browser tests) on exact branch SHA.
- Confirm no preview or production deployment for this branch. Production Release 195 READY; Release 194/193 available rollback.
- No merge or deployment of this research/test-only PR without a separately reviewed release authorization.

## Boundaries
This one-browser synthetic deletion check does **not** prove cross-tab/device erasure, secure deletion of downloaded archives, all IndexedDB corruption or privacy guarantees. V1 real-document certification and unrelated PDF-to-Excel R&D remain separate. No V1 acceptance is asserted.
