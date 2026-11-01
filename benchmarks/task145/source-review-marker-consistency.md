# Task 145 — Source-marked table ID must never bypass reviewed-only export

**Date:** 2026-10-27 Asia/Kolkata.  
**Review-only branch:** `fix/task145-source-review-marker-consistency`.  
**Parent:** Task 144 preflight `0f0328348886a5fe485fd58ea1be66583dcd15b8`.  
**Decision:** candidate for review; do not merge or deploy automatically.

## Concrete safety inconsistency found

The table-choice selection layer (`pdfToXlsxSelection.ts`) treated a recovered source-bounded table as such if **either** its table ID or a row's original `blockId` had a guarded native prefix. The UI acknowledgement and the unattended export eligibility gate classified review-only tables from the **row block ID only**. A table that carried a guarded *table ID* but lost/mismatched row source-marker classification could therefore be treated inconsistently: candidate exclusion detected it, while the confirmation or unattended refusal checks might not.

No production exploit or observed original-PDF malformed marker is claimed. This is a **fail-closed consistency correction** for unexpected provenance differences, not new table recognition or accuracy.

## Exactly what changed

1. `isScientificReviewOnlyTable()` now matches the eight existing guarded prefixes against **either** table ID or individual row's source provenance marker.
2. Unattended `preparePdfV4XlsxExport()` uses that **same single helper** for excluding unverified new candidates; the review-note generation uses it too. The PDF-to-Excel page already consumes that helper for the explicit review checkbox and download-button guard, so those checks now stay aligned.
3. One table-driven regression covers all four published source-bounded types — rotated invoice, USDA panel, FBI NICS, NREL fuel savings — when table ID requires review but the rows retain unrelated ordinary provenance. For every case the test confirms no unattended export, an eligible review-only selection, and a HIGH REVIEW PRIORITY notice. An ordinary source table remains non-review-only.

No detector thresholds, OCR policy, source values, blank-cell assumptions, previous exceptions, workspace persistence, billing or original-V4 certification code changed.

## Exact local verification on Task 140 production code plus Task 141 browser harness and this patch

| Check | Result |
| --- | --- |
| Focused selection/structural evidence | **22 / 22 passed** |
| Full Vitest | **734 passed / 8 skipped**; 146 passing test files |
| TypeScript `npx tsc --noEmit` | PASS |
| ESLint | **0 errors / 25 preexisting warnings** |
| Next.js 16.4.2 `npm run build -- --webpack` | PASS (all 66 static routes) |
| `git diff --check` | PASS |
| Fresh original PDF browser replay in current environment | **NOT RUN**, matching Playwright browser absent |
| Earlier Task 141 actual public PDF browser suite | **4 / 4 PASS** at its previous exact head, not requalified against this change |
| Formal Engine V4 Stable | **BLOCKED, 0/20** original PDFs independently accepted |

The unit checks exercise the export-layer policy, not all event handling through a physical browser. A missing test runner temporary directory in read-only mode was resolved by permitting ordinary test-cache files; no product code workaround was needed.

## Safety and merge boundaries

- This branch's first published tree sets `git.deploymentEnabled["fix/task145-source-review-marker-consistency"] = false`.
- Review-only, stacked on Task 144. No merge, preview, deployment, Actions rerun, payment, outreach, external PDF retrieval or private documents.
- Next check after branch review: rerun actual 4/4 browser import/ack/download on a matching Chromium environment against the exact integrated candidate and verify it still refuses malformed generic overlaps. Do not weaken refusal thresholds or count source-known fixtures toward 20 blind documents.
