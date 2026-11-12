import type { PDFPageProxy } from "pdfjs-dist";

type TextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;
type TextContentPage = Pick<PDFPageProxy, "streamTextContent" | "getTextContent" | "isPureXfa">;
type TextContentParams = Parameters<PDFPageProxy["streamTextContent"]>[0];

/**
 * Collect the same text chunks as PDF.js getTextContent(), using getReader().
 *
 * PDF.js 6.2.108 calls `for await ... of` on a ReadableStream internally.
 * Shipping iOS WebKit has lacked ReadableStream[Symbol.asyncIterator], so
 * getTextContent() fails before Engine V4 can inspect any native PDF words.
 * The reader API works in those browsers without patching global prototypes.
 *
 * Pure XFA uses PDF.js' special text path, which does not iterate a stream.
 */
export async function readPdfJsNativeTextContent(
  page: TextContentPage,
  params?: TextContentParams,
): Promise<TextContent> {
  if (page.isPureXfa) return page.getTextContent(params);
  const stream = page.streamTextContent(params) as ReadableStream<TextContent>;
  const reader = stream.getReader();
  const result: TextContent = {
    items: [],
    styles: Object.create(null) as TextContent["styles"],
    lang: null,
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      result.lang ??= value.lang;
      Object.assign(result.styles, value.styles);
      result.items.push(...value.items);
    }
    return result;
  } catch (error) {
    // A failed extraction must release the worker-backed stream; retain the
    // original exception if cancellation also fails.
    try { await reader.cancel(error); } catch { /* preserve original cause */ }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
