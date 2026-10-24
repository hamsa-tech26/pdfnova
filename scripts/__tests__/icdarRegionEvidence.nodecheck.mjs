import {test} from "node:test";
import assert from "node:assert/strict";
import {regionEvidence} from "../icdarRegionEvidence.mjs";
const box={x:10,y:20,width:80,height:40};
function fixture(){
  const word={text:"PRIVATE 123",bounds:box,extractionProvenance:{source:"native-pdf"}};
  return {document:{pages:[{words:[word,{...word,bounds:{...box,x:500}}],lines:[{bounds:box}],
    imagePaintCount:1,imagePaintRegions:[{bounds:box}]}]},
    tables:[{pageNumber:1,bounds:box,rows:[{}],columnCount:2,text:"PRIVATE"}],
    candidateRegionDiagnostics:[{pageNumber:1,outcome:"PRIVATE",lineCount:4,acceptedColumnCount:2,
      analysis:{totalScore:0.7,text:"PRIVATE"}}]};
}
test("reference-local evidence preserves input and excludes source content",()=>{
  const input=fixture(),before=JSON.stringify(input);
  const result=regionEvidence(input,{regions:[{page:1,bounds:box}]});
  assert.equal(JSON.stringify(input),before);
  assert.equal(result[0].references[0].nativeWords,1);
  assert.equal(result[0].references[0].imageOverlaps[0].referenceAreaFraction,1);
  assert.equal(result[0].references[0].bestPredictionIoU,1);
  assert.equal(result[0].predictions[0].removalReducesMatchCount,true);
  assert.equal(result[0].candidates[0].outcome,"unknown");
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.equal(result[0].formalV4StableDocumentCredit,0);
});
test("duplicates are not individually credited and unknown provenance is not native",()=>{
  const input=fixture();input.tables.push({...input.tables[0]});
  delete input.document.pages[0].words[0].extractionProvenance;
  const result=regionEvidence(input,{regions:[{page:1,bounds:box}]})[0];
  assert.ok(result.predictions.every(p=>!p.removalReducesMatchCount));
  assert.equal(result.references[0].nativeWords,0);
  assert.equal(result.references[0].unknownProvenanceWords,1);
});
test("invalid references and oversized evidence fail closed",()=>{
  for(const regions of [[{page:0,bounds:box}],[{page:2,bounds:box}],[{page:1,bounds:{...box,width:NaN}}]])
    assert.throws(()=>regionEvidence(fixture(),{regions}));
  const input=fixture();input.tables=Array(101).fill(input.tables[0]);
  assert.throws(()=>regionEvidence(input,{regions:[{page:1,bounds:box}]}));
});
