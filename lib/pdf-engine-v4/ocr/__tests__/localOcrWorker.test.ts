import {expect,it} from "vitest";
import {LOCAL_ENGLISH_OCR_OPTIONS} from "../localOcrWorker";

it("loads all English OCR assets from the same origin without blob workers",()=>{
  expect(LOCAL_ENGLISH_OCR_OPTIONS).toEqual({
    workerPath:"/ocr-runtime/worker.min.js",
    corePath:"/ocr-runtime",
    langPath:"/ocr-runtime",
    workerBlobURL:false,
  });
  expect(Object.values(LOCAL_ENGLISH_OCR_OPTIONS).filter(x=>typeof x==="string")
    .every(path=>path.startsWith("/ocr-runtime"))).toBe(true);
});
