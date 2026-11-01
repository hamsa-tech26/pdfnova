# Task 150 — Dense native caption label leader cleanup

Date: 2026-10-27

Status: **Research draft; no merge or deployment; V4 Stable remains 0/20.**

## Defect

Following Task149, 37 correct table records and nine numeric cells per record
were recovered from each of two original U.S. BLS CPI reports. But all 74
extracted first-column labels contained PDF dot-leader decorations. These
strings did not match the publisher's separately released XLSX labels.

## Bounded correction

Only when a logical row is already classified
`native-dense-caption-ten-body-review`, the first-column label consists of
native PDF words, and the cell text ends with **eight or more dot-leader
marks**, omit that trailing decoration from the presentation text.

- Original source words and exact original extracted text are retained on the
  cell for audit (`words`, `originalNativeText`).
- Every changed label carries a `nativeTextAdjustmentReasons` receipt.
- Export-quality review notes distinguish decorative-leader cleanup from
  ambiguous scientific Greek-glyph inference; a source-visual comparison is
  still mandatory.
- Short ellipses, internal punctuation, all numeric cells, and the original
  V4 generic row/cell thresholds are left unchanged.
- Previously established `native-caption-header-grid-` review-only provenance
  is preserved. The original PDF source is not rewritten.

## Independently published source comparison

Input PDFs and BLS XLSX versions and pinned SHA-256 hashes are documented in
[Task149's verification report](../task149/verification-report.md). The
Task150 source replay can be run locally using the script in this directory.

| Original release | Table body rows | Exact first-column labels before | After trailing-leader cleanup | Still differing |
|---|---:|---:|---:|---:|
| BLS Sep 2026 | 37 | 0 | **28** | 9 |
| BLS Aug 2026 | 37 | 0 | **28** | 9 |
| **Combined** | **74** | **0** | **56** | **18** |

The nine remaining rows in each edition involve superscript footnote symbols,
commas separating multiple footnote symbols, or placement of a footnote marker
inside a wrapped label, plus one typographic apostrophe difference. Examples:

- Original native: `1 Dairy and related products` → publisher XLSX:
  `Dairy and related products(1)`.
- Original native: `1, 2 Tobacco and smoking products` → publisher XLSX:
  `Tobacco and smoking products(1)(2)`.
- Original native: `Motor vehicle maintenance and 1 repair` → publisher XLSX:
  `Motor vehicle maintenance and repair(1)`.

**No automatic footnote movement was implemented.** It would imply content
structure not yet independently proven. The new labels remain **review-only**.
The numeric content still passes Task149's source-pinned comparison.

## Reproduction

With the same four original public BLS files and names described in Task149:

```bash
node benchmarks/task150/diagnose-labels.mjs /path/to/public-sources
KUKUREKU_TASK149_PUBLIC_DIR=/path/to/public-sources npx vitest run
```

The diagnostic asserts that exactly 28 of 37 labels per publication agree
after decoration removal and prints unresolved differences. This is a
**publisher-source engineering check**, not independent blind human
certification of 20 documents.

## Decision

Keep both Task149 and Task150 as stacked draft PRs for review. Do not merge
or deploy automatically and do not claim V4 Stable. Further footnote placement
correction should require stronger geometric evidence and negative tests
against other public documents.
