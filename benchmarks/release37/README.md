# Release 37 — PDF Engine V4 Phase 10.15–10.20

Current designation: IN DEVELOPMENT, NOT V4 STABLE.

## Measured synthetic fixtures (10.15–10.17)

Run these commands from the repository root:

    npm run benchmark:release37:fixtures
    npx playwright test --config=playwright.benchmark.config.mjs

The fixture generator makes three reproducible PDFs: a three-page hybrid (native, scanned, native-with-scanned-inset), a nested-header PDF and a two-page continuation PDF. The browser benchmark exercises the actual Engine Inspector and writes JSON evidence to benchmarks/release37/reports/. The hybrid must OCR only the fully scanned page, retain native pages and explicitly mark inset OCR unverified. The complex and continuation fixtures currently capture diagnostics, NOT structure accuracy certification.

## Scope and honest limitations

Phase 10.15: native-first selective OCR and preservation smoke is testable. Native-text pages with raster paint operations are now flagged for explicit inset review, but image presence can also be a logo, and automatic inset OCR remains NOT VERIFIED.

Phase 10.16: structural review warnings detect invalid/duplicate column slots and missing cells. Nested headers, merged cells, forms, gridless structures, and independent geometric structure fidelity are NOT VERIFIED.

Phase 10.17: merged row provenance checks page sequence. Changes to repeated headers, layout and table identity must be compared against independent ground truth before acceptance.

Phase 10.18: current scanner uses only the English Tesseract model. Native Bengali or Devanagari text can be detected; scanned Bengali/Hindi OCR accuracy is NOT VERIFIED. Multilingual models, licensing, script routing and data are pending.

Phase 10.19: report includes elapsed time, but measured peak memory, cancellation, responsive main-thread behavior, page batching and 20–25 MB workloads are pending.

Phase 10.20: the independent formal freeze gate is deliberately BLOCKED until real-world coverage passes.

## Production release gate (must not be bypassed)

    npm run qualify:v4:stable

The checked-in report.json is an explicit NOT_VERIFIED placeholder. Gate requires 20+ distinct consented/de-identified real PDFs, at least two cases each of native, scanned, hybrid, complex, multipage, rotated, Hindi and Bengali, separately measured text/row/structure accuracy per slice, independent linked phase evidence, Phase 10.14 real-browser OCR gate PASS, no critical regressions, and measured 20–25 MB memory, responsiveness, batching and cancellation stress. No green build or synthetic benchmark substitutes for this gate. Do not weaken thresholds to force a pass.

Never commit original personal, government, or confidential source documents; only consented/de-identified metadata, hashes and aggregate score evidence. A human reviewer must verify corpus quality and reference labels.

The GitHub Actions V4 Stable Release Gate intentionally fails on the NOT_VERIFIED report and must remain a merge/deploy blocker until independent evidence is supplied and reviewed. Never mark it successful just because separate build and synthetic OCR jobs pass.

## Real-world corpus intake and independent scoring

Candidates are listed in [candidates.json](./candidates.json), but none is currently accepted toward the 20-document formal qualification. Public availability does not automatically imply permission to reuse copyrighted third-party figures.

Use the USGS rights guidance (https://pubs.usgs.gov/documentation/faq) and the DocLayNet dataset card (https://huggingface.co/datasets/docling-project/DocLayNet) to check each source. IBM DocLayNet declares CDLA-Permissive-1.0, but its annotated page layouts are not by themselves complete table-cell or multilingual OCR labels. Do not silently reuse research-only or noncommercial benchmark PDFs for a commercial product.

Put permitted original PDFs, independent reference labels and complete PDF Engine V4 Inspector output inside benchmarks/release37/private/. This path is gitignored.

Sample manifest at benchmarks/release37/private/manifest.json:

```json
{"documents":[{"id":"reviewed-001","origin":"real-world","usageRights":"public-domain","rightsUrl":"https://example.org/rights","rightsConfirmed":true,"sourceUrl":"https://example.org/file.pdf","sha256":"64_CHAR_HEX_SHA256","categories":["native","complex"],"independentReferenceReview":true,"reviewedBy":"Independent QA reviewer","reviewedAt":"2026-10-08","localPdf":"benchmarks/release37/private/reviewed-001.pdf","referenceJson":"benchmarks/release37/private/reviewed-001-gold.json","inspectorJson":"benchmarks/release37/private/reviewed-001-v4.json"}]}
```

Replace the illustrative URLs and hash before use. Reference labels must be independently verified rather than copied from V4 output. Gold JSON has tables[] with rowCount, columnCount and cells[]; each cell needs rowIndex, columnIndex, text, and optional rowSpan/columnSpan. The observed file must be the complete JSON exported by the actual Engine Inspector.

Run: npm run benchmark:release37:corpus

Scoring is positional and separately measures exact text, complete rows and structure; missing/extra cells and rows count as failures. It validates PDF signatures, SHA-256 input hashes, source/rights evidence, independent reviews, and the presence of actual Inspector output. It only writes aggregated JSON to the ignored benchmarks/release37/reports/real-corpus.json file.

### Public-document pilot

An optional GitHub CI job fetches the genuine publisher-hosted USGS sir20245103 report, copies the first three real pages without altering page contents, and runs the actual V4 browser Inspector. Only SHA-256s, routing, extraction counts and elapsed time are uploaded. Neither PDFs nor extracted content is uploaded to GitHub.

Run locally: npm run benchmark:release37:public-pilot, then npx playwright test --config=playwright.pilot.config.mjs.

The pilot is non-blocking and not a scored table-accuracy benchmark. These three pages count as no more than one real source, and the pilot is not formal acceptance evidence until rights and ground truth have been independently reviewed.

The formal V4 Stable gate remains intentionally BLOCKED until complete real-world, structure, language, regression and stress evidence is available.

The reference scorer rejects incomplete table annotations (including omitted blank cells), overlapping gold spans and malformed predicted merge geometry. It does not repair predictions from reference answers. Source-document accuracy remains NOT VERIFIED without independent labels.

A real-world document must have a distinct SHA-256, not merely a new name or manifest ID. The formal gate compares independently evidenced category document counts against category metrics. Duplicate PDF content cannot satisfy the 20-document requirement.

PubTables-1M (Microsoft Research) is a candidate source for independently reviewed blank cells, headers, and table geometry. Its reference annotations must be mapped to source PDF pages and their respective rights reviewed; its large archives are NOT downloaded as part of CI.
