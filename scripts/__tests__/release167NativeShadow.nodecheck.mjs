import {test} from "node:test";
import assert from "node:assert/strict";
import {proposeNativeGridRegions} from "../../benchmarks/release166/nativeGridShadow.mjs";
const makeLine=(row,tokens,ys=700-row*18,ocr=false)=>({
  id:"line-"+row,pageNumber:1,text:tokens.join(" "),
  bounds:{x:55,y:ys,width:420,height:11},
  words:tokens.map((text,i)=>({
    id:"word-"+row+"-"+i,pageNumber:1,text,
    bounds:{x:55+i*145,y:ys,width:text.length*5+10,height:11},
    extractionProvenance:{source:ocr?"ocr-tesseract":"native-pdf"},
  })),
});
const page=lines=>({pageNumber:1,width:620,height:840,lines});
test("four real aligned numeric source rows produce bounded shadow region only",()=>{
  const rows=Array.from({length:5},(_,i)=>
    makeLine(i,["Site"+i,String(2010+i),String(51+i)]));
  const r=proposeNativeGridRegions(page(rows));
  assert.equal(r.length,1);
  assert.equal(r[0].rowCount,5);
  assert.ok(r[0].bounds.height>=70);
  assert.ok(r[0].bounds.width>=290);
});
test("two-column article prose and weak numeric content never qualify",()=>{
  const prose=Array.from({length:12},(_,i)=>
    makeLine(i,["ordinary", "prose"],700-i*12));
  const sparse=Array.from({length:12},(_,i)=>
    makeLine(i,["Label"+i,"Year",String(2020+i)]));
  assert.deepEqual(proposeNativeGridRegions(page(prose)),[]);
  assert.deepEqual(proposeNativeGridRegions(page(sparse)),[]);
});
test("source OCR, unequal number positions and y gaps block automatic candidate",()=>{
  const ocr=Array.from({length:8},(_,i)=>
    makeLine(i,["Site"+i,String(2020+i),String(10+i)],undefined,true));
  assert.deepEqual(proposeNativeGridRegions(page(ocr)),[]);
  const gap=Array.from({length:5},(_,i)=>
    makeLine(i,["Site"+i,String(2020+i),String(10+i)],700-i*55));
  assert.deepEqual(proposeNativeGridRegions(page(gap)),[]);
  const displaced=Array.from({length:5},(_,i)=>
    makeLine(i,["Site"+i,String(2020+i),String(10+i)]));
  for(let i=1;i<displaced.length;i++)
    displaced[i].words[2].bounds.x+=40;
  assert.deepEqual(proposeNativeGridRegions(page(displaced)),[]);
});
test("never returns candidate for unbounded or invalid geometry",()=>{
  assert.deepEqual(proposeNativeGridRegions(page(Array(2501).fill({}))),[]);
  assert.deepEqual(proposeNativeGridRegions({pageNumber:1,width:NaN,height:840,lines:[]}),[]);
});
