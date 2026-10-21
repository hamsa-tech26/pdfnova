# Kukureku V4 source-region diagnosis — 21 October 2026

## Observed, reproducible findings

Developer diagnostic on 20 SHA-pinned, distinct PMC original PDF files (242 source pages) used the externally published PubTables-1M **Detection_Annotations_Test** XML rectangles, one-to-one matching, IoU >= 0.50.

| Bounded experiment | Published boxes | Matched | Unmatched predictions | Meaning |
| --- | ---: | ---: | ---: | --- |
| Current V4 native detector | 34 | 5 | 11 | Source-box reference *comparison*, NOT a certified recall estimate |
| V4 + source-only numeric-row shadow | 34 | 5 | 14 | No additional source-box matches; worse false positives |
| Quantized Xenova Table Transformer ONNX | 34 | 1 | 18 at score >= 0.25 | Not a deployment candidate |
| Full-precision Xenova Table Transformer ONNX | 34 | 1 | 18 at score >= 0.25 | No measurable quantization-related improvement |
| Historical targeted original-PDF cases | 6 | 3 | 1 | Three published detection rectangles still missed |

**Critical source-alignment qualification:** the source PDF is independently downloaded from the PMC OA S3 mirror and verified by its pinned SHA256, while the PubTables-1M XML annotations describe **published page images**. We have **NOT verified that the exact pixels/crop, version and page transform of each supplied XML image are identical to each independently downloaded PDF page**. A shared PMC identifier, plausible aspect ratio, or a few correct matches do **not** establish pixel equivalence. Consequently **5/34 cannot safely be advertised as Kukureku's real-world recall** until that mapping is proven. The official rendered PubTables detection-test page-image archive is ~7.44 GB; no bulk image download is authorized here. The publisher also provides a PDF-coordinate annotation corpus, but obtaining/validating it remains a separate scoped operation.

## Why native numeric rescue did not help

Of the 29 regions without a baseline match, the post-hoc original-source mapping found:

- 8 with **zero** source-native text words in the reference box.
- 17 with **zero** source-native numeric tokens; 22 with at most one.
- Only 2 with two or more original native lines carrying at least two numeric tokens.
- 16 with ten or more native PDF words, which does not alone prove table-cell truth.

These categories overlap and do not automatically prove the detected content is a table. The native source-row shadow detector was **not** integrated. Adding its proposals did not improve matched boxes and increased unmatched predictions 11 -> 14.

## Conclusions and strict next gates

1. Verify official published page-image / PDF-coordinate reference alignment against the *exact original PDF versions* **before** optimizing to the 20-source score. A small legally permitted sample, not the full multi-GB image archive, is sufficient for preflight if it can be legitimately obtained; never claim pixel identity without proof.
2. Obtain a separate, rights-reviewed and independently annotated original-PDF cell/blank/merged-header reference for true table-quality assessment. Do not derive the reference from V4 Inspector output, pretrained model proposals, or published boxes alone.
3. Compare novel table detector candidates on a genuinely **unseen** original-PDF source set with both recall and unmatched/false-positive counts, then source-cell geometry and OCR correctness. Never tune against the 20 source labels and call the same set a held-out test.
4. Any browser-local visual model must separately pass memory, startup/download size, privacy, cancellation and 20–25 MB stress before production. The tested ONNX model did not justify integration.
5. **V4 Stable remains BLOCKED at 0/20 independently approved PDFs**. Hindi/Bengali OCR, 20 independent reviewed documents, cell/row/structure accuracy and performance requirements in `scripts/checkRelease37Gate.mjs` remain unchanged.

## CI evidence

- First pinned 20-source diagnostic: https://github.com/hamsa-tech26/pdfnova/actions/runs/39599997335
- Source-word geometry: https://github.com/hamsa-tech26/pdfnova/actions/runs/39644969804
- Shadow original-source numeric rescue: https://github.com/hamsa-tech26/pdfnova/actions/runs/39644223731
- Full-precision visual detector: https://github.com/hamsa-tech26/pdfnova/actions/runs/39645817970
- Original focused six-box diagnostic: https://github.com/hamsa-tech26/pdfnova/issues/75
- Dataset page-image vs PDF annotation descriptions: https://huggingface.co/datasets/bsmock/pubtables-1m

No source PDFs, XML pages, private OCR transcripts, page screenshots, uploaded files or model weights are committed by this investigation. This note is diagnostic only, not a release certificate.
