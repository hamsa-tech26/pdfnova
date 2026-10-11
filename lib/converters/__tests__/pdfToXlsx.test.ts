import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createPdfXlsxWorkbook } from "../pdfToXlsx";

describe("PDF to genuine XLSX OOXML export", () => {
  it("writes well-formed package paths and preserves five-column source values", async () => {
    const bytes = await createPdfXlsxWorkbook({ tables: [{
      name: "Financial Table",
      rows: [
        ["Sl No", "Code", "Name", "Amount", "Remarks"],
        ["1", "00071", "A & B <Pilot>", "1,250.50", "Quoted \"phrase\""],
        ["2", "00072", "Bengali বাংলা", "-5", "empty next"],
        ["3", "", "Next", "", ""],
      ],
    }]});
    const zip = await JSZip.loadAsync(bytes);
    for (const path of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml"]) {
      expect(zip.file(path)).not.toBeNull();
    }
    const worksheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(worksheet).toContain('<dimension ref="A1:E4"/>');
    expect(worksheet).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">00071</t>');
    expect(worksheet).toContain("A &amp; B &lt;Pilot&gt;");
    expect(worksheet).toContain("Bengali বাংলা");
    expect(worksheet).toContain("&quot;phrase&quot;");
    expect(worksheet).toContain('<c r="E4" t="inlineStr">');
    expect(worksheet).not.toContain("<f>");
    const rel = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
    expect(rel).toContain('Target="worksheets/sheet1.xml"');
  });

  it("keeps formula-like payloads as Excel strings, never executable formulas", async () => {
    const bytes = await createPdfXlsxWorkbook({ tables: [{
      name: "Unsafe",
      rows: [["=1+1", "+SUM(A1)", "-2+3", "@HYPERLINK", "  =WEBSERVICE(1)"]],
    }]});
    const zip = await JSZip.loadAsync(bytes);
    const content = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(content.match(/t="inlineStr"/g)?.length).toBe(5);
    expect(content).toContain("=WEBSERVICE(1)");
    expect(content).not.toContain("<f>");
  });

  it("uses one worksheet per table and separates unverified review notes", async () => {
    const bytes = await createPdfXlsxWorkbook({
      tables: [{ name: "T1", rows: [["A"]] }, { name: "T2", rows: [["B"]] }],
      reviewNotes: ["Accuracy not certified"],
    });
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file("xl/worksheets/sheet1.xml")).not.toBeNull();
    expect(zip.file("xl/worksheets/sheet2.xml")).not.toBeNull();
    const notes = await zip.file("xl/worksheets/sheet3.xml")!.async("string");
    expect(notes).toContain("Accuracy not certified");
    const workbook = await zip.file("xl/workbook.xml")!.async("string");
    expect(workbook).toContain('name="Review Notes"');
  });

  it("fails closed on empty/malformed or unbounded tables", async () => {
    await expect(createPdfXlsxWorkbook({tables: []})).rejects.toThrow();
    await expect(createPdfXlsxWorkbook({tables: [{name:"empty",rows:[]}]})).rejects.toThrow();
    await expect(createPdfXlsxWorkbook({tables: [{name:"wide",rows:[Array(129).fill("X")]}]}))
      .rejects.toThrow();
    await expect(createPdfXlsxWorkbook({tables: [{name:"huge",rows:[[ "x".repeat(10001) ]]}]}))
      .rejects.toThrow();
  });
});