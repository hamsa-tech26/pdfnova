# Release 37 — PDF Engine V4 Phase 10.15–10.20

Current designation: IN DEVELOPMENT, NOT V4 STABLE.

## Measured synthetic fixtures (10.15–10.17)

Run these commands from the repository root:

    npm run benchmark:release37:fixtures
    npx playwright test --config=playwright.benchmark.config.mjs

The fixture generator makes three reproducible PDFs: a three-page hybrid (native, scanned, native-with-scanned-inset), a nested-header PDF and a two-page continuation PDF. The browser benchmark exercises the actual Engine Inspector and writes JSON evidence to benchmarks/release37/reports/. The hybrid must OCR only the fully scanned page, retain native pages and explicitly mark inset OCR unverified. The complex and continuation fixtures currently capture diagnostics, NOT structure accuracy certification.

## Scope and honest limitations

Phase 10.15: native-first selective OCR and preservation smoke is testable; mixed page image insertions are NOT VERIFIED.

Phase 10.16: structural review warnings detect invalid/duplicate column slots and missing cells. Nested headers, merged cells, forms, gridless structures, and independent geometric structure fidelity are NOT VERIFIED.

Phase 10.17: merged row provenance checks page sequence. Changes to repeated headers, layout and table identity must be compared against independent ground truth before acceptance.

Phase 10.18: current scanner uses only the English Tesseract model. Native Bengali or Devanagari text can be detected; scanned Bengali/Hindi OCR accuracy is NOT VERIFIED. Multilingual models, licensing, script routing and data are pending.

Phase 10.19: report includes elapsed time, but measured peak memory, cancellation, responsive main-thread behavior, page batching and 20–25 MB workloads are pending.

Phase 10.20: the independent formal freeze gate is deliberately BLOCKED until real-world coverage passes.

## Production release gate (must not be bypassed)

    npm run qualify:v4:stable

The checked-in report.json is an explicit NOT_VERIFIED placeholder. Gate requires 20+ distinct consented/de-identified real PDFs, at least two cases each of native, scanned, hybrid, complex, multipage, rotated, Hindi and Bengali, separately measured text/row/structure accuracy per slice, independent linked phase evidence, Phase 10.14 real-browser OCR gate PASS, no critical regressions, and measured 20–25 MB memory, responsiveness, batching and cancellation stress. No green build or synthetic benchmark substitutes for this gate. Do not weaken thresholds to force a pass.

Never commit original personal, government, or confidential source documents; only consented/de-identified metadata, hashes and aggregate score evidence. A human reviewer must verify corpus quality and reference labels.
