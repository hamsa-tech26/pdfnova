#!/usr/bin/env python3
"""Local-only, evidence-limited PDF/page-image correspondence screening.

Use this after independently obtaining an original, rights-cleared publisher
PDF and its *official* benchmark page bitmap. Neither publisher bytes nor
source text are written to disk, logs, CI artifacts, or a network endpoint.

The two SHA-256 pins must be taken from independently recorded source receipts,
not inferred from the file under test. Similarity is NOT proof of authentic
source correspondence, copyright clearance, or table-cell ground truth.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import warnings
from io import BytesIO
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image, ImageOps


MAX_FILE_BYTES = 30 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
THUMB_SIZE = (160, 160)
SHA = re.compile(r"^[a-f0-9]{64}$", re.IGNORECASE)
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
warnings.simplefilter("error", Image.DecompressionBombWarning)


def _read_bounded(path: Path) -> bytes:
    if path.is_symlink() or not path.is_file():
        raise ValueError("Source must be a regular local file, not a symlink.")
    size = path.stat().st_size
    if size < 8 or size > MAX_FILE_BYTES:
        raise ValueError("Source file is empty or exceeds the 30 MiB intake bound.")
    return path.read_bytes()


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _validate_pin(pin: str) -> str:
    if not SHA.fullmatch(pin):
        raise ValueError("Expected SHA-256 must contain exactly 64 hexadecimal characters.")
    return pin.lower()


def _screen_thumbnails(rendered: Image.Image, reference: Image.Image) -> dict:
    # The official benchmark bitmap may have been rasterized with different
    # antialiasing. This is a *screening* signal, not a pixel identity verdict.
    a = ImageOps.grayscale(rendered).resize(THUMB_SIZE, Image.Resampling.LANCZOS)
    b = ImageOps.grayscale(reference).resize(THUMB_SIZE, Image.Resampling.LANCZOS)
    # `tobytes()` keeps compatibility with both older Pillow and Pillow 13+;
    # Image.getdata() is deprecated in newer versions.
    av = a.tobytes()
    bv = b.tobytes()
    mae = sum(abs(x - y) for x, y in zip(av, bv)) / (len(av) * 255)

    # Ink overlap supplements the otherwise deceptively low error of two
    # unrelated mostly white pages. All-white pairs are explicitly inconclusive.
    am = [x < 224 for x in av]
    bm = [x < 224 for x in bv]
    count_a, count_b = sum(am), sum(bm)
    common = sum(x and y for x, y in zip(am, bm))
    dice = 2 * common / (count_a + count_b) if count_a + count_b else 0.0
    total = len(av)
    return {
        "thumbnailMeanAbsoluteErrorPct": round(mae * 100, 3),
        "thumbnailInkDice": round(dice, 4),
        "sourceInkFraction": round(count_a / total, 4),
        "referenceInkFraction": round(count_b / total, 4),
    }


def screen_page_pair(
    pdf_path: Path,
    page_number: int,
    benchmark_image_path: Path,
    expected_pdf_sha256: str,
    expected_image_sha256: str,
) -> dict:
    """Return metadata-only screening for a 1-based source page/image pair."""
    if not isinstance(page_number, int) or not 1 <= page_number <= 500:
        raise ValueError("Source page must be between 1 and 500.")
    pdf = _read_bounded(pdf_path)
    img = _read_bounded(benchmark_image_path)
    if not pdf.startswith(b"%PDF-"):
        raise ValueError("Expected an original PDF file.")
    pdf_sha, img_sha = _sha256(pdf), _sha256(img)
    if pdf_sha != _validate_pin(expected_pdf_sha256):
        raise ValueError("Source PDF SHA-256 does not match its independent pin.")
    if img_sha != _validate_pin(expected_image_sha256):
        raise ValueError("Official image SHA-256 does not match its independent pin.")

    document = None
    try:
        document = fitz.open(stream=pdf, filetype="pdf")
        if document.needs_pass or page_number > document.page_count:
            raise ValueError("PDF cannot be read at the specified source page.")
        page = document.load_page(page_number - 1)
        if page.rect.width <= 0 or page.rect.height <= 0:
            raise ValueError("Invalid original PDF page rectangle.")
        # Decode the exact image bytes that passed the checksum, never a
        # reopened path which might have changed after pin verification.
        with Image.open(BytesIO(img)) as official:
            if official.format not in ("PNG", "JPEG", "TIFF"):
                raise ValueError("Official reference must be a PNG, JPEG or TIFF bitmap.")
            official.load()
            w, h = official.size
            if w < 100 or h < 100 or w * h > MAX_IMAGE_PIXELS:
                raise ValueError("Out-of-bounds official page-image dimensions.")
            pdf_ratio = page.rect.width / page.rect.height
            img_ratio = w / h
            relative_delta = abs(pdf_ratio / img_ratio - 1)
            report = {
                "schema": "kukureku-v4-page-image-pair-screen-v1",
                "status": "AUTOMATED_SCREEN_ONLY_NOT_INDEPENDENT_APPROVAL",
                "sourcePdfSha256": pdf_sha,
                "officialImageSha256": img_sha,
                "sourcePage": page_number,
                "sourcePageCount": document.page_count,
                "pdfPageRotation": page.rotation,
                "referenceImageWidth": w,
                "referenceImageHeight": h,
                "aspectRatioDeltaPct": round(relative_delta * 100, 4),
                "acceptedCertificationDocuments": 0,
            }
            if relative_delta > 0.015:
                report["pairingSignal"] = "ASPECT_MISMATCH_NO_PIXEL_SCORE"
                return report
            sx, sy = w / page.rect.width, h / page.rect.height
            pixels = page.get_pixmap(matrix=fitz.Matrix(sx, sy), alpha=False)
            if pixels.width * pixels.height > MAX_IMAGE_PIXELS:
                raise ValueError("Rendered PDF page exceeds pixel safety bound.")
            rendered = Image.frombytes("RGB", (pixels.width, pixels.height), pixels.samples)
            metrics = _screen_thumbnails(rendered, official)
            report.update(metrics)
            corroborated = (
                metrics["thumbnailMeanAbsoluteErrorPct"] <= 6
                and metrics["thumbnailInkDice"] >= 0.77
                and metrics["sourceInkFraction"] >= 0.01
                and metrics["referenceInkFraction"] >= 0.01
            )
            report["pairingSignal"] = (
                "HIGH_SIMILARITY_NEEDS_HUMAN_CONFIRMATION"
                if corroborated else "INCONCLUSIVE_NEEDS_HUMAN_CONFIRMATION"
            )
            return report
    except (ValueError, RuntimeError):
        raise
    except Exception:
        # Suppress library error messages that could include a private filename.
        raise ValueError("Unable to inspect source PDF and official bitmap.") from None
    finally:
        if document is not None:
            document.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--page", type=int, required=True)
    parser.add_argument("--official-image", type=Path, required=True)
    parser.add_argument("--pdf-sha256", required=True)
    parser.add_argument("--image-sha256", required=True)
    args = parser.parse_args()
    try:
        report = screen_page_pair(args.pdf, args.page, args.official_image,
                                  args.pdf_sha256, args.image_sha256)
        print(json.dumps(report, sort_keys=True))
        return 0 if report["pairingSignal"].startswith("HIGH_SIMILARITY") else 2
    except (ValueError, OSError, fitz.FileDataError):
        print("Source-page pairing blocked: verify pinned private files, dimensions and format.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
