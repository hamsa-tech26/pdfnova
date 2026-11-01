"""Independent synthetic checked/unchecked AcroForm flattening QA.
Only filenames passed in args; never log source PDF text or personal information.
"""
import json
import sys
import fitz

source_path, flat_path, expected_checked = sys.argv[1:4]
assert expected_checked in ("qa_left", "qa_right")
# Capture MuPDF structural warnings with a per-document attribution instead
# of allowing warnings to corrupt the machine-readable acceptance report.
fitz.TOOLS.mupdf_display_errors(False)
fitz.TOOLS.reset_mupdf_warnings()
warnings = {}
def record(stage):
    noted = fitz.TOOLS.mupdf_warnings().strip()
    if noted:
        warnings[stage] = noted.splitlines()[:12]
    fitz.TOOLS.reset_mupdf_warnings()

source = fitz.open(source_path)
record("source_open")
flat = fitz.open(flat_path)
record("flatten_open")
assert len(source) == len(flat) == 1, "Page count changed"
src, dst = source[0], flat[0]
assert abs(src.rect.width-dst.rect.width) < .1
assert abs(src.rect.height-dst.rect.height) < .1
assert "SYNTHETIC_TASK197_CONTROL" in dst.get_text(), "Original page text missing"
record("flatten_text")
widgets = {w.field_name:w for w in list(src.widgets() or [])}
record("source_widgets")
assert set(widgets) == {"qa_left","qa_right"}, "Source must have exactly two checkboxes"
assert not list(dst.widgets() or []), "Flattened result retains editable form widgets"
record("flatten_widgets")
for name, widget in widgets.items():
    checked = widget.field_value not in (None, "", "Off")
    assert checked == (name == expected_checked), "Source checkbox state differs from fixture"
    assert src.rect.contains(widget.rect)
    assert widget.rect.width >= 20 and widget.rect.height >= 20

scale=3
old_pix=src.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False,annots=True)
record("source_render")
new_pix=dst.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False,annots=True)
record("flatten_render")
assert old_pix.width==new_pix.width and old_pix.height==new_pix.height

def interior_dark(pix, rect):
    # Skip the outer 22% of the widget, so the checkbox square's
    # border does not get mistaken for a checked tick.
    x1=int((rect.x0+rect.width*.22)*scale)
    x2=int((rect.x1-rect.width*.22)*scale)
    y1=int((rect.y0+rect.height*.22)*scale)
    y2=int((rect.y1-rect.height*.22)*scale)
    assert x2-x1>=18 and y2-y1>=18
    return sum(1 for y in range(y1,y2) for x in range(x1,x2)
               if max(pix.pixel(x,y)[:3])<145)

old={name:interior_dark(old_pix,w.rect) for name,w in widgets.items()}
new={name:interior_dark(new_pix,w.rect) for name,w in widgets.items()}
other="qa_right" if expected_checked=="qa_left" else "qa_left"
for category, pixels in (("original",old),("flattened",new)):
    assert pixels[expected_checked]>=25, category+" visually lost the selected checkbox tick"
    assert pixels[other] < pixels[expected_checked]*.40, (
        category+" made the unchecked checkbox look checked"
    )
# Each of the two independent renderings must maintain visible selections.
assert new[expected_checked] > 0 and old[expected_checked] > 0
print(json.dumps({"result":"PASS","pageCount":1,"originalCheckboxes":2,
                  "flattenedWidgetCount":0,"checkedPosition":expected_checked,
                  "sourceCheckedDarkPixels":old[expected_checked],
                  "sourceUncheckedDarkPixels":old[other],
                  "flattenedCheckedDarkPixels":new[expected_checked],
                  "flattenedUncheckedDarkPixels":new[other],
                  "checkboxAppearancePreserved":True,
                  "readerWarnings":warnings}))
