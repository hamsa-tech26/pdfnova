# Task 254 — original-source coordinate-frame plausibility

**NO MERGE / NO DEPLOY / NO RELEASE 216 RESUME.** This is numeric, source-pinned, diagnostic-only work atop the existing Task 232 branch (#202).

## Why
The published PubTables XML annotation viewport and original PMC PDF page coordinate frame are currently mapped by width/height scaling. Without the exact source annotation image and independently reviewed page/crop/rotation correspondence, matching XML names or page dimensions does **not** prove pixel-level identity.

## Test
For each of the five annotated source pages, record annotation image dimensions, PDF extracted page viewport dimensions, X/Y scale factors, aspect-drift percentage and a 3% plausibility flag in the ephemeral numeric-only source report. Invalid dimensions fail closed, source-only unit tests cover normal and rotated/mismatched cases. We **do not** change the detector, 0.50 IoU threshold, data extraction, rights status or V4 certification. Even matching aspect ratios leave pixel identity and independent cell truth **NOT VERIFIED**.

## Existing observed detector baseline
Source diagnostic at prior head: **3/6** matched boxes, **3** misses, **1** unmatched predicted region. Page 1 and page 4 of PMC1064082 remain missed; PMC1064098 page 6 is image-only in the published box. This task establishes whether an obvious frame mismatch requires investigation before interpreting detector misses. It does not convert image-only content to native text or authoritatively relabel prose as tables.

## Release gate
Exact-head `Release 112 External Table-Box Diagnostic`, `Validate`, and `Browser Reliability Smoke` must pass. Any newly observed frame inconsistency blocks reliance on that region for accuracy claims until independent source-image verification. Formal Engine V4 Stable remains **0/20**.
