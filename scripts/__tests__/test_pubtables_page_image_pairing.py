"""Synthetic negative controls; these never constitute real PubTables evidence."""

from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

import fitz
from PIL import Image

from scripts.checkPubTablesPageImagePairing import screen_page_pair


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class PagePairScreeningTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.pdf = self.root / "original.pdf"
        doc = fitz.open()
        first = doc.new_page(width=612, height=792)
        for i in range(16):
            y = 100 + 26 * i
            first.draw_line((60, y), (550, y), color=(0, 0, 0))
            first.insert_text((75, y - 8), f"Row {i + 1}   42    175    890", fontsize=13)
        second = doc.new_page(width=612, height=792)
        second.draw_rect(fitz.Rect(110, 120, 500, 660), fill=(0.1, 0.2, 0.6))
        second.insert_text((125, 300), "UNRELATED PAGE", fontsize=35, color=(1, 1, 1))
        doc.save(self.pdf)
        self.first_image = self.root / "official-first.png"
        self.second_image = self.root / "official-second.png"
        for number, target in [(0, self.first_image), (1, self.second_image)]:
            page = doc.load_page(number)
            page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(target)
        doc.close()

    def screen(self, image: Path, page: int = 1, pdf_sha: str | None = None, img_sha: str | None = None):
        return screen_page_pair(self.pdf, page, image, pdf_sha or sha(self.pdf), img_sha or sha(image))

    def test_exact_page_image_pair_has_high_similarity_without_certification_credit(self):
        report = self.screen(self.first_image)
        self.assertEqual(report["pairingSignal"], "HIGH_SIMILARITY_NEEDS_HUMAN_CONFIRMATION")
        self.assertEqual(report["acceptedCertificationDocuments"], 0)
        self.assertLess(report["thumbnailMeanAbsoluteErrorPct"], 0.1)
        self.assertGreater(report["thumbnailInkDice"], 0.99)
        self.assertNotIn("Row 1", json.dumps(report))

    def test_wrong_original_page_cannot_pass_similarity_screen(self):
        report = self.screen(self.second_image)
        self.assertEqual(report["pairingSignal"], "INCONCLUSIVE_NEEDS_HUMAN_CONFIRMATION")
        self.assertEqual(report["acceptedCertificationDocuments"], 0)

    def test_checksum_mismatch_refuses_inspection(self):
        with self.assertRaisesRegex(ValueError, "does not match"):
            self.screen(self.first_image, pdf_sha="0" * 64)
        with self.assertRaisesRegex(ValueError, "does not match"):
            self.screen(self.first_image, img_sha="f" * 64)

    def test_aspect_ratio_mismatch_is_not_scored(self):
        source = Image.open(self.first_image)
        wrong_shape = self.root / "wrong-shape.png"
        source.resize((300, 800)).save(wrong_shape)
        report = self.screen(wrong_shape)
        self.assertEqual(report["pairingSignal"], "ASPECT_MISMATCH_NO_PIXEL_SCORE")
        self.assertNotIn("thumbnailInkDice", report)

    def test_invalid_page_and_missing_pins_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "between 1 and 500"):
            self.screen(self.first_image, page=0)
        with self.assertRaisesRegex(ValueError, "cannot be read"):
            self.screen(self.first_image, page=3)
        with self.assertRaisesRegex(ValueError, "64 hexadecimal"):
            self.screen(self.first_image, pdf_sha="not-a-sha")

    def test_rotated_source_page_uses_the_observed_pdf_viewport(self):
        rotated = self.root / "rotated.pdf"
        official = self.root / "rotated-page.png"
        doc = fitz.open()
        page = doc.new_page(width=500, height=700)
        page.insert_text((60, 65), "ROTATED PHYSICAL TABLE", fontsize=22)
        for i in range(18):
            page.draw_line((60, 105 + i * 26), (445, 105 + i * 26))
        page.set_rotation(90)
        doc.save(rotated)
        doc.close()
        original = fitz.open(rotated)
        original[0].get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(official)
        original.close()
        result = screen_page_pair(rotated, 1, official, sha(rotated), sha(official))
        self.assertEqual(result["pdfPageRotation"], 90)
        self.assertEqual(result["pairingSignal"], "HIGH_SIMILARITY_NEEDS_HUMAN_CONFIRMATION")
        self.assertEqual(result["acceptedCertificationDocuments"], 0)

    def test_empty_page_cannot_gain_similarity_credit(self):
        blank_pdf = self.root / "blank.pdf"
        blank_image = self.root / "blank.png"
        doc = fitz.open()
        page = doc.new_page(width=612, height=792)
        doc.save(blank_pdf)
        page.get_pixmap().save(blank_image)
        doc.close()
        result = screen_page_pair(blank_pdf, 1, blank_image, sha(blank_pdf), sha(blank_image))
        self.assertEqual(result["pairingSignal"], "INCONCLUSIVE_NEEDS_HUMAN_CONFIRMATION")


if __name__ == "__main__":
    unittest.main()
