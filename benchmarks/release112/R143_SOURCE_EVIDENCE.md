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
