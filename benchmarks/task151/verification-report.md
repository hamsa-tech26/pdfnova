# Task 151 — Strictly anchored native caption superscript footnotes

Date: 2026-10-27

Status: **Research draft; review-only; V4 Stable 0/20. No production release.**

## Source defect

Task149 recovered all 37 native data rows and 333 numeric values from each
of two independently published U.S. BLS CPI release workbooks. Task150 removed
decorative PDF dot leaders. Nine labels per edition still displayed native
superscript reference numbers ahead of or inside the label, because the
generic reading-order routine treats those slightly elevated words as a
separate physical line.

## Original-PDF visual and native-word evidence

The original page-nine CPI table was inspected visually and the source
`PdfWord` geometry replayed for **both** September and August 2026 source
PDFs. All nine superscript-bearing labels per edition share the same
reproducible geometry:

- Raised word font size **5.9868** versus text-label font size **7.982**;
  ratio approximately **0.750**.
- Raised word top is **3.24 PDF points higher** than the source label word to
  which it attaches.
- Its left edge starts at the **right edge of that label word**, with observed
  horizontal gap about **0–0.01 points**.
- The rule applies to superscripts attached on a wrapped continuation line
  as well as single-line labels, e.g. "Owners' equivalent rent of residences"
  and "Motor vehicle maintenance and repair."

The evidence is from **two separately published monthly source documents**,
but they share the CPI report template; it is not a blind multi-format test.

## Conservative correction and controls

For an already `native-dense-caption-ten-body-review` **native-only first
column** cell, a small numeric word may be displayed as an end-label footnote
only if all these independent cues hold:

1. The source marker is an integer or comma-separated integer list, with
   smaller font size **58–82%** of the body text.
2. Its x origin is within **1.25 PDF points** of the endpoint of a full-size
   native label word, and its y rise is **1.5–5.5 PDF points**.
3. Its source height is less than 80% of the normal label height.
4. At most two marker words / four reference numbers appear in one label.
   Any unattached small numeral invalidates recovery.

The source words and exact raw original text remain in the cell for audit.
Every inferred footnote receives an explicit `nativeTextAdjustmentReasons`
receipt and XLSX **UNVERIFIED** review warning. This presentation change does
not alter the native source PDF, numeric cell content or generic V4 detection
thresholds. It does not apply to scanned/OCR tables.

Six or more dot leaders can be printed after a raised marker; after the
superscript words are removed from the displayed label body, the guarded
case may have only five visible terminal dots. For **geometrically anchored
markers only**, five trailing dots are treated as decoration. All other
dense-native review labels retain Task150's eight-dot threshold, preserving
short ellipses.

## Original government PDF versus publisher Excel

The exact public source PDF and XLSX URLs and SHA-256 hashes appear in
`benchmarks/task149/verification-report.md`; originals are not committed.

| Edition | Source body rows | Exact labels after Task150 | Exact after Task151 | Numeric cells |
|---|---:|---:|---:|---:|
| BLS September 2026 | 37 | 28 | **35** | 333/333 |
| BLS August 2026 | 37 | 28 | **35** | 333/333 |
| **Combined** | **74** | **56** | **70** | **666/666** |

The remaining two label differences in each edition are **only apostrophe
typography**: the PDF uses curly `’`, whereas the publisher Excel uses straight
`'` in "Owners' equivalent rent ..." and "Physicians' services". The engine
keeps the original PDF punctuation to preserve source fidelity. These are
**not** claims that every label is independently certified.

## Reproduction

With the four hash-pinned public BLS files from Task149 placed together:

```bash
node benchmarks/task151/analyze-footnotes.mjs /path/to/public-sources
node benchmarks/task150/diagnose-labels.mjs /path/to/public-sources
KUKUREKU_TASK149_PUBLIC_DIR=/path/to/public-sources npx vitest run
```

The synthetic regression asserts preservation of original source words,
correct handling of comma-separated markers and rejection when a putative
superscript is horizontally displaced. The original review-only export gate
continues to refuse unattended exports of the reconstructed candidate.

## Certification and release decision

**Draft only, no merge/deploy.** Source and publisher comparisons support
better presentation of a specific native table geometry, not certification
of the full document, OCR, hidden cells, other document templates or 20
independently blind-annotated documents. V4 Stable remains **0/20** and the
previous reserved-region misses remain unresolved.
