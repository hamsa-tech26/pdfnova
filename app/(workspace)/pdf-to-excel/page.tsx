"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { analyzePdfV4 } from "@/lib/pdf-engine-v4/pipeline/analyzePdfV4";
import { tableToCsvRows, inspectV4TableExport } from "@/lib/converters/v4TableExport";
import { createPdfXlsxWorkbook } from "@/lib/converters/pdfToXlsx";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { saveAs } from "file-saver";
import { useRef, useState, type ChangeEvent } from "react";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_PAGES = 25;
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function PdfToExcelPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<Blob | null>(null);
  const [outputName, setOutputName] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");

  function reset() {
    if (inputRef.current) inputRef.current.value = "";
    setFile(null);
    setOutput(null);
    setOutputName("");
    setWarnings([]);
    setError("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    setOutput(null);
    setOutputName("");
    setWarnings([]);
    if (!selected || !selected.name.toLowerCase().endsWith(".pdf") ||
        selected.size > MAX_FILE_BYTES || selected.size === 0) {
      setFile(null);
      setError("Choose a PDF document between 1 byte and 25 MB.");
      return;
    }
    setFile(selected);
    setError("");
  }

  async function convert() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setOutput(null);
    setWarnings([]);
    try {
      // V4 is intentionally used without scanned-page OCR. This MVP accepts
      // text-selectable source PDFs only; an image scan must fail clearly.
      const analyzed = await analyzePdfV4(file, { enableControlledOcr: false });
      if (analyzed.document.pages.length > MAX_PAGES) {
        throw new Error("This converter supports at most 25 pages per PDF.");
      }
      if (analyzed.nativePageTextExtraction.some(p => p.textExtraction.status !== "sufficient")) {
        throw new Error("This PDF has image-only or low-text pages. Scanned and mixed PDFs are not supported by this XLSX converter.");
      }
      if (analyzed.tables.length === 0) {
        throw new Error("No reliable selectable-text table was detected. No empty XLSX was created.");
      }
      if (analyzed.tables.length > 12) {
        throw new Error("This PDF exceeds the maximum of 12 detected tables.");
      }
      if (analyzed.tables.some(t => t.confidence < 0.65 || t.columnCount < 2 || t.rows.length < 2)) {
        throw new Error("One or more tables have uncertain row or column structure. Export was withheld to prevent misleading XLSX data.");
      }

      const review: string[] = [
        "UNVERIFIED: XLSX cells were reconstructed from PDF text positions; check all rows, headings, numbers and column order against the original PDF.",
      ];
      const converted = analyzed.tables.map((table, index) => {
        const diagnostics = inspectV4TableExport(table);
        diagnostics.warnings.forEach(note => review.push("Table " + (index + 1) + ": " + note));
        return { name: "Table " + (index + 1), rows: tableToCsvRows(table) };
      });
      // Every detected table is included. We do not silently discard
      // low-confidence tables or replace missing data with fabricated values.
      const bytes = await createPdfXlsxWorkbook({ tables: converted, reviewNotes: review });
      const safe = new Uint8Array(bytes.byteLength);
      safe.set(bytes);
      const blob = new Blob([safe.buffer], { type: XLSX_TYPE });
      const name = (file.name.replace(/\.pdf$/i, "") || "kukureku") + "-tables.xlsx";
      saveAs(blob, name);
      setOutput(blob);
      setOutputName(name);
      setWarnings(review);
      addRecentFile({ fileName: name, toolName: "PDF to Excel" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF-to-Excel conversion failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolLayout
      label="PDF to Excel"
      title="PDF tables to genuine Excel XLSX — privately"
      description="Extract confidently recognized tables from selectable-text PDFs into a real Excel workbook on your device. Each table gets a worksheet with a review-notes sheet. Scan/OCR-to-Excel and perfect layout fidelity are not supported."
      tips={[
        { title: "Text-selectable PDF only", description: "Scanned or mixed image-only PDFs cannot be converted with this version." },
        { title: "Verify the spreadsheet", description: "Rows, columns, values, and headings must be checked against the source document before professional use." },
        { title: "Preserves literal text", description: "Cell data remains text, including leading zeros and formula-like strings. No formulas are executed." },
      ]}
      faqs={[
        { question: "Will my PDF be uploaded?", answer: "No. Extraction and XLSX generation happen in the browser." },
        { question: "Does it convert scans or every table?", answer: "No. It accepts only confidently structured selectable-text tables and refuses uncertain extraction rather than silently inventing rows or cells." },
      ]}
      howToTitle="How to convert a PDF table to Excel"
      howToSteps={[
        { title: "Select a PDF", description: "Choose a selectable-text PDF up to 25 MB and 25 pages." },
        { title: "Extract detected tables", description: "Kukureku checks the native PDF text and reconstructs supported table rows and columns." },
        { title: "Verify the XLSX", description: "Download the workbook and compare every table with the original PDF before using the result." },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <FileUploader fileInputRef={inputRef} onFileSelection={chooseFile}
        accept=".pdf,application/pdf" multiple={false} title="Choose a selectable-text PDF"
        description="Tables only — no OCR or cloud upload." buttonText="Choose PDF"
        helperText="PDF · Up to 25 MB, 25 pages" disabled={busy} />
      {!file && error && <div className="mt-6"><ErrorCard title="Could not select PDF"
        description={error} reasons={[]} onReset={reset}/></div>}
      {file && <div className="mt-8 space-y-6">
        <FileCard file={file} onRemove={busy ? undefined : reset}
          statusText={busy ? "Analyzing tables locally" : output ? "XLSX workbook ready" : "Ready to inspect tables"}/>
        {!output && !error && <ActionButton isLoading={busy} loadingText="Converting tables..."
          buttonText="Convert to Excel (.xlsx)"
          subtitle="No upload. Unsupported or uncertain tables will not be exported."
          onClick={convert} disabled={busy}/>}
        {!busy && output && <>
          <SuccessCard title="Excel workbook created"
            description="Every exported value is text. Please review it against the original PDF."
            fileName={outputName} onDownloadAgain={() => saveAs(output, outputName)}
            onStartAgain={reset} downloadLabel="Download XLSX Again"
            resetLabel="Convert Another PDF"/>
          <div className="rounded-xl border border-amber-200 p-4 text-sm text-slate-700 dark:text-slate-200">
            <p className="font-semibold">Extraction review — not certified</p>
            {warnings.map((item, index) => <p className="mt-2" key={index}>{item}</p>)}
          </div>
        </>}
        {!busy && error && <ErrorCard title="Excel conversion withheld"
          description={error}
          reasons={["Scanned, mixed, or image-only PDFs are not supported.",
            "The document may have uncertain table geometry or be password-protected.",
            "Try a smaller PDF with a clearly selectable table."]}
          onRetry={convert} onReset={reset} retryLabel="Try Again" resetLabel="Choose Another PDF"/>}
      </div>}
    </ToolLayout>
  );
}