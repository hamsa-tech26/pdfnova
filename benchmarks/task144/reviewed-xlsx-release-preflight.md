# Task 144 — Four reviewed PDF-to-Excel recoveries: combined beta preflight

**Date:** 2026-10-27 Asia/Kolkata.  
**Decision:** **NO-GO for immediate production release; conditional candidate for a separately approved limited beta once hosted/current-browser checks and release acceptance are complete.**  
**Source code baseline:** Task 140 `3419b1a26f8b90a9d32084007453022722c373fc`; Task 141 test-only head `05129af9c5790175c7aab65b9386151ffaa1b6e8`.  
**Branch role:** review-only documentation; no detection, export, OCR, dependency, threshold or certification-code changes.

## Material correction of Task 181's four refusals

The four real-document failures from draft PR #133 / Task 181 have already been repaired *narrowly* in the subsequent Tasks 137–140 (not on production). Reimplementing them as a fifth independent fix is unnecessary.

| Original pinned public document | Stacked recovery | Reviewed XLSX source claim | Fresh browser evidence |
| --- | --- | --- | --- |
| Invoice `issue-140-example.pdf` | Task 137 | 5×9 rotated, 37/37 observed source positions matched; eight unobserved positions stay unverified | Task 141 4/4 joint source-pinned Chromium suite, includes workbook check |
| USDA weekly energy | Task 138 | 42×5 left-panel table, chart content excluded, 165 source positions | Same joint suite |
| FBI NICS November 2015 | Task 139 | 58×25 grid, 1,290/1,290 observed body positions matched; 129 gaps are not certified blanks | Same joint suite |
| NREL fuel-savings Table 2-1 | Task 140 | 7×7, 35/35 numeric body source cells matched; malformed overlap blocked | Same joint suite |

All four require *explicit user selection/acknowledgement* before an XLSX download; unattended extraction retains its refusal. PDF-to-XLSX browser PASS means exact pinned smoke tests, **not** arbitrarily accurate PDF conversion or a blind independent human reference.

## Exact GitHub integration topology checked

- Production `main`: `85880e0181ee1e7f44990225aefe8563a3ece7a7` at comparison time.
- `main...test/task141-source-pinned-browser` is **ahead 9 commits and behind 0**. The main-delta touches OCR asset wiring, guarded source recognition, table selection/quality, tests and the deployment denylist.
- Dependency order: **PR #134 root (against main) → #135 → #136 → #137 → #138 → #139 → #140 → #142 (Task 141 browser harness)**. Each was open, unmerged and marked draft when checked. PR #141 is an **unrelated mobile UI** draft and must not be mistaken for Task 141. PR #143 is *corpus research only*, stacked after #142; it need not enter a product beta.
- Merging PR #142 *into its current parent branch* does not by itself publish the four improvements to main. Any integration plan must contain the nine-commit ancestral delta and satisfy owner-approved merge/deploy controls.

## Fresh local verification: exact Task 140 source plus Task 141 harness

| Check | Observed result |
| --- | --- |
| Focused table/selection tests | 20 passed, 1 skipped |
| Full Vitest | **733 passed, 8 skipped**; 146 passing test files |
| TypeScript | PASS |
| ESLint | **0 errors, 25 existing warnings** |
| `npm run build -- --webpack` | PASS (Next.js 16.4.2, 66 static pages, local English OCR assets prepared) |
| Tool registry | **31 / 31 synchronized** |
| Synthetic golden document invariants | **3 / 3 PASS**, not real-world accuracy |
| Live locked-dependency `npm audit --audit-level=moderate --json` | **0 vulnerability findings** |
| Earlier Task 141 exact-head browser receipts | **4 / 4 source-PDF upload → selected table → downloaded XLSX; independent openpyxl checks** |
| Fresh browser rerun in this environment | **NOT RUN**; Playwright 1.56.1 exists but its Chromium 141 runtime is missing |
| Hosted CI on exact PR #142 head | **NO WORKFLOW RUNS / NO COMMIT STATUSES RETURNED**, so CI is NOT VERIFIED |

The read-only sandbox initially prevented Vitest's temporary directory creation (ENOENT); re-running the same focused tests with normal test-cache write permissions passed, 20/20 (plus one intentional skip). This environmental failure is not an engine regression. The fresh verification uses the Task 140 code checkout with the locally available Task 141 harness, not a new fresh clean-install from remote PR #142.

## Release decision and constraints

1. **Release candidate is technically promising for the four *known* original PDFs**, but the requested source-limited behavior must remain disclosed and review-only. Do not generalize those passes to unseen PDFs.
2. Before proposing a *limited beta*, obtain a current-commit clean-install + hosted CI receipt, rerun actual pinned-browser downloads on a supplied Chromium runtime, and explicitly review the aggregate nine-commit diff. Independently created reference spreadsheets / human rights review remain incomplete; therefore do **not** claim V4 Stable.
3. The required formal `npm run qualify:v4:stable` gate remains **BLOCKED, 0/20** independently accepted original documents. This gate is **not weakened** for a source-specific beta.
4. No merge, Vercel preview, production change, payment, outreach, dataset bulk-download, API key or customer file was used. The Task 144 branch disables deployment before the first published commit. All existing draft PRs remain intact.

**Next safe engineering priority:** build a small automated integration guard that fails when the known incorrect overlapping candidate is again selectable or a reviewed-only PDF is exported without acknowledgement, then repeat browser verification on the exact candidate. Do not manufacture source blanks or disable refusals.
