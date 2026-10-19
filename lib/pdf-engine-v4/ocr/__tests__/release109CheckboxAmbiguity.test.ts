import {describe,it,expect} from "vitest";
import type {PdfV4OcrPageResult,PdfV4OcrWord} from "../ocrRecognizer";
import {inspectPdfV4OcrCheckboxCandidates} from "../ocrCheckboxReview";
const word=(text:string,x:number,y:number,confidence=90):PdfV4OcrWord=>({
  text,confidence,bounds:{x0:x,y0:y,x1:x+38,y1:y+18},
  coordinateSpace:"rendered-image-pixels",source:"ocr-tesseract",
});
function page(marks:PdfV4OcrWord[]):PdfV4OcrPageResult{
  return {
    pageNumber:1,confidence:85,text:"Pass Fail N/A\nFloor dry X",
    renderedWidth:1000,renderedHeight:1200,language:"eng",
    detectedSkewRadians:null,source:"ocr-tesseract",
    words:[word("Pass",600,80),word("Fail",700,80),word("N/A",800,80),
      word("Floor",50,140),word("dry",100,140),word("Notes",50,240),...marks],
  };
}
describe("Release 109 scanned checklist ambiguous-mark protection",()=>{
  it("retains one confident positioned X as a review clue, never a verified status",()=>{
    expect(inspectPdfV4OcrCheckboxCandidates(page([word("X",700,140,93)])))
      .toEqual([{rowLabel:"Floor dry",alignedWith:"Fail",markerText:"X"}]);
  });
  it("refuses confident status when a low-confidence competing X exists on that row",()=>{
    expect(inspectPdfV4OcrCheckboxCandidates(page([
      word("X",700,140,93),word("X",800,140,32),
    ]))).toEqual([]);
  });
  it("refuses a single weak mark rather than upgrading its confidence",()=>{
    expect(inspectPdfV4OcrCheckboxCandidates(page([
      word("X",700,140,28),
    ]))).toEqual([]);
  });
  it("does not let a weak mark on a separate row suppress an unambiguous clue",()=>{
    expect(inspectPdfV4OcrCheckboxCandidates(page([
      word("X",700,140,93),word("X",800,190,32),
    ]))).toEqual([{rowLabel:"Floor dry",alignedWith:"Fail",markerText:"X"}]);
  });
});
