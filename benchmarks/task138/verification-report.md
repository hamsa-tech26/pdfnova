# Task 138 — Guarded USDA left report panel (draft, not deployed)

## Source and scope

- Public source: jsvine/pdfplumber, examples/pdfs/ag-energy-round-up-2017-02-24.pdf, source commit 4c64b92d5caccd71c645e98e0fabb0c4dba7ff45.
- Original PDF SHA-256: 4b9774416291f79421a85fac7ecbb8bf2bc625df9a7207d9dcd3ba845f3146fb.
- Baseline V4 extracts one misleading 1-row by 8-column candidate; its XLSX conversion is correctly refused. The left report panel contains five columns; three unrelated charts occupy the right side.
- This isolated draft adds a **review-only** guarded native-text recovery, stacked on the Task 137 draft. Auto-deployment is disabled on the Task 138 branch before first remote publication.

## Actual source evidence

| Check | Result |
| --- | --- |
| Table | 42 original physical lines, 5 columns |
| Contents | 1 partial source header, 10 original section headings, 31 data rows |
| Observed source-position cells | 165 original-value cells; 269 distinct native PDF text items accounted for |
| Missing positions | 45 unobserved positions, no explicitly empty source cell objects; do not claim they were blank |
| Top row | No source label for the item/category column; four original headings occupy columns 2–5 |
| Chart isolation | Only source words inside original left-panel bounds are retained; right-side graph labels, axis ticks, footers and charts are excluded |
| Existing original 1×8 candidate | Still presented as ineligible, not silently replaced or incorrectly exported |
| Automatic export | Still refused because all candidate content is either insufficient or review-only |
| Manual selection | Source-bounded table can be explicitly selected, previewed and acknowledged before exporting |
| Real XLSX | 42×5 worksheet generated, independently read with Python openpyxl; first and final source records, chart exclusion, absence of formulas and review-notes sheet checked |

Every logical cell is populated solely from its own native PDF text items. Period values and ranges remain literal text. Section-only lines do not synthesize numeric values in missing columns. The guarded candidate requires the exact report heading and source header, ten source section labels in order, 31 three-period numeric records, unambiguous physical row positions and strict region/provenance conditions. Missing, duplicate, OCR and chart-like intrusions fail closed. This is **not** a general USDA template converter or broad arbitrary-PDF table accuracy claim.

## Local verification

- Complete Vitest suite: **728 passed, 6 skipped**, 144 passing test files.
- OCR regression slice: **145 passed**.
- Opt-in real public source plus synthetic negatives: **3/3 passed** on the pinned input; an external spreadsheet reader verified the generated XLSX.
- TypeScript: PASS.
- ESLint: **0 errors**, **25 existing warnings**.
- Next.js production build: PASS.
- Tool registry: **31/31**.
- Golden synthetic checks: **3/3** passed, no independently accepted real gold case.
- Full npm dependency audit: **0 vulnerabilities**.
- All-tool output-evidence audit: **14 PASS, 17 PASS_WITH_WARNING, 0 FAIL**; internal scoped qualification only.
- Chromium upload-to-download browser test: **NOT VERIFIED** in this environment. The preceding task's matching browser could not be provisioned from available archives; no claim of a current-commit browser pass.

## Remaining gates and release decision

This is a developer-known source, not blinded independent review; Engine V4 Stable remains **0/20** independently adjudicated documents. The FBI dense multipanel report remains an unresolved source case. A browser-tested combined release of the Task 135–138 stack, wider real-world table samples and independent adjudication remain prerequisites.

**Decision:** open draft only, stacked on Task 137. Do not merge, preview, release to production, modify Android/Smart Scanner, purchase anything, activate billing or clean up unrelated PRs.
