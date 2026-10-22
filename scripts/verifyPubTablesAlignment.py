"""Offline, exact decoded-pixel preflight. Never an accuracy certificate.

Requires PyMuPDF 1.26.6 and Pillow 12.3.0; see benchmarks/issue112/README.md.
All input files remain local. CLI output is numeric metadata and SHA256 only.
"""
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import warnings
import xml.etree.ElementTree as ET

import fitz
from PIL import Image

fitz.TOOLS.mupdf_display_errors(False)
fitz.TOOLS.mupdf_display_warnings(False)
MAX_PIXELS = 4_000_000


class Rejected(Exception):
    def __init__(self, code):
        self.code = code


def require(condition, code):
    if not condition:
        raise Rejected(code)


def bounded(path, cap):
    with Path(path).open("rb") as stream:
        data = stream.read(cap + 1)
    require(0 < len(data) <= cap, 2)
    return data


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify(manifest, pdf_path, image_path, xml_path):
    # No inferred provenance: these are caller attestations, not publisher proof.
    require(manifest.get("schemaVersion") == 1, 3)
    require(manifest.get("rightsReviewed") is True, 3)
    for key in ("publisherUrl", "rightsUrl", "sourceVersion"):
        require(isinstance(manifest.get(key), str) and 0 < len(manifest[key]) <= 2048, 3)
    require(fitz.VersionBind == "1.26.6" and Image.__version__ == "12.3.0", 4)
    data = [bounded(pdf_path, 25 * 1024 * 1024),
            bounded(image_path, 16 * 1024 * 1024), bounded(xml_path, 1_000_000)]
    hashes = [sha(value) for value in data]
    for key, digest in zip(("pdfSha256", "imageSha256", "xmlSha256"), hashes):
        require(manifest.get(key) == digest, 5)
    require(data[0].startswith(b"%PDF-"), 6)
    # Reject entities/DTD rather than resolving any external source.
    require(b"<!DOCTYPE" not in data[2].upper() and b"<!ENTITY" not in data[2].upper(), 7)
    root = ET.fromstring(data[2])
    require(root.tag == "annotation" and len(root.findall("size")) == 1, 7)
    size = root.find("size")
    require(len(size.findall("width")) == len(size.findall("height")) == 1, 7)
    dims = (int(size.findtext("width")), int(size.findtext("height")))
    require(all(0 < n <= 20000 for n in dims) and dims[0] * dims[1] <= MAX_PIXELS, 8)
    require(manifest.get("imageSize") == list(dims), 8)
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(io.BytesIO(data[1])) as image:
            require(image.format in ("PNG", "JPEG") and image.size == dims, 8)
            require(getattr(image, "n_frames", 1) == 1, 8)
            require(image.mode == "RGB", 8)
            # No EXIF orientation, color correction, resampling or crop search.
            require(image.getexif().get(274, 1) == 1, 8)
            reference = image.tobytes()
    page_number = manifest.get("pageNumber")
    require(type(page_number) is int and page_number >= 1, 9)
    scale = manifest.get("renderScale")
    require(type(scale) in (int, float) and math.isfinite(scale) and 0 < scale <= 4, 9)
    with fitz.open(stream=data[0], filetype="pdf") as document:
        require(not document.needs_pass and 0 < document.page_count <= 300, 9)
        require(page_number <= document.page_count, 9)
        page = document[page_number - 1]
        require(manifest.get("mediaBox") == list(page.mediabox), 10)
        require(manifest.get("cropBox") == list(page.cropbox), 10)
        require(type(manifest.get("rotation")) is int and manifest["rotation"] == page.rotation, 10)
        bounds = (page.rect * fitz.Matrix(scale, scale)).irect
        require((bounds.width, bounds.height) == dims, 8)
        raster = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csRGB, alpha=False)
        require((raster.width, raster.height) == dims, 8)
        pixels = raster.samples
    require(len(pixels) == len(reference), 8)
    different = sum(a != b for a, b in zip(pixels, reference))
    # Even one different channel fails. No perceptual or aspect-ratio fallback.
    return {"schemaVersion": 1, "exactDecodedPixelMatch": int(different == 0),
            "officialPairVerified": 0, "formalV4DocumentCredit": 0,
            "pageNumber": page_number, "width": dims[0], "height": dims[1],
            "rotation": manifest["rotation"], "differentChannels": different,
            "pdfSha256": hashes[0], "imageSha256": hashes[1], "xmlSha256": hashes[2],
            "renderedPixelsSha256": sha(pixels), "referencePixelsSha256": sha(reference)}


def main(args):
    try:
        require(len(args) == 4, 1)
        manifest = json.loads(bounded(args[0], 16_384))
        result = verify(manifest, *args[1:])
        print(json.dumps(result, sort_keys=True))
        return 0 if result["exactDecodedPixelMatch"] else 1
    except Exception as error:
        # Never print parser exceptions, file paths, XML or source metadata.
        print(json.dumps({"errorCode": error.code if isinstance(error, Rejected) else 99,
                          "exactDecodedPixelMatch": 0, "officialPairVerified": 0,
                          "formalV4DocumentCredit": 0}, sort_keys=True))
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
