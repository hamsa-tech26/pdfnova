# PubTables original-PDF/page-image correspondence: local-only preflight

**Purpose:** close one measurement prerequisite, *not* change V4 detector
behavior. Draft [PR #111](https://github.com/hamsa-tech26/pdfnova/pull/111)
measured a preliminary 5/34 table-box overlap across twenty original PDFs.
Its source image/PDF-version correspondence was **NOT_VERIFIED**; aspect ratio
agreement within 0.131% is a useful sanity check, not image identity.

## Inputs and handling

For a deliberately small, licensed source sample, obtain **both**:

1. An original publisher PDF, with full original-document provenance, page
   number, rights review and its independently recorded original SHA-256.
2. The **official** published benchmark page image (not a screenshot or a
   new render of the same PDF), with independently recorded provenance,
   article-version mapping, page identity and image SHA-256.

Keep both originals privately in a local, gitignored folder. No customer PDF,
source image, raw OCR, cell value, document filename, private path or model
output may enter committed files, CI artifacts or external messages. Never
obtain benchmark images from Kukureku's own rendered PDF; that would create
a circular test rather than corroborating the independent publisher reference.

## Local diagnostic

With Python, PyMuPDF and Pillow available:

```bash
python3 scripts/checkPubTablesPageImagePairing.py \
  --pdf /approved/private/original.pdf \
  --page 8 \
  --official-image /approved/private/published-page.png \
  --pdf-sha256 <independently-recorded-64-hex-hash> \
  --image-sha256 <independently-recorded-64-hex-hash>
```

The script checks pinned bytes, original PDF page count/rotation, bitmap
dimensions, page aspect ratio and bounded thumbnail grayscale/ink agreement.
It emits **numeric-only** metadata and image/PDF SHA-256s. Its result is either
`HIGH_SIMILARITY_NEEDS_HUMAN_CONFIRMATION`,
`INCONCLUSIVE_NEEDS_HUMAN_CONFIRMATION` or
`ASPECT_MISMATCH_NO_PIXEL_SCORE`. A high-similarity result still requires
independent visual review: antialiasing, publisher renderers, crop boxes,
replaced figures, shifted PDFs, non-text graphics and visually similar pages
can affect automated measures. An inconclusive result must not be used as
evidence that the table detector failed.

The script is intentionally **not run on real publisher PDFs by CI**. It does
not retrieve images, override the 0.50 IoU evaluation threshold, create a
table annotation, admit a new source to the 20-document formal gate, or claim
an independent human reviewer. Inaccessible or unverified source-image pairs
remain blocked until authorized files and provenance are available.

## Negative controls

Run:

```bash
python3 -m unittest -v scripts.__tests__.test_pubtables_page_image_pairing
```

Synthetic tests exercise a same-page image, wrong-page image, wrong checksums,
wrong aspect ratio, invalid pages, rotated PDF pages and empty-page false
similarity. They do not contribute to real-world recall or V4 Stable credit.

**Decision boundary:** after a rights-cleared official page image and the
original publisher PDF are independently paired, review the source image and
annotation geometry before attempting a bounded detector correction. Engine
V4 Stable remains 0/20 independently approved documents.
