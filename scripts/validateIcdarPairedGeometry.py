#!/usr/bin/env python3
"""Original ICDAR PDF + region XML pairing and geometry preflight.

Archives never leave a temporary runner file; only aggregate numbers are logged.
Not a cell-accuracy test and not source-rights clearance.
"""
import hashlib
import json
import re
import sys
import tarfile
import tempfile
import xml.etree.ElementTree as ET
from pathlib import PurePosixPath
from urllib.request import Request,urlopen
import fitz
from auditIcdarPairedCorpus import URL,EXPECTED_SHA256,ARCHIVE_CAP,MEMBER_CAP,stem_of

def kind_of(name):
    n=PurePosixPath(name.replace("\\","/")).name.lower()
    if n.endswith(".pdf"):return "pdf"
    if n.endswith("-reg.xml") or n.endswith("_reg.xml"):return "region"
    return ""

def check_pair(pdf_data,xml_data,document_stem):
    if len(pdf_data)>MEMBER_CAP or not pdf_data.startswith(b"%PDF-") or len(xml_data)>1024*1024:
        return (False,0,"size")
    if b"<!DOCTYPE" in xml_data.upper() or b"<!ENTITY" in xml_data.upper():
        return (False,0,"unsafeXml")
    try:
        root=ET.fromstring(xml_data)
        if root.tag.rsplit("}",1)[-1]!="document":return (False,0,"badRoot")
        ref=root.get("filename","")
        if stem_of(ref)!=document_stem:return (False,0,"filename")
        with fitz.open(stream=pdf_data,filetype="pdf") as document:
            if document.page_count<1 or document.page_count>100:
                return (False,0,"pages")
            regions=[node for node in root.iter() if node.tag.rsplit("}",1)[-1]=="region"]
            if not regions:return (False,0,"emptyRegions")
            count=0
            for r in regions:
                page_index=int(r.attrib.get("page","0"))-1
                if page_index<0 or page_index>=document.page_count:return (False,0,"pageIndex")
                bounds=[node for node in r.iter() if node.tag.rsplit("}",1)[-1]=="bounding-box"]
                if len(bounds)!=1:return (False,0,"bboxCount")
                b=bounds[0]
                x1=float(b.attrib["x1"]);y1=float(b.attrib["y1"])
                x2=float(b.attrib["x2"]);y2=float(b.attrib["y2"])
                page=document[page_index]
                # Native PDF coordinate direction can differ, but extents
                # must still fit the MediaBox. This does not prove pixel identity.
                w=page.mediabox.width;h=page.mediabox.height
                if not (0<=x1<x2<=w+3 and 0<=y1<y2<=h+3):
                    return (False,0,"bounds")
                count+=1
            return (True,count,"ok")
    except (ValueError,KeyError,TypeError,fitz.FileDataError,ET.ParseError,RuntimeError,OverflowError):
        return (False,0,"parse")

def inspect_source_pairs(stream):
    groups={}
    with tarfile.open(fileobj=stream,mode="r:gz") as tar:
        for member in tar:
            typ=kind_of(member.name)
            if not typ or not member.isfile() or member.size>MEMBER_CAP:
                continue
            stem=stem_of(member.name)
            if not stem:continue
            data=tar.extractfile(member).read(MEMBER_CAP+1)
            if len(data)>MEMBER_CAP:continue
            groups.setdefault(stem,{"pdf":{},"region":{}})[typ][hashlib.sha256(data).hexdigest()]=data
    summary={"filenameGroups":len(groups),"unambiguousPairs":0,
             "variantAmbiguousPairs":0,"geometryVerifiedDocumentPairs":0,
             "geometryVerifiedReferenceRegions":0,"geometryRejectedDocumentPairs":0,
             "sourceRightsIndependentlyReviewed":False,
             "formalV4StableDocumentCredit":0,
             "metric":"SOURCE_AND_ANNOTATION_VERSION_GEOMETRY_SANITY_NOT_PIXEL_EQUIVALENCE"}
    error_counts={}
    for stem,variants in groups.items():
        if not variants["pdf"] or not variants["region"]:continue
        if len(variants["pdf"])!=1 or len(variants["region"])!=1:
            summary["variantAmbiguousPairs"]+=1
            continue
        summary["unambiguousPairs"]+=1
        valid,regions,why=check_pair(next(iter(variants["pdf"].values())),
                                     next(iter(variants["region"].values())),stem)
        if valid:
            summary["geometryVerifiedDocumentPairs"]+=1
            summary["geometryVerifiedReferenceRegions"]+=regions
        else:
            summary["geometryRejectedDocumentPairs"]+=1
            error_counts[why]=error_counts.get(why,0)+1
    summary["rejectReasonsByType"]=error_counts
    return summary

def main():
    with tempfile.TemporaryFile() as temp:
        req=Request(URL,headers={"User-Agent":"Kukureku-ephemeral-ICDAR-geometry-audit/1.0"})
        digest=hashlib.sha256();size=0
        with urlopen(req,timeout=45) as response:
            while True:
                chunk=response.read(65536)
                if not chunk:break
                size+=len(chunk)
                if size>ARCHIVE_CAP:raise ValueError("archive cap")
                digest.update(chunk);temp.write(chunk)
        if digest.hexdigest()!=EXPECTED_SHA256:raise ValueError("source SHA256 mismatch")
        temp.seek(0)
        result=inspect_source_pairs(temp)
        print(json.dumps({"type":"ICDAR_ORIGINAL_PDF_ANNOTATION_GEOMETRY",**result},sort_keys=True))
        if result["geometryVerifiedDocumentPairs"]==0:sys.exit(2)

if __name__=="__main__":
    try:main()
    except Exception as err:
        print(json.dumps({"type":"ICDAR_ORIGINAL_PDF_ANNOTATION_GEOMETRY",
                          "result":"BLOCKED","failure":type(err).__name__,"certifiedDocuments":0}))
        sys.exit(1)
