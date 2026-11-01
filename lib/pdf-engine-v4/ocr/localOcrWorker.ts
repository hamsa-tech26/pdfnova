import {createWorker,OEM} from "tesseract.js";

/** The predev/prebuild staging script prepares these paths from pinned packages. */
export const LOCAL_ENGLISH_OCR_OPTIONS={
  workerPath:"/ocr-runtime/worker.min.js",
  corePath:"/ocr-runtime",
  langPath:"/ocr-runtime",
  workerBlobURL:false,
} as const;

/** LSTM-only English OCR: never fetch worker/core/language from external CDNs. */
export function createLocalEnglishOcrWorker(){
  return createWorker("eng",OEM.LSTM_ONLY,LOCAL_ENGLISH_OCR_OPTIONS);
}
