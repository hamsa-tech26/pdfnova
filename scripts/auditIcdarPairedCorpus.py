#!/usr/bin/env python3
"""SHA-pinned small PDF+annotation paired-corpus availability probe.

No source files, document text or annotations leave the ephemeral CI runner.
This is an inventory-only test, NOT accuracy certification or rights clearance.
"""
import hashlib
import json
from pathlib import PurePosixPath
import sys
import tarfile
import tempfile
from urllib.request import Request, urlopen

URL="https://huggingface.co/datasets/bsmock/ICDAR-2013-Table-Competition-Corrected/resolve/main/ICDAR-2013-Table-Competition-Corrected.tar.gz"
EXPECTED_SHA256="fbea3d39d186256c56cca5640c197af458d06e1f73210adb78526b92068c193a"
ARCHIVE_CAP=16*1024*1024
MEMBER_CAP=32*1024*1024
TOTAL_UNPACKED_CAP=280*1024*1024

def stem_of(filename):
    basename=PurePosixPath(filename.replace("\\","/")).name.lower()
    if basename.endswith(".pdf"):
        return basename[:-4]
    if not basename.endswith(".xml"):
        return None
    basename=basename[:-4]
    for suffix in ("-reg","-str","_reg","_str","-region","_region","-structure","_structure"):
        if basename.endswith(suffix):
            return basename[:-len(suffix)]
    return basename

def inspect(f):
    pdfs,annotations={},{}
    members=0
    total=0
    valid_header=False
    with tarfile.open(fileobj=f,mode="r:gz") as archive:
        for m in archive:
            members+=1
            if members>15000: raise ValueError("member limit")
            parts=PurePosixPath(m.name.replace("\\","/")).parts
            if m.name.startswith("/") or ".." in parts or m.issym() or m.islnk() or not (m.isfile() or m.isdir()):
                raise ValueError("unsafe entry")
            if not m.isfile(): continue
            if m.size>MEMBER_CAP: raise ValueError("individual member limit")
            total+=m.size
            if total>TOTAL_UNPACKED_CAP: raise ValueError("uncompressed limit")
            name=m.name.lower()
            stem=stem_of(name)
            if not stem: continue
            if name.endswith(".pdf"):
                pdfs[stem]=pdfs.get(stem,0)+1
                if not valid_header:
                    stream=archive.extractfile(m)
                    valid_header=bool(stream and stream.read(5)==b"%PDF-")
            elif name.endswith(".xml"):
                annotations[stem]=annotations.get(stem,0)+1
    return {
        "archiveMembers":members,"pdfCount":sum(pdfs.values()),
        "xmlCount":sum(annotations.values()),"pairedStems":len(pdfs.keys()&annotations.keys()),
        "pdfHeaderValid":valid_header,"duplicatePdfStems":sum(x>1 for x in pdfs.values()),
        "duplicateXmlStems":sum(x>1 for x in annotations.values()),
        "sourceRightsIndependentlyReviewed":False,"formalV4StableDocumentCredit":0,
        "status":"SOURCE_AND_GT_IN_SAME_DISTRIBUTED_ARCHIVE_NOT_YET_GEOMETRY_VERIFIED"
    }

def main():
    with tempfile.TemporaryFile() as dst:
        request=Request(URL,headers={"User-Agent":"Kukureku-bounded-benchmark-probe/1.0"})
        with urlopen(request,timeout=45) as response:
            sha=hashlib.sha256()
            size=0
            while True:
                data=response.read(65536)
                if not data: break
                size+=len(data)
                if size>ARCHIVE_CAP: raise ValueError("archive cap")
                dst.write(data);sha.update(data)
        checksum=sha.hexdigest()
        if checksum!=EXPECTED_SHA256: raise ValueError("publisher mirror sha mismatch")
        dst.seek(0)
        result=inspect(dst)
        result.update({"type":"SMALL_REAL_PDF_BENCHMARK_PREFLIGHT",
                       "archiveBytes":size,"archiveSha256":checksum})
        print(json.dumps(result,sort_keys=True))
        if result["pairedStems"]<1 or not result["pdfHeaderValid"]: sys.exit(2)

if __name__=="__main__":
    try: main()
    except Exception as exc:
        print(json.dumps({"type":"SMALL_REAL_PDF_BENCHMARK_PREFLIGHT","status":"BLOCKED",
                          "failureClass":type(exc).__name__,"certificationGranted":False}))
        sys.exit(1)
