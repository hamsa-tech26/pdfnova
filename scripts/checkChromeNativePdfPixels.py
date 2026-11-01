"""Inspect only synthetic Chrome PNG screenshots for a known blue PDF rectangle."""
import json
import sys
import fitz

def blue_pixels(path):
    pix = fitz.Pixmap(path)
    count = 0
    sampled = 0
    # Exclude the upper viewer toolbar and outer margins where UI may vary.
    for y in range(int(pix.height * 0.14), int(pix.height * 0.92), 3):
        for x in range(int(pix.width * 0.16), int(pix.width * 0.87), 3):
            rgb = pix.pixel(x, y)[:3]
            sampled += 1
            if rgb[2] >= 170 and rgb[2] > rgb[1] + 70 and rgb[2] > rgb[0] + 110:
                count += 1
    return count, sampled

blank, sample_count = blue_pixels(sys.argv[1])
marked, sample_count_2 = blue_pixels(sys.argv[2])
assert sample_count == sample_count_2, "Screenshot dimensions differ"
visible = marked > max(300, blank * 5) and marked - blank > 300
print(json.dumps({"blankBluePixels": blank, "markedBluePixels": marked,
                  "sampleCount": sample_count,
                  "nativePdfContentVisible": bool(visible)}))
