# Phase 10.14 — OCR stress benchmark

The four synthetic PDF generators are in `scripts/generatePhase10_14[a-d].mjs`. This benchmark records ground-truth rows from the generators and **never fabricates OCR results**.

Run `npm run benchmark:ocr:baseline` to create an explicit `NOT_RUN` report. This verifies report generation, NOT OCR accuracy.

Once actual Engine V4 outputs have been captured as JSON, run:
`node scripts/scorePhase10_14.mjs path/to/actual-results.json`

The JSON must be an array of objects `{"id":"10.14a","rows":[["1","..."],...]}` for fixture ids `10.14a` through `10.14d`. The scorer calculates exact normalized cell and row matches. Missing fixtures have `NOT_RUN` status and cause a nonzero exit when an input path is supplied. Missing cells are counted as failures; extra rows prevent an exact match.

The output `benchmarks/phase10_14/reports/latest.json` should be treated as a local artifact, not committed as evidence without the corresponding input and provenance. The scoring test cases are unit tests of the scorer only. **Real OCR accuracy remains unverified until actual results are collected.**

Follow-up: wire deterministic Engine V4 extraction into this input format, produce real fixtures, capture per-page timing and memory; add real-world document corpus and a separately reviewed privacy policy for fixture data.
