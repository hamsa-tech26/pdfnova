import io
import tarfile
import unittest
from auditIcdarPairedCorpus import inspect, stem_of

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
