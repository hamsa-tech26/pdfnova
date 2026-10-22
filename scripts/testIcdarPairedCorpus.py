import io
import tarfile
import unittest
from auditIcdarPairedCorpus import inspect, stem_of
from compareIcdarHeldout import compare_reports
from copy import deepcopy

def fixture(entries):
    output=io.BytesIO()
    with tarfile.open(fileobj=output,mode="w:gz") as tar:
        for name,payload in entries:
            info=tarfile.TarInfo(name)
            info.size=len(payload)
            tar.addfile(info,io.BytesIO(payload))
    output.seek(0)
    return output

class BoundedCorpusTests(unittest.TestCase):
    def test_reserved_comparison_rejects_regression_source_substitution_and_duplicate_content(self):
        baseline=[{"sampleIndex":i,"pdfSha256":str(i)*64,"referenceXmlSha256":"a"*64,
                   "referenceRegions":1,"matchedRegions":1,"predictions":1,"unmatchedPredictions":0}
                  for i in range(4,10)]
        self.assertEqual(compare_reports(baseline,deepcopy(baseline))["baselineMatched"],6)
        for mode in ("miss","falsePositive","source","duplicate","missing"):
            candidate=deepcopy(baseline)
            if mode=="miss":candidate[0].update(matchedRegions=0,predictions=0)
            if mode=="falsePositive":candidate[0].update(predictions=2,unmatchedPredictions=1)
            if mode=="source":candidate[0]["referenceXmlSha256"]="b"*64
            if mode=="duplicate":candidate[0]["pdfSha256"]=candidate[1]["pdfSha256"]
            if mode=="missing":candidate.pop()
            with self.subTest(mode=mode),self.assertRaises(ValueError):compare_reports(baseline,candidate)
    def test_filename_pair_normalization(self):
        self.assertEqual(stem_of("folder/PUB-001.pdf"),"pub-001")
        self.assertEqual(stem_of("gold/Pub-001-reg.xml"),"pub-001")
        self.assertEqual(stem_of("gold/Pub-001-str.xml"),"pub-001")
    def test_true_pair(self):
        report=inspect(fixture([("PDFs/a.pdf",b"%PDF-hello"),("XML/a-reg.xml",b"<root/>")]))
        self.assertEqual(report["pairedStems"],1)
        self.assertTrue(report["pdfHeaderValid"])
        self.assertEqual(report["formalV4StableDocumentCredit"],0)
    def test_unpaired_is_not_counted(self):
        report=inspect(fixture([("a.pdf",b"%PDF-hello"),("b-reg.xml",b"<root/>")]))
        self.assertEqual(report["pairedStems"],0)
    def test_archive_traversal_is_rejected(self):
        with self.assertRaises(ValueError):
            inspect(fixture([("../bad.pdf",b"%PDF-hello")]))
    def test_archive_links_are_rejected(self):
        output=io.BytesIO()
        with tarfile.open(fileobj=output,mode="w:gz") as archive:
            m=tarfile.TarInfo("link.pdf")
            m.type=tarfile.SYMTYPE
            m.linkname="/etc/passwd"
            archive.addfile(m)
        output.seek(0)
        with self.assertRaises(ValueError): inspect(output)
