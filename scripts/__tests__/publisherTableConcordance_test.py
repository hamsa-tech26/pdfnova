import unittest
import json
import importlib.util
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "checkPublisherTableConcordance.py"
spec = importlib.util.spec_from_file_location("publisher", p)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def fixture():
    wraps = "".join(
        '<table-wrap><label>Table %d</label><table><tbody>'
        '<tr><th>Sample identity %d</th><th>Value</th></tr>'
        '<tr><td>Specimen 000123</td><td>12.3</td></tr>'
        '</tbody></table></table-wrap>' % (n, n)
        for n in range(1, 5)
    )
    return ('<article><front><article-meta>'
            '<article-id pub-id-type="doi">10.1186/bcr949</article-id>'
            '<article-id pub-id-type="pmc">1064098</article-id>'
            '<permissions><license xmlns:xlink="http://www.w3.org/1999/xlink" '
            'xlink:href="http://creativecommons.org/licenses/by/2.0/"/>'
            '</permissions></article-meta></front><body>' + wraps +
            '</body></article>').encode()

class PublisherConcordanceTests(unittest.TestCase):
    def test_four_original_article_tables_with_blanks_and_spans(self):
        value = fixture()
        items = mod.parse_publisher(value)
        self.assertEqual(len(items), 4)
        self.assertTrue(all("Specimen 000123" in x for x in items))

    def test_bounded_external_jats_doctype_accepted_without_loading_entities(self):
        good = fixture()
        header = (b'<!DOCTYPE article PUBLIC "-//NLM//DTD JATS 1.4//EN" '
                  b'"JATS-archivearticle1-4-mathml3.dtd">\n')
        self.assertEqual(len(mod.parse_publisher(header + good)), 4)
        dangerous = [
            b'<!DOCTYPE article [<!ENTITY ex SYSTEM "file:///etc/passwd">]>\n',
            b'<!DOCTYPE article PUBLIC "-//NLM//DTD JATS//EN" "https://x.test/a.dtd">\n',
            b'<!DOCTYPE article SYSTEM "random.dtd">\n',
        ]
        for declaration in dangerous:
            with self.assertRaises(Exception):
                mod.parse_publisher(declaration + good)

    def test_rejects_wrong_doi_missing_license_and_unbounded_xml(self):
        good = fixture()
        for bad in [good.replace(b"bcr949", b"WRONG"),
                    good.replace(b"creativecommons.org/licenses/by/", b"unknown/license/"),
                    b"<!DOCTYPE article><article/>",
                    good + b" "*mod.MAX_JATS]:
            with self.assertRaises(Exception):
                mod.parse_publisher(bad)

    def test_source_digest_must_be_bound_to_independently_recorded_publisher_copy(self):
        self.assertRegex(mod.EXPECTED_PUBLISHER_JATS_SHA256, r"^[0-9a-f]{64}$")
        import hashlib
        self.assertNotEqual(hashlib.sha256(fixture()).hexdigest(),
                            mod.EXPECTED_PUBLISHER_JATS_SHA256)

    def test_comparison_is_diagnostic_and_never_logs_cells(self):
        payload = {"document": {"pages": [{"words": [{"text": "Specimen"}]}] + [{} for _ in range(13)]},
                   "tables": [{"rows": [{"cells": [
                       {"words": [{"text": "Specimen"}, {"text": "000123"}]},
                       {"words": [{"text": "12.3"}]},
                   ]}]}]}
        out = mod.compare(fixture(), json.dumps(payload))
        self.assertEqual(out["publisherTables"], 4)
        self.assertEqual(out["pdfPages"], 14)
        self.assertEqual(out["matchingDistinctCells"], 1)
        self.assertEqual(out["matchingDistinctCellsUsingReconstructedCellText"], 0)
        self.assertEqual(out["matchingDistinctCellsFormatInsensitiveWordJoin"], 1)
        self.assertGreaterEqual(out["publisherCellsContiguousWithinPdfRow"], 1)
        self.assertGreaterEqual(out["publisherCellsContiguousWithinPdfTable"], 1)
        self.assertGreaterEqual(out["publisherTokensAnywhereInPdf"], 1)
        self.assertGreaterEqual(out["publisherTokensInDetectedTables"], 1)
        self.assertLessEqual(out["publisherTokensInDetectedTables"], out["distinctivePublisherTokens"])
        self.assertEqual(out["formalV4Credit"], 0)
        self.assertFalse(out["sourceVersionAligned"])
        self.assertNotIn("Specimen", json.dumps(out))
        self.assertNotIn("12.3", json.dumps(out))

    def test_cell_text_can_disagree_with_joined_words_without_conferring_certification(self):
        payload = {"document": {"pages": [{} for _ in range(14)]},
                   "tables": [{"rows": [{"cells": [
                       {"text": "Specimen 000123", "words": [
                           {"text": "Specimen"}, {"text": "broken"}]},
                   ]}]}]}
        out = mod.compare(fixture(), json.dumps(payload))
        self.assertEqual(out["matchingDistinctCells"], 0)
        self.assertEqual(out["matchingDistinctCellsUsingReconstructedCellText"], 1)
        self.assertEqual(out["pdfCellTextWordJoinDisagreements"], 1)
        self.assertEqual(out["formalV4Credit"], 0)
        self.assertNotIn("Specimen", json.dumps(out))

    def test_source_cell_split_across_detected_cells_is_not_an_exact_cell_match(self):
        payload = {"document": {"pages": [{} for _ in range(14)]},
                   "tables": [{"rows": [{"cells": [
                       {"text": "Specimen", "words": [{"text": "Specimen"}]},
                       {"text": "000123", "words": [{"text": "000123"}]},
                   ]}]}]}
        out = mod.compare(fixture(), json.dumps(payload))
        self.assertEqual(out["matchingDistinctCells"], 0)
        self.assertEqual(out["matchingDistinctCellsUsingReconstructedCellText"], 0)
        self.assertGreaterEqual(out["publisherCellsContiguousWithinPdfRow"], 1)
        self.assertEqual(out["formalV4Credit"], 0)

    def test_rejects_non_original_inspector_shape(self):
        with self.assertRaises(Exception):
            mod.compare(fixture(), json.dumps({"document": {"pages": [{}]},
                                               "tables": []}))

if __name__ == "__main__":
    unittest.main()
