import {test} from "node:test";
import assert from "node:assert/strict";
import {parseDetectionXml,annotationToPdfBox,rectangleIoU,scoreDetectionPage}
  from "../../benchmarks/release112/scoreTableRegions.mjs";
const xml=items=>"<annotation><size><width>1000</width><height>2000</height></size>"+
  items.map(([name,x0,y0,x1,y1])=>"<object><name>"+name+
    "</name><bndbox><xmin>"+x0+"</xmin><ymin>"+y0+
    "</ymin><xmax>"+x1+"</xmax><ymax>"+y1+"</ymax></bndbox></object>").join("")+
  "</annotation>";
test("Top-left image box maps to bottom-left PDF exactly",()=>{
  const a=parseDetectionXml(xml([["table",100,400,900,800]]));
  const b=annotationToPdfBox(a.boxes[0],a,{width:500,height:1000});
  assert.deepEqual(b,{x:50,y:600,width:400,height:200});
  assert.equal(rectangleIoU(b,b),1);
});
test("Non-table figures cannot boost detection recall",()=>{
  const a=parseDetectionXml(xml([["figure",100,100,900,500],["table",100,700,900,1200]]));
  assert.equal(a.boxes.length,1);
});
test("Invalid or nonfinite bounds cannot fabricate overlap",()=>{
  assert.equal(rectangleIoU({x:0,y:0,width:-1,height:10},{x:0,y:0,width:10,height:10}),0);
  assert.equal(rectangleIoU({x:0,y:0,width:NaN,height:10},{x:0,y:0,width:10,height:10}),0);
  assert.throws(()=>parseDetectionXml(xml([["table",0,100,1100,900]])),/Out-of-range/);
});
test("Duplicate detections cannot double-credit the same published table",()=>{
  const a={x:10,y:10,width:100,height:100};
  const score=scoreDetectionPage([a],[a,a]);
  assert.deepEqual([score.matchedCount,score.unmatchedPredictionCount],[1,1]);
});
test("Missed boxes and false positives remain visible",()=>{
  const refs=[{x:0,y:0,width:100,height:100},{x:200,y:200,width:100,height:100}];
  const pred=[{x:0,y:0,width:100,height:100},{x:500,y:500,width:100,height:100}];
  assert.deepEqual(scoreDetectionPage(refs,pred),{
    referenceCount:2,predictionCount:2,matchedCount:1,missedCount:1,
    unmatchedPredictionCount:1,referenceBestIoU:[1,0]});
});
test("Bad annotation and invalid threshold fail closed",()=>{
  assert.throws(()=>parseDetectionXml(""),/image size/);
  assert.throws(()=>scoreDetectionPage([],[],0),/Invalid/);
});

test("Overlapping published regions use maximum one-to-one recall, not greedy highest IoU",()=>{
  // R0/P0 (.739) ties R0/P1; greedily picking R0/P0 would
  // strand R1, despite R1/P0 (.6) satisfying the unchanged 0.5 gate.
  const refs=[{x:0,y:0,width:10,height:10},{x:4,y:0,width:10,height:10}];
  const predictions=[{x:1.5,y:0,width:10,height:10},
    {x:-1.5,y:0,width:10,height:10}];
  assert.equal(rectangleIoU(refs[1],predictions[0]),0.6);
  assert.ok(rectangleIoU(refs[1],predictions[1])<0.5);
  const result=scoreDetectionPage(refs,predictions);
  assert.deepEqual([result.matchedCount,result.missedCount,
    result.unmatchedPredictionCount],[2,0,0]);
  assert.deepEqual(result.referenceBestIoU,[0.7391,0.6]);
});
test("Maximum matching never credits duplicate predictions or cross-threshold rectangles",()=>{
  const reference=[{x:0,y:0,width:10,height:10},
    {x:4,y:0,width:10,height:10}];
  const candidates=[{x:1.5,y:0,width:10,height:10}];
  const scored=scoreDetectionPage(reference,candidates);
  assert.deepEqual([scored.matchedCount,scored.missedCount,
    scored.unmatchedPredictionCount],[1,1,0]);
  const strict=scoreDetectionPage(reference,candidates,0.75);
  assert.deepEqual([strict.matchedCount,strict.missedCount,
    strict.unmatchedPredictionCount],[0,2,1]);
});
