# Mission 171: outward raster redaction coverage

For a 100 x 100 raster, a selection beginning at x=10.5, y=20.5 pixels was
painted from x=11, y=21. Nearest-origin rounding left selected boundary pixels
unmasked and shifted the mask into unselected pixels.

`redactionPixelBounds` normalizes the selected rectangle, rounds its origin
down and its far edges up, and keeps the result within the rendered page.
The actual redaction painter now uses these bounds. PDF rendering, raster
export, metadata/object removal, page rotations and resource limits are unchanged.

## Measured component regression

For the constructed fractional selection, an independent Pillow raster check
using the actual production helper's bounds measured:

| Measurement | Before | After |
| --- | --- | --- |
| Exposed pixels intersecting the selected area | 51 | 0 |
| Overwritten pixels outside the selected area | 51 | 0 |

Two additional unit tests cover edge pixels, full-page masks, backwards drags,
clipping, right/bottom boundaries and three raster sizes. The new browser
regression checks every canvas pixel against independent interval-intersection
conditions on eight constructed cases, including surrounding pixels.

Local branch checks: 139 files / 705 unit tests PASS, TypeScript PASS,
changed-file lint PASS, whitespace checks PASS. These use the cached older
test runtime because the environment's proxy is unreachable; they do not
establish a build or audit pass on the exact patched dependencies.

Chromium launch is blocked locally by a process-sandbox `setsockopt` EPERM.
The browser regression is prepared but NOT_RUN. The Pillow component result
does not substitute for a downloaded-PDF visual/text/object inspection or
independent real-document redaction acceptance. Hosted exact-branch Validate
and Browser Reliability must pass before release consideration.

The existing PR workflow filters accept the maintenance base for stacked
verification. This branch is disabled in Vercel before any remote creation.
No production merge/deployment or independent document qualification occurred.

## Authorized publication and actual PDF verification

The owner authorized this separate draft on 24 October 2026. It retains the
patched maintenance dependency baseline and disabled branch deployment guard.
Validate and Browser Reliability explicitly check out the published head SHA;
Validate runs standalone TypeScript after its production build.

The added browser-download scenario contains a selectable secret, form value,
link, attachment and metadata marker. The independent pinned PyMuPDF reader
checks that the exported two-page PDF retains no selectable text, form fields,
annotations, links, fonts, attachments, source markers in any decompressed
object or extra image objects. It verifies both visible masking and the actual
embedded image pixels, as well as preservation of the unselected second page.
Exact mask-edge coverage remains covered separately before JPEG compression.

Checker controls run locally: properly masked image-only fixture PASS;
painted overlay retaining source text rejected; image-only PDF with an
unredacted underlying image behind an overlay rejected. These validate the
checker, not the actual product output. Hosted browser results are pending.
