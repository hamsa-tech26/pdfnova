import {describe, expect, it} from "vitest";
import {PDFDocument, PDFName} from "pdf-lib";
import {validateRedactionSourceImages} from "../redactionBudget";

async function sourceWithImages(dimensions: number[][]) {
  const pdf = await PDFDocument.create();
  for (const [Width, Height] of dimensions) {
    pdf.context.register(pdf.context.stream(new Uint8Array([0]), {Type: "XObject", Subtype: "Image", Width, Height}));
  }
  // Reparse to use the same raw stream representation as actual input PDFs.
  return PDFDocument.load(await pdf.save());
}
describe("pre-decode redaction image admission", () => {
  it("admits a 300-dpi landscape report and ordinary source images", async () => {
    const source = await sourceWithImages([[4200, 2550], [1, 1]]);
    expect(() => validateRedactionSourceImages(source)).not.toThrow();
  });
  it("refuses a 600-dpi report before invoking a decoder", async () => {
    const source = await sourceWithImages([[8400, 5100]]);
    expect(() => validateRedactionSourceImages(source)).toThrow(/before image decoding/);
  });
  it("counts masks and unused images conservatively toward a total source budget", async () => {
    const source = await sourceWithImages(Array.from({length: 5}, () => [4000, 4000]));
    expect(() => validateRedactionSourceImages(source)).toThrow(/memory budget/);
    expect(source.context.enumerateIndirectObjects().some(([, o]) => String(o).includes(PDFName.of("Image").toString()))).toBe(true);
  });
});
