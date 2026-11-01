"""Independent rendered AcroForm regression for synthetic rotated and cropped two-page PDFs.
Accepts two generated local files, never logs their contents.
"""
import json
import sys
import fitz

created, filled = (fitz.open(path) for path in sys.argv[1:3])
assert len(created) == len(filled) == 2, "Expected exactly two pages"

expected = [
    {"name": "qa_page1", "value": "Kukureku Test User", "rotation": 270,
     "width": 520, "height": 700},
    {"name": "qa_page2", "value": "Junior Engineer", "rotation": 0,
     "width": 612, "height": 792},
]
results = []

for index, spec in enumerate(expected):
    before = created[index]
    after = filled[index]
    assert before.rotation == after.rotation == spec["rotation"], "Page rotation changed"
    assert abs(after.cropbox.width - spec["width"]) < .1, "Crop width changed"
    assert abs(after.cropbox.height - spec["height"]) < .1, "Crop height changed"

    original_fields = list(before.widgets() or [])
    filled_fields = list(after.widgets() or [])
    assert len(original_fields) == len(filled_fields) == 1, "Missing or duplicated form widget"
    original = original_fields[0]
    widget = filled_fields[0]
    assert original.field_name == widget.field_name == spec["name"], "Widget name changed"
    assert widget.field_value == spec["value"], "Full AcroForm field value was not preserved"
    assert abs(widget.rect.x0 - original.rect.x0) < .3, "Widget x geometry moved"
    assert abs(widget.rect.y0 - original.rect.y0) < .3, "Widget y geometry moved"
    assert abs(widget.rect.width - original.rect.width) < .3, "Widget width changed"
    assert abs(widget.rect.height - original.rect.height) < .3, "Widget height changed"

    for pdf, form in ((created, original), (filled, widget)):
        kind, appearance = pdf.xref_get_key(form.xref, "AP")
        assert kind == "dict" and "/N" in appearance, "Normal widget appearance missing"

    # A moderately small field must not save a huge appearance font.
    assert 0 < widget.text_fontsize <= 14, "Field appearance uses an oversized/invalid font"
    # Widget rectangles are unrotated; measure the *displayed* horizontal span
    # after applying the page's rotation before judging text fit.
    display = (widget.rect * after.rotation_matrix) & after.rect
    assert display.is_valid and not display.is_empty, "Field not visible inside CropBox"
    assert fitz.get_text_length(spec["value"], fontname="helv", fontsize=widget.text_fontsize) < display.width - 6, (
        "Field text cannot fit horizontally in its displayed rectangle at its declared font size"
    )

    matrix = fitz.Matrix(1.5, 1.5)
    empty_pix = before.get_pixmap(matrix=matrix, alpha=False, annots=True)
    filled_pix = after.get_pixmap(matrix=matrix, alpha=False, annots=True)
    assert empty_pix.width == filled_pix.width and empty_pix.height == filled_pix.height

    # Annotation rectangles are in unrotated page coordinates in PyMuPDF;
    # transform into rendered page coordinates before sampling.
    assert display.width >= 24 and display.height >= 12, "Field too small or incorrectly rotated"
    left = max(0, int(display.x0 * 1.5) + 5)
    right = min(filled_pix.width, int(display.x1 * 1.5) - 5)
    top = max(0, int(display.y0 * 1.5) + 4)
    bottom = min(filled_pix.height, int(display.y1 * 1.5) - 4)
    assert right > left + 8 and bottom > top + 8, "No interior available for the field"

    changed_dark = 0
    for y in range(top, bottom, 2):
        for x in range(left, right, 2):
            old = empty_pix.pixel(x, y)[:3]
            new = filled_pix.pixel(x, y)[:3]
            if max(new) < 190 and sum(old) - sum(new) > 65:
                changed_dark += 1
    assert changed_dark >= 12, "Filled form ink not independently rendered inside the widget"
    results.append({"page": index + 1, "rotation": after.rotation,
                    "storedValueComplete": True, "normalAppearance": True,
                    "visibleNewInk": True, "fontSize": widget.text_fontsize})

print(json.dumps({"result": "PASS", "pageCount": len(results),
                  "cropRotationChecked": True, "renderedAppearanceChecked": True,
                  "pages": results}))
