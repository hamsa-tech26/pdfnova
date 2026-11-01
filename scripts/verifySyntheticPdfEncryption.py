"""Independent synthetic PDF protect/unlock output acceptance; no customer documents."""
import json
import os
import sys
import fitz

mode = sys.argv[1]
path = sys.argv[2]
if mode not in ("protected", "unlocked"):
    raise ValueError("Unsupported verification mode")

password = os.environ.get("KUKUREKU_QA_PASSWORD", "")
assert len(password) >= 8, "Missing synthetic test password"

doc = fitz.open(path)
if mode == "protected":
    assert doc.needs_pass, "Downloaded protected PDF opens without a password"
    assert doc.authenticate("incorrect-synthetic-password") == 0, "Wrong password unexpectedly accepted"
    assert doc.authenticate(password) > 0, "Correct password rejected by independent PDF reader"
else:
    assert not doc.needs_pass, "Downloaded unlocked PDF still requires a password"

assert len(doc) == 2, "Downloaded PDF page count changed"
assert "TASK191_ALPHA_SOURCE" in doc[0].get_text(), "Page 1 content corrupted"
assert "TASK191_BRAVO_SOURCE" in doc[1].get_text(), "Page 2 content corrupted"

if mode == "protected":
    with open(path, "rb") as f:
        raw = f.read()
    assert b"TASK191_ALPHA_SOURCE" not in raw, "Protected file contains plaintext marker"
    assert b"TASK191_BRAVO_SOURCE" not in raw, "Protected file contains plaintext marker"

print(json.dumps({
    "mode": mode,
    "pageCount": len(doc),
    "markerCount": 2,
    "requiresPassword": mode == "protected",
    "independentReader": "PyMuPDF"
}))
