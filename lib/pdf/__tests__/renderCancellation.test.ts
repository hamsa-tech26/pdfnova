import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {forEachRenderedPdfPage} from "../render";

const fake = vi.hoisted(() => ({
  cancel: vi.fn(), cleanup: vi.fn(), destroy: vi.fn(), render: vi.fn(),
  slowLoad: false, abortLoading: () => {}, rejectLoad: (error: Error) => { void error; },
}));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({destroy: () => {
    fake.destroy();
    if (fake.slowLoad) fake.rejectLoad(new Error("Loading destroyed"));
    return Promise.resolve();
  }, promise: fake.slowLoad ? new Promise<never>((_resolve, reject) => {
    fake.rejectLoad = reject;
    setTimeout(() => fake.abortLoading(), 0);
  }) : Promise.resolve({numPages: 1,
    getPage: async () => ({getViewport: () => ({width: 20, height: 30}),
      render: fake.render, cleanup: fake.cleanup}),
  })}),
}));
let canvas: {width: number; height: number};
beforeEach(() => {
  vi.clearAllMocks();
  fake.slowLoad = false;
  canvas = {width: 0, height: 0};
  vi.stubGlobal("window", {setTimeout});
  vi.stubGlobal("document", {createElement: () => Object.assign(canvas, {
    getContext: () => ({}), toDataURL: () => "data:image/png;base64,AA==",
  })});
});
afterEach(() => vi.unstubAllGlobals());
const file = {arrayBuffer: async () => new ArrayBuffer(10)} as File;

it("interrupts pending PDF.js loading and destroys its document task only once", async () => {
  const controller = new AbortController();
  fake.slowLoad = true;
  fake.abortLoading = () => controller.abort();
  const callback = vi.fn();
  await expect(forEachRenderedPdfPage(file, {signal: controller.signal}, callback))
    .rejects.toMatchObject({name: "AbortError"});
  expect(fake.destroy).toHaveBeenCalledOnce();
  expect(callback).not.toHaveBeenCalled();
  expect(fake.render).not.toHaveBeenCalled();
});

it("cancels an active PDF.js render, withholds callback and destroys document and canvas", async () => {
  const controller = new AbortController();
  fake.render.mockImplementation(() => {
    let reject: (e: Error) => void;
    const promise = new Promise<void>((_resolve, fail) => { reject = fail; });
    fake.cancel.mockImplementation(() => reject(new Error("RenderingCancelledException")));
    setTimeout(() => controller.abort(), 0);
    return {promise, cancel: fake.cancel};
  });
  const callback = vi.fn();
  await expect(forEachRenderedPdfPage(file, {signal: controller.signal}, callback))
    .rejects.toMatchObject({name: "AbortError"});
  expect(fake.cancel).toHaveBeenCalledOnce();
  expect(callback).not.toHaveBeenCalled();
  expect(fake.cleanup).toHaveBeenCalledOnce();
  expect(fake.destroy).toHaveBeenCalledOnce();
  expect(canvas).toMatchObject({width: 0, height: 0});
});

it("releases the renderer canvas before invoking a consuming async callback", async () => {
  fake.render.mockReturnValue({promise: Promise.resolve(), cancel: fake.cancel});
  const controller = new AbortController();
  await forEachRenderedPdfPage(file, {signal: controller.signal}, async page => {
    expect(page).toMatchObject({width: 20, height: 30});
    expect(canvas).toMatchObject({width: 0, height: 0});
  });
  controller.abort();
  expect(fake.cancel).not.toHaveBeenCalled();
  expect(fake.destroy).toHaveBeenCalledOnce();
});
