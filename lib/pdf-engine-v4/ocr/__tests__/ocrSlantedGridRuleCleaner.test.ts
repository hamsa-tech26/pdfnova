import {describe,it,expect} from "vitest";
import {detectPdfV4SlantedRules,clearPdfV4SlantedRules} from "../ocrSlantedGridRuleCleaner";
const fixture=(slanted:boolean)=>{
 const width=600,height=900,pixels=new Uint8ClampedArray(width*height*4).fill(255);
 for(let y=200;y<690;y++)for(let n=0;n<5;n++){
   const x=Math.round(80+105*n+(slanted?0.035*(y-400)*(n-2):0));
   for(let dx=-2;dx<=2;dx++){const p=(y*width+x+dx)*4;pixels[p]=0;pixels[p+1]=0;pixels[p+2]=0;}
 }
 return {width,height,pixels};
};
describe("source-image slanted ruled-grid candidate",()=>{
 it("detects multiple long, spatially coherent slanted rulings",()=>{
   const {width,height,pixels}=fixture(true);
   expect(detectPdfV4SlantedRules(pixels,width,height).length).toBeGreaterThanOrEqual(4);
 });
 it("does not change ordinary straight ruled grids",()=>{
   const {width,height,pixels}=fixture(false);
   expect(detectPdfV4SlantedRules(pixels,width,height)).toEqual([]);
 });
 it("erases detected dark ruling pixels without adding textual content",()=>{
   const {width,height,pixels}=fixture(true);
   const rules=detectPdfV4SlantedRules(pixels,width,height);
   const cleaned=clearPdfV4SlantedRules(pixels,width,height,rules);
   const wasBlack=pixels.reduce((n,v,i)=>n+(i%4===0&&v===0?1:0),0);
   const stillBlack=cleaned.reduce((n,v,i)=>n+(i%4===0&&v===0?1:0),0);
   expect(stillBlack).toBeLessThan(wasBlack);
 });
});
