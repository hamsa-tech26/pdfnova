# Task 143 — Selective DocLayNet redundant-annotation preflight

**Decision:** STOP / NOT_VERIFIED for the proposed two-page independent table-region IoU pilot.  
**Date:** 2026-10-27 (Asia/Kolkata).  
**Predecessor:** Task 142 draft PR #143 at `59b1fe5fb1a3b797a0a8bddcf03b8617ac7a0aef`.  
**Transfer:** <30 MB in total including repeated small range requests, below the 50 MB cap. No archive, page PDF, layout image, proprietary source, or raw annotations committed.

## What actually ran

The [official IBM DocLayNet core archive](https://codait-cos-dax.s3.us.cloud-object-storage.appdomain.cloud/dax-doclaynet/1.0.0/DocLayNet_core.zip) reported:

- Length **30,012,083,650 bytes** and `Accept-Ranges: bytes`.
- Object ETag `"52242220284e12538949c5b06eb2777c-448"`, last modified 2022-08-02.
- ZIP64 end record: 81,478 entries, central-directory offset 29,999,021,762, central-directory size 13,061,790 bytes.
- A small 1,000,000-byte prefix of the central directory exposed the three COCO annotation member offsets and ZIP checksums. We requested only the compressed byte ranges, inflated them in memory, and printed aggregate counts. We did **not** download the archive, images or the 7.5 GB extra PDF archive.

| Member | Compressed bytes accessed | Original JSON size | Image/page records | Annotation records | Human table boxes | Nonzero `precedence` |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `COCO/test.json` | 5,792,451 (twice, second time for checksum/category audit) | 39,851,786 | 4,999 | 66,531 | 2,394 across 1,439 pages | **0** for all image and annotation entries |
| `COCO/val.json` | 8,441,685 | 59,467,367 | 6,489 | 99,816 | 2,269 | **0** for all image and annotation entries |
| `COCO/train.json` | **8,000,000-byte compressed prefix only** of 81,816,237 | 565,443,929 **total, not fetched** | All 69,375 image metadata records appeared in the decompressed prefix | Only an incomplete prefix of annotations inspected | **Not measured** | **0** on all 69,375 image records; zero `precedence: 1` in observed annotation prefix, **not a finding about the uninspected remainder** |

**Integrity checks:** Test JSON expanded CRC32 `859155c5` agrees with the ZIP central directory. Test member compressed SHA-256 `57ce40b1edee33dfb63eaa2e0a566a572f18c6f1ea2135cde2c88a6334ef4bdd`; validation JSON central-directory CRC32 `f7074b06`. The core archive URL, object ETag, byte positions and member identifiers establish provenance without republishing content.

The test file's 1,439 table-containing pages span financial reports (862), scientific articles (52), laws/regulations (126), government tenders (78), manuals (257), and patents (64). They are useful as a **single-label prospective layout corpus** but cannot meet the proposed independently redundant table-region comparison from this evidence.

## Why the pilot stops

1. The canonical source [DocLayNet README](https://github.com/DS4SD/DocLayNet/blob/main/README.md) says a subset of pages has repeated human layout annotation and defines `precedence` to distinguish annotation order. But **neither complete small public evaluation split exposes a second label for a single table region** in the inspected annotations. Training was not downloaded in full because its compressed annotation JSON alone is **81.8 MB**, over the *remaining* cap. Absence across all training annotations is **not** claimed.
2. The selective [DocLayNet-v1.2 viewer](https://huggingface.co/datasets/docling-project/DocLayNet-v1.2) omits `precedence` in inspected records; its accessible single-page PDF is not the complete original report. Pair correspondence cannot be independently verified by joining v1.2 samples to the duplicate human labels from the original data based on evidence obtained.
3. For any chosen sample, underlying **original-document redistribution/reuse rights** are not resolved merely by the dataset curator's annotation license. No PDF/image was retrieved or used for a comparison because both rights and human-pair preconditions failed.
4. Consequently **no engine prediction, table-region IoU, accepted sample or Stable certification score** is reported. Writing a "passed" pilot or counting generic published labels as two original independent reviewers would be misleading.

## Outcome and safe next move

- **Task 143: NOT_VERIFIED / stop**, as stipulated in Task 142. The unchanged Engine V4 Stable gate remains **0/20 independently accepted original full PDFs**. No detector thresholds, classification, OCR code, export safeguards, certification criteria or deployment settings changed in this probe.
- **Engineering priority after this blocked pilot:** return to reproducible, source-linked user-facing table-export refusals already documented in Task 181 / draft PR #133. Pick one bounded recoverable refusal, prove correct source cells and downloadable XLSX on an original permitted PDF; otherwise preserve the refusal and mark `NOT_VERIFIED`. Continue separating development fixes from formal 20-document certification.
- No owner action is needed to interpret this result. No charge, outreach, Vercel deployment, branch preview, merge or production action was undertaken.
