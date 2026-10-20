# R143 — Original-publisher table coverage and remaining evidence gaps

**Scope:** regression diagnostics only. Do not ship a speculative table detector,
invent PDF cells, expand bounds solely to increase overlap, or award V4 Stable
qualification credit. No source PDF or raw extraction content in this file.

## USGS OFR 2024–1025 source-page coverage

The original 30-page source PDF was SHA-256 checked in the ephemeral
public-document pilot before extraction of **original pages 14, 17, 18, 19, 20**.
The original source ID and hash are fixed by
`benchmarks/release37/pilot-sources.json` and
`benchmarks/release37/public-table-inventory.json`.

At the R143 original-publisher test run [#39401809120](https://github.com/hamsa-tech26/pdfnova/actions/runs/39401809120)
the previously missing five published table pages each had exactly **one**
qualified native candidate, with numeric row×column shapes:

| Original page | Extracted candidate rows × columns |
| --- | --- |
| 14 | 6 × 6 |
| 17 | 4 × 6 |
| 18 | 4 × 6 |
| 19 | 4 × 7 |
| 20 | 5 × 7 |

The five corresponding extracted XLSX tables passed an existing
**147-cell developer-transcribed** source comparison (not independent
ground truth). The pilot also passed 20 original-public browser cases.
This evidence corrects the old report of *zero detected tables* in a
narrower excerpt but does **not** establish full 30-page automatic
acceptance, correct merged cells, rights approval, or independent
full-document cell/geometry certification.

## PubTables original-publisher box failures remain real

Source: R136 [run #39391540416](https://github.com/hamsa-tech26/pdfnova/actions/runs/39391540416),
full SHA-pinned PMC1064082.1 and PMC1064098.1 PDFs,
six external published **detection boxes only**, not cell truth.

The current V4 detector matched **2 / 6** at one-to-one IoU ≥ 0.50
and generated **2 unmatched predictions**. Missing boxes remain:

1. PMC1064082, original page 1: five aligned two-native-word source lines,
   no nearby caption. Global admission risks misclassifying ordinary
   two-column article prose.
2. PMC1064082, original page 4: interleaved native text and painted images,
   only one well-separated native two-word row in the published box.
3. PMC1064098, original page 6: no native PDF words in the published
   region; source includes images. Opt-in manual image OCR is **not**
   automatically verified table detection.
4. PMC1064098, original page 8, upper region: complex multi-tier native
   source layout, best table-region IoU **0.4852**, below 0.50.
   Do not pad predicted box bounds merely to push this past threshold.

The two accepted spatial matches are PMC1064098 original page 7
(IoU **0.9785**) and lower page 8 (IoU **0.7631**). Even these
two boxes do not certify cell content or semantic row grouping.

## Next safe implementation target

Use independent source-first visual box/cell annotations and negative
article-prose controls to investigate the uncaptioned native-paired
layout **separately** from image-only OCR. Preserve source words,
word provenance, table false-positive count, and every previously
validated USGS XLSX cell; do not weaken the 0.50 IoU scorer. The current
formal V4 Stable gate remains 0/20 independently reviewed original PDFs.

Related: GitHub issues #70, #75, #38 and #57.

## R150 — Corrected source-footnote localization (October 20, 2026)

The old R145 upper region IoU was **0.4712**. Its preceding broad
paragraph proxy gave **0.4852** but contained unrelated prose. R150
uses immediately trailing, explicitly marked **native PDF table footnote**
lines as physical detection extent, while retaining exactly **12 physical
header/body rows** and **four columns** in the user-reviewed logical table.
The footnote source words remain *outside* the logical data cells; no OCR
results, image pixels, publication annotation coordinates or invented
semantic field values enter the grid.

On the fixed original PMC1064098 source PDF page 8, the updated upper
logical detection rectangle measured **IoU 0.5210**, above the unchanged
0.50 gate. The lower source box remained **0.7631**, original page 7
remained **0.9785**, and the original two-PDF aggregate improved to
**3/6 published table boxes matched**, **three misses** and
**one unmatched prediction**. This is **source box localization only**,
not independently verified table-cell correctness or general extraction
accuracy. No additional formal V4 Stable document qualification (0/20).

The R150 source-footnote recognizer has negative controls for nearby
unlabeled prose, OCR markers, malformed geometry and distant notes.
Unverified scientific tables remain omitted from automatic all-tables
XLSX; selecting a scientific table requires manual review and warns
that table notes do not appear as data cells. Mixed image regions
remain opt-in review-only, never automatically accepted or added to Excel.
The source labels are never used as in-product detector inputs.

The CI release gate now requires **at least 3/6** original published
boxes, no more than two unmatched predictions and an upper-region
overlap at or above 0.50 with original source footnote words not exported
as data. Do not mark Issue #75 resolved while the other three published
source boxes and independent semantic cell ground truth remain missing.
