"""Task 178: source-authored JATS ↔ observed PDF cell diagnostic; no certification.

The PMC original PDF is SHA-pinned by release112's existing downloader.
The full publisher JATS is fetched only in ephemeral CI and never committed,
uploaded or logged. Text is compared in-memory; output is numeric-only.
"""
import hashlib
import json
import re
import sys
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ARTICLE_ID = "PMC1064098"
DOI = "10.1186/bcr949"
URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC1064098/fullTextXML"
MAX_JATS = 2 * 1024 * 1024
EXPECTED_PUBLISHER_JATS_SHA256 = "6ccae06bb8df38ae1d1a71119e700066202488b3417159e20e667c4ccf8c54bc"
MAX_INSPECTOR = 15 * 1024 * 1024
STAGE = "INITIAL"


class SourceRejected(Exception):
    pass


def require(condition):
    if not condition:
        raise SourceRejected("Publisher source verification failed")


def tag(element):
    return element.tag.rsplit("}", 1)[-1]


def text_of(element):
    return unicodedata.normalize(
        "NFC", " ".join("".join(element.itertext()).split())
    )[:2048]


def parse_publisher(xml):
    global STAGE
    STAGE = "XML_PARSE"
    require(0 < len(xml) <= MAX_JATS)
    # Publisher JATS routinely has an external PUBLIC DTD declaration.
    # Strip ONLY the bounded, syntactically restricted declaration: never
    # fetch a DTD, resolve entities, or permit an internal entity subset.
    require(b"<!ENTITY" not in xml.upper())
    doctype = re.search(rb'<!DOCTYPE\s+article\s+PUBLIC\s+"[^"<>\[\]]{1,250}"\s+"[A-Za-z0-9._/-]{1,160}"\s*>', xml, re.I)
    if b"<!DOCTYPE" in xml.upper():
        require(doctype is not None and xml.upper().count(b"<!DOCTYPE") == 1)
        xml = xml[:doctype.start()] + xml[doctype.end():]
    STAGE = "XML_ROOT"
    root = ET.fromstring(xml)
    require(tag(root) == "article")
    ids = [(element.attrib.get("pub-id-type", "").lower(), text_of(element).lower())
           for element in root.iter() if tag(element) == "article-id"]
    STAGE = "ARTICLE_ID"
    doi_ok = ("doi", DOI) in ids
    pmc_ok = any(kind in ("pmc", "pmcid") and value in ("1064098", "pmc1064098")
                 for kind, value in ids)
    # Both independent identifiers are required. An HTTP response from a
    # plausible endpoint is not enough to authenticate publisher content.
    require(doi_ok and pmc_ok)
    license_refs = [
        str(v).lower()
        for element in root.iter() if tag(element) == "license"
        for k, v in element.attrib.items()
        if k.rsplit("}", 1)[-1] in ("href", "license-type")
    ]
    STAGE = "LICENSE"
    require(any("creativecommons.org/licenses/by/" in v for v in license_refs))
    wraps = [element for element in root.iter() if tag(element) == "table-wrap"]
    STAGE = "TABLE_COUNT"
    require(len(wraps) == 4)
    output = []
    for wrap in wraps:
        STAGE = "TABLE_SHAPE"
        tables = [t for t in wrap.iter() if tag(t) == "table"]
        require(len(tables) == 1)
        rows = [r for r in tables[0].iter() if tag(r) == "tr"]
        require(2 <= len(rows) <= 100)
        cells = []
        for row in rows:
            items = [c for c in list(row) if tag(c) in ("td", "th")]
            require(1 <= len(items) <= 32)
            for item in items:
                value = text_of(item)
                require(len(value) <= 1200)
                # Cell wording remains in memory, never logged/committed.
                if value:
                    cells.append(value)
        require(cells)
        output.append(cells)
    return output


def normalize(value):
    return unicodedata.normalize("NFC", " ".join(str(value).split())).casefold()


def compare(jats, inspector):
    publisher = parse_publisher(jats)
    parsed = json.loads(inspector)
    pages = parsed.get("document", {}).get("pages", [])
    tables = parsed.get("tables", [])
    require(isinstance(pages, list) and len(pages) == 14)
    require(isinstance(tables, list) and len(tables) <= 100)
    observed = []
    reconstructed_cell_texts = []
    observed_row_texts = []
    observed_table_texts = []
    cell_text_word_disagreements = 0
    for table in tables:
        rows = table.get("rows", [])
        require(isinstance(rows, list) and len(rows) <= 2000)
        table_row_texts = []
        for row in rows:
            cells = row.get("cells", [])
            require(isinstance(cells, list) and len(cells) <= 128)
            row_cells = []
            for cell in cells:
                words = cell.get("words", [])
                require(isinstance(words, list) and len(words) <= 512)
                value = normalize(" ".join(str(word.get("text", "")) for word in words))
                own_text = normalize(str(cell.get("text") or ""))
                if value:
                    observed.append(value)
                if own_text:
                    reconstructed_cell_texts.append(own_text)
                if value and own_text and value != own_text:
                    cell_text_word_disagreements += 1
                row_cells.append(own_text or value)
            row_text = " ".join(row_cells)
            observed_row_texts.append(row_text)
            table_row_texts.append(row_text)
        observed_table_texts.append(" ".join(table_row_texts))
    pub_values = [normalize(value) for table in publisher for value in table]
    # Only distinctive nontrivial cells count toward preliminary text overlap.
    # No identity is inferred from shared short numbers or blank cells.
    distinct = set(value for value in pub_values if len(value) >= 8
                   and any(char.isalpha() for char in value))
    matches = distinct.intersection(observed)
    own_text_matches = distinct.intersection(reconstructed_cell_texts)
    def compact(value):
        # Punctuation and whitespace are only removed for diagnostic
        # comparison; the actual downloaded cell text is never rewritten.
        return "".join(c for c in normalize(value) if c.isalnum())
    distinctive_compact = {compact(value) for value in distinct}
    word_join_compact = {compact(value) for value in observed}
    own_text_compact = {compact(value) for value in reconstructed_cell_texts}
    normalized_word_matches = distinctive_compact & word_join_compact
    normalized_own_matches = distinctive_compact & own_text_compact
    # Source text spanning multiple separate extracted cells may be visible
    # in a single observed row/table, but that is NOT a correctly aligned cell.
    row_compact = [compact(value) for value in observed_row_texts]
    table_compact = [compact(value) for value in observed_table_texts]
    row_contiguous = sum(any(key in value for value in row_compact)
                         for key in distinctive_compact if len(key) >= 8)
    table_contiguous = sum(any(key in value for value in table_compact)
                           for key in distinctive_compact if len(key) >= 8)
    # Secondary diagnostic: find substantial publisher words anywhere in the
    # PDF versus only inside automatically detected table cells. This does NOT
    # establish row/cell structure or document/page version correspondence.
    def tokens(values):
        return {word for value in values
                for word in re.findall(r"[a-zA-Z][a-zA-Z0-9]{5,}", value)}
    publisher_tokens = tokens(pub_values)
    full_pdf_words = []
    for page in pages:
        words = page.get("words", [])
        require(isinstance(words, list) and len(words) <= 20000)
        full_pdf_words.extend(str(word.get("text", "")) for word in words)
    pdf_tokens = tokens([normalize(v) for v in full_pdf_words])
    detected_table_tokens = tokens(observed)
    return {
        "status": "DIAGNOSTIC_ONLY", "publisherId": ARTICLE_ID,
        "publisherTables": len(publisher), "publisherNonemptyCells": len(pub_values),
        "pdfPages": len(pages), "pdfLogicalTables": len(tables),
        "pdfObservedNonemptyCells": len(observed),
        "distinctPublisherCells": len(distinct),
        "matchingDistinctCells": len(matches),
        "matchingDistinctCellsUsingReconstructedCellText": len(own_text_matches),
        "matchingDistinctCellsFormatInsensitiveWordJoin": len(normalized_word_matches),
        "matchingDistinctCellsFormatInsensitiveCellText": len(normalized_own_matches),
        "publisherCellsContiguousWithinPdfRow": row_contiguous,
        "publisherCellsContiguousWithinPdfTable": table_contiguous,
        "pdfCellTextWordJoinDisagreements": cell_text_word_disagreements,
        "distinctivePublisherTokens": len(publisher_tokens),
        "publisherTokensAnywhereInPdf": len(publisher_tokens & pdf_tokens),
        "publisherTokensInDetectedTables": len(publisher_tokens & detected_table_tokens),
        "sourceVersionAligned": False,
        "cellStructureIndependentlyAdjudicated": False,
        "formalV4Credit": 0,
    }


def bounded_file(path, max_bytes):
    with open(path, "rb") as fh:
        data = fh.read(max_bytes + 1)
    require(0 < len(data) <= max_bytes)
    return data


def fetch(destination):
    global STAGE
    STAGE = "NETWORK_FETCH"
    u = urllib.request.Request(URL, headers={"User-Agent": "KukurekuResearch/1.0 (source audit)"})
    with urllib.request.urlopen(u, timeout=30) as response:
        require(response.status == 200)
        require(response.url.startswith("https://www.ebi.ac.uk/europepmc/"))
        length = int(response.headers.get("Content-Length", "0"))
        require(length <= MAX_JATS)
        payload = response.read(MAX_JATS + 1)
    STAGE = "SOURCE_PARSE"
    require(hashlib.sha256(payload).hexdigest() == EXPECTED_PUBLISHER_JATS_SHA256)
    inventory = parse_publisher(payload)
    output = Path(destination)
    require(output.name == "PMC1064098.publisher.xml")
    require(output.parent.name == "private" and output.parent.parent.name == "release112")
    output.parent.mkdir(parents=True, exist_ok=True)
    STAGE = "SAVE_PRIVATE"
    output.write_bytes(payload)
    return {"status": "SOURCE_DOWNLOADED", "publisherId": ARTICLE_ID,
            "publisherTables": len(inventory), "sourceSha256": hashlib.sha256(payload).hexdigest(),
            "sourceSavedOnlyInIgnoredPrivateFolder": True, "formalV4Credit": 0}


def main(args):
    try:
        require(len(args) >= 2)
        if args[0] == "fetch":
            require(len(args) == 2)
            data = fetch(args[1])
        elif args[0] == "compare":
            require(len(args) == 3)
            publisher_xml = bounded_file(args[1], MAX_JATS)
            require(hashlib.sha256(publisher_xml).hexdigest() ==
                    EXPECTED_PUBLISHER_JATS_SHA256)
            data = compare(publisher_xml,
                           bounded_file(args[2], MAX_INSPECTOR))
        else:
            raise SourceRejected()
        print(json.dumps(data, sort_keys=True))
        return 0
    except Exception as exc:
        # Safe enum/class metadata only; never exception messages or values.
        klass = type(exc).__name__[:64]
        print(json.dumps({"status": "SOURCE_BLOCKED_OR_INVALID",
                          "stage": STAGE, "exceptionClass": klass,
                          "formalV4Credit": 0}, sort_keys=True))
        return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
