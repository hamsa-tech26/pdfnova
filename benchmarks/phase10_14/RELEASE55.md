# Kukureku Release 55 — OCR V4 measured-error engineering

This release is a focused, **candidate** reliability correction with recorded synthetic benchmark evidence. It does **not** certify OCR V4 Stable, arbitrary scanned PDFs or real-world table fidelity.

## What changed

- In enhanced-crop retries, an overlapping primary token previously always won. The merge now replaces it only when the primary confidence is below 70, retry confidence is at least 80 and at least 15 points higher, and the retry token is nonempty. Existing strong primary tokens and disjoint words are preserved; original OCR reading order remains stable.
- Added nontextual, position-specific diagnostics for Phase 10.14 rows and columns. Distinguishes missing cells, mismatches, extra rows and potential adjacent shifts, without altering the gold rows or silently aligning failures. Report is `benchmarks/phase10_14/reports/release55-diagnostics.json`.
- The real browser OCR benchmark still runs all four original synthetic PDFs and keeps the existing strict release gate: **95% exact cells, 75% exact rows, correct count, confirmed actual OCR per fixture**. Failed or missing OCR remains BLOCKED.

## Previous evidence and boundaries

An Oct 9 benchmark on the *separate open Release 37 draft* showed the perspective-distortion fixture at 97.78% exact cells and 88.89% exact rows, but that draft failed its broader V4 Stable release gate and was not merged. Do not transpose or claim those values for this Release 55 branch: it must be remeasured independently against its own exact commit. Benchmark CI stores 14-day artifacts. The Release 37 draft remains separate and unmerged.

Release 54's real-document framework still requires eight distinct, rights-approved, independently annotated PDFs and cannot pass without them. The Phase 10.14 synthetic benchmark passing is insufficient for real-document or Phase 10.20 qualification. The unchanged V4 Stable freeze gate has not been waived.

## Workflow

1. PR Validate and Browser Reliability Smoke must pass on the candidate commit.
2. Triggered Phase 10.14 Real OCR Benchmark executes real browser OCR, exports four JSON results, scores original manifest rows and emits Release 55 error diagnostics. Inspect **exact** measured accuracy, including regressions.
3. If this code's OCR acceptance gate or quality regressions fail, leave PR unmerged and production unchanged; use diagnostics to guide fixes. Only a validated, reviewable branch is eligible for a single consolidated production deployment.
4. Never promote a V4 Stable label merely because synthetic benchmark passes.
