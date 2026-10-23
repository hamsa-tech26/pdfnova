# Next PDF accuracy investigation after the maintenance candidate

Source: draft [PR #117](https://github.com/hamsa-tech26/pdfnova/pull/117),
head `42bbd1338cb71a85b527fbcf14fb1bc12d6d0ece`, and its
[paired replay](https://github.com/hamsa-tech26/pdfnova/actions/runs/39887834357).
These are historical diagnostic results, not fresh measurements on Task 170.
Do not merge this research or any detector change into the maintenance release.

## First target: Sample 8's short native table region

Before changing detection, obtain an authorized original and independently
verify that its page pixels correspond to the reference image/annotation.
Record source hashes, page number, rotation, crop/scale and coordinate transform.
Keep original PDFs, annotations and Inspector raw content in approved private,
gitignored storage. Same-archive filenames and page geometry alone do not
establish semantic reference correspondence or document rights.

The historical Sample 8 page-2 reference is `(70,378,426,58)`. It overlaps
15 native extraction items, eight containing digits, across five lines, with
no overlapping recorded image paint. The 57-line candidate scores 49.4281,
accepts only one column and is rejected. After visual pairing is established,
trace candidate extent and native-column formation around these five lines.
Determine whether the candidate absorbs unrelated page content or loses
source-supported column anchors. Use the source evidence to choose a bounded
correction; the numeric report alone does not prove the intended cell grid.

## Adjacent evidence to preserve

- Sample 9, page 2: reference `(72,184,456,124)`, 19 native items, six
  digit-bearing items, seven lines, no overlapping image paint. A 13-line
  candidate scores 40.1307, below threshold. Review its source separately;
  these two examples do not justify lowering a global threshold.
- Sample 5, page 1: the matched 6-row/14-column region has IoU .7420.
  The extra region `(60.4885,191.8298,498.5405,147.8429)` has one logical row,
  three columns, and IoU zero against the only reference. It is spatially
  separate; removal preserves match count, but visual review must determine
  whether it is a valid unannotated table. Do not globally reject one-row tables.

Historical localization is development 6/6, exposed regression 6/8, two misses
and one unmatched prediction. Samples 4–9 have been exposed and cannot serve
as an untouched evaluation set. PR #117 also predates the production security
patch, so its historical audit failures must not be confused with this release.

## Focused implementation and acceptance

1. Confirm source rights and original/reference pixel correspondence; have an
   independent reviewer adjudicate Samples 8, 9 and 5 with recorded transforms.
2. Reproduce the Sample 8 candidate/column failure on a separate guarded branch.
   Retain the existing diagnostic redaction and provenance controls.
3. Implement the smallest source-supported region/column correction. Add a
   meaningful positive regression and nearby negative/prose/one-row controls.
   Preserve OCR routing, source fidelity, unique IDs and existing good matches.
4. Replay the exposed cases, reporting per-reference matches, IoUs, misses and
   unmatched regions. A retained unmatched region needs adjudication, not concealment.
5. Independently annotate table cells and expected workbook contents; validate
   exported XLSX with a separate reader, preserving text/identifier fidelity
   and literal untrusted text. Localization success does not prove cell accuracy.
6. Evaluate a fresh authorized untouched real-world set, then the real-document
   acceptance matrix for all 31 tools. Maintain fail-closed qualification.

Independent cell/Excel accuracy, fresh real-world generalization and complete
31-tool real-document acceptance remain NOT_VERIFIED. Engine V4 Stable remains
**0/20** until its existing document-level acceptance requirements are met.
