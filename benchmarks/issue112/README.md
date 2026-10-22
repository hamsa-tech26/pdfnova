# Issue 112: offline alignment preflight; official evidence blocked

## Result

No official PubTables image/PDF pair was verified in this investigation. Issue
[112](https://github.com/hamsa-tech26/pdfnova/issues/112) remains open. V4 Stable
remains 0/20, and [Issue 75](https://github.com/hamsa-tech26/pdfnova/issues/75)
remains open. No detector, conversion or production behavior changes.

Reviewed Draft [PR 111](https://github.com/hamsa-tech26/pdfnova/pull/111), including
`benchmarks/release166/diagnosis.md` at commit
`4c9e7b63b20ed146924614512d53f6552cf54c36`, the existing source downloader,
box scorer and detection regression tests. The benchmark scales image rectangles
to PDF coordinates without establishing image identity. Its 5/34 comparison and
0/31 verified images do not establish real-world detection accuracy. A pinned
PDF hash authenticates that PDF, not its relationship to separately published XML.

## Publisher evidence and exact blocker

The [official Microsoft repository README](https://github.com/microsoft/table-transformer/blob/main/README.md)
(Git blob `15eea49d75df39143524e52c97583c9798bef5e1`) explicitly distinguishes
page-image detection archives from PDF-coordinate JSON annotations. It links the
publisher's Hugging Face mirror and describes Microsoft download links requiring
a generated SAS token. It does not supply proof that our separately retrieved
PMC PDF versions match those page images. The linked demo image is not a
version-pinned Detection Test reference and is not used as one.

The repository [LICENSE](https://github.com/microsoft/table-transformer/blob/main/LICENSE)
(Git blob `9e841e7a26e4eb057b24511e7b92d42b257a80e5`) is MIT for software.
This investigation does **not** interpret that as verified licensing for each
dataset image or underlying article. Dataset/sample-specific terms and original
PDF-version identity remain unverified.

On 2026-10-22 the managed executor's configured proxy could not be reached:
Git fetch failed with `Failed to connect to proxy port 8080`. GitHub connector
reads succeeded, allowing the review above, but cannot substitute for downloading
and validating an official image/PDF pair. The environment's supported status
reported network policy state `unknown`, no ready secrets or outbound identities.
No bulk archive download, alternate proxy, new authentication or paid access was
attempted. No small official paired sample was established with the accessible
evidence. Acquisition stopped at this blocker.

To resume real-source verification, an authorized environment must have working
egress to the publisher and PMC source, or an authorized reviewer must provide a
small official sample locally with publisher URL/revision, sample-specific rights,
independent expected hashes, and the exact original PDF. Do not obtain the
multi-GB image archive merely to extract a sample. A successful synthetic run is
not a substitute for this evidence, and this PR does not satisfy that definition
of done. No authorization to spend, create tokens, or deploy is requested.

## Offline method

`scripts/verifyPubTablesAlignment.py` reads one local PDF, reference image, XML
and manifest. It verifies independently supplied SHA256 pins before parsing,
page number, page count, MediaBox, CropBox, rotation, XML/image dimensions and
the declared rendering scale. It renders only that page with pinned PyMuPDF,
decodes the independent reference with pinned Pillow, and compares every RGB
channel. Even one changed channel fails; there is no tolerant, resized,
perceptual, aspect-ratio or filename fallback. Crop and rotation use the PDF's
native page transform. XML rectangles are not scored or certified by this tool.

Bounds: PDF 25 MiB and 300 pages, image 16 MiB, XML 1 MB, manifest 16 KiB,
4 million rendered pixels, scale at most 4, one page per invocation. DTD/entity
XML, animated images, non-RGB images and EXIF rotation are rejected. Inputs
remain local; output contains only numeric metadata and SHA256. Errors are
numeric codes; parser messages and file paths are suppressed. Run untrusted
inputs in an isolated process with a time/memory limit as well: byte/pixel caps
do not provide a hard bound on PDF decoding complexity.

The manifest requires `schemaVersion: 1`, `rightsReviewed: true`, nonempty
`publisherUrl`, `rightsUrl`, `sourceVersion`, the three `pdfSha256`, `imageSha256`,
`xmlSha256` pins, 1-based `pageNumber`, `imageSize: [width, height]`, `renderScale`,
`mediaBox`, `cropBox` (four-number rectangles from PyMuPDF), and `rotation`.
Pins, geometry and provenance must come from independent reviewed evidence;
creating them from whatever files happen to be present proves no provenance.
The provenance fields are attestations, not an automatic rights/version check.

Reproduce locally (keep all real inputs outside Git and CI artifacts):

```sh
python -m pip install PyMuPDF==1.26.6 Pillow==12.3.0
python -m unittest discover -s scripts/__tests__ -p pubtablesAlignment_test.py -v
node --test scripts/__tests__/release112Detection.nodecheck.mjs
python scripts/verifyPubTablesAlignment.py /local/manifest.json /local/source.pdf /local/reference.jpg /local/reference.xml
```

Exit 0 means exact decoded-pixel equality for the supplied local files only.
Exit 1 means mismatch or rejection. `officialPairVerified` and
`formalV4DocumentCredit` are always 0, including on success. No automatic promotion
to a source certificate is implemented. JPEG compression and renderer/version
differences may reject a genuinely corresponding page; failure is not proof of
different PDF content. No image search, PDF-coordinate-only proof, perceptual
tolerance or transformed box scoring is implemented.

## Tests and privacy

Nine Python tests pass locally: deterministic synthetic positive, same-size wrong
page, single-channel mutation, all three hash mismatches, metadata/rights/range
rejections, cropped/rotated positive and crop negative, XML/pixel caps, CLI error
redaction, and CLI success/failure exit codes. These generate geometric PDF/PNG
fixtures in temporary directories and clean them up; no source text or real
documents are committed. Existing detection Node regressions also pass locally.
The new CI job installs only pinned libraries, tests synthetic inputs and uploads
no artifacts. Its five-minute timeout bounds the CI job. GitHub CI status must be
read from the draft PR; local success is not a claim that hosted CI passed.

The complete existing Vitest suite passed locally: 139 files, 694 tests.
`npm run lint` exited 0 with 25 existing warnings and no errors.
`git diff --check` passed. The investigation branch is explicitly disabled in
`vercel.json` before publication to prevent a branch preview deployment.
