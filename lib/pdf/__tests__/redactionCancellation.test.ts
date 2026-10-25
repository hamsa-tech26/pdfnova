import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createRasterRedactedPdf} from "../redaction";
import {createRedactionBudget, REDACTION_LIMITS, validateRedactionInput} from "../redactionBudget";

const state = vi.hoisted(() => ({
  pages: 1, stage: "", controller: null as AbortController | null,
  canvases: [] as {width: number; height: number}[],
  embed: vi.fn(), save: vi.fn(),
}));
vi.mock("pdf-lib", async importOriginal => ({...await importOriginal<typeof import("pdf-lib")>(), PDFDocument: {
  load: async () => ({getPageCount: () => state.pages, context: {enumerateIndirectObjects: () => []}}),
  create: async () => ({
    embedPng: async () => {
      if (state.stage === "embedding") state.controller?.abort();
      return {embed: state.embed};
    },
    addPage: () => ({drawImage() {}}),
    save: state.save,
  }),
}}));
vi.mock("../render", () => ({forEachRenderedPdfPage: async (
  _file: File,
  options: {signal: AbortSignal; beforePageRender: (w: number, h: number) => void},
  callback: (page: object) => Promise<void>,
) => {
  if (state.stage === "rendering") state.controller?.abort();
  options.beforePageRender(100, 120);
  await callback({pageNumber: 1, width: 100, height: 120, pageWidth: 100, pageHeight: 120,
    dataUrl: "data:image/png;base64,AAAA"});
}}));
const mask = {1: [{x: .1, y: .1, width: .2, height: .2}]};
const file = {size: 100, arrayBuffer: vi.fn(async () => new ArrayBuffer(100))} as unknown as File;

beforeEach(() => {
  state.pages = 1; state.stage = ""; state.controller = new AbortController(); state.canvases = [];
  state.embed.mockReset(); state.save.mockReset().mockImplementation(async () => {
    if (state.stage === "export") state.controller?.abort();
    return new Uint8Array([1, 2, 3]);
  });
  vi.stubGlobal("window", {atob, setTimeout, clearTimeout});
  vi.stubGlobal("Image", class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) { if (value) queueMicrotask(() => this.onload?.()); }
  });
  vi.stubGlobal("document", {createElement: () => {
    const canvas = {width: 0, height: 0, getContext: () => ({fillRect() {}, drawImage() {}}),
      toDataURL: () => "data:image/png;base64,AAAA"};
    state.canvases.push(canvas); return canvas;
  }});
});
afterEach(() => vi.unstubAllGlobals());

describe("fail-closed redaction cancellation", () => {
  it.each(["rendering", "embedding", "export"])("withholds bytes cancelled during %s and releases canvases", async stage => {
    state.stage = stage;
    await expect(createRasterRedactedPdf(file, mask, {signal: state.controller!.signal}))
      .rejects.toMatchObject({name: "AbortError"});
    expect(state.canvases.every(c => c.width === 0 && c.height === 0)).toBe(true);
    if (stage !== "export") expect(state.save).not.toHaveBeenCalled();
  });
  it("does not read an already cancelled source", async () => {
    const read = vi.fn(); state.controller!.abort();
    await expect(createRasterRedactedPdf({size: 100, arrayBuffer: read} as unknown as File, mask,
      {signal: state.controller!.signal})).rejects.toMatchObject({name: "AbortError"});
    expect(read).not.toHaveBeenCalled();
  });
  it("releases masked pixels before embedding and permits a clean retry", async () => {
    state.embed.mockImplementation(() => {
      expect(state.canvases.every(c => c.width === 0 && c.height === 0)).toBe(true);
    });
    await expect(createRasterRedactedPdf(file, mask)).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });
  it("cleans up even if canvas context creation fails", async () => {
    vi.stubGlobal("document", {createElement: () => {
      const c = {width: 0, height: 0, getContext: () => null}; state.canvases.push(c); return c;
    }});
    await expect(createRasterRedactedPdf(file, mask)).rejects.toThrow(/Canvas/);
    expect(state.canvases.every(c => !c.width && !c.height)).toBe(true);
  });
  it("refuses over-limit page count before rendering", async () => {
    state.pages = 101;
    await expect(createRasterRedactedPdf(file, mask)).rejects.toThrow(/100 pages/);
    expect(state.canvases).toHaveLength(0);
  });
});

describe("redaction work budgets", () => {
  it("admits boundary input and rejects oversize sources", () => {
    expect(() => validateRedactionInput(REDACTION_LIMITS.inputBytes, 100)).not.toThrow();
    expect(() => validateRedactionInput(REDACTION_LIMITS.inputBytes + 1, 100)).toThrow();
  });
  it("refuses cumulative raster work without silently lowering resolution", () => {
    const b = createRedactionBudget();
    for (let i = 0; i < 11; i++) b.admitPage(3200, 3200);
    expect(() => b.admitPage(3200, 3200)).toThrow(/raster/);
    expect(() => createRedactionBudget().admitPage(3201, 1)).toThrow(/raster/);
  });
  it("refuses accumulated encoded buffers and elapsed time", () => {
    let now = 0; const b = createRedactionBudget(() => now);
    b.admitEncoded(REDACTION_LIMITS.encodedBytes);
    expect(() => b.admitEncoded(1)).toThrow(/memory budget/);
    now = REDACTION_LIMITS.milliseconds;
    expect(() => b.checkTime()).toThrow(/processing limit/);
  });
});
