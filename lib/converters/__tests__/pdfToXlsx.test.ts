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

  it("types only canonical opt-in metric columns, preserving padded IDs and formulas", async () => {
    const bytes = await createPdfXlsxWorkbook({ tables: [{
      name: "Verified metrics",
      rows: [
        ["Sl No", "Households", "FHTCs"],
        ["00071", "16", "12"],
        ["00072", "0", "0013"],
        ["=HYPERLINK(1)", "=1+1", "9999999999999999"],
      ],
      numericColumns: [1, 2],
      freezeHeader: true,
      columnWidths: [16, 19, 20],
    }]});
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toContain('<c r="A2" t="inlineStr">');
    expect(xml).toContain('<c r="B2" t="n"><v>16</v></c>');
    expect(xml).toContain('<c r="C2" t="n"><v>12</v></c>');
    expect(xml).toContain('<c r="B3" t="n"><v>0</v></c>');
    expect(xml).toContain('<c r="C3" t="inlineStr"><is><t xml:space="preserve">0013');
    expect(xml).toContain("9999999999999999");
    expect(xml).toContain("=HYPERLINK(1)");
    expect(xml).not.toContain("<f>");
    expect(xml).toContain('<pane ySplit="1"');
    expect(xml).toContain('<autoFilter ref="A1:C4"/>');
    expect(xml).toContain('<col min="1" max="1" width="16" customWidth="1"/>');
  });

  it("refuses malformed column typing metadata rather than inferring numeric identifiers", async () => {
    await expect(createPdfXlsxWorkbook({tables:[{
      name:"bad",rows:[["ID","Count"],["00001","12"]],numericColumns:[1,1],
    }]})).rejects.toThrow(/numeric column/);
    await expect(createPdfXlsxWorkbook({tables:[{
      name:"bad",rows:[["ID","Count"],["00001","12"]],numericColumns:[2],
    }]})).rejects.toThrow(/numeric column/);
    await expect(createPdfXlsxWorkbook({tables:[{
      name:"bad",rows:[["ID","Count"],["00001","12"]],columnWidths:[20,1000],
    }]})).rejects.toThrow(/column widths/);
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

  it("preserves carriage returns and CRLF without changing tabs, LF or literal XML-looking text", async () => {
    const zip = await JSZip.loadAsync(await createPdfXlsxWorkbook({
      tables: [{name: "Text", rows: [["A\rB", "A\r\nB", "A\nB", "A\tB", "&#13;", "বাংলা 🐓"]]}],
      reviewNotes: ["First\r\nSecond"],
    }));
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xml).toContain('xml:space="preserve">A&#13;B</t>');
    expect(xml).toContain('xml:space="preserve">A&#13;\nB</t>');
    expect(xml).toContain('xml:space="preserve">A\nB</t>');
    expect(xml).toContain('xml:space="preserve">A\tB</t>');
    expect(xml).toContain('&amp;#13;');
    expect(xml).toContain("বাংলা 🐓");
    expect(await zip.file("xl/worksheets/sheet2.xml")!.async("string"))
      .toContain("First&#13;\nSecond");
  });

  it("withholds export instead of deleting unsupported source characters or exposing the value in errors", async () => {
    for (const invalid of ["\u0000", "\u0001", "\u000b", "\u001f", "\ud800", "\udfff", "\ufffe", "\uffff"]) {
      const value = "PRIVATE_VALUE" + invalid + "END";
      await expect(createPdfXlsxWorkbook({tables: [{name: "Text", rows: [[value]]}]}))
        .rejects.toThrow("A spreadsheet value contains unsupported characters; export was withheld to avoid changing source text.");
    }
    await expect(createPdfXlsxWorkbook({
      tables: [{name: "Text", rows: [["safe"]]}], reviewNotes: ["PRIVATE\u0001NOTE"],
    })).rejects.toThrow(/unsupported characters/);
  });

  it("does not truncate review notes or exceed worksheet limits", async () => {
    const tables = Array.from({ length: 12 }, (_, i) => ({
      name: "Table " + i, rows: [["ID", String(i)]],
    }));
    await expect(createPdfXlsxWorkbook({ tables, reviewNotes: ["Must review"] }))
      .rejects.toThrow(/review-notes worksheet/);
    await expect(createPdfXlsxWorkbook({
      tables: [tables[0]], reviewNotes: ["R".repeat(501)],
    })).rejects.toThrow(/500 characters/);
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
