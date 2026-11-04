import {describe,it,expect} from "vitest";
import {allowPrivateGoldenRequest as allowed} from "../privateGoldenNetworkPolicy.mjs";

describe("Task 205 private-source network egress policy",()=>{
  it("allows only local app reads on the declared port",()=>{
    expect(allowed("http://127.0.0.1:3000/ocr-pdf?__rsc=1","GET")).toBe(true);
    expect(allowed("http://localhost:3000/_next/static/app.js","HEAD")).toBe(true);
    expect(allowed("http://127.0.0.1:3001/ocr-pdf","GET")).toBe(false);
    expect(allowed("http://127.0.0.1:3000/upload","POST")).toBe(false);
    expect(allowed("http://user:pass@localhost:3000/","GET")).toBe(false);
  });
  it("permits exact Tesseract worker/core and English model assets",()=>{
    expect(allowed("https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js","GET")).toBe(true);
    expect(allowed("https://cdn.jsdelivr.net/npm/tesseract.js-core@v6.0.0/tesseract-core-simd-lstm.wasm.js","GET")).toBe(true);
    expect(allowed("https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz","GET")).toBe(true);
    expect(allowed("https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz","GET")).toBe(true);
  });
  it("blocks an exfiltration attempt disguised as an approved asset GET",()=>{
    expect(allowed("https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js?doc=CONFIDENTIAL","GET")).toBe(false);
    expect(allowed("https://cdn.jsdelivr.net/npm/private-exfil/secret.pdf","GET")).toBe(false);
    expect(allowed("https://tessdata.projectnaptha.com/private/secret","GET")).toBe(false);
    expect(allowed("https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js","POST")).toBe(false);
  });
  it("rejects third-party, malformed, downgraded, credentialed and fragment URLs",()=>{
    for(const uri of ["not-url","https://attacker.example/collect",
      "http://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js",
      "https://user@cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js",
      "https://cdn.jsdelivr.net/npm/tesseract.js@v7.0.0/dist/worker.min.js#private"]){
      expect(allowed(uri,"GET")).toBe(false);
    }
  });
});
