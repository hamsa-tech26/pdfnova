import {describe,it,expect} from "vitest";
import {removeOcrGridIntersectionTokens} from "../ocrGridIntersectionFilter";
const word=(text:string,x:number,y:number)=>({text,confidence:92,bounds:{x0:x,y0:y,x1:x+10,y1:y+20},coordinateSpace:"rendered-image-pixels" as const,source:"ocr-tesseract" as const});
describe("Perspective-grid OCR artifact filtering",()=>{
  it("strips only wide multi-column lines and their adjoining faux E glyph",()=>{
    const data=[word("Rani",300,740),word("Para",350,740),word("E",172,560),
      word("|",240,560),word("|",790,560),word("|",1150,560),word("|",1400,560),word("|",1600,560),
      word("Status",1170,616),word("2",172,870)];
    const out=removeOcrGridIntersectionTokens(data,1750);
    expect(out.map(w=>w.text)).toEqual(["Rani","Para","Status","2"]);
    expect(data).toHaveLength(10);
  });
  it("preserves ordinary pipes and legitimate E when no ruled-grid evidence exists",()=>{
    const rows=[word("A",20,90),word("|",80,90),word("E",150,90),word("|",230,110)];
    expect(removeOcrGridIntersectionTokens(rows,1750)).toEqual(rows);
  });
  it("does not delete prose on same y as ruled table borders",()=>{
    const data=[word("Section",500,560),word("|",240,560),word("|",790,560),word("|",1150,560),word("|",1400,560),word("|",1600,560)];
    const out=removeOcrGridIntersectionTokens(data,1750);
    expect(out.map(w=>w.text)).toEqual(["Section"]);
  });
});
