import {test,expect} from "@playwright/test";

test("same-origin English OCR worker, language and WASM cores are served locally",async({request})=>{
  const files=[
    "worker.min.js",
    "eng.traineddata.gz",
    "LICENSE-eng-traineddata-Apache-2.0.txt",
    "tesseract-core-lstm.wasm.js",
    "tesseract-core-lstm.wasm",
    "tesseract-core-simd-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm",
  ];
  for(const file of files){
    const response=await request.get("/ocr-runtime/"+file);
    expect(response.status(),`${file} must be served by our own site`).toBe(200);
    expect((await response.body()).byteLength,`${file} must not be empty`).toBeGreaterThan(100);
    if(file==="LICENSE-eng-traineddata-Apache-2.0.txt"){
      expect(await response.text()).toContain("Apache License");
    }
  }
});
