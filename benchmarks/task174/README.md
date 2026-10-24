# Task 174 — Explicit native provenance safeguard

Production base: `0d42c81091617d30194a669b0c543f522065b5bd` (post-release Task 172/173). This change is a scoped
detector integrity hardening and NOT a correction to ICDAR Sample 8 or Sample 9.

## Reproduced logic defect
`findNativeDenseGridSubregions` admitted words with missing
`extractionProvenance` as "native" because its negative-only test rejected
`ocr-tesseract` but allowed `undefined`. The PDF data model makes provenance
optional. Thus a dense numeric block with unknown-origin words could be
mislabelled as confidently native PDF extraction.

## Correction
Require a positive `extractionProvenance.source === "native-pdf"` marker for
every word on each source line before source-native grid recovery can run.
Preserve established OCR routing and all table thresholds, word content,
line ownership, page IDs and coordinates.

A source-level regression covers confirmed native data (still recovered),
all unknown-origin data (refused), a single unknown data cell in a native
paragraph (refused), input immutability and word-ID preservation.

## Required release gates
Run GitHub CI on the exact branch commit, including full unit and OCR tests,
TypeScript, build, security audit, browser reliability, and the public-document
pilot if triggered. Distinguish a successful synthetic guardrail from a
real-document table-accuracy improvement. No new benchmark certification is
granted; formal Engine V4 Stable stays 0/20.

## Scope and deployment
The branch is Vercel-deployment-disabled in its very first Git tree.
Keep the PR draft; do not merge or deploy without separate explicit approval.
Samples 8 and 9 still need validated original/reference page correspondence
and rights; the existing research PR #117 is left untouched.
