import {describe,it,expect} from "vitest";
import {createPdfV4OcrDecision} from "../ocrDecision";

function decision(...statuses:Array<"none"|"low"|"sufficient">){
  return createPdfV4OcrDecision({
    pages:statuses.map((status,index)=>({
      pageNumber:index+1,textExtraction:{status},
    })),
  } as Parameters<typeof createPdfV4OcrDecision>[0]);
}
describe("Release 111 native-first mixed-page OCR routing regression",()=>{
  it("keeps native text out of required OCR, and records review pages separately",()=>{
    expect(decision("sufficient","none","low")).toEqual({
      status:"page-selective",
      requiredPageNumbers:[2],
      reviewPageNumbers:[3],
      nativeTextPageNumbers:[1],
    });
  });
  it("does not request OCR of a wholly selectable document",()=>{
    expect(decision("sufficient","sufficient")).toMatchObject({
      status:"not-required",requiredPageNumbers:[],reviewPageNumbers:[],
      nativeTextPageNumbers:[1,2],
    });
  });
  it("requires full-page OCR only for entirely absent native text",()=>{
    expect(decision("none","none")).toMatchObject({
      status:"required",requiredPageNumbers:[1,2],
      nativeTextPageNumbers:[],
    });
  });
  it("retains a low-text-only page as review, not unverified native sufficiency",()=>{
    expect(decision("sufficient","low")).toMatchObject({
      status:"review",requiredPageNumbers:[],reviewPageNumbers:[2],
      nativeTextPageNumbers:[1],
    });
  });
});
