# Task 142 — external-reference feasibility and independent Engine V4 evidence

**Decision date:** 2026-10-27  
**Scope:** research-only, zero-cost, no outreach, no bulk dataset downloads, no source PDFs or reference cells committed.  
**Disposition:** **NO-GO for formal Engine V4 Stable certification**; **conditional GO for bounded public human-layout evaluation**.  
**Exact predecessor:** Task 141 draft PR #142, commit `05129af9c5790175c7aab65b9386151ffaa1b6e8`.

## Verified baseline

The unchanged `npm run qualify:v4:stable` gate exits with `BLOCKED`: **0 distinct, independently accepted original real PDFs out of 20**, no measured category accuracy, Phases 10.15–10.19 still missing, and no accepted Phase 10.14 actual OCR/stress gate. This is a correct refusal, not a software test failure.

The locked criteria in `scripts/checkRelease37Gate.mjs` require 20 distinct original PDF hashes, two real documents for each of native, scanned, hybrid, complex, multipage, rotated, Hindi and Bengali; measured >=95% cells, >=75% rows and >=90% structure per category; independent source review, cleared phases and regressions, actual OCR and bounded resource performance. Two separate original-source blind transcriptions and rights approval are additionally required by `benchmarks/release37/README.md`. Changing a Boolean, trusting a derived OCR transcription, or repeating a page from one report cannot satisfy this requirement.

The owner cannot organize two reviewers; do not assign them recruitment. Existing published datasets may offer **independent reference evidence for scoped diagnostics**, but a public label is not automatically proof of two independent human reviews of an entire original PDF.

## Public options checked against primary sources

| Dataset/source | Verified useful evidence | Material gaps before formal acceptance | Decision / credit |
| --- | --- | --- | --- |
| **DocLayNet / DocLayNet-v1.2**, IBM/Docling | ~80,863 human-labelled pages, eleven layout classes including table, with double/triple-annotated subset; extra single-page PDFs and digital text-cell JSON; v1.2 offers PDF bytes and per-region text in Parquet | Annotation redundancy covers **layout**, not an independently reviewed full XLSX cell grid; single-page derivatives are not an independently approved complete original document; specific underlying publication rights/identity and source grouping need review. v1.2 repository is ~39.8 GB; individual listed test shards are hundreds of MB | **Priority 1 for bounded table-region pilot; 0/20 credit** |
| **PubTables-1M**, Microsoft | ~947,642 annotated tables; row/column/cell boxes including empty cells, original PDF coordinates, and 401,733 per-PDF annotation JSON files | Published labels derive from a PDF/XML annotation pipeline and quality checks; no verified two independent human blind cell transcriptions for each source PDF. Individual PMC publication reuse rights and complete original PDF mapping must be checked; archives are too large for indiscriminate download | **Priority 2 for exact cell/geometry development comparisons; 0/20 credit** |
| **PubTabNet**, IBM | ~568k table images, HTML table structure and text; published annotation license CDLA-Permissive-1.0 | Images have separate PMC Open Access rights. Table images/HTML and nonempty-cell boxes do not constitute a full independent original-PDF, missing-slot and multipage review; no documented independent human two-reviewer agreement for each item | **Secondary cross-reader source; 0/20 credit** |
| **USGS SIR 2024-5103, FS 2024-3013, OFR 2024-1025** | Original publisher PDFs, checked source digests/page locations and bounded public pilot diagnostics already tracked in this repository | Current inventory marks per-document rights and independent reference review **false**; the five-table excerpt from one OFR still counts as one original document, never five | **Continue source-specific diagnostics only; 0/20 credit** |

### Primary evidence links

- [IBM DocLayNet original source and annotation protocol](https://github.com/DS4SD/DocLayNet/blob/main/README.md): human layout annotations, overlapping review subset, single-page PDF assets, source document identifiers and labeling guide.
- [DocLayNet v1.2 dataset card](https://huggingface.co/datasets/docling-project/DocLayNet-v1.2/blob/main/README.md): per-region `pdf_cells`, embedded PDFs, and curator-declared CDLA-Permissive-1.0. Dataset license does **not** automatically resolve each underlying publication's redistribution rights.
- [Microsoft PubTables-1M official release description](https://github.com/microsoft/table-transformer/blob/main/README.md): full cell/blank annotations and PDF-coordinate archive; QA is not two independent human source reviews.
- [IBM PubTabNet repository](https://github.com/ibm-aur-nlp/PubTabNet) and [annotation/image rights split](https://github.com/ibm-aur-nlp/PubTabNet/blob/master/LICENSE.md).
- Existing [USGS pilot source inventory](../release37/pilot-sources.json) and [zero-credit table inventory](../release37/public-table-inventory.json).

## Bounded next engineering move (Task 143)

1. **Target region-detection accuracy, not V4 Stable certification.** Seek at most **two** DocLayNet pages with independently redundant human *table-region* annotations and publicly allowed local analysis. Before download, pin exact dataset revision, identify original document/page, verify applicable rights and confirm whether the two annotators' regions agree. Never count derived pages as separate full original documents.
2. Attempt a **small, selective transfer capped at 50 MB total**. Do not fetch the 28 GB core ZIP, 7.5 GB extra ZIP, 39.8 GB v1.2 repository or hundreds-of-MB Parquet shards. If selective, lawful access to source and both annotations is unavailable, record `NOT_VERIFIED` and stop this pilot without spending or expanding the cap.
3. Keep any original PDFs, human boxes and extracted words local/private. Publish only dataset provenance, source digest, numerical table-region IoU, unmatched/misleading region counts and bounded diagnostics. Any detection correction must show source-aligned improvement on held-out pages without weakening export safeguards.
4. Later perform PubTables **full-PDF/source-rights** mapping on a small subset for cell-level diagnostics. Keep all missing/ambiguous cells unverified; do not turn corpus or publisher labels into a human sign-off.
5. Maintain the original 20-document blind-approval gate at **0/20** until full real-document two-reviewer references, multilingual OCR and performance evidence actually exist. If that independent evidence cannot be acquired at zero cost, report the formal Stable milestone as blocked while continuing honestly labeled development/production improvements with separate owner approval.

## Controls and exclusions

No source files, private document contents, annotation transcripts, reviewer identities, credentials, or raw user PDFs are included. No datasets were bulk-downloaded. No modification to OCR recognition, extraction, source-selection quality thresholds, release gate, licensing claim, hosting, deployment or payment systems is made. This report is research, **not a new certification result**. All older PRs stay open until separately reviewed; this branch disables automatic Vercel deployment in its first published tree.
