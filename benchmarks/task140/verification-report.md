# Task 140 — guarded NREL fuel-savings grid and duplicate-selection safety

## Original public source

- Repository: [`camelot-dev/camelot` `tests/files/foo.pdf`](https://github.com/camelot-dev/camelot/blob/92777b852e00933a5c4b9ba642601784604356cd/tests/files/foo.pdf) at pinned source commit `92777b852e00933a5c4b9ba642601784604356cd`.
- PDF SHA-256: `7d6c24e45b38375e322419281cee1335ddb97e00fc86abe9f22afcd8b42e6d82`.
- Original public one-page excerpt: NREL fuel-saving driving-cycles narrative with a small ruled seven-column Table 2-1 below several paragraphs, followed by Figure 2-1 prose.
- Stacked baseline: Task 139 draft PR #139. Production is **not** the source baseline for this draft.

## Source-only table result

| Test | Result |
| --- | --- |
| Source grid | 7 positional columns × 5 numeric body rows |
| Literal original native source items | 50: 1 parent-heading item, 14 two-tier subheading items and 35 body values |
| Reviewed output | 7 logical rows: 1 sparse parent-heading tier, 1 joined source-word subheading tier, 5 original data rows |
| Original physical source rows | 10 source lines, grouped without any prose continuation |
| Missing detected positions | 6 positions in the sparse parent-heading tier only; **not** independently certified blank |
| Actual workbook / independent cross-reader | **35/35** body source cells exactly matched, reading the generated `.xlsx` with `openpyxl` and source PDF grid words with `pdfplumber` |
| Excluded material | Long paragraphs, numbered list, source caption, following Figure 2-1 discussion and page number |
| Unattended export | **Refused**, requiring deliberate selection and source review |

The original native subheadings are two vertically stacked text items per field (e.g., `Cycle` + `Name`, `Improved` + `Speed`). Their source words are retained verbatim when joined into review-only Excel header cells. The printed `Percent Fuel Savings` parent heading visually spans the last four columns; the worksheet keeps the original text in the first of those four positions **without claiming merged-cell semantics**. Percentage values and numeric labels remain literal, with no formula evaluation or automatic type inference.

The guarded path requires the original caption, exact page dimensions/rotation, all seven paired source headings, one parent text item and every one of the five complete physical data rows, original cycle identifiers, native-only text, strict coordinate bounds and a one-to-one source-item audit. Synthetic rotations, corrupted captions, duplicate/missing values, OCR substitutions, intruding prose and shifted column positions fail closed. This is **not** a general NREL file parser.

## Important additional safety fix

The existing engine simultaneously exposes a legacy **6×7** native-captioned candidate from the same ruled region. It combines unrelated `Percent Fuel Savings` parent text with `Decreased Accel` into one header cell. Prior to Task 140, that old candidate was independently **selectable** despite its incorrect header semantics. Task 140 adds an explicit duplicate-region check in the single-table selection layer: a generic candidate sharing at least 90% of the smaller table region's area with a stronger guarded source recovery on the same page is **ineligible** for XLSX selection. The correct, strictly guarded candidate remains selectable only with review. Separate pages and nonoverlapping tables remain eligible under their existing rules. The same rule protects other named source-bounded recovery types if they expose an overlapping generic candidate.

No general detector admission threshold, global OCR policy, or unrecovered source text was modified.

## Local tests, limits and release decision

- Opt-in real PDF + synthetic negative/positive tests: **3/3 passed**; independent actual XLSX read and original-PDF comparison **35/35** source body cells.
- Complete Vitest suite: **733 passed, 8 skipped** (146 passing files, 1 skipped file).
- OCR / Phase 10.14 unit slice: **146/146 passed**. This is not measured actual scan OCR quality.
- TypeScript: PASS; lint **0 errors / 25 preexisting warnings**; production build PASS.
- Tool registry **31/31**; synthetic golden **3/3**; internal output evidence **14 PASS, 17 PASS_WITH_WARNING**.
- Complete npm vulnerability audit: **0 reported vulnerabilities**.
- Current-commit Chromium browser upload/download suite: **NOT VERIFIED locally** (matching browser unavailable). The image OCR benchmark, independent blinded references and physical-device testing are not qualified by these runs.

**Engine V4 Stable remains 0/20 independently accepted documents.** Four formerly refused published reference sources now have narrow **draft-only** review paths across Tasks 137–140, but source-specific success must not be reported as arbitrary-PDF table detection or production certification.

**Disposition:** draft stacked on PR #139, with its branch present in Vercel's `git.deploymentEnabled` denylist **before branch publication**. No merge, preview, deployment, quota use, billing, Android/Smart Scanner work or cleanup of other PRs. Browser and independent human reference review remain blockers to a combined release.
