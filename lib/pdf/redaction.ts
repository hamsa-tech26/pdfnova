import {PDFDocument} from "pdf-lib";
import {forEachRenderedPdfPage} from "./render";
import {throwIfPdfOperationCancelled, PdfOperationCancelledError} from "./operationCancellation";
import {REDACTION_LIMITS, createRedactionBudget, validateRedactionInput, validateRedactionSourceImages} from "./redactionBudget";
import {normalizeRedactionRect, isUsefulRedactionRect, redactionPixelBounds, validateRedactionPlan, type RedactionRect} from "./redactionGeometry";
export {normalizeRedactionRect, isUsefulRedactionRect, redactionPixelBounds, validateRedactionPlan, type RedactionRect} from "./redactionGeometry";

export type RedactionsByPage = Record<number, RedactionRect[]>;

function dataUrlToBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) throw new Error("Unable to encode the redacted page.");
  const binary = window.atob(dataUrl.slice(commaIndex + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function loadImage(dataUrl: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    function cleanup() {
      image.onload = image.onerror = null;
      signal.removeEventListener("abort", abort);
    }
    function abort() {
      cleanup();
      image.src = "";
      reject(new PdfOperationCancelledError());
    }
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error("Unable to decode a PDF page preview.")); };
    signal.addEventListener("abort", abort, {once: true});
    if (signal.aborted) { abort(); return; }
    image.src = dataUrl;
  });
}

export async function createRasterRedactedPdf(
  file: File,
  redactionsByPage: RedactionsByPage,
  options: {signal?: AbortSignal} = {},
): Promise<Uint8Array> {
  if (typeof window === "undefined") throw new Error("PDF redaction is only available in the browser.");

  const controller = new AbortController();
  const signal = controller.signal;
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, {once: true});
  if (options.signal?.aborted) cancel();
  const budget = createRedactionBudget();
  let timedOut = false;
  const timer = window.setTimeout(() => { timedOut = true; cancel(); }, REDACTION_LIMITS.milliseconds);
  function check() {
    budget.checkTime();
    if (timedOut) throw new Error("Redaction exceeded the two-minute processing limit. Export was withheld.");
    throwIfPdfOperationCancelled(signal);
  }
  async function checkpoint() {
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    check();
  }

  try {
    check();
    // Refuse size before allocating bytes; keep the parsed original out of the page loop.
    validateRedactionInput(file.size, 1);
    const pageCount = await (async () => {
      const sourceBytes = await file.arrayBuffer();
      check();
      const source = await PDFDocument.load(sourceBytes);
      check();
      validateRedactionSourceImages(source);
      return source.getPageCount();
    })();
    validateRedactionInput(file.size, pageCount);
    // Every selected area must be valid; never silently omit an invalid mask.
    validateRedactionPlan(redactionsByPage, pageCount);
    const output = await PDFDocument.create();
    let renderedCount = 0;

    await forEachRenderedPdfPage(file, {
      scale: 1.75,
      // Both source and masked rasters stay lossless, including sensitive edge pixels.
      format: "png",
      maxDimension: REDACTION_LIMITS.dimension,
      signal,
      maxPages: REDACTION_LIMITS.pages,
      beforePageRender: (width, height) => { check(); budget.admitPage(width, height); },
    }, async renderedPage => {
      check();
      const image = await loadImage(renderedPage.dataUrl, signal);
      const canvas = document.createElement("canvas");
      try {
        check();
        canvas.width = renderedPage.width;
        canvas.height = renderedPage.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is not supported in this browser.");
        // Only an opaque, already-masked raster enters the new document.
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        context.fillStyle = "#000000";
        for (const rawRect of redactionsByPage[renderedPage.pageNumber] ?? []) {
          const rect = normalizeRedactionRect(rawRect);
          if (!isUsefulRedactionRect(rect)) continue;
          const pixels = redactionPixelBounds(rect, canvas.width, canvas.height);
          context.fillRect(pixels.x, pixels.y, pixels.width, pixels.height);
        }
        const pngDataUrl = canvas.toDataURL("image/png");
        // Neither compression nor its input yield needs the canvas backing store.
        canvas.width = canvas.height = 0;
        image.src = "";
        budget.admitEncoded(Math.floor((pngDataUrl.length - pngDataUrl.indexOf(",") - 1) * 3 / 4));
        await checkpoint();
        const embedded = await output.embedPng(dataUrlToBytes(pngDataUrl));
        await checkpoint();
        // Immediate embedding releases pdf-lib's decoded RGB buffer for this page.
        await embedded.embed();
        check();
        // PDF.js viewport includes CropBox/MediaBox clipping, rotation and UserUnit.
        const width = renderedPage.pageWidth;
        const height = renderedPage.pageHeight;
        output.addPage([width, height]).drawImage(embedded, {x: 0, y: 0, width, height});
        renderedCount += 1;
      } finally {
        canvas.width = canvas.height = 0;
        image.src = "";
      }
      await checkpoint();
    });

    if (renderedCount !== pageCount) throw new Error("Not every PDF page could be rendered for secure redaction.");
    await checkpoint();
    const bytes = await output.save();
    // Drain queued Cancel input after synchronous serialization, before returning bytes.
    await checkpoint();
    if (bytes.byteLength > REDACTION_LIMITS.outputBytes) {
      throw new Error("Redaction exceeded the output memory budget. Export was withheld.");
    }
    return bytes;
  } catch (error) {
    check();
    throw error;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
