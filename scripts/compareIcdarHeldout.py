"""Compare numeric-only reserved-split results; no source document reads."""
import json
from pathlib import Path
import re

def compare_reports(baseline,corrected):
    def index(reports):
        if len(reports)!=6:raise ValueError("six reserved documents required")
        result={}
        for item in reports:
            key=item.get("sampleIndex")
            if type(key) is not int or key not in range(4,10) or key in result:
                raise ValueError("invalid or repeated reserved index")
            if any(not re.fullmatch("[0-9a-f]{64}",str(item.get(field,"")))
                   for field in ("pdfSha256","referenceXmlSha256")):
                raise ValueError("missing source pins")
            fields=[item.get(field) for field in ("referenceRegions","matchedRegions","predictions","unmatchedPredictions")]
            if any(type(value) is not int or value<0 for value in fields):
                raise ValueError("invalid counts")
            refs,matched,predicted,unmatched=fields
            if refs<1 or matched>refs or predicted!=matched+unmatched:
                raise ValueError("inconsistent counts")
            result[key]=item
        if len({item["pdfSha256"] for item in result.values()})!=6:
            raise ValueError("duplicate document content")
        return result
    old,new=index(baseline),index(corrected)
    changes=[]
    for key in sorted(old):
        a,b=old[key],new[key]
        if any(a[field]!=b[field] for field in ("pdfSha256","referenceXmlSha256","referenceRegions")):
            raise ValueError("baseline/corrected source mismatch")
        if b["matchedRegions"]<a["matchedRegions"] or b["unmatchedPredictions"]>a["unmatchedPredictions"]:
            raise ValueError("reserved document regression at index "+str(key))
        changes.append({"sampleIndex":key,"references":a["referenceRegions"],
                        "baselineMatched":a["matchedRegions"],"correctedMatched":b["matchedRegions"],
                        "baselineUnmatched":a["unmatchedPredictions"],"correctedUnmatched":b["unmatchedPredictions"]})
    return {"type":"ICDAR_RESERVED_SPLIT_COMPARISON","documents":6,
            "referenceRegions":sum(item["referenceRegions"] for item in old.values()),
            "baselineMatched":sum(item["matchedRegions"] for item in old.values()),
            "correctedMatched":sum(item["matchedRegions"] for item in new.values()),
            "results":changes,"formalV4StableDocumentCredit":0,
            "scope":"Frozen code, development-excluded split; not cell accuracy, rights or pixel certification"}

if __name__=="__main__":
    root=Path("benchmarks/icdar/private/heldout")
    try:
        old=[json.loads((root/f"score-baseline-{i}.json").read_text()) for i in range(4,10)]
        new=[json.loads((root/f"score-corrected-{i}.json").read_text()) for i in range(4,10)]
        print(json.dumps(compare_reports(old,new),sort_keys=True))
    except (OSError,ValueError,KeyError,TypeError):
        print(json.dumps({"type":"ICDAR_RESERVED_SPLIT_COMPARISON","status":"BLOCKED","formalV4StableDocumentCredit":0}))
        raise SystemExit(1)
