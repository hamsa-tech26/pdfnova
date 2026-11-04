# Task 202 — Independently scoped retention controls (synthetic browser test)

2026-11-03 IST. Proposed deploy-disabled branch `test/task202-retention-surface-independence`, base Release 194 `c3d7a09bf3ee80aad8be81e863978084d62cd591`.

## Verified gap and scope

- Current privacy policy explicitly differentiates browser-saved PDF workspace records, Dashboard recent activity, and intelligence index text, but existing browser tests did not independently demonstrate the different clearing paths.
- One new synthetic Playwright browser case seeds: a Magic Drop saved PDF, a synthetic localStorage recent-file entry, and a synthetic IndexedDB intelligence record. It activates **Clear history** and **Clear intelligence cache** from public UIs and checks saved PDF persists across both actions and reload.
- The test checks that Dashboard history deletion does not clear indexed records, then intelligence deletion clears only the indexed records. No actual user/PDF file is transmitted to CI.
- No changes to production application code, PDF conversion, IndexedDB implementation, PDF-to-Excel R&D, or Engine V4.

## Required verification

- Fresh exact-head Validate, Browser Reliability Smoke (now expected 101 browser tests: 100 production-base checks plus this single new check), and production-dependency audit.
- Inspect test-output receipt `TASK202_RETENTION_SURFACE_INDEPENDENCE`; **NOT VERIFIED** until the job passes.
- Verify new branch produces no Vercel preview or production deploy, and current READY Release 194 remains available for rollback.

## Limitations

- Synthetic directly seeded intelligence/recent history does not prove real OCR accuracy, all corrupted IDB shapes, private window, cross-tab races, browser permissions, or downloaded files and backups deletion.
- Saved-PDF deletion itself is separate [draft PR #165](https://github.com/hamsa-tech26/pdfnova/pull/165) and combined [draft PR #166](https://github.com/hamsa-tech26/pdfnova/pull/166); this isolated test deliberately does not depend on either branch.
- Keep [issue #153](https://github.com/hamsa-tech26/pdfnova/issues/153) V1 NO-GO until real-document and independent checks exist. **NO MERGE / NO DEPLOY** without exact-head release approval.
