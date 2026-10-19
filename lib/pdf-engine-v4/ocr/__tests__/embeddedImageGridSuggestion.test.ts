import {describe,it,expect} from "vitest";
import type {PdfV4OcrWord} from "../ocrRecognizer";
import {suggestEmbeddedImageGrid} from "../embeddedImageGridSuggestion";
function word(text:string,x:number,y:number,confidence=96):PdfV4OcrWord{
  return {text,confidence,bounds:{x0:x,y0:y,x1:x+Math.max(16,text.length*9),y1:y+22},
    coordinateSpace:"rendered-image-pixels",source:"ocr-tesseract"};
}
const words=[
  word("Item",40,25),word("Cost",310,25),
  word("StationA",40,75),word("00120",310,75),
  word("StationB",41,125),word("00071",312,125),
  word("StationC",39,175),word("01300",309,175),
];
describe("Kukureku R124–128 image OCR table proposal boundary",()=>{
  it("recovers 4-by-2 consistent word geometry only as a manual proposal",()=>{
    const plan=suggestEmbeddedImageGrid(words,650,320);
    expect(plan.status).toBe("PROPOSED_FOR_MANUAL_REVIEW");
    expect(plan.rows).toEqual([
      ["Item","Cost"],["StationA","00120"],["StationB","00071"],["StationC","01300"]
    ]);
    expect(plan.tsv).toContain("StationB\t00071");
    expect(plan.reason).toMatch(/Compare every proposed cell/);
    expect(plan.sourceWordCount).toBe(8);
  });
  it("merges adjacent OCR glyph words into a cell without changing column alignment",()=>{
    const w=[
      word("Service",40,25),word("Site",107,25),word("Count",310,25),
      word("Station",40,75),word("One",122,75),word("0123",310,75),
      word("Station",41,125),word("Two",123,125),word("0110",312,125),
    ];
    const plan=suggestEmbeddedImageGrid(w,650,320);
    expect(plan.status).toBe("PROPOSED_FOR_MANUAL_REVIEW");
    expect(plan.rows[0][0]).toBe("Service Site");
    expect(plan.rows[2]).toEqual(["Station Two","0110"]);
  });
  it("refuses parallel article prose, one-column text and drifting anchors",()=>{
    const prose=words.map((w,i)=>({...w,text:["Narrative","Context","Figure","Column","Layout","Notes","Section","Footer"][i]}));
    expect(suggestEmbeddedImageGrid(prose,650,320).status).toBe("INSUFFICIENT_EVIDENCE");
    const oneColumn=words.filter((_,i)=>i%2===0);
    expect(suggestEmbeddedImageGrid(oneColumn,650,320).status).toBe("INSUFFICIENT_EVIDENCE");
    const shifted=words.map((w,i)=>i===5?{...w,bounds:{...w.bounds,x0:390,x1:460}}:w);
    expect(suggestEmbeddedImageGrid(shifted,650,320).status).toBe("INSUFFICIENT_EVIDENCE");
  });
  it("refuses unreliable words, inconsistent columns and off-page coordinates",()=>{
    expect(suggestEmbeddedImageGrid(words.map(w=>({...w,confidence:12})),650,320).status)
      .toBe("INSUFFICIENT_EVIDENCE");
    expect(suggestEmbeddedImageGrid(words.slice(0,7),650,320).status)
      .toBe("INSUFFICIENT_EVIDENCE");
    const outside=words.map((w,i)=>i===0?{...w,bounds:{...w.bounds,x0:-1}}:w);
    expect(suggestEmbeddedImageGrid(outside,650,320).status).toBe("INSUFFICIENT_EVIDENCE");
  });
});
