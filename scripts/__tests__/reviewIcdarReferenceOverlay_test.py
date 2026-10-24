"""Synthetic-only regression tests for private ICDAR reference overlay safety."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

import fitz
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reviewIcdarReferenceOverlay import inspect


class OverlayReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        split = self.root / "heldout"
        split.mkdir()
        pdf = fitz.open()
        pdf.new_page(width=500, height=700)
        page = pdf.new_page(width=500, height=700)
        page.insert_text((72, 390), "6   12   5   4   7", fontsize=12)
        pdf_file = split / "sample-8.pdf"
        pdf.save(pdf_file)
        pdf.close()
        manifest = {
            "approvedV4StableCredit": 0, "rightsIndependentlyVerified": False,
            "excludedFromDevelopment": True, "samples": [{
                "sampleIndex": 8, "pageCount": 2,
                "pdfSha256": hashlib.sha256(pdf_file.read_bytes()).hexdigest(),
                "regions": [{"page": 2, "pageWidth": 500, "pageHeight": 700,
                             "bounds": {"x": 70, "y": 378, "width": 250, "height": 58}}]
            }]
        }
        (split / "pilot.json").write_text(json.dumps(manifest))

    def test_hash_pinned_two_orientation_private_renders(self):
        result = inspect(self.root, 8)
        self.assertTrue(result["sourceSha256Verified"])
        self.assertFalse(result["referenceTransformVerified"])
        self.assertFalse(result["rightsIndependentlyVerified"])
        self.assertEqual(result["formalV4StableDocumentCredit"], 0)
        self.assertEqual(len(result["privateImages"]), 1)
        image = Image.open(result["privateImages"][0])
        self.assertEqual(image.size, (1600, 1170))
        colors = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
        self.assertGreater(sum(1 for p in colors if p[0] > 180 and p[1] < 80), 200)
        colors = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
        self.assertGreater(sum(1 for p in colors if p[2] > 180 and p[0] < 80), 200)

    def test_pdf_hash_tamper_rejected(self):
        with (self.root / "heldout/sample-8.pdf").open("ab") as stream:
            stream.write(b" tampered")
        with self.assertRaisesRegex(ValueError, "pinned manifest hash"):
            inspect(self.root, 8)
        self.assertFalse((self.root / "review").exists())

    def test_reference_geometry_rejected(self):
        path = self.root / "heldout/pilot.json"
        manifest = json.loads(path.read_text())
        manifest["samples"][0]["regions"][0]["bounds"]["width"] = -10
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, "Reference geometry"):
            inspect(self.root, 8)

    def test_false_rights_credit_rejected(self):
        path = self.root / "heldout/pilot.json"
        manifest = json.loads(path.read_text())
        manifest["rightsIndependentlyVerified"] = True
        path.write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, "misleading certification"):
            inspect(self.root, 8)

    def test_only_already_exposed_samples(self):
        with self.assertRaisesRegex(ValueError, "already-exposed"):
            inspect(self.root, 4)


if __name__ == "__main__":
    unittest.main()
