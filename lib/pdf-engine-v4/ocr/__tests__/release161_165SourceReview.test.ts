import {describe,it,expect} from "vitest";
import type {PdfV4OcrPageResult,PdfV4OcrWord} from "../ocrRecognizer";
import {inspectOcrIdentifierRisks} from "../ocrIdentifierRisks";
import {shouldReviewLowResolutionOcr,planLowResolutionIdentifierLine,
  acceptIdentifierLineReview} from "../ocrLowResolutionReview";
import {inspectPdfV4OcrCheckboxCandidates} from "../ocrCheckboxReview";
import {buildPdfV4OcrTextExport,formatPdfV4OcrPageExport,
  suggestPdfV4OcrColumnPreview} from "../ocrTextExport";
const w=(text:string,x:number,y:number,confidence=94,width=44):PdfV4OcrWord=>({
  text,confidence,bounds:{x0:x,x1:x+width,y0:y,y1:y+16},
  coordinateSpace:"rendered-image-pixels",source:"ocr-tesseract",
});
const page=(words:PdfV4OcrWord[],text="source"):PdfV4OcrPageResult=>({
  words,text,pageNumber:1,confidence:88,renderedWidth:1000,
  renderedHeight:1400,detectedSkewRadians:null,language:"eng",source:"ocr-tesseract",
});
describe("R161 source-anchored OCR identifiers, never automatic source correction",()=>{
  it("flags mixed identifier characters while preserving exact original OCR strings",()=>{
    const text="Record ID: DC-T316\nReference: MAINT-160CT\nOrdinary note.";
    const a=inspectOcrIdentifierRisks(text);
    expect(a.map(x=>x.lineNumber)).toEqual([1,2]);
    expect(a.every(x=>x.requiresSourceCheck)).toBe(true);
    expect(a.every(x=>x.ambiguousCharacterCount>=1)).toBe(true);
    const exported=buildPdfV4OcrTextExport(page([],text));
    expect(exported.text).toBe(text);
    expect(exported.warnings.join(" ")).toMatch(/character confusion/);
    expect(formatPdfV4OcrPageExport(page([],text)))
      .toContain("[EXACT IDENTIFIER SOURCE CHECK - NOT VERIFIED]");
    expect(formatPdfV4OcrPageExport(page([],text))).not.toContain("DC-7316");
  });
  it("refuses speculative substitutions, ordinary body tokens and unbounded text",()=>{
    expect(inspectOcrIdentifierRisks("Paragraph about DC-T316.")).toEqual([]);
    expect(inspectOcrIdentifierRisks("Record ID: abcdef")).toEqual([]);
    expect(inspectOcrIdentifierRisks("x".repeat(250001))).toEqual([]);
    expect(inspectOcrIdentifierRisks("Record ID: A0B7")).toHaveLength(1);
  });
});
describe("R162 bounded reread of independent Reference: source line",()=>{
  const referenceWords=[
    w("FORM",40,50),w("Inspection",120,50),w("Record",40,85),
    w("Date:",120,85),w("2026-10-20",200,85),
    w("Reference:",40,160),w("MAINT-160CT",180,160),
    w("Section",40,250),w("Inspector",120,250),
    w("Complete",200,250),
  ];
  it("targets only a local source label, with no invisible guess",()=>{
    const planned=planLowResolutionIdentifierLine({
      words:referenceWords,renderedWidth:1000,renderedHeight:1400});
    expect(planned).not.toBeNull();
    expect(planned!.left).toBeLessThan(40);
    expect(planned!.left+planned!.width).toBeGreaterThan(210);
    expect(planned!.top+planned!.height).toBeLessThan(250);
    const baseline="Reference: MAINT-160CT\nSome report metadata and repeated details "+
      "that are clearly more than seventy characters long.";
    expect(shouldReviewLowResolutionOcr(baseline,74)).toBe(true);
    expect(shouldReviewLowResolutionOcr(baseline,96)).toBe(false);
    expect(acceptIdentifierLineReview("Reference: MAINT-160CT",
      "Reference: MAINT-16OCT",86)).toBe("Reference: MAINT-16OCT");
    expect(acceptIdentifierLineReview("Reference: MAINT-160CT",
      "Record ID: DC-T316",86)).toBeNull();
  });
  it("refuses a distant second column even if the label looks plausible",()=>{
    const spread=referenceWords.map(word=>({...word,bounds:{...word.bounds}}));
    spread[6].bounds.x0=820;spread[6].bounds.x1=925;
    expect(planLowResolutionIdentifierLine({
      words:spread,renderedWidth:1000,renderedHeight:1400})).toBeNull();
  });
});
describe("R163 conservatively refuse ambiguous OCR checkbox assignments",()=>{
  const headings=[w("Pass",550,80),w("Fail",650,80),w("N/A",750,80)];
  const row=[w("Water",40,160),w("works",98,160),w("X",650,160)];
  it("shows evidence only when header and row text are reliable",()=>{
    expect(inspectPdfV4OcrCheckboxCandidates(page([...headings,...row])))
      .toHaveLength(1);
    const weakHeading=headings.map((v,i)=>i===1?{...v,confidence:45}:v);
    expect(inspectPdfV4OcrCheckboxCandidates(page([...weakHeading,...row])))
      .toEqual([]);
    const weakRow=row.map((v,i)=>i<2?{...v,confidence:35}:v);
    expect(inspectPdfV4OcrCheckboxCandidates(page([...headings,...weakRow])))
      .toEqual([]);
  });
  it("refuses X status when competing ambiguous marks appear in same row",()=>{
    const checkbox=page([...headings,...row,w("✓",760,160,50)]);
    expect(inspectPdfV4OcrCheckboxCandidates(checkbox)).toEqual([]);
    expect(buildPdfV4OcrTextExport(checkbox).text).toBe("source");
  });
});
describe("R164 preserve displaced OCR words in optional multi-column preview",()=>{
  it("retains source spanning headings without inferring their reading order",()=>{
    const words=Array.from({length:15},(_,i)=>[
      w("left"+i,25,90+i*31),w("body",85,90+i*31),
      w("right"+i,785,90+i*31),w("text",845,90+i*31),
    ]).flat();
    words.push(w("SectionHeading",320,24,90,440));
    const input=page(words,"Original OCR still includes all recognized words.");
    const preview=suggestPdfV4OcrColumnPreview(input);
    expect(preview).toContain("[LEFT COLUMN");
    expect(preview).toContain("[RIGHT COLUMN");
    expect(preview).toContain("[SPANNING OR UNCERTAIN WORDS");
    expect(preview).toContain("SectionHeading");
    expect(buildPdfV4OcrTextExport(input).text).toBe(input.text);
  });
});
