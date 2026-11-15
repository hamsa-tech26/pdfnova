# Task 254 — Original-source coordinate-frame plausibility

**DRAFT / NO MERGE / NO DEPLOY.** This branch uses current production baseline `4d41cdf36c2319f59ec8b5c35d4a999799010802` to avoid the merge-conflicted Task 232 PR #202 and run exact-head source CI.

For each annotated page of SHA-verified original PMC PDFs, record source-PDF viewport dimensions, published annotation image dimensions, X/Y scales, aspect-drift percentage, and a triage-only plausible-frame flag. There is no imaging/pixel identity proof, publication rights sign-off, independently annotated cells, detector adjustment or qualification credit. Numeric output only; all original PDFs and XML remain ephemeral in CI.

Baseline before this modification: **3/6 published boxes matched at IoU ≥ 0.50**, **3 misses**, **1 unmatched prediction**, **0/20** formal V4 accepted documents. The currently missed regions are PMC1064082 p1 (uncaptioned/prose ambiguity), PMC1064082 p4 (mixed images/text) and PMC1064098 p6 (image-only in published box). The new frame plausibility data must be reviewed before treating those misses as a detector-quality conclusion. Matching proportions are necessary but never sufficient to prove reference-image/source-page equality.

Run exact-head Validate, Browser Reliability Smoke, and Release 112 External Table-Box Diagnostic. Do not weaken IoU or promote OCR/paragraph proxies to tables. No automatic deployment or Release 216 change.
