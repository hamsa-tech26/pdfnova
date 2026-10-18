"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { analyzePdfV4 } from "@/lib/pdf-engine-v4/pipeline/analyzePdfV4";
import { preparePdfV4XlsxExport } from "@/lib/converters/pdfToXlsxQuality";
import {inspectPdfV4XlsxChoices,prepareSelectedPdfV4XlsxExport,
  type PdfXlsxTableChoice} from "@/lib/converters/pdfToXlsxSelection";
import { createPdfXlsxWorkbook } from "@/lib/converters/pdfToXlsx";
import { recoverEightColumnNativePdf } from "@/lib/converters/pdfToXlsxNativeBoundaries";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { saveAs } from "file-saver";
import { useRef, useState, type ChangeEvent } from "react";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function PdfToExcelPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<Blob | null>(null);
  const [outputName, setOutputName] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [inspected, setInspected] = useState<Awaited<ReturnType<typeof analyzePdfV4>> | null>(null);
  const [choices, setChoices] = useState<PdfXlsxTableChoice[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  function reset() {
    if (inputRef.current) inputRef.current.value = "";
    setFile(null);
    setOutput(null);
    setOutputName("");
    setWarnings([]);
    setError("");
    setInspected(null);
    setChoices([]);
    setSelectedIndex(null);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    setOutput(null);
    setOutputName("");
    setWarnings([]);
    setInspected(null);
    setChoices([]);
    setSelectedIndex(null);
    if (!selected || !selected.name.toLowerCase().endsWith(".pdf") ||
        selected.size > MAX_FILE_BYTES || selected.size === 0) {
      setFile(null);
      setError("Choose a PDF document between 1 byte and 25 MB.");
      return;
    }
    setFile(selected);
    setError("");
  }


  /** This is an explicit inspection step; no data is automatically downloaded. */
  async function inspectTables(){
    if(!file||busy)return;
    setBusy(true);setError("");setOutput(null);setWarnings([]);
    try{
      const analyzed=inspected??await analyzePdfV4(file,{enableControlledOcr:false});
      const available=inspectPdfV4XlsxChoices(analyzed);
      setInspected(analyzed);setChoices(available);setSelectedIndex(null);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Unable to inspect this PDF.");
    }finally{setBusy(false);}
  }

  async function finishWorkbook(
    plan:Parameters<typeof createPdfXlsxWorkbook>[0],name:string,
  ){
    const bytes=await createPdfXlsxWorkbook(plan);
    const safe=new Uint8Array(bytes.byteLength);safe.set(bytes);
    const blob=new Blob([safe.buffer],{type:XLSX_TYPE});
    saveAs(blob,name);
    setOutput(blob);setOutputName(name);setWarnings([...(plan.reviewNotes??[])]);
    addRecentFile({fileName:name,toolName:"PDF to Excel"});
  }

  async function exportSelected(){
    if(!file||busy||!inspected||selectedIndex===null)return;
    setBusy(true);setError("");setOutput(null);setWarnings([]);
    try{
      const choice=choices.find(c=>c.index===selectedIndex);
      if(!choice?.eligible)throw new Error("The selected table failed export safety checks.");
      // Validate the table AGAIN at actual export time, never trust a UI badge.
      const plan=prepareSelectedPdfV4XlsxExport(inspected,selectedIndex);
      const stem=file.name.replace(/\.pdf$/i,"")||"kukureku";
      await finishWorkbook(plan,stem+"-table-"+(selectedIndex+1)+".xlsx");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Selected-table export was withheld.");
    }finally{setBusy(false);}
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
      const analyzed = inspected ?? await analyzePdfV4(file, { enableControlledOcr: false });
      // Centralized fail-closed quality checks preserve multi-page row
      // provenance, do not infer merged-cell formatting, and report omissions.
      // Only all-native, sufficiently selectable PDFs may enter the
      // numbered eight-column positional recovery path. It must verify every
      // page and data record before displacing the V4 output. Other documents
      // retain the existing strict V4 quality gate, including OCR refusal.
      const nativeOnly = analyzed.nativePageTextExtraction.length ===
        analyzed.document.pages.length &&
        analyzed.nativePageTextExtraction.every(page =>
          page.textExtraction.status === "sufficient") &&
        analyzed.tables.every(table =>
          !table.extractionProvenance ||
          table.extractionProvenance.source === "native-pdf");
      const recovered = nativeOnly && analyzed.document.pages.length > 1
        ? await recoverEightColumnNativePdf(file)
        : null;
      const exportPlan = recovered ?? preparePdfV4XlsxExport(analyzed);
      const name = (file.name.replace(/\.pdf$/i, "") || "kukureku") + "-tables.xlsx";
      await finishWorkbook(exportPlan,name);
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
      description="Convert all eligible native-text PDF tables or inspect and choose just one detected table. Other tables remain excluded, not silently exported. Processing is browser-local; all results need source verification. OCR-to-Excel is not supported."
      tips={[
        { title: "Text-selectable PDF only", description: "Scanned or mixed image-only PDFs cannot be converted with this version." },
        { title: "Choose a single table", description: "Inspect the table candidates and select one eligible for export, even when unrelated tables are withheld." },
        { title: "Verify the spreadsheet", description: "Rows, columns, values, and headings must be checked against the source document before professional use." },
        { title: "Safe cell types", description: "Identifiers, leading zeros and formula-like inputs remain text. Only verified household and FHTC count columns in supported layouts become Excel numbers; no PDF content is executed as formulas." },
      ]}
      faqs={[
        { question: "Will my PDF be uploaded?", answer: "No. Extraction and XLSX generation happen in the browser." },
        { question: "Can I choose one table if another fails?", answer: "Yes. Inspect the detected candidates and explicitly choose an eligible table. Other tables stay excluded. The selected table must still pass the existing structural, provenance and native-text safety checks." },
        { question: "Does it convert scans or every table?", answer: "No. It accepts only confidently structured selectable-text tables and refuses uncertain extraction rather than silently inventing rows or cells." },
      ]}
      howToTitle="How to convert a PDF table to Excel"
      howToSteps={[
        { title: "Select a PDF", description: "Choose a selectable-text PDF up to 25 MB and 25 pages." },
        { title: "Choose which tables", description: "Convert all tables using the original safety gate, or inspect candidates and choose one eligible table." },
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
        {!output && !error && !inspected && (
          <button type="button" onClick={inspectTables} disabled={busy}
            className="w-full rounded-xl border border-blue-300 bg-white px-5 py-3 font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200">
            {busy ? "Inspecting PDF locally…" : "Inspect & choose a table"}
          </button>
        )}
        {!output && !error && inspected && (
          <section aria-labelledby="table-choice-heading"
            className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
            <h3 id="table-choice-heading" className="text-lg font-bold text-slate-950 dark:text-white">
              Select one detected table
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {choices.length} candidate(s) detected. Only the table you select will be exported.
              Eligible means automated checks passed, not that the values are certified.
              Other tables and pages are excluded.
            </p>
            <fieldset disabled={busy} className="space-y-3">
              <legend className="sr-only">Select one PDF table for export</legend>
              {choices.map(choice => (
                <label key={choice.index}
                  className={"flex cursor-pointer gap-3 rounded-xl border p-3 text-sm dark:border-slate-700 "+
                    (choice.eligible?"border-slate-300":"border-slate-200 opacity-75")}>
                  <input type="radio" name="pdf-table-selection" value={choice.index}
                    checked={selectedIndex===choice.index} disabled={!choice.eligible||busy}
                    onChange={()=>setSelectedIndex(choice.index)} className="mt-1 h-4 w-4"/>
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-950 dark:text-white">
                      Table {choice.index+1} — {choice.pageLabel} — {choice.rows} rows × {choice.columns} columns
                    </span>
                    <span className="mt-1 block text-slate-600 dark:text-slate-300">
                      {choice.eligible?"Eligible for reviewed export: ":"Export withheld: "}{choice.reason}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            <button type="button" onClick={exportSelected}
              disabled={busy||selectedIndex===null}
              className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
              {busy?"Preparing selected table…":"Export selected table (.xlsx)"}
            </button>
          </section>
        )}
        {!busy && output && <>
          <SuccessCard title="Excel workbook created"
            description="Verified household and FHTC counts may be numeric in supported tables; identifiers, leading zeros and formula-like values remain text. Compare the workbook with the original PDF."
            fileName={outputName} onDownloadAgain={() => saveAs(output, outputName)}
            onStartAgain={reset} downloadLabel="Download XLSX Again"
            resetLabel="Convert Another PDF"/>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800 dark:border-amber-900/70 dark:bg-slate-950 dark:text-slate-200">
            <p className="font-semibold text-amber-950 dark:text-amber-200">Extraction review — not certified</p>
            {warnings.map((item, index) => <p className="mt-2" key={index}>{item}</p>)}
          </div>
        </>}
        {!busy && output && inspected && (
          <button type="button" onClick={()=>{
            setOutput(null);setOutputName("");setWarnings([]);setSelectedIndex(null);
          }} className="w-full rounded-xl border border-blue-300 px-4 py-3 font-semibold text-blue-800 dark:text-blue-200">
            Choose another table from this PDF
          </button>
        )}
        {!busy && error && <ErrorCard title="Excel conversion withheld"
          description={error}
          reasons={["Scanned, mixed, or image-only PDFs are not supported.",
            "The document may have uncertain table geometry or be password-protected.",
            "Try a smaller PDF with a clearly selectable table."]}
          onRetry={inspected?()=>setError(""):convert} onReset={reset}
          retryLabel={inspected?"Return to table choices":"Try Again"} resetLabel="Choose Another PDF"/>}
      </div>}
    </ToolLayout>
  );
}