"""Compare actual embedded PDF rasters with local PDF.js reference PNGs.

Inputs stay local; stdout contains counts only. This checks pixel preservation,
not arbitrary-document forensic acceptance or the correctness of user masks.
"""
import json
import math
import sys
from pathlib import Path

import fitz


def verify(manifest_path, output_path):
    manifest = json.loads(Path(manifest_path).read_text())
    selected = changed = checked = selected_nonblack = unselected_changed = 0
    with fitz.open(output_path) as output:
        assert len(output) == len(manifest), "PAGE_COUNT_MISMATCH"
        assert not output.is_repaired, "PDF_REPAIR_REQUIRED"
        active_images = set()
        for page, spec in zip(output, manifest):
            assert not page.get_text(), "RETAINED_TEXT"
            assert not page.get_fonts(), "RETAINED_FONTS"
            assert not list(page.annots() or []), "RETAINED_ANNOTATIONS"
            assert not list(page.widgets() or []), "RETAINED_FIELDS"
            assert not page.get_links(), "RETAINED_LINKS"
            assert len(page.get_images(full=True)) == 1, "UNEXPECTED_IMAGE_COUNT"
            active_images.add(page.get_images(full=True)[0][0])
            reference = fitz.Pixmap(spec["reference"])
            if reference.alpha:
                reference = fitz.Pixmap(reference, 0)
            actual = fitz.Pixmap(output, page.get_images(full=True)[0][0])
            assert actual.n == reference.n == 3, "UNEXPECTED_COLORSPACE"
            assert (actual.width, actual.height) == (reference.width, reference.height), "RASTER_SIZE_CHANGED"
            assert all(abs(a - b) < 0.001 for a, b in zip(page.rect, spec["pageRect"])), "PAGE_GEOMETRY_CHANGED"
            bounds = []
            for rect in spec["masks"]:
                # Independent pixel/interval intersection; no production helper.
                x1 = max(0, min(1, min(rect[0], rect[0] + rect[2])))
                y1 = max(0, min(1, min(rect[1], rect[1] + rect[3])))
                x2 = max(0, min(1, max(rect[0], rect[0] + rect[2])))
                y2 = max(0, min(1, max(rect[1], rect[1] + rect[3])))
                bounds.append((math.floor(x1 * actual.width), math.floor(y1 * actual.height),
                               math.ceil(x2 * actual.width), math.ceil(y2 * actual.height)))
            src, dst = memoryview(reference.samples), memoryview(actual.samples)
            for y in range(actual.height):
                for x in range(actual.width):
                    offset = (y * actual.width + x) * 3
                    masked = any(l <= x < r and t <= y < b for l, t, r, b in bounds)
                    if masked:
                        selected += 1
                        selected_nonblack += any(dst[offset:offset + 3])
                    else:
                        unselected_changed += src[offset:offset + 3] != dst[offset:offset + 3]
                    checked += 1
        assert output.embfile_count() == 0, "RETAINED_ATTACHMENT"
        stored_images = set()
        for xref in range(1, output.xref_length()):
            obj = output.xref_object(xref, compressed=False)
            if "/Subtype /Image" in obj:
                stored_images.add(xref)
            assert "/Type /Font" not in obj, "RETAINED_FONT_OBJECT"
            assert "/Subtype /Form" not in obj, "RETAINED_FORM_OBJECT"
        assert stored_images == active_images, "RETAINED_EXTRA_IMAGE"
    changed = selected_nonblack + unselected_changed
    result = {"pages": len(manifest), "checkedPixels": checked,
              "selectedPixels": selected, "mismatchedPixels": changed,
              "selectedNonblackPixels": selected_nonblack, "unselectedChangedPixels": unselected_changed}
    assert changed == 0, json.dumps(result, sort_keys=True)
    return {"status": "PASS", **result}


if __name__ == "__main__":
    try:
        print(json.dumps(verify(*sys.argv[1:]), sort_keys=True))
    except AssertionError as error:
        print(json.dumps({"status": "FAILED", "reason": str(error)}))
        sys.exit(2)
