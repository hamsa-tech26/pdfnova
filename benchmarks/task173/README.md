# Task 173 — Fail-closed redaction page-plan validation

Source: Task 172 integration candidate `05c7350f0f1da61904648ef54f2d526ec3dc5e83` (#123).

## Reproducible issue
The raster-redaction exporter previously counted "useful" rectangles across the
unvalidated page map before reading the original PDF's page count. A stale
selection on page 99 for a 2-page PDF passed the nonempty-count check, was
never painted, yet the exporter could rebuild an unmasked raster PDF and
return a successful download. Mixed valid and malformed masks could also be
silently skipped.

## Correction
Validate every supplied page key against the actual loaded source page count
before rendering or creating any output. Reject noncanonical page indices,
out-of-range pages, non-array values, malformed and nonfinite coordinates,
fully off-page / tiny masks, and partially invalid selections. Fail the whole
operation if one mask cannot be safely applied. Preserve backwards drag
normalization and legitimate page clipping. Keep the existing outward pixel
coverage correction and private raster export unchanged.

## Tests and gates
- Four added focused Vitest regressions (valid multi-page and backwards-drags;
  missing, mixed and noncanonical pages; malformed and nonfinite rectangles;
  empty and invalid selection maps).
- Full unit, OCR, browser reliability, standalone TypeScript, lint, production
  build and complete/production audits required on the exact branch head.
- The change is a pre-export safety invariant; the existing downloaded-PDF
  redaction/underlying-image inspection must remain passing.
- No sample-specific detector claims, real-document certification or V4 Stable
  credit. Engine V4 Stable remains 0/20.

This branch has Vercel deployment disabled in its first commit and must stay
DRAFT. Do not merge or deploy without separate owner authorization.
