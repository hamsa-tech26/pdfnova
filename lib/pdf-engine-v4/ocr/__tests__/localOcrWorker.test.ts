import {expect, it} from "vitest";
import {LOCAL_ENGLISH_OCR_OPTIONS} from "../localOcrWorker";

it("loads English OCR worker, cores, and language data only from this site's origin", () => {
  expect(LOCAL_ENGLISH_OCR_OPTIONS).toEqual({
    workerPath: "/ocr-runtime/worker.min.js",
    corePath: "/ocr-runtime",
    langPath: "/ocr-runtime",
    workerBlobURL: false,
  });
  expect(Object.values(LOCAL_ENGLISH_OCR_OPTIONS).filter(
    value => typeof value === "string",
  ).every(path => path === "/ocr-runtime" || path.startsWith("/ocr-runtime/"))).toBe(true);
});
