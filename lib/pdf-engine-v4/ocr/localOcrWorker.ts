import {createWorker, OEM} from "tesseract.js";

/** Browser assets are staged from lockfile-installed packages before dev/build. */
export const LOCAL_ENGLISH_OCR_OPTIONS = {
  workerPath: "/ocr-runtime/worker.min.js",
  corePath: "/ocr-runtime",
  langPath: "/ocr-runtime",
  workerBlobURL: false,
} as const;

/** English LSTM OCR does not need any external runtime CDN requests. */
export function createLocalEnglishOcrWorker() {
  return createWorker("eng", OEM.LSTM_ONLY, LOCAL_ENGLISH_OCR_OPTIONS);
}
