# Engine V4 — no-cost independent reference feasibility (9 November 2026)

**Decision: development benchmarks may proceed; formal V4 Stable acceptance remains BLOCKED (0/20).** This is a source and rights screening memo, not evidence of completed review, a release, or a new certification. No external reviewer was contacted and no paid dataset was acquired for this work.

## Requirements that public datasets cannot silently waive

The existing `scripts/checkRelease37Gate.mjs` requires at least 20 distinct original real-world PDF SHA-256 hashes, at least two documents in each required category, independently approved and rights-cleared full-source table references, measured cell/row/structure metrics, language-specific OCR evidence, Phases 10.15–10.19, critical-regression clearance, and stress/performance evidence. Synthetic fixtures, copied publisher tables, automatically aligned annotations, and reports with missing human attestations receive **zero** credit.

Local checks on the unchanged Release 215 baseline:

- `npm run test:v4:blind-pair`: 8 passed, 0 failed.
- `npm run qualify:v4:stable`: expected `BLOCKED` (exit 1); 0 distinct eligible real PDF hashes; all eight required source categories unqualified; independent phases and performance evidence absent.
- `node --test scripts/__tests__/release112Detection.nodecheck.mjs`: 8 passed, 0 failed, including one-to-one box matching, duplicate prediction refusal and invalid box rejection.

## Public reference candidates

| Resource | Original-source / label strengths | Evidence limitation | Current disposition |
| --- | --- | --- | --- |
| [Microsoft PubTables-1M](https://github.com/microsoft/table-transformer) | Table boxes, PDF/image coordinates, rows, columns, cells including blanks and header semantics; released source-PDF annotation archives. The [CVPR 2022 paper](https://openaccess.thecvf.com/content/CVPR2022/papers/Smock_PubTables-1M_Towards_Comprehensive_Table_Extraction_From_Unstructured_Documents_CVPR_2022_paper.pdf) describes deriving labels through PDF/text-to-publisher-HTML alignment and consistency checks. | **Published annotations are not two blind independent human transcriptions.** Document-specific PMC OA reuse rights, exact original-PDF identities, full document coverage, provenance, and cell fidelity are unverified for our intended cases. | Candidate for **source-first geometry/structure regression diagnostics**, 0/20 formal credit. Do not download the full archive or claim human signoff. |
| [IBM/Docling DocLayNet](https://github.com/DS4SD/DocLayNet) | Human-labelled page-level document layout across diverse source types. The [dataset README](https://huggingface.co/datasets/docling-project/DocLayNet/blob/main/README.md) documents a CDLA-Permissive-1.0 dataset license, PDFs, cell-level *PDF text extraction metadata*, and some double/triple layout annotation. | Layout segmentation is **not** a full original-PDF human-reviewed table-cell/blank/merge transcription. Dataset license does not automatically establish every source PDF's downstream redistribution and review rights. Hindi/Bengali OCR is not demonstrated. | Candidate for **layout robustness and annotator-disagreement research**, 0/20 formal credit. |
| [USGS original-publisher reports](https://pubs.usgs.gov/) already listed in `candidates.json` | Three original reports with known publisher URLs, diverse native layouts and five published table locations in OFR 2024-1025. | Report-by-report embedded third-party rights and independently blind-annotated *full originals* remain unverified; CI's extracted pilot pages are not distinct documents. | Retain as **candidate source review queue only**, 0/20 formal credit. |

## Selected bounded PubTables diagnostic sample — no new measured claim

The existing `benchmarks/release112/sources.json` already pins exactly two **original** PMC OA PDF URLs, SHA-256 values and six published table-detection reference boxes. Reuse these instead of choosing fresh files by convenience or allowing detection output to decide which source boxes are correct:

| Original | Original source SHA-256 | Original pages / boxes | Rights state |
| --- | --- | --- | --- |
| `PMC1064082.1` | `97510a4389ac7a3453835e896ed5b4c18ff7c257dea25fbf0179bbf30ef6f14b` | Page 1 (1), page 4 (1) | Individual article license not verified |
| `PMC1064098.1` | `a36e01c63d45ece27a4b85a255d189ed573d2331281d0fb4770ae06dda9d4722` | Page 6 (1), page 7 (1), page 8 (2) | Individual article license not verified |

Existing source receipt: `benchmarks/release112/R143_SOURCE_EVIDENCE.md`. The previous R150 diagnostic recorded **3/6 matched** published table boxes at IoU >= 0.50, with three misses and one unmatched prediction. **This is historic regression evidence, not a fresh November run.** Neither source has independent reviewed table cells or certification credit.

The [NLM PMC copyright notice](https://pmc.ncbi.nlm.nih.gov/about/copyright) and [PMC OA dataset guidance](https://pmc.ncbi.nlm.nih.gov/tools/openftlist/) explicitly require article-specific license checking. The [2026 PMC dataset-access guidance](https://pmc.ncbi.nlm.nih.gov/tools/pmcaws) also documents the new cloud distribution rather than assuming old FTP paths continue working. The individual articles' license metadata could not be reliably inspected in this research session. Keep `rightsConfirmed=false` and prohibit redistribution.

An attempted HTTP HEAD of an existing USGS publisher pilot PDF on 9 November returned **403**. No source PDF was downloaded, and the V4 detector was **not** rerun against an original public source in this session. The local evaluator's eight negative-control tests passing does not establish any change in 3/6 detector recall.

## Safe next intake sequence

1. Keep the existing public references in a **diagnostic** track: compare table boxes/structure against engine output without turning any label into a certification claim.
2. For a *small* candidate subset, record the exact original PDF URL, publication/license link, source SHA-256, page count, and whether table annotations are human, algorithmic, or mixed. Do not fetch any bulk archive or transmit private PDFs.
3. If genuine independent human source-first annotations later become available, use `v4:blind-pair`, `v4:compare-blind`, and private `benchmark:v4:corpus` exactly as documented in `README.md`. Both annotator identities, source rights, and final review must be checked outside code.
4. Keep the formally required Hindi/Bengali OCR, 20 distinct real documents, original-PDF complete table cells, and performance evidence **open** until measured. A dataset's existence does not satisfy those conditions.
5. Preserve reviewer intake privacy: no raw candidate communications, candidate identity records, actual source PDFs, raw annotation strings, answer keys, or customer documents in public Git, Vercel, CI artifacts, or this memo.

## Release boundary

This document changes no extraction algorithm, production configuration, deployed route, OCR model or freeze threshold. It authorizes no spending, outside contact, dataset redistribution, PR merge, or deployment. The default action remains **NO-GO** on any V4 Stable announcement until the existing fail-closed gate actually passes on approved measurements.
