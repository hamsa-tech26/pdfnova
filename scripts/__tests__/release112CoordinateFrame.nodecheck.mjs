import {test} from "node:test";
import assert from "node:assert/strict";
import {auditCoordinateFrame} from "../../benchmarks/release112/auditCoordinateFrame.mjs";

test("same aspect at different rendering scales is plausible, never certified",()=>{
  const r=auditCoordinateFrame({imageWidth:1200,imageHeight:1600},{width:600,height:800});
  assert.equal(r.relativeAspectDriftPercent,0);
  assert.equal(r.aspectFramePlausible,true);
  assert.equal(r.pixelIdentityVerified,false);
  assert.equal(r.cropRotationPairingIndependentlyVerified,false);
  assert.equal(r.originalDocumentRightsApproved,false);
  assert.equal(r.acceptedFormalV4Credit,0);
});
test("dimension mismatch flags possible cropped, different or rotated source",()=>{
  const r=auditCoordinateFrame({imageWidth:1200,imageHeight:1600},{width:800,height:600});
  assert.equal(r.aspectFramePlausible,false);
  assert.ok(r.relativeAspectDriftPercent>40);
  assert.equal(r.acceptedFormalV4Credit,0);
});
test("invalid coordinate metadata must fail rather than silently normalize",()=>{
  assert.throws(()=>auditCoordinateFrame({imageWidth:0,imageHeight:100},{width:50,height:60}),/Invalid/);
  assert.throws(()=>auditCoordinateFrame({imageWidth:100,imageHeight:100},{width:NaN,height:100}),/Invalid/);
});
