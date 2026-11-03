# Task 200 — Explicit saved-PDF deletion control

2026-11-02 (IST). Branch: `fix/task200-delete-saved-workspace-pdfs`, based on Release 194 commit `c3d7a09bf3ee80aad8be81e863978084d62cd591`.

## Verified problem

The published privacy policy instructs users to use the workspace removal control to delete saved PDFs. The Workspace Health interface on Release 194 does not expose that control, although `clearWorkspaceFiles()` exists in the browser-local persistence module. Clearing dashboard recent activity and intelligence cache is not equivalent to deleting saved PDF files. This is a privacy/retention user-experience gap, not evidence of uploaded or leaked files.

## Proposed isolated change

- Add a **Delete all saved PDFs** action to Workspace Health, disabled when no PDFs exist or a backup operation is active.
- Require a separate explicit **Confirm delete all saved PDFs** action; Cancel has no side effects.
- Use existing `clearWorkspaceFiles()` to remove saved PDF versions, metadata, active selection and workflow-recipe progress; refresh the displayed inventory.
- Explain that downloads/backups on the user's device, Dashboard recent activity and indexed intelligence text are unaffected and need separate cleanup.
- Add one synthetic browser regression that checks cancellation, confirmed removal after reload and explicit restore from an earlier ZIP backup.
- Deployments for this branch disabled in `vercel.json`; no research/XLSX/V4 modifications or real customer file use.

## Local evidence

- `npx eslint app/(workspace)/workspace-health/page.tsx e2e/workspace-saved-pdf-deletion.e2e.mjs`: PASS.
- `npx tsc --noEmit --incremental false`: PASS.
- `npm test -- --reporter=dot`: 715/715 PASS across 139 test files.
- `npx playwright test e2e/workspace-saved-pdf-deletion.e2e.mjs`: **1/1 PASS** after correcting a test-only ambiguous alert selector. A fictional PDF was imported; cancel preserved it; explicit confirmation removed the saved record persistently across reload; an earlier ZIP was successfully restored by user action. A final 390-pixel/keyboard-confirmation variant requires a fresh run before credit.

## Still required before release

1. Fresh hosted exact-head Validate and Browser Reliability Smoke including the new regression.
2. Review product copy, confirm the deletion surface on mobile/keyboard, and verify production behavior only after an approved release.
3. Explicit owner review before merge/deploy, one deployment, retained rollback; do not treat this as broad data-erasure certification. Deletion cannot remove previously downloaded backups or browser data outside the defined workspace stores.
4. V1 #153 and cross-release #57 remain open; PDF-to-Excel research #152 and V4 Stable 0/20 remain separate.
