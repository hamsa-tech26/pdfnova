# Preserve exact source text during native wide-header reflow

Base: main `85880e0181ee1e7f44990225aefe8563a3ece7a7`.

The existing PR #121 newline and nonempty merged-child safeguards are already
in main. PR #125's independent USGS XLSX reader and browser test are also
identical to main after #126. This isolated change reuses those safeguards
without modifying or closing the older drafts.

## Reproduced defect

Wide-header physical-line restoration used whitespace removal plus NFKC
compatibility normalization to decide whether it could overwrite a cell.
That admitted distinct strings such as ㎎/mg, Ω/Ω, ﬃ/ffi, Ａ/A, ²/2 and µ/μ.
It also admitted tabs, NBSP, CRLF, doubled spaces and padded labels, then
replaced them with reconstructed spaces and LF. Two new regressions failed
against main while its five existing header tests passed.

## Scoped correction

Restore physical line breaks only when the existing cell exactly equals
the native word sequence joined with ordinary spaces. On any discrepancy,
retain the source cell unchanged and omit this optional reflow. Do not
normalize characters, strip whitespace, alter data cells, change merges,
adjust detector/OCR thresholds or invent missing native evidence.

Tests include six compatibility pairs, five whitespace/line-ending controls,
and a positive ordinary-space multiline heading. An independent openpyxl
browser-suite test compares all 1,452 coordinates in 12 constructed XLSX
worksheets, checks shapes, and rejects formulas, merges and external links.
Existing actual browser PDF-to-XLSX roundtrips and OCR refusals remain intact.

The real publisher pilot must retain all existing checks, including 147
project-transcribed USGS cells read with openpyxl and the actual PMC wide
table. Its workflow now checks out the exact development head. Source-cell
expectations remain project-curated, not independently blind-reviewed.
Local publisher intake is blocked by the managed network policy; branch CI
must supply fresh real-document results. Exact-head receipts and final
counts are recorded in the draft description.

The source comparison is deliberately conservative: an ambiguous heading
can retain its original single-line display. Source text takes priority
over optional line formatting. Engine V4 Stable remains 0/20; unresolved
detector misses and independent-reference gaps are not fixed by this work.

This branch is deployment-disabled before its first remote commit. No merge,
preview/production deployment, paid service, Android work, or modification of
Smart Scanner PR #129 is part of this change.
