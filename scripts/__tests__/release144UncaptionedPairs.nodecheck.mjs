import {test} from "node:test";
import assert from "node:assert/strict";
import {assessUncaptionedPairedNativeStream as assess}
  from "../../benchmarks/release112/assessUncaptionedNativePairs.mjs";
const ref={x:50,y:93,width:405,height:61};
function line(y,left=true,right=true){
  return {bounds:{x:57,y:y-4,width:480,height:8},
    words:[...(left?[{text:"long source narrative segment",
      extractionProvenance:{source:"native-pdf"},
      bounds:{x:57,y:y-4,width:220,height:8}}]:[]),
      ...(right?[{text:"another long source narrative segment",
      extractionProvenance:{source:"native-pdf"},
      bounds:{x:315,y:y-4,width:215,height:8}}]:[])]};
}
function source(rows){return [{type:"paragraph",lines:rows}];}
test("continuous scientific article prose may NOT be auto-promoted by a cropped published box",()=>{
  const rows=[line(157.7),...Array.from({length:5},(_,i)=>line(145.9-i*11.75)),
    line(87.2,false,true)];
  const q=assess(source(rows),ref);
  assert.equal(q.pairedInside,5);
  assert.equal(q.topContinues,true);
  assert.equal(q.bottomContinues,true);
  assert.equal(q.status,"CONTIGUOUS_NATIVE_ARTICLE_COLUMNS_POSSIBLE");
  assert.equal(q.sourcePromotable,false);
});
test("even physically separated uncaptioned 2-column runs remain uncertified",()=>{
  const rows=[line(195),...Array.from({length:5},(_,i)=>line(145.9-i*11.75)),line(51)];
  const q=assess(source(rows),ref);
  assert.equal(q.status,"ISOLATED_PAIRED_LAYOUT_NOT_CERTIFIED");
  assert.equal(q.sourcePromotable,false);
  assert.equal(q.topContinues,false);
  assert.equal(q.bottomContinues,false);
});
test("OCR, insufficient row evidence, or invalid anchors cannot get promotion",()=>{
  const rows=Array.from({length:5},(_,i)=>line(145.9-i*11.75));
  for(const row of rows)row.words[0].extractionProvenance.source="ocr-tesseract";
  assert.equal(assess(source(rows),ref).sourcePromotable,false);
  assert.equal(assess(source([line(145),line(132),line(119)]),ref).status,
    "NO_STABLE_PAIRED_RUN");
  assert.equal(assess([],ref).sourcePromotable,false);
});
