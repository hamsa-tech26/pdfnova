#!/usr/bin/env python3
"""Task 260: independent (PyMuPDF) numeric source-page geometry audit.

SHA-verified publisher PDFs and fixed annotation XML are provided ephemerally
by the existing source downloader. This does not inspect/copy PDF contents,
claim pixel identity, settle data rights, or award V4 certification credit.
"""
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

import fitz

ROOT = Path(__file__).resolve().parent
PRIVATE = ROOT / "private"
REPORTS = ROOT / "reports"


def rect_as_list(rect):
    return [round(float(v), 3) for v in rect]


def scan_page(page, xml_file, source, page_number):
    tree = ET.parse(xml_file)
    frame = tree.find("./size")
    if frame is None:
        raise ValueError("Missing published annotation size")
    width = int(frame.findtext("width", "0"))
    height = int(frame.findtext("height", "0"))
    if not (0 < width <= 20000 and 0 < height <= 20000):
        raise ValueError("Invalid published image dimensions")
    rect = page.rect
    if not (math.isfinite(rect.width) and math.isfinite(rect.height) and rect.width > 0 and rect.height > 0):
        raise ValueError("Invalid independent PDF page rectangle")
    sx = width / rect.width
    sy = height / rect.height
    drift = abs(sx - sy) / max(sx, sy)
    cropbox, mediabox = page.cropbox, page.mediabox
    crop_is_media = all(abs(a - b) < 0.1 for a, b in zip(cropbox, mediabox))
    return {
        "sourceId": source,
        "originalPage": page_number,
        "independentReader": "PyMuPDF",
        "pageViewportPoints": [round(rect.width, 3), round(rect.height, 3)],
        "annotationImagePixels": [width, height],
        "mediaBox": rect_as_list(mediabox),
        "cropBox": rect_as_list(cropbox),
        "pageRotationDegrees": int(page.rotation),
        "cropEqualsMedia": crop_is_media,
        "scaleX": round(sx, 6),
        "scaleY": round(sy, 6),
        "aspectDriftPercent": round(drift * 100, 4),
        "requiresIndependentFrameReview": bool(drift > 0.03 or page.rotation != 0 or not crop_is_media),
        "originalAnnotationImagePixelIdentityVerified": False,
        "independentReferenceCellTruthVerified": False,
        "independentRightsClearanceVerified": False,
        "acceptedFormalV4DocumentCredit": 0,
    }


def main():
    manifest = json.loads((ROOT / "sources.json").read_text(encoding="utf-8"))
    assert manifest["scope"] == "EXTERNAL_TABLE_DETECTION_DIAGNOSTIC_ONLY"
    assert manifest["acceptedFormalV4DocumentCredit"] == 0
    records = []
    for info in manifest["documents"]:
        source_id = info["id"]
        path = PRIVATE / (source_id + ".pdf")
        raw = path.read_bytes()
        if not raw.startswith(b"%PDF-"):
            raise ValueError("Not a PDF: " + source_id)
        if hashlib.sha256(raw).hexdigest() != info["sha256"]:
            raise ValueError("Source hash mismatch: " + source_id)
        with fitz.open(stream=raw, filetype="pdf") as pdf:
            if len(pdf) != info["sourcePages"]:
                raise ValueError("Publisher page count mismatch")
            for ref in info["referencePages"]:
                number = int(ref["page"])
                if not (1 <= number <= len(pdf)):
                    raise ValueError("Invalid referenced page")
                # Reference file names come from the fixed SHA-pinned manifest.
                xml_path = PRIVATE / ref["annotation"]
                if xml_path.name != ref["annotation"]:
                    raise ValueError("Invalid annotation filename")
                records.append(scan_page(pdf[number - 1], xml_path, source_id, number))
    if len(records) != 5:
        raise ValueError("Expected exactly five publisher-annotated pages")
    summary = {
        "task": 260,
        "sourceCount": len(manifest["documents"]),
        "referencePagesAudited": len(records),
        "independentPageGeometryRecords": records,
        "pixelPairingIndependentlyVerified": False,
        "acceptedFormalV4Documents": 0,
        "limitation": "Matching PDF page boxes and XML image proportions cannot prove the original annotation raster matches publisher PDF pixels.",
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / "independent-page-geometry.json").write_text(
        json.dumps(summary, indent=2) + "\n", encoding="utf-8"
    )
    # Never log source words, PDF bytes, image pixels or XML content.
    print(json.dumps({
        "task": 260,
        "sourceCount": summary["sourceCount"],
        "referencePagesAudited": len(records),
        "aspectReviewFlagged": sum(r["requiresIndependentFrameReview"] for r in records),
        "acceptedFormalV4Documents": 0,
        "pixelIdentityVerified": False,
    }))


if __name__ == "__main__":
    main()
