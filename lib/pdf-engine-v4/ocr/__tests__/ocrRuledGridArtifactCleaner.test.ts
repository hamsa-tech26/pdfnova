import {describe,it,expect} from "vitest";
import {cleanPdfV4RuledGridArtifacts} from "../ocrRuledGridArtifactCleaner";
import type {PdfV4OcrWord} from "../ocrRecognizer";
const w=(text:string,x:number,y:number,confidence=90):PdfV4OcrWord=>({
 text,confidence,bounds:{x0:x,y0:y,x1:x+(text==="18"?36:text.length>8?100:9),y1:y+20},
 coordinateSpace:"rendered-image-pixels",source:"ocr-tesseract",
});
function grid(){
 return [1300,1520,1640,1778,1900].flatMap(y=>[130,250,780,1200,1660].map(x=>w("|",x,y,90)));
}
describe("ruled OCR grid artifacts",()=>{
 it("does not edit text without spatial evidence",()=>{
  const words=[w("18",128,1649,41),w("damage!",1535,1506,50),w("I",119,1824,30)];
  expect(cleanPdfV4RuledGridArtifacts(words,1750)).toEqual({words,removed:[],corrected:[]});
 });
 it("drops low-confidence source-border debris but preserves low-confidence legitimate words",()=>{
  const longRule=w("———",800,1810,0);longRule.bounds.x1=1000;
  const words=[...grid(),w("Damcherra",790,1649,8),w("a",130,1613,0),w("ES",283,1810,22),longRule];
  const result=cleanPdfV4RuledGridArtifacts(words,1750);
  expect(result.words.some(x=>x.text==="Damcherra")).toBe(true);
  expect(result.words.filter(x=>x.text==="|")).toHaveLength(25);
  expect(result.removed.map(x=>x.text).sort()).toEqual(["ES","a","———"].sort());
 });
 it("repairs a border-prefixed serial only when observed neighboring serials corroborate",()=>{
  const words=[...grid(),w("7",154,1520),w("18",128,1649,41),w("9",142,1778)];
  const result=cleanPdfV4RuledGridArtifacts(words,1750);
  expect(result.words.filter(x=>x.text!=="|").map(x=>x.text)).toEqual(["7","8","9"]);
  expect(result.corrected).toHaveLength(1);
 });
 it("does not assume sequential serials where evidence is missing",()=>{
  const words=[...grid(),w("18",128,1649,41),w("9",142,1778)];
  expect(cleanPdfV4RuledGridArtifacts(words,1750).words.find(x=>x.text==="18")?.text).toBe("18");
 });
});
