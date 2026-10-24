#!/usr/bin/env python3
"""Private visual adjudication of already-exposed ICDAR PDF/reference regions.

Render both possible annotation Y-axis orientations, not an assumed transform.
Requires a locally prepared and SHA-pinned private original. Never uploads PDF,
XML, extracted text, images or thumbnails to CI/artifacts/GitHub. The overlays
cannot establish independent source-image identity, cell accuracy or rights.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import fitz
from PIL import Image, ImageDraw

ALLOWED_SAMPLES = {5, 8, 9}
MAX_PDF_BYTES = 32 * 1024 * 1024
MAX_PAGE_PIXELS = 10_000_000
SCALE = 1.6


def _is_box(box):
    return (isinstance(box, dict)
            and all(isinstance(box.get(k), (int, float)) and not isinstance(box[k], bool)
                    and math.isfinite(box[k]) for k in ("x", "y", "width", "height"))
            and box["width"] > 0 and box["height"] > 0)


def inspect(private_root, sample_index):
    if sample_index not in ALLOWED_SAMPLES:
        raise ValueError("Only already-exposed samples 5, 8 and 9 are permitted")
    source_root = Path(private_root).resolve(strict=True)
    split = source_root / "heldout"  # Former heldout; now exposed regression examples
    with (split / "pilot.json").open("r", encoding="utf-8") as stream:
        manifest = json.load(stream)
    if (manifest.get("rightsIndependentlyVerified") is not False
            or manifest.get("approvedV4StableCredit") != 0
            or manifest.get("excludedFromDevelopment") is not True
            or not isinstance(manifest.get("samples"), list)
            or len(manifest["samples"]) > 6):
        raise ValueError("Invalid exposed-regression manifest or misleading certification state")
    sample = next((s for s in manifest["samples"] if s.get("sampleIndex") == sample_index), None)
    if sample is None or not isinstance(sample.get("regions"), list):
        raise ValueError("Missing sample or reference regions")
    if not 1 <= len(sample["regions"]) <= 30:
        raise ValueError("Unbounded reference regions")
    file = split / f"sample-{sample_index}.pdf"
    if file.is_symlink() or not file.is_file() or file.stat().st_size > MAX_PDF_BYTES:
        raise ValueError("Missing, symlinked or oversized PDF")
    expected = sample.get("pdfSha256", "")
    if len(expected) != 64 or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
        raise ValueError("Original PDF does not match pinned manifest hash")
    outputs = []
    with fitz.open(file) as pdf:
        if not 1 <= len(pdf) <= 100 or len(pdf) != sample.get("pageCount"):
            raise ValueError("PDF page count mismatch")
        pages = sorted(set(r.get("page") for r in sample["regions"]))
        if any(not isinstance(n, int) or isinstance(n, bool)
               or not 1 <= n <= len(pdf) for n in pages):
            raise ValueError("Reference page out of bounds")
        for page_number in pages:
            page = pdf[page_number - 1]
            if page.rotation or page.cropbox != page.mediabox:
                raise ValueError("Rotated/cropped PDF needs independently reviewed transform")
            if page.rect.width * page.rect.height * SCALE * SCALE > MAX_PAGE_PIXELS:
                raise ValueError("Oversized page for bounded raster review")
            refs = [r for r in sample["regions"] if r["page"] == page_number]
            for ref in refs:
                box = ref.get("bounds")
                if (not _is_box(box)
                        or any(not isinstance(ref.get(k), (int, float))
                               or not math.isfinite(ref[k])
                               for k in ("pageWidth", "pageHeight"))
                        or abs(page.mediabox.width - ref["pageWidth"]) >= 3
                        or abs(page.mediabox.height - ref["pageHeight"]) >= 3
                        or box["x"] < 0 or box["y"] < 0
                        or box["x"] + box["width"] > page.rect.width + 3
                        or box["y"] + box["height"] > page.rect.height + 3):
                    raise ValueError("Reference geometry does not match source page")
            pix = page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE),
                                  alpha=False, colorspace=fitz.csRGB)
            original = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            width, header = pix.width, 50
            canvas = Image.new("RGB", (2 * width, pix.height + header), "white")
            draw = ImageDraw.Draw(canvas)
            draw.text((10, 8), "Hypothesis A: XML y is TOP-origin", fill="black")
            draw.text((width + 10, 8), "Hypothesis B: XML y is BOTTOM-origin", fill="black")
            draw.text((10, 29), "Neither overlay proves image identity or rights", fill="black")
            canvas.paste(original, (0, header))
            canvas.paste(original, (width, header))
            draw = ImageDraw.Draw(canvas)
            for ref in refs:
                box = ref["bounds"]
                for mode, dx, color in (("top", 0, "red"), ("bottom", width, "blue")):
                    y = box["y"] if mode == "top" else page.rect.height - box["y"] - box["height"]
                    draw.rectangle([dx + box["x"] * SCALE, header + y * SCALE,
                                    dx + (box["x"] + box["width"]) * SCALE,
                                    header + (y + box["height"]) * SCALE],
                                   outline=color, width=5)
            outputs.append((page_number, canvas))
    out_root = source_root / "review"  # Included in .gitignore's benchmarks/icdar/private/
    out_root.mkdir(mode=0o700, exist_ok=True)
    images = []
    for page_number, canvas in outputs:
        target = out_root / f"sample-{sample_index}-page-{page_number}-coordinate-hypotheses.png"
        canvas.save(target, format="PNG")
        images.append(str(target))
    return {"sampleIndex": sample_index, "pageCountRendered": len(images),
            "sourceSha256Verified": True, "referenceTransformVerified": False,
            "originalImageIdentityVerified": False, "rightsIndependentlyVerified": False,
            "formalV4StableDocumentCredit": 0,
            "status": "LOCAL_VISUAL_ADJUDICATION_REQUIRED", "privateImages": images}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample-index", type=int, required=True, choices=sorted(ALLOWED_SAMPLES))
    parser.add_argument("--private-root", default="benchmarks/icdar/private")
    args = parser.parse_args()
    print(json.dumps(inspect(args.private_root, args.sample_index), indent=2))


if __name__ == "__main__":
    main()
