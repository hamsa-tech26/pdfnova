# Lossless redaction and visible-page geometry

Base: main `85880e0181ee1e7f44990225aefe8563a3ece7a7`, also the production
commit reported by Vercel for kukureku.com during the 25 October 2026 audit.

PRs #121 and #122 remain drafts against the older maintenance branch, but
their source-character/merge and fractional-mask fixes are already integrated
in main through #123. PR #125's verifier and browser test are identical to
main after #126. All three old heads conflict with current main; #122 also
conflicts with newer fail-closed redaction-plan validation. None was modified,
closed, retargeted or merged. Smart Scanner draft #129 was read only.

## Confirmed defects and correction

Although mask bounds covered touched pixels before JPEG encoding, the actual
download did not preserve those pixels: the five-page cropped/rotated
high-frequency synthetic control had 506,048 mismatches among 529,100 pixels.
This measures raster differences, not recovered secret text or a forensic
acceptance score. Both source and final JPEG passes can mix neighboring
colors; the old output checker deliberately inspected only inset regions.

Render to PNG, composite transparency onto white, paint existing outward
rounded masks, and embed the resulting PNG. The existing 1.75 render scale,
3200-pixel maximum dimension, plan refusal, page streaming and new-document
rebuild remain in force. The output retains one opaque image per page.
Lossless images may produce larger PDFs than the previous JPEG output.

The renderer's physical viewport is also now carried to redaction export.
Reading CropBox alone missed its intersection with MediaBox and UserUnit:
a 300×230 CropBox around a 240×200 MediaBox with UserUnit 2 was previously
written as 300×230 instead of the rendered 480×400 points (before rotation).
The additional renderer fields do not change other tools' pixel dimensions.

## Regression evidence and limits

The browser-download regression checks all four quarter-turn rotations,
nonzero CropBox origins, fractional, touching and overlapping selections,
unselected pages, CropBox clipping and UserUnit. Independent PyMuPDF opens
the actual PDF, checks physical geometry, every selected raster pixel,
every unselected raster pixel against a local lossless PDF.js reference,
absence of retained text/fields/links/fonts/attachments, and extra images.
The existing stronger marker/object privacy test and negative controls remain.

The public-document pilot adds an actual USGS five-table-page redaction
download: fully mask the first page and independently compare every remaining
rendered pixel. Publisher hashes are verified, and logs contain counts/hashes
only. PDF bytes, text, PNG references and workbooks stay ephemeral and are
excluded from the pilot's uploaded artifacts.

Local publisher intake is blocked by the managed proxy (HTTP CONNECT 403).
The public pilot checks out the exact published development head; its results
must be read separately from synthetic results. Branch-specific hosted CI
receipts and final counts belong in the draft description, without editing
the tested source commit to add its own SHA.

Rasterization intentionally removes selectable and interactive content from
all pages; preserving unselected pixels does not preserve original PDF objects.
These bounded regressions do not establish arbitrary-document forensic
security, safe user mask placement or independent document acceptance.
Engine V4 Stable remains 0/20, with existing detector misses unresolved.

The development branch is disabled in vercel.json from its first remote
commit. No merge, preview/production deployment, spending, Android or Smart
Scanner development is authorized by this change.
