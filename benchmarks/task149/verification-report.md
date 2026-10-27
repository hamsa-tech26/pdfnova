# Task 149 — Source-guarded dense native CPI table row recovery

Date: 2026-10-27

Status: **Research draft; no merge or production deployment. V4 Stable 0/20.**

## Observed defect and corrected behavior

The V4 adaptive row heuristic conflated repeated small, raised native PDF
footnote numerals with serial-number cues, aggregating the 37 published table
body rows into seven generic logical rows. The native candidate already had
ten accepted columns (one label and nine numeric columns).

The source-guarded recovery is considered only for captioned native paragraph
regions with exactly ten columns, at least twenty separately positioned source
records containing nine numeric cells apiece, a bounded header and repeated
physical line spacing. OCR, missing/shifted numeric cells, noncaption blocks,
excess intervening content and insufficient evidence revert to the original
adaptive-row behavior. Native source words are preserved, including footnotes,
and raised left-margin footnote markers are assigned to the label column.

Result: on each of **two official CPI source PDFs**, V4 produces one
review-labelled header and **37 body rows** with ten columns.

## Independent numerical comparison (not blind certification)

Publisher: U.S. Bureau of Labor Statistics (BLS). Source PDF page nine,
"Table 1. Consumer Price Index for All Urban Consumers (CPI-U)"; numeric
cells C–K compared against the corresponding **independently published** BLS
Excel release table. Inputs are not redistributed or committed.

| Release | Official original PDF | Original publisher workbook | PDF SHA-256 | Workbook SHA-256 | Result |
|---|---|---|---|---|---|
| Sep 2026 | https://www.bls.gov/news.release/archives/cpi_10142026.pdf | https://www.bls.gov/cpi/tables/supplemental-files/news-release-table1-202609.xlsx | `d2fe7deb0ae83a869a37553c9d3934d3d5be4969cd3ca9763a4881df878bf66a` | `d991b4ce1b370d23c692c00f54d652cfb7d53ccdd018355cbdb226d8fdc0ef4b` | 37/37 body rows; 333/333 numeric cells |
| Aug 2026 | https://www.bls.gov/news.release/archives/cpi_09112026.pdf | https://www.bls.gov/cpi/tables/supplemental-files/news-release-table1-202608.xlsx | `658d7de6366114cb1638af490e14fe03cd1fab8faa8c9ce9aeba95c5b9a65e52` | `30afa35be3f1151d417a08a759952a212a998cd9420f7216ce2d2404349b6ed2` | 37/37 body rows; 333/333 numeric cells |

**Combined: 74/74 source body rows and 666/666 numeric cells agree** with
the publisher workbooks. This check explicitly excludes publisher header
numeric rows and blank body separators. The source-to-workbook check is an
opt-in test (`publicBlsDenseCaptionRegression.test.ts`), with source hashes
validated before every replay.

## Scope, safety and limits

- **Not independently certified:** row-label text, dotted leaders, superscript
  footnote placement, header semantics and visual grouping may differ from
  publisher workbooks; not all table contents are proven equivalent.
- **Fail closed:** the `native-caption-header-grid-` row provenance prefix
  makes this a scientific **review-only** reconstruction. Bulk XLSX export of
  only this candidate throws rather than silently creating an unreviewed
  workbook. Existing explicit individual-selection review remains available
  subject to the existing converter's unchanged quality checks.
- **No broader claims:** no new OCR/scan accuracy proof, no independent blind
  annotation, no PubTables rights/cell verification, and no formal 20-document
  V4 Stable certification. Prior unresolved reserved-source misses and
  unmatched predictions are not changed by this source-specific correction.
- The implementation uses repeatable column geometry and source line
  structure; it contains no BLS file names, numbers or release-specific text.

## Verification command (opt-in publisher replay)

Place the four original publisher files in one directory with the filenames
`kukureku-task149-cpi-sep-2026.pdf`,
`kukureku-task149-bls-table1-202609.xlsx`,
`kukureku-task149-cpi-aug-2026.pdf`, and
`kukureku-task149-bls-table1-202608.xlsx`, then run:

```bash
KUKUREKU_TASK149_PUBLIC_DIR=/path/to/public-sources npx vitest run \
  lib/pdf-engine-v4/analysis/__tests__/publicBlsDenseCaptionRegression.test.ts \
  lib/pdf-engine-v4/analysis/__tests__/nativeDenseCaptionTenColumnRows.test.ts
```

The test is skipped when the optional directory is absent. Synthetic
regression tests ensure the algorithm refuses OCR and malformed/misaligned
source lines even without the source corpus.

## Release decision

Draft review only. Independently reviewed row labels, header and footnotes,
cross-source corpus generality, and separately maintained blind certification
remain necessary before any V4 Stable claim or unattended expansion.
