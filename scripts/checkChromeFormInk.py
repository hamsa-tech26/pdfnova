"""Analyze synthetic Chrome native PDF viewer screenshots; do not OCR or log form text."""
import json
import sys
import fitz

def read(path):
    return fitz.Pixmap(path)

def bounds_of_red(pix):
    xs, ys = [], []
    for y in range(int(pix.height * .11), int(pix.height * .92), 2):
        for x in range(int(pix.width * .13), int(pix.width * .90), 2):
            red, green, blue = pix.pixel(x, y)[:3]
            if red > 175 and green < 95 and blue < 95:
                xs.append(x)
                ys.append(y)
    assert len(xs) >= 80, "Chrome did not visibly render the red synthetic field border"
    box = (min(xs), min(ys), max(xs), max(ys))
    assert box[2] - box[0] >= 150, "Field border too narrow or clipped in Chrome"
    assert box[3] - box[1] >= 35, "Field border too short or clipped in Chrome"
    return box

empty = read(sys.argv[1])
filled = read(sys.argv[2])
assert empty.width == filled.width and empty.height == filled.height, (
    "Chrome viewer screenshots must have equal viewport dimensions"
)
before = bounds_of_red(empty)
after = bounds_of_red(filled)
assert max(abs(a-b) for a,b in zip(before,after)) <= 10, (
    "Native Chrome changed the field location/scale between screenshots"
)
xs = []
changed = 0
left = before[0] + 12
right = before[2] - 12
top = before[1] + 9
bottom = before[3] - 9
assert right - left > 40 and bottom - top > 10
for y in range(top, bottom, 2):
    for x in range(left, right, 2):
        a = empty.pixel(x, y)[:3]
        b = filled.pixel(x, y)[:3]
        if max(b) < 190 and sum(a) - sum(b) > 105:
            changed += 1
            xs.append(x)

ink_span = max(xs) - min(xs) if xs else 0
assert changed >= 30, "No substantial new field text ink is visible inside Chrome PDF viewer"
assert ink_span >= 35, "Text appears implausibly truncated inside the Chrome field frame"

print(json.dumps({
    "chromeNativeViewer": True,
    "source": "SYNTHETIC_ONLY",
    "screenshotWidth": empty.width,
    "screenshotHeight": empty.height,
    "fieldBoxWidth": before[2]-before[0],
    "fieldBoxHeight": before[3]-before[1],
    "newDarkSamples": changed,
    "newInkHorizontalSpan": ink_span,
    "visibleTextChange": True,
    "limitation": "Checks visible text footprint, not full glyph-by-glyph clipping or native Chrome edit/save"
}))
