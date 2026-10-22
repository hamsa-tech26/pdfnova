#!/usr/bin/env python3
"""Prepare fixed development or reserved PDF/region-XML pairs for browser QA.

No source PDF, XML or transcript should leave the temporary GitHub Actions runner.
One fixed sample is DEVELOPMENT DIAGNOSTIC, never unseen final qualification.
"""
import hashlib
import argparse
import json
from pathlib import Path
import tarfile
import tempfile
from urllib.request import Request,urlopen
import xml.etree.ElementTree as ET
import fitz
from auditIcdarPairedCorpus import URL, EXPECTED_SHA256, ARCHIVE_CAP, MEMBER_CAP, stem_of
from validateIcdarPairedGeometry import check_pair, kind_of

OUT=Path("benchmarks/icdar/private")
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--heldout",action="store_true")
    heldout=parser.parse_args().heldout
    skip,take=(3,6) if heldout else (0,3)
    out=OUT/"heldout" if heldout else OUT
    with tempfile.TemporaryFile() as tmp:
        size=0;sha=hashlib.sha256()
        with urlopen(Request(URL,headers={"User-Agent":"Kukureku-ephemeral-ICDAR-pilot/1.0"}),timeout=45) as source:
            while True:
                part=source.read(65536)
                if not part:break
                size+=len(part)
                if size>ARCHIVE_CAP:raise ValueError("archive cap exceeded")
                sha.update(part);tmp.write(part)
        if sha.hexdigest()!=EXPECTED_SHA256:raise ValueError("archive hash mismatch")
        tmp.seek(0)
        groups={}
        with tarfile.open(fileobj=tmp,mode="r:gz") as tar:
            for member in tar:
                typ=kind_of(member.name)
                if not member.isfile() or not typ or member.size>MEMBER_CAP:continue
                stem=stem_of(member.name)
                if not stem:continue
                data=tar.extractfile(member).read(MEMBER_CAP+1)
                if len(data)>MEMBER_CAP:continue
                groups.setdefault(stem,{"pdf":{},"region":{}})[typ][hashlib.sha256(data).hexdigest()]=data
        chosen=[]
        valid_index=0
        for stem in sorted(groups):
            entries=groups[stem]
            if len(entries["pdf"])!=1 or len(entries["region"])!=1:continue
            pdf=next(iter(entries["pdf"].values()))
            xml=next(iter(entries["region"].values()))
            valid,num,reason=check_pair(pdf,xml,stem)
            if not valid:continue
            valid_index+=1
            if valid_index<=skip:continue
            tree=ET.fromstring(xml)
            refs=[]
            with fitz.open(stream=pdf,filetype="pdf") as document:
                for region in tree.iter("region"):
                    page=int(region.attrib["page"])
                    boxes=list(region.iter("bounding-box"))
                    if len(boxes)!=1:raise ValueError("inconsistent verified reference")
                    a=boxes[0].attrib
                    rect={"x":float(a["x1"]),"y":float(a["y1"]),
                          "width":float(a["x2"])-float(a["x1"]),
                          "height":float(a["y2"])-float(a["y1"])}
                    refs.append({"page":page,"bounds":rect,
                                 "pageHeight":document[page-1].mediabox.height,
                                 "pageWidth":document[page-1].mediabox.width})
                index=valid_index
                chosen.append({"sampleIndex":index,"pageCount":document.page_count,
                               "pdfSha256":hashlib.sha256(pdf).hexdigest(),
                               "referenceSha256":hashlib.sha256(xml).hexdigest(),
                               "regions":refs})
                out.mkdir(parents=True,exist_ok=True)
                (out/("sample-"+str(index)+".pdf")).write_bytes(pdf)
            if len(chosen)==take:break
        if len(chosen)!=take:raise ValueError("insufficient strictly source-mapped examples")
        (out/"pilot.json").write_text(json.dumps({"provenance":"ICDAR2013_CORRECTED_THIRD_PARTY_PAIRS",
            "approvedV4StableCredit":0,"rightsIndependentlyVerified":False,
            "split":"heldout" if heldout else "development",
            "excludedFromDevelopment":heldout,
            **({} if heldout else {"unseenHeldout":False}),"samples":chosen}),encoding="utf8")
        print(json.dumps({"type":"ICDAR_ACTUAL_PDF_SPLIT_PREPARED",
            "documentCount":len(chosen),
            "referenceRegions":sum(len(c["regions"]) for c in chosen),
            "acceptedV4StableCredit":0,"excludedFromDevelopment":heldout}))
if __name__=="__main__":
    try:main()
    except Exception as e:
        print(json.dumps({"type":"ICDAR_ACTUAL_PDF_SPLIT_PREPARED",
                         "state":"BLOCKED","errorType":type(e).__name__}))
        raise SystemExit(1)
