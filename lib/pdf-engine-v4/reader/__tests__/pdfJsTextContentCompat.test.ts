import { describe, expect, it, vi } from "vitest";
import type { PDFPageProxy } from "pdfjs-dist";
import { readPdfJsNativeTextContent } from "../pdfJsTextContentCompat";

type Chunk = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;

function pageWithChunks(chunks: Chunk[]) {
  const forbiddenGetText = vi.fn(() => {
    throw new Error("Unsupported Safari ReadableStream async iteration");
  });
  const page = {
    isPureXfa: false,
    getTextContent: forbiddenGetText,
    streamTextContent: () => {
      const stream = new ReadableStream<Chunk>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
      // Reproduce Safari: no async-iterator method, but getReader() works.
      Object.defineProperty(stream, Symbol.asyncIterator, { value: undefined });
      return stream;
    },
  };
  return { page, forbiddenGetText };
}

describe("PDF.js native text stream compatibility", () => {
  it("preserves the content, styles, language and chunk order without async iteration", async () => {
    const a = { str: "Water", transform: [1, 0, 0, 1, 30, 60],
      width: 35, height: 10, fontName: "F1", dir: "ltr", hasEOL: false };
    const b = { ...a, str: "Supply", hasEOL: true };
    const { page, forbiddenGetText } = pageWithChunks([
      { items: [a], styles: { F1: { fontFamily: "Helvetica", ascent: 0.8, descent: -0.2,
        vertical: false } }, lang: "en" },
      { items: [b], styles: { F2: { fontFamily: "Sans", ascent: 0.7, descent: -0.1,
        vertical: false } }, lang: null },
    ] as Chunk[]);
    const result = await readPdfJsNativeTextContent(page);
    expect(result.items).toEqual([a, b]);
    expect(Object.keys(result.styles)).toEqual(["F1", "F2"]);
    expect(result.lang).toBe("en");
    expect(forbiddenGetText).not.toHaveBeenCalled();
  });

  it("returns a valid empty text result for pages without selectable words", async () => {
    const { page } = pageWithChunks([]);
    const result = await readPdfJsNativeTextContent(page);
    expect(result.items).toEqual([]);
    expect(result.lang).toBeNull();
    expect(Object.keys(result.styles)).toEqual([]);
  });

  it("propagates stream read errors instead of inventing text", async () => {
    const stream = new ReadableStream<Chunk>({
      pull(controller) { controller.error(new Error("source stream failed")); },
    });
    const page = { isPureXfa: false, getTextContent: vi.fn(), streamTextContent: () => stream };
    await expect(readPdfJsNativeTextContent(page)).rejects.toThrow("source stream failed");
  });

  it("preserves PDF.js' special pure-XFA text path", async () => {
    const special = { items: [], styles: {}, lang: "en" } as Chunk;
    const page = {
      isPureXfa: true,
      getTextContent: vi.fn(async () => special),
      streamTextContent: vi.fn(),
    };
    expect(await readPdfJsNativeTextContent(page)).toBe(special);
    expect(page.getTextContent).toHaveBeenCalledOnce();
    expect(page.streamTextContent).not.toHaveBeenCalled();
  });

  it("matches upstream PDF.js text extraction for an actual generated PDF", async () => {
    const [{ PDFDocument, StandardFonts }, pdfjs] = await Promise.all([
      import("pdf-lib"), import("pdfjs-dist/legacy/build/pdf.mjs"),
    ]);
    const input = await PDFDocument.create();
    const page = input.addPage([600, 800]);
    const font = await input.embedFont(StandardFonts.Helvetica);
    page.drawText("Damcherra 120 households", { x: 70, y: 700, size: 12, font });
    const bytes = await input.save();
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
    try {
      const document = await task.promise;
      const actualPage = await document.getPage(1);
      const expected = await actualPage.getTextContent();
      const actual = await readPdfJsNativeTextContent(actualPage);
      expect(actual.items).toEqual(expected.items);
      expect(actual.styles).toEqual(expected.styles);
      expect(actual.lang).toBe(expected.lang);
    } finally {
      await task.destroy();
    }
  });
});
