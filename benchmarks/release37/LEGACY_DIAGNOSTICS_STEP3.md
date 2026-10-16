# Step 3 — Legacy V4 Diagnostic Consolidation

This development-only change starts from production main commit 0c145a429a41cc24e117f927c60817ebdc2d996a. It selectively preserves useful research/diagnostic source files and tests from draft PR #59 and PR #39. Neither old PR was merged, edited or closed.

## Files preserved

From PR #59 (edf853ea548f7a79269bdf7817c6ba2ca93b7ccd):

- OCR heading candidate helper and tests: flags possible missing titles as unverified hypotheses without rewriting original OCR output.
- OCR identifier candidate helper and tests: bounded region reread eligibility and unverified alternative text comparisons.
- Conservative horizontal row drift estimator and tests: standalone research only.
- Perspective row assignment estimator and tests: standalone research only, deliberately not connected to the production SmartCellBuilder. The legacy integration test was adapted to check that the current production builder remains unchanged.

From PR #39 (97568fda034515206707282079e8cec824cbe704):

- Release 37 scoped audit helper and unit tests: a standalone, diagnostic-only function, not wired into analyzePdfV4 and not an independent accuracy certificate.
- Release 37 synthetic fixture generator: run manually to create three synthetic examples; files are not accepted as independent original PDFs.
- The retired raster paint property is handled as an optional legacy signal because current PdfPageModel does not populate it. Missing evidence remains NOT_VERIFIED.

## Explicitly not included

- No legacy release37-stable.yml workflow; that version would prematurely require independent evidence on ordinary development PRs.
- No obsolete qualification browser test assuming an integrated audit result.
- No modifications to live OCR recognition, conversion, table builder, V4 pipeline, exports, user routes, benchmark thresholds or human review attestation logic.
- No activation of experimental row geometry corrections, perspective transforms or alternate OCR readings.
- No original PDFs, private OCR output or human reviewer information.

## Validations on temporary local branch

- TypeScript: passed.
- Lint: passed.
- Unit tests: 565 passed across 110 suites, including 29 targeted migrated tests.
- Next.js optimized production build: passed, without deployment.
- Real publisher USGS pilot: 4 browser tests passed; five table sheets and 147 of 147 developer-reference cells matched. Not independent qualification.
- OCR: 5 actual browser tests passed for digital text, embedded text review, low-resolution safety, multiline heading and image-only PDF.
- Synthetic diagnostic generator: produced three fixtures, clearly marked synthetic.
- Existing V4 formal qualification gate: remains BLOCKED at 0/20 as designed.
- The Inspector showed a duplicate React key warning during the USGS pilot; this is not resolved by this diagnostic preservation PR and is tracked separately from the passing workbook regression.

## Release controls

No Vercel preview or production deployment authorized. The branch adds a deploymentEnabled=false entry for itself in vercel.json. No merges or closures of draft PR #59 or PR #39. All new code is standalone research/diagnostic; any activation must be separately justified through real-world source benchmarking and a new explicit owner approval.

PMC scientific-table detection Issue #75 and independent qualification Issue #38 remain separate unresolved engineering and evidence tasks.
