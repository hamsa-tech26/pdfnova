"""Independent offline validation of synthetic Kukureku AcroForm output."""
import json
import sys
import fitz

mode, pdf_path = sys.argv[1:3]
if mode not in ("created", "filled"):
    raise ValueError("Expected created or filled mode")

pdf = fitz.open(pdf_path)
assert not pdf.needs_pass, "Synthetic output unexpectedly requires password"
assert len(pdf) == 1, "Synthetic form page count changed"
page = pdf[0]
widgets = list(page.widgets() or [])
by_name = {widget.field_name: widget for widget in widgets}
expected = {"qa_name"} if mode == "created" else {"qa_name", "qa_consent", "qa_region"}
assert set(by_name) == expected, "Form widget identities were lost or duplicated"

for name, widget in by_name.items():
    rect = widget.rect
    assert rect.width >= 12 and rect.height >= 12, f"Widget {name} rectangle is too small"
    assert page.rect.contains(rect), f"Widget {name} lies outside its page"
    typ, appearance = pdf.xref_get_key(widget.xref, "AP")
    assert typ == "dict" and "/N" in appearance, f"Widget {name} has no normal appearance"

if mode == "filled":
    assert by_name["qa_name"].field_value == "Independent Form Proof 2026", "Filled text was lost"
    assert by_name["qa_region"].field_value == "USA", "Dropdown selection was lost"
    assert by_name["qa_consent"].field_value not in (None, "", "Off"), "Checkbox was not checked"
    text_widget = by_name["qa_name"]
else:
    text_widget = by_name["qa_name"]
    text_widget.field_value = "INDEPENDENT_EDITOR_REOPEN_PROOF"
    text_widget.update()
    roundtrip = fitz.open(stream=pdf.tobytes(), filetype="pdf")
    checked = list(roundtrip[0].widgets() or [])
    assert len(checked) == 1 and checked[0].field_value == "INDEPENDENT_EDITOR_REOPEN_PROOF", (
        "Independent PDF reader could not edit and reopen generated form"
    )
    pdf = roundtrip
    page = pdf[0]
    text_widget = checked[0]

# Exclude outer field-border pixels; require visible ink in an independent renderer.
pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False, annots=True)
rect = text_widget.rect
x1 = max(0, min(pix.width - 1, int(rect.x0 * 2) + 8))
x2 = max(x1 + 1, min(pix.width, int(rect.x1 * 2) - 6))
y1 = max(0, min(pix.height - 1, int(rect.y0 * 2) + 7))
y2 = max(y1 + 1, min(pix.height, int(rect.y1 * 2) - 7))
dark = sum(
    1 for y in range(y1, y2, 2) for x in range(x1, x2, 2)
    if max(pix.pixel(x, y)[:3]) < 155
)
assert dark >= 12, "Widget value not visibly rendered inside its rectangle"
print(json.dumps({"mode": mode, "pages": len(pdf), "widgetCount": len(widgets),
                  "appearancePresent": True, "visibleTextInk": True,
                  "externalEditorReopen": mode == "created"}))
