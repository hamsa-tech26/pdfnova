# Task 139 — FBI NICS dense-grid source recovery (draft only)

## Original source and problem

- Published file: [`jsvine/pdfplumber` background-checks.pdf](https://github.com/jsvine/pdfplumber/blob/4c64b92d5caccd71c645e98e0fabb0c4dba7ff45/examples/pdfs/background-checks.pdf), commit `4c64b92d5caccd71c645e98e0fabb0c4dba7ff45`.
- PDF SHA-256: `4f0ae6e017b0e97de211da8fd97316e55bd927af5740d6ce95e1b7b1539f9407`.
- Source image: one 1008 × 612 pt landscape page. Printed heading: *NICS Firearm Background Checks — November 2015*. Notes and disclaimers are below the actual data grid.
- Historical V4 automatic table detector had merged many lines, and no trustworthy XLSX was produced. This task retains that detector's score and adds one strictly source-matched **review-only** table option.

## What was verified

| Source fact | Result |
| --- | --- |
| Physical text rows in reconstructed grid | 58: 1 parent-heading row, 1 subheading row, 55 state/territory rows, 1 Totals row |
| Positional column slots | 25, including State/Territory and Totals |
| Original source items in those rows | 1,321 PDF.js native text items mapped one-to-one to 1,321 source-bearing cell positions |
| Source body cells | 1,290 observed: 55 × 23 and final Totals × 25 |
| Missing source positions | 129: 19 unobserved positions in parent-heading row and 110 in the two Rentals columns across the 55 state/territory records |
| Independent source-to-XLSX audit | **1,290 / 1,290** body cells matched against a second parser (`pdfplumber`) using the painted table's column boundaries and original row positions; the actual exported XLSX was read with `openpyxl` |
| Native source text | Retained literally, including `98 452` and `180 116` in the California source row, not replaced with inferred commas |
| Footer exclusion | Printed footnotes, disclaimers, page number, title and date were not silently exported as data cells |
| Automatic PDF-to-Excel | **Refused** for this review-only table; the user must select and inspect it deliberately |

No missing cell content is synthesized, including the 110 Rentals positions. In particular, missing native PDF text **does not certify that a visually colored but untexted cell is empty**. The six superheadings are positioned based on their original center coordinates rather than declared as Excel merged cells or certified source semantics. Generated worksheet values remain literal text, never formulas. Explicit review notes accompany export.

The new guard requires exactly this source shape: native text provenance, correct report title and month, all 25 named subheadings, the six parent headings, the 56 complete physical record positions, 55 × 23 and 1 × 25 body source items, numeric text values, unambiguous distinct column positions, and fixed original row anchors. Rotations, OCR substitutions, lost/duplicated values, changed headings and shifted values are rejected in synthetic negatives. It is not a general solution for different NICS months, unseen layouts or arbitrary PDF tables.

## Verification in isolated local checkout

- Baseline: PR #138 head `1b91a420fd0a536f16c2e9cf30d9fd57a175291e` (the Task 137/138 draft stack, **not** production).
- 3/3 direct Task 139 tests passed, including the pinned real published PDF, synthetic negative cases and actual XLSX cross-reader comparison.
- Complete Vitest suite: **730 passed, 7 skipped** (145 passing test files; one skipped file).
- OCR + Phase 10.14 unit slice: **146 passed** (unit-regression fixtures, not real-world OCR accuracy scores).
- TypeScript: PASS. ESLint: **0 errors / 25 pre-existing warnings**. Next.js production build: PASS.
- Tool registry: **31/31**. Generated synthetic golden checks: **3/3**. Internal output-evidence: **14 PASS, 17 PASS_WITH_WARNING, 0 FAILED**.
- Full and production npm audits: **0 reported vulnerabilities**.
- Actual OCR image benchmark: **NOT RUN**; its four fixture entries report `NOT_RUN` (do not treat its command's exit status as an accuracy result).
- Chromium upload/download browser test: **NOT VERIFIED locally** on this change. No matching local Playwright browser was provisioned for this isolated checkout. CI/browser results must be checked on the exact published commit.

## Limits and disposition

The cross-parser match is a useful independent software comparison against a published file, **not independent human source annotation** or proof of table semantic correctness. Engine V4 Stable remains **0/20 independently accepted real documents**, and other real-world table-detection failures remain unresolved. No production certification, arbitrary-document assurance or device-compatibility guarantee follows from this case.

**Disposition: draft only.** Stack on PR #138 and disable Vercel automatic deployments before the first push. No merge, preview, production deployment, Vercel quota use, billing, PR closure, Android or Smart Scanner changes. Perform browser validation and independently annotated acceptance before considering a combined release.
