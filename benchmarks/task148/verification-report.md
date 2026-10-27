# Task 148 — Safe source-page selection for PDF-to-Excel

**Date:** 2026-10-27

**Base:** draft PR #145, `044b0ef2b35824dc03c97ede2db0a952f174438c`
**Disposition:** verified draft only; no merge, preview or production deployment.

## Original publisher references

Two archived Bureau of Labor Statistics PDF reports and their *original*
Table 1 XLSX workbooks were retrieved in memory. No PDF, workbook, source cell,
user data or original source text is committed.

| Source PDF and publisher workbook | Full original pages | Original PDF SHA-256 | Original V4 full-PDF candidates | After explicitly selecting original pages 9–10 |
| --- | ---: | --- | --- | --- |
| [September 2026 CPI PDF](https://www.bls.gov/news.release/archives/cpi_10142026.pdf) · [Table 1 XLSX](https://www.bls.gov/cpi/tables/supplemental-files/news-release-table1-202609.xlsx) | 38 | `d2fe7deb0ae83a869a37553c9d3934d3d5be4969cd3ca9763a4881df878bf66a` | 30, all refused due 25-page limit | Two-page derivative (22,482 bytes); one 7×10 overlapping candidate refused, one 7×8 candidate eligible but unverified |
| [August 2026 CPI PDF](https://www.bls.gov/news.release/archives/cpi_09112026.pdf) · [Table 1 XLSX](https://www.bls.gov/cpi/tables/supplemental-files/news-release-table1-202608.xlsx) | 38 | `658d7de6366114cb1638af490e14fe03cd1fab8faa8c9ce9aeba95c5b9a65e52` | 30, all refused due 25-page limit | Two-page derivative (22,586 bytes); one 7×10 overlapping candidate refused, one 7×8 candidate eligible but unverified |

The separately published Table 1 workbook has 49 physical worksheet rows
for each report; this is **not** a measured exact-cell accuracy score.
The V4 candidate still improperly combines multiple report rows into oversized
cells. That overlapping candidate remains refused. A candidate's export
eligibility does not prove fidelity or source-to-workbook correspondence.

## Safety and behavior

- Original selected file and bytes are unchanged. All processing stays browser-local.
- Optional consecutive page range is valid only for positive integers, 1–25
  selected pages, within the actual full original PDF page count.
- Original input and derived subset are each capped at 25 MiB. The converter's
  existing 25-page limit is not weakened.
- No silently omitted pages: original start/end and the full source page count
  are recorded in visible UI warnings and downloaded XLSX review notes.
- When no source range is selected, the existing whole-document path remains.
- Image review and native recovery operate on the same derived subset, preventing
  page-number mismatch. Strict overlap/provenance/quality gates remain.

## Verification receipts

- New helper unit tests: **3/3 PASS** (including source preservation and refusals).
- Converter suite: **115/115 PASS**.
- Full suite on isolated PR #145 base: **737 PASS, 8 skipped** across 148 test files.
- TypeScript (`tsc --noEmit --incremental false`): **PASS**.
- Targeted ESLint: **PASS**.
- Next.js 16.4.2 production webpack build: **PASS**, 66 prerendered routes.
- Pinned Chromium Headless Shell 141.0.7390.37 browser checks: **2/2 PASS**
  (successful 38-to-2 selection, excessive-range refusal).
- `git diff --check`: **PASS**.

## Remaining certification gap

**Engine V4 Stable stays BLOCKED at 0/20** independently accepted real PDFs.
No independent two-blind-annotator cell review, language coverage, complete
stress qualification or exact publisher-workbook cell score is claimed.
Next target: correct the BLS source-row segmentation and compare each actual
extracted cell against the official publisher workbook under the same refusal
safeguards, without inventing ground truth.
