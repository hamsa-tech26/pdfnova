import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

import fitz
from PIL import Image

spec = importlib.util.spec_from_file_location("alignment", Path(__file__).parents[1] / "verifyPubTablesAlignment.py")
alignment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alignment)


class AlignmentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.pdf, self.image, self.xml = [base / name for name in ("source.pdf", "reference.png", "reference.xml")]
        with fitz.open() as doc:
            page = doc.new_page(width=100, height=120)
            page.draw_rect(fitz.Rect(10, 20, 40, 60), color=(0, 0, 0), fill=(0.2, 0.4, 0.6))
            page = doc.new_page(width=100, height=120)
            page.draw_circle((50, 50), 15, fill=(1, 0, 0))
            doc.save(self.pdf)
        self.xml.write_bytes(b"<annotation><size><width>100</width><height>120</height></size></annotation>")
        with fitz.open(self.pdf) as doc:
            doc[0].get_pixmap(colorspace=fitz.csRGB, alpha=False).save(self.image)
        self.manifest = {"schemaVersion": 1, "rightsReviewed": True,
                         "publisherUrl": "synthetic", "rightsUrl": "synthetic", "sourceVersion": "synthetic",
                         "pageNumber": 1, "imageSize": [100, 120], "renderScale": 1,
                         "mediaBox": [0, 0, 100, 120], "cropBox": [0, 0, 100, 120], "rotation": 0}
        self.pin()

    def pin(self):
        for key, path in zip(("pdfSha256", "imageSha256", "xmlSha256"), (self.pdf, self.image, self.xml)):
            self.manifest[key] = alignment.sha(path.read_bytes())

    def verify(self):
        return alignment.verify(self.manifest, self.pdf, self.image, self.xml)

    def test_synthetic_positive_and_repeatability(self):
        first = self.verify()
        self.assertEqual(first, self.verify())
        self.assertEqual(first["exactDecodedPixelMatch"], 1)
        self.assertEqual(first["officialPairVerified"], 0)
        self.assertEqual(first["formalV4DocumentCredit"], 0)

    def test_same_size_wrong_page_fails(self):
        self.manifest["pageNumber"] = 2
        self.assertEqual(self.verify()["exactDecodedPixelMatch"], 0)

    def test_one_pixel_change_fails_even_when_repinned(self):
        with Image.open(self.image) as image:
            image.putpixel((0, 0), (254, 255, 255))
            image.save(self.image)
        self.pin()
        self.assertEqual(self.verify()["differentChannels"], 1)

    def test_hash_mismatches_fail_closed(self):
        original = copy.deepcopy(self.manifest)
        for key in ("pdfSha256", "imageSha256", "xmlSha256"):
            with self.subTest(key=key):
                self.manifest = {**original, key: "0" * 64}
                with self.assertRaises(alignment.Rejected):
                    self.verify()

    def test_geometry_and_rights_fail_closed(self):
        original = copy.deepcopy(self.manifest)
        for key, value in (("rotation", 90), ("cropBox", [1, 0, 100, 120]),
                           ("mediaBox", [0, 0, 101, 120]), ("imageSize", [120, 100]),
                           ("rightsReviewed", False), ("sourceVersion", ""),
                           ("renderScale", float("nan")), ("renderScale", 4),
                           ("pageNumber", 0), ("pageNumber", True), ("pageNumber", 3)):
            with self.subTest(key=key):
                self.manifest = {**original, key: value}
                with self.assertRaises(alignment.Rejected):
                    self.verify()

    def test_rotated_cropped_positive_and_changed_crop_negative(self):
        with fitz.open(self.pdf) as doc:
            page = doc[0]
            page.set_cropbox(fitz.Rect(10, 10, 90, 110))
            page.set_rotation(90)
            modified = doc.tobytes()
        self.pdf.write_bytes(modified)
        with fitz.open(self.pdf) as doc:
            page = doc[0]
            page.get_pixmap(colorspace=fitz.csRGB, alpha=False).save(self.image)
            self.manifest.update(cropBox=list(page.cropbox), rotation=90, imageSize=[100, 80])
        self.xml.write_bytes(b"<annotation><size><width>100</width><height>80</height></size></annotation>")
        self.pin()
        self.assertEqual(self.verify()["exactDecodedPixelMatch"], 1)
        self.manifest["cropBox"] = [0, 0, 100, 120]
        with self.assertRaises(alignment.Rejected):
            self.verify()

    def test_xml_and_pixel_limits(self):
        for value in (b'<!DOCTYPE annotation [<!ENTITY x "private">]><annotation/>',
                      b'<annotation><size><width>20000</width><height>20000</height></size></annotation>',
                      b'<annotation><size><width>100</width><height>121</height></size></annotation>'):
            self.xml.write_bytes(value)
            self.pin()
            with self.assertRaises(alignment.Rejected):
                self.verify()

    def test_cli_redacts_errors_and_returns_failure(self):
        manifest = Path(self.temp.name) / "manifest.json"
        manifest.write_text(json.dumps(self.manifest))
        self.xml.write_bytes(b"SENSITIVE_SOURCE_CONTENT")
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            status = alignment.main([str(manifest), str(self.pdf), str(self.image), str(self.xml)])
        self.assertEqual(status, 1)
        report = json.loads(output.getvalue())
        self.assertTrue(all(type(value) is int for value in report.values()))
        self.assertNotIn("SENSITIVE", output.getvalue())
        self.assertNotIn(self.temp.name, output.getvalue())

    def test_cli_positive_and_negative_exit_status(self):
        manifest = Path(self.temp.name) / "manifest.json"
        for page, expected in ((1, 0), (2, 1)):
            self.manifest["pageNumber"] = page
            manifest.write_text(json.dumps(self.manifest))
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(alignment.main([str(manifest), str(self.pdf), str(self.image), str(self.xml)]), expected)


if __name__ == "__main__":
    unittest.main()
