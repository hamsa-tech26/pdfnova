"""Independent, synthetic-only Task 171 browser-download verification.

The fixed markers and coordinates describe the constructed regression fixture,
never a production detector or a private-document acceptance reference.
"""
import json
import sys
import fitz


def require(condition, code):
    if not condition:
        raise ValueError(code)


def verify(source_path, output_path):
    with fitz.open(source_path) as source, fitz.open(output_path) as output:
        require(len(source) == len(output) == 2, "PAGE_COUNT_MISMATCH")
        require("SECRET_REDACT_171" in source[0].get_text(), "SOURCE_SECRET_NOT_PRESENT")
        require(source.embfile_count() == 1, "SOURCE_ATTACHMENT_NOT_PRESENT")
        require(list(source[0].widgets() or []), "SOURCE_FIELD_NOT_PRESENT")
        require(source[0].get_links(), "SOURCE_LINK_NOT_PRESENT")
        require(source.metadata.get("title") == "SECRET_META_171", "SOURCE_METADATA_NOT_PRESENT")
        require(sum(len(page.get_text()) for page in output) == 0, "OUTPUT_HAS_SELECTABLE_TEXT")
        require(output.embfile_count() == 0, "OUTPUT_HAS_ATTACHMENT")
        image_xrefs = set()
        for page in output:
            require(tuple(page.rect) == (0, 0, 400, 400), "OUTPUT_GEOMETRY_CHANGED")
            require(not list(page.widgets() or []), "OUTPUT_HAS_FORM_FIELDS")
            require(not list(page.annots() or []), "OUTPUT_HAS_ANNOTATIONS")
            require(not page.get_links(), "OUTPUT_HAS_LINKS")
            require(not page.get_fonts(), "OUTPUT_HAS_FONT_RESOURCES")
            require(len(page.get_images(full=True)) == 1, "OUTPUT_IMAGE_STRUCTURE_CHANGED")
            image_xrefs.add(page.get_images(full=True)[0][0])
            contents = page.read_contents()
            require(b"BT" not in contents and b"Tj" not in contents and b"TJ" not in contents, "OUTPUT_HAS_TEXT_OPERATORS")

        markers = ["SECRET_REDACT_171", "SECRET_FIELD_171", "SECRET_VALUE_171", "SECRET_LINK_171", "SECRET_ATTACHMENT_171", "SECRET_META_171"]
        objects = [str(output.metadata).encode()]
        stored_images = set()
        for xref in range(1, output.xref_length()):
            obj = output.xref_object(xref, compressed=False)
            objects.append(obj.encode())
            if "/Subtype /Image" in obj:
                stored_images.add(xref)
            if output.xref_is_stream(xref):
                objects.append(output.xref_stream(xref))
        for marker in markers:
            encoded = marker.encode()
            representations = [encoded, encoded.hex().encode(), encoded.hex().upper().encode(), marker.encode("utf-16-be")]
            require(not any(value in obj for obj in objects for value in representations), "SOURCE_MARKER_RETAINED_IN_OBJECT")
        require(stored_images == image_xrefs and len(image_xrefs) == 2, "EXTRA_IMAGE_OBJECT_RETAINED")

        # Check visible masking independently from the absence of text objects.
        # The inset avoids JPEG ringing at the mask boundary; exact boundary
        # coverage is checked separately by the browser canvas regression.
        mask = output[0].get_pixmap(matrix=fitz.Matrix(2, 2), clip=fitz.Rect(50, 90, 316, 216), alpha=False)
        require(max(mask.samples) <= 20, "MASK_INTERIOR_NOT_BLACK")
        image = fitz.Pixmap(output, output[0].get_images(full=True)[0][0])
        require(image.n == 3 and not image.alpha, "UNEXPECTED_IMAGE_COLORSPACE")
        samples = memoryview(image.samples)
        for y in range(round(90 / 400 * image.height), round(216 / 400 * image.height)):
            start = (y * image.width + round(50 / 400 * image.width)) * 3
            end = (y * image.width + round(316 / 400 * image.width)) * 3
            require(max(samples[start:end]) <= 20, "UNDERLYING_IMAGE_NOT_REDACTED")
        unselected = output[1].get_pixmap(clip=fitz.Rect(100, 100, 110, 110), alpha=False)
        require(all(unselected.samples[i] <= 20 and unselected.samples[i + 1] <= 20 and unselected.samples[i + 2] >= 235 for i in range(0, len(unselected.samples), 3)), "UNSELECTED_PAGE_CHANGED")
        return {"status": "PASS", "pages": 2, "selectableCharacters": 0, "embeddedFiles": 0, "sourceMarkersInObjects": 0, "maskInteriorVerified": True, "underlyingImageRedacted": True, "unselectedPagePreserved": True}


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 3, "EXPECTED_SOURCE_AND_OUTPUT_PATHS")
        print(json.dumps(verify(sys.argv[1], sys.argv[2]), sort_keys=True))
    except ValueError as error:
        print(json.dumps({"status": "FAILED", "reason": str(error)}))
        sys.exit(2)
    except Exception:
        print(json.dumps({"status": "FAILED", "reason": "PDF_READER_FAILURE"}))
        sys.exit(2)
