# Kukureku — PDF Engine V4 formal qualification (development only)

**Current state: NOT VERIFIED. This work does not certify V4 Stable or fix OCR recognition.**

This directory contains a fail-closed, independent assessment foundation recovered from draft PR #39 onto current production `main`. It does not change the existing OCR, PDF-to-Excel, parsing, or PDF processing paths.

## Why this is separate from the existing Golden Document suite

The current Golden Document workflow remains the release-level, privacy-preserving real-document regression suite. Formal V4 Phases 10.15–10.20 additionally require broad, independently reviewed table geometry, multilingual, performance, cancellation, and stress evidence across **at least 20 distinct real PDFs**. Passing a synthetic benchmark or an individual physical test is not enough.

The public OCR PDF tool is currently **English-only**. Hindi/Bengali recognition and reference datasets are future work; the formal gate correctly remains blocked until those are implemented, evaluated and approved. Do **not** change product claims to V4 Stable merely because unit tests pass.

## Local-only usage

1. Work with licensed, public-domain, properly consented or safely de-identified PDFs. Obtain human-confirmed usage rights and separately reviewed reference annotations. Never add document bytes or identifiable text to GitHub, commit messages, CI artifacts, or issue comments.
2. Keep every source PDF and its human-reviewed reference JSON and captured V4 Inspector JSON **only** inside `benchmarks/release37/private/`. This directory, along with generated score reports, is gitignored.
3. Create `benchmarks/release37/private/manifest.json`, with a `documents` array of entries like:

```json
{
  "documents": [
    {
      "id": "reviewed-example-001",
      "origin": "real-world",
      "usageRights": "public-domain",
      "rightsUrl": "https://example.org/rights",
      "sourceUrl": "https://example.org/example.pdf",
      "rightsConfirmed": true,
      "categories": ["native", "complex"],
      "sha256": "<actual 64-character PDF SHA-256>",
      "independentReferenceReview": true,
      "reviewedBy": "Independent reviewer",
      "reviewedAt": "2026-10-15",
      "localPdf": "benchmarks/release37/private/source.pdf",
      "referenceJson": "benchmarks/release37/private/gold.json",
      "inspectorJson": "benchmarks/release37/private/actual.json"
    }
  ]
}
```

4. Run `npm run benchmark:v4:corpus` **locally only**. It validates source hashes and path containment, scores actual V4 output independently against reviewed table labels, and writes an aggregate-only report to `benchmarks/release37/reports/real-corpus.json`.
5. Inspect limitations; then add independently documented phase, actual-2026 Phase 10.14 OCR, critical regression and measured performance evidence to a **private local copy** of the score report. Never claim a metric was measured unless backed by reproducible execution and review.
6. Run `node scripts/checkRelease37Gate.mjs benchmarks/release37/reports/real-corpus.json` on the completed local evidence report. For a repo-only no-evidence baseline run `npm run qualify:v4:stable`; it is **expected to exit nonzero and print BLOCKED** against `benchmarks/release37/report.json`.

## Acceptance thresholds

- At least **20 distinct real PDF SHA-256 hashes**; at least **2 independent documents** in each of native, scanned, hybrid, complex, multi-page, rotated, Hindi and Bengali categories.
- Independently measured exact cell accuracy **>=95%**, row accuracy **>=75%** and structure accuracy **>=90%** per category. Inference from synthetics and unreviewed ground truths is disallowed.
- Completed and source-linked evidence for Phases **10.15–10.19**; no critical regressions; actual Phase 10.14 OCR gate PASS.
- Measured **20–25 MB** stress coverage, peak heap <=512 MiB, main-thread blocking <=200 ms, verified page batching and cancellation.

Unit tests for `checkRelease37Gate` use explicitly **mocked records** to test fail-closed decision logic; a mock PASS is *never* production evidence. Only a fully inspected corpus and real measurements can clear the formal gate.

## Status of original draft PRs

- PRs **#56 / #63**: most OCR review-safety notes, checkbox clues and the metadata fix are already in deployed main. They must **not** overwrite later OCR repairs.
- PR **#59**: PDF-to-Excel is already released through PR #65; experimental geometry and OCR heuristics need independent qualification and remain **off**.
- PR **#39**: outdated integrated branch must not be merged wholesale; this branch selectively recovers the independent scoring and formal gate infrastructure.
- The old PRs are intentionally kept open until the user authorizes their closure; do not merge or deploy them as a batch.

Any future feature migration must start from current production `main`, be tested on a new development branch, and receive independent release approval.
