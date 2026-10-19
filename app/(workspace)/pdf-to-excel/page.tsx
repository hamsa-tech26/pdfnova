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
import { csvDownloadBlob } from "@/lib/converters/tableExport";
import {reviewEmbeddedImageRegions,type EmbeddedImageOcrReviewResult} from "@/lib/pdf-engine-v4/ocr/embeddedImageReviewOcr";
import {parseUserReviewedImageGrid,prepareUserReviewedImageXlsx} from "@/lib/converters/reviewedImageTableWorkbook";
import {buildPdfTablePreview,inspectPdfTableCell,parsePdfTableCellAddress,
  pdfTableCellAddress,PREVIEW_MAX_ROWS,PREVIEW_MAX_COLUMNS,
  type PdfTablePreview} from "@/lib/converters/pdfToXlsxPreview";
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
  const [preview, setPreview] = useState<PdfTablePreview | null>(null);
  const [cellAddressInput,setCellAddressInput]=useState("");
  const [cellDetail,setCellDetail]=useState<ReturnType<typeof inspectPdfTableCell>|null>(null);
  const [cellStatus,setCellStatus]=useState("");
  const [imageReview,setImageReview]=useState<EmbeddedImageOcrReviewResult|null>(null);
  const [imagePage,setImagePage]=useState<number|null>(null);
  const [imageBusy,setImageBusy]=useState(false);
  const [reviewedTsv,setReviewedTsv]=useState("");
  const [reviewedRows,setReviewedRows]=useState<string[][]|null>(null);
  const [reviewConfirmed,setReviewConfirmed]=useState(false);
  const [imageStatus,setImageStatus]=useState("");
  const [reviewRegionIndex,setReviewRegionIndex]=useState<number|null>(null);

  function reset() {
    if (inputRef.current) inputRef.current.value = "";
    setFile(null);
    setOutput(null);
    setOutputName("");
    setWarnings([]);
    setError("");
    setInspected(null);
    setImageReview(null);setImagePage(null);setReviewedTsv("");setReviewedRows(null);
    setReviewConfirmed(false);setImageStatus("");setReviewRegionIndex(null);
    setChoices([]);
    setSelectedIndex(null);
    setPreview(null);setCellAddressInput("");setCellDetail(null);setCellStatus("");
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    setOutput(null);
    setOutputName("");
    setWarnings([]);
    setInspected(null);
    setImageReview(null);setImagePage(null);setReviewedTsv("");setReviewedRows(null);
    setReviewConfirmed(false);setImageStatus("");setReviewRegionIndex(null);
    setChoices([]);
    setSelectedIndex(null);
    setPreview(null);setCellAddressInput("");setCellDetail(null);setCellStatus("");
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
      const analyzed=await analyzePdfV4(file,{enableControlledOcr:false,inspectImagePaints:true});
      const available=analyzed.tables.length?inspectPdfV4XlsxChoices(analyzed):[];
      setInspected(analyzed);setChoices(available);
      setImagePage(analyzed.imageContentReview.find(p=>p.imageReviewRecommended)?.pageNumber??null);
      setImageReview(null);setReviewedTsv("");setReviewedRows(null);setReviewConfirmed(false);
      setSelectedIndex(null);setPreview(null);setCellAddressInput("");setCellDetail(null);setCellStatus("");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Unable to inspect this PDF.");
    }finally{setBusy(false);}
  }

  /** The public all-native export is unchanged; OCR requires an explicit click. */
  async function inspectImageContent(){
    if(!file||busy)return;
    setBusy(true);setError("");setImageStatus("");setImageReview(null);
    setReviewedTsv("");setReviewedRows(null);setReviewConfirmed(false);
    try{
      const analyzed=await analyzePdfV4(file,{enableControlledOcr:false,inspectImagePaints:true});
      setInspected(analyzed);
      setImagePage(analyzed.imageContentReview.find(p=>p.imageReviewRecommended)?.pageNumber??null);
      setChoices(analyzed.tables.length?inspectPdfV4XlsxChoices(analyzed):[]);
      setSelectedIndex(null);setPreview(null);
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Unable to inspect image content.");
    }finally{setBusy(false);}
  }
  async function runImageOcrReview(){
    if(!file||!inspected||busy||imageBusy||imagePage===null)return;
    setImageBusy(true);setImageStatus("");setImageReview(null);
    setReviewRegionIndex(null);setReviewedTsv("");setReviewedRows(null);setReviewConfirmed(false);
    try{
      const reviewed=await reviewEmbeddedImageRegions(file,
        inspected.document.pages.filter(p=>p.pageNumber===imagePage));
      setImageReview(reviewed);
      const usable=reviewed.reviews.findIndex(x=>x.status==="TEXT_REVIEW_ONLY");
      setReviewRegionIndex(usable>=0?usable:null);
      if(usable<0)
        setImageStatus("No sufficiently readable image region was found. No cells can be exported.");
    }catch(cause){
      setImageStatus(cause instanceof Error?cause.message:"Embedded-image OCR review failed.");
    }finally{setImageBusy(false);}
  }
  /** R127: suggestion ONLY fills editable input; it never previews, approves or exports. */
  function useTentativeOcrGrid(){
    const proposed=reviewRegionIndex===null?null:
      imageReview?.reviews[reviewRegionIndex]?.gridProposal;
    if(proposed?.status!=="PROPOSED_FOR_MANUAL_REVIEW"||!proposed.tsv)return;
    setReviewedTsv(proposed.tsv);
    setReviewedRows(null);setReviewConfirmed(false);
    setImageStatus("Tentative OCR grid copied to the editable form. Compare each heading and value against the source image, fix errors, then preview and approve.");
  }
  function previewUserGrid(){
    try{
      const rows=parseUserReviewedImageGrid(reviewedTsv);
      setReviewedRows(rows);setReviewConfirmed(false);setImageStatus("");
    }catch(cause){
      setReviewedRows(null);setReviewConfirmed(false);
      setImageStatus(cause instanceof Error?cause.message:"Invalid tab-separated table.");
    }
  }
  async function exportUserReviewedImage(){
    if(!file||!inspected||busy||imageBusy||!reviewedRows||!reviewConfirmed)return;
    setBusy(true);setError("");setImageStatus("");
    try{
      const reviewed=reviewRegionIndex===null?null:imageReview?.reviews[reviewRegionIndex];
      if(!reviewed)throw Error("Select a usable embedded image OCR review before exporting.");
      const plan=prepareUserReviewedImageXlsx({review:reviewed,tsv:reviewedTsv,
        confirmed:reviewConfirmed,documentPageCount:inspected.document.pages.length});
      // Validate the exact currently edited grid again, not an old preview.
      if(JSON.stringify(plan.tables[0].rows)!==JSON.stringify(reviewedRows))
        throw Error("The reviewed cells changed. Preview and confirm the current values again.");
      const name=(file.name.replace(/\.pdf$/i,"")||"kukureku")+"-user-reviewed-image.xlsx";
      await finishWorkbook(plan,name);
    }catch(cause){
      setImageStatus(cause instanceof Error?cause.message:"Reviewed image table export was withheld.");
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

  function chooseTable(index:number){
    if(!inspected||!choices.some(c=>c.index===index&&c.eligible))return;
    try{
      const proposed=buildPdfTablePreview(inspected,index);
      setSelectedIndex(index);setPreview(proposed);setError("");
      setCellDetail(null);setCellStatus("");setCellAddressInput("");
    }catch(cause){
      setSelectedIndex(null);setPreview(null);
      setError(cause instanceof Error?cause.message:"Table preview was withheld.");
    }
  }

  /** Releases 98–100: navigate only within a revalidated source table. */
  function showPreview(rowStart:number,columnStart:number){
    if(!inspected||selectedIndex===null)return;
    try{
      const next=buildPdfTablePreview(inspected,selectedIndex,{rowStart,columnStart});
      setPreview(next);setCellDetail(null);setCellStatus("");setError("");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Preview was withheld.");
    }
  }
  function showExactCell(rowIndex:number,columnIndex:number){
    if(!inspected||selectedIndex===null)return;
    try{
      const detail=inspectPdfTableCell(inspected,selectedIndex,rowIndex,columnIndex);
      setCellDetail(detail);setCellAddressInput(detail.address);
      setCellStatus("");setError("");
    }catch(cause){
      setError(cause instanceof Error?cause.message:"This source cell cannot be inspected.");
    }
  }
  function jumpToCell(){
    if(!preview||!inspected||selectedIndex===null)return;
    const cell=parsePdfTableCellAddress(
      cellAddressInput,preview.totalRows,preview.totalColumns);
    if(!cell){
      setCellStatus("Enter a source Excel cell inside the selected table, such as J13.");
      return;
    }
    showPreview(
      Math.floor(cell.rowIndex/PREVIEW_MAX_ROWS)*PREVIEW_MAX_ROWS,
      Math.floor(cell.columnIndex/PREVIEW_MAX_COLUMNS)*PREVIEW_MAX_COLUMNS);
    showExactCell(cell.rowIndex,cell.columnIndex);
  }
  async function copyExactCell(){
    if(!cellDetail)return;
    try{
      await navigator.clipboard.writeText(cellDetail.value);
      setCellStatus("Exact extracted cell text copied. Verify it against the PDF.");
    }catch{
      setCellStatus("Clipboard unavailable. Select the exact text shown below to copy manually.");
    }
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

  // Release 95: reviewed selective CSV is a distinct, explicit format.
  // Re-run the same source/provenance/overlap quality gate at download time.
  // CSV has no review worksheet or grouping styles; formula-like cells are
  // escaped by the shared safe serializer, not executed by spreadsheet apps.
  async function exportSelectedCsv(){
    if(!file||busy||!inspected||selectedIndex===null)return;
    setBusy(true);setError("");setOutput(null);setWarnings([]);
    try{
      const choice=choices.find(c=>c.index===selectedIndex);
      if(!choice?.eligible)throw new Error("The selected table failed export safety checks.");
      const plan=prepareSelectedPdfV4XlsxExport(inspected,selectedIndex);
      if(plan.tables.length!==1)throw new Error("Expected exactly one selected table.");
      const name=(file.name.replace(/\.pdf$/i,"")||"kukureku")+
        "-table-"+(selectedIndex+1)+".csv";
      const blob=csvDownloadBlob(plan.tables[0].rows);
      saveAs(blob,name);
      setOutput(blob);setOutputName(name);
      setWarnings([...(plan.reviewNotes??[]),
        "CSV FORMAT: No Excel review worksheet, source geometry, cell merges or formatting is included. Formula-like values are text-escaped. Inspect the PDF before using this file."]);
      addRecentFile({fileName:name,toolName:"PDF to Excel"});
    }catch(cause){
      setError(cause instanceof Error?cause.message:"Selected-table CSV was withheld.");
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
      description="Convert all eligible native-text PDF tables, or choose a table and inspect its actual exported cell values before downloading. Other tables are excluded explicitly. Processing stays on your device; source verification is still required."
      tips={[
        { title: "Native tables or reviewed hybrid image", description: "Automatic conversion accepts selectable-text tables. On hybrid PDF pages, embedded-image OCR is separately available after explicit review and confirmation; fully scanned PDFs remain unsupported." },
        { title: "Review every source cell", description: "Browse the selected table in 12-row and 8-column windows, jump to any Excel cell, and inspect its complete extracted text before downloading. This is not accuracy certification." },
        { title: "Verify the spreadsheet", description: "Rows, columns, values, and headings must be checked against the source document before professional use." },
        { title: "Safe cell types", description: "Identifiers, leading zeros and formula-like inputs remain text. Only verified household and FHTC count columns in supported layouts become Excel numbers; no PDF content is executed as formulas." },
      ]}
      faqs={[
        { question: "Will my PDF be uploaded?", answer: "No. Extraction and XLSX generation happen in the browser." },
        { question: "Can I choose one table if another fails?", answer: "Yes. Inspect candidates, choose an eligible table, and review its extracted cell preview before exporting. Other tables stay excluded. All original safety checks still apply." },
        { question: "Does it convert scans or every table?", answer: "Automatic export accepts only structured selectable-text tables. An optional image-OCR review can create a separately labeled XLSX only after you manually correct, preview and confirm its cells. Fully scanned documents remain unsupported." },
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
        description="Automatic native tables, or optional browser-local image OCR with manual review. No cloud upload." buttonText="Choose PDF"
        helperText="PDF · Up to 25 MB, 25 pages" disabled={busy} />
      {!file && error && <div className="mt-6"><ErrorCard title="Could not select PDF"
        description={error} reasons={[]} onReset={reset}/></div>}
      {file && <div className="mt-8 space-y-6">
        <FileCard file={file} onRemove={busy ? undefined : reset}
          statusText={busy ? "Analyzing tables locally" : output ? "Download ready" : "Ready to inspect tables"}/>
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
        {!output && !error && !inspected && (
          <button type="button" onClick={inspectImageContent} disabled={busy}
            className="w-full rounded-xl border border-amber-300 px-5 py-3 font-semibold text-amber-800 disabled:opacity-60 dark:border-amber-700 dark:text-amber-200">
            Inspect embedded images for optional OCR
          </button>
        )}
        {!output && inspected && imagePage!==null && (
          <section aria-labelledby="image-review-heading"
            className="space-y-4 rounded-2xl border border-amber-300 p-5 dark:border-amber-800">
            <h3 id="image-review-heading" className="text-lg font-bold">
              Optional embedded-image to Excel review
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              This is separate from automatic PDF-to-Excel. OCR row and column suggestions may be offered, but they are never accepted automatically. An image is not
              automatically a table. Check your original PDF image, correct the
              OCR text into columns and rows, and confirm each cell before
              creating a separate user-reviewed XLSX. Your existing native
              PDF tables are never changed.
            </p>
            <label htmlFor="public-image-page" className="block text-sm font-semibold">Page to review</label>
            <select id="public-image-page" value={imagePage}
              disabled={busy||imageBusy}
              onChange={e=>{setImagePage(Number(e.target.value));setImageReview(null);
                setReviewRegionIndex(null);setReviewedRows(null);setReviewedTsv("");
                setReviewConfirmed(false);setImageStatus("");}}
              className="rounded-lg border bg-white px-3 py-2 text-slate-900">
              {inspected.imageContentReview.filter(p=>p.imageReviewRecommended).map(p=>(
                <option key={p.pageNumber} value={p.pageNumber}>Page {p.pageNumber}</option>
              ))}
            </select>
            <div>
              <button type="button" disabled={busy||imageBusy} onClick={runImageOcrReview}
                className="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900">
                {imageBusy?"Reviewing image locally…":"Run image OCR on selected page"}
              </button>
            </div>
            {imageReview?.reviews.map((review,index)=>(
              <div key={index} className="space-y-3 rounded-xl border p-3 dark:border-slate-700">
                <p className="font-semibold text-sm">Image {index+1}, page {review.pageNumber} · {review.status.replaceAll("_"," ")}</p>
                <p className="text-xs">OCR confidence: {Math.round(review.confidence)}% · Words: {review.wordCount}. Not a cell accuracy score.</p>
                {review.text && <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{review.text}</pre>}
              </div>
            ))}
            {imageReview?.reviews.some(r=>r.status==="TEXT_REVIEW_ONLY") && (
              <div className="space-y-3">
                <label htmlFor="public-image-region" className="block text-sm font-semibold">Select OCR image region</label>
                <select id="public-image-region" value={reviewRegionIndex??""}
                  onChange={e=>{setReviewRegionIndex(Number(e.target.value));
                    setReviewedRows(null);setReviewedTsv("");setReviewConfirmed(false);}}
                  className="rounded-lg border bg-white px-3 py-2 text-slate-900">
                  {imageReview.reviews.map((r,i)=>r.status==="TEXT_REVIEW_ONLY"&&(
                    <option key={i} value={i}>Image {i+1} (PDF page {r.pageNumber})</option>
                  ))}
                </select>
                {reviewRegionIndex!==null && imageReview.reviews[reviewRegionIndex]?.gridProposal &&
                  <div className="rounded-lg border border-amber-300 p-3 text-sm dark:border-amber-800">
                    <p className="font-medium">
                      {imageReview.reviews[reviewRegionIndex].gridProposal.status==="PROPOSED_FOR_MANUAL_REVIEW"
                        ? "Tentative OCR table grid available (not verified)"
                        : "Automatic row/column suggestion withheld"}
                    </p>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {imageReview.reviews[reviewRegionIndex].gridProposal.reason}
                    </p>
                    {imageReview.reviews[reviewRegionIndex].gridProposal.status==="PROPOSED_FOR_MANUAL_REVIEW"&&(
                      <button type="button" onClick={useTentativeOcrGrid}
                        className="mt-2 rounded-lg border border-amber-600 px-3 py-2 font-semibold">
                        Copy tentative grid for manual correction
                      </button>
                    )}
                  </div>
                }
                <label htmlFor="reviewed-image-grid" className="block font-semibold text-sm">
                  Your corrected table — tabs separate columns, new lines separate rows
                </label>
                <textarea id="reviewed-image-grid" value={reviewedTsv}
                  onChange={e=>{setReviewedTsv(e.target.value);setReviewedRows(null);
                    setReviewConfirmed(false);setImageStatus("");}}
                  rows={6} maxLength={30000}
                  placeholder={"Name\tAmount\nItem A\t00123\nItem B\t00456"}
                  className="w-full rounded-lg border p-3 font-mono text-sm text-slate-950 dark:bg-slate-900 dark:text-white"/>
                <button type="button" onClick={previewUserGrid}
                  className="rounded-lg border px-4 py-2 font-semibold text-sm">
                  Preview my corrected cells
                </button>
                {reviewedRows&&(
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">User-entered cell preview — {reviewedRows.length} rows × {reviewedRows[0].length} columns</p>
                    <div role="region" aria-label="Reviewed image table cell preview"
                      className="max-h-72 overflow-auto rounded-xl border">
                      <table className="w-full border-collapse text-sm"><tbody>
                        {reviewedRows.map((row,ri)=><tr key={ri}>
                          {row.map((value,ci)=><td key={ci} className="border p-2 whitespace-pre-wrap">{value}</td>)}
                        </tr>)}
                      </tbody></table>
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={reviewConfirmed}
                        onChange={e=>setReviewConfirmed(e.target.checked)}/>
                      I compared this edited grid with my source PDF image and approve
                      these exact user-entered cells for a separate spreadsheet.
                    </label>
                    <button type="button" disabled={!reviewConfirmed||busy||imageBusy}
                      onClick={exportUserReviewedImage}
                      className="rounded-xl bg-blue-800 px-4 py-3 font-semibold text-white disabled:opacity-50">
                      Download confirmed image table (.xlsx)
                    </button>
                  </div>
                )}
              </div>
            )}
            {imageStatus&&<p role="status" className="text-sm text-amber-800 dark:text-amber-200">{imageStatus}</p>}
          </section>
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
                    onChange={()=>chooseTable(choice.index)} className="mt-1 h-4 w-4"/>
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

            {preview && selectedIndex!==null && (
              <div className="space-y-3" aria-label="Selected table preview">
                <h4 className="text-base font-semibold text-slate-950 dark:text-white">
                  Table {selectedIndex+1} — extracted values preview (unverified)
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Source PDF page(s): {preview.sourcePages.join(", ")}.
                  Showing rows {preview.rowStart+1}–{preview.rowEnd} of {preview.totalRows},
                  columns {pdfTableCellAddress(0,preview.columnStart).replace(/\d+$/,"")}–
                  {pdfTableCellAddress(0,preview.columnEnd-1).replace(/\d+$/,"")}
                  of {preview.totalColumns} source columns.
                  This is the actual selected-table export cell matrix, not a visual
                  rendering of the original PDF.
                  Check against the source before using the spreadsheet.
                </p>
                {preview.pairedHeaderLayout && (
                  <p role="status" className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Two-level native header detected: paired parent headings are grouped
                    in the preview and Excel. Verify the group labels and boundaries against the PDF.
                  </p>
                )}
                <div className="max-h-80 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700"
                  role="region" aria-label="Scrollable extracted spreadsheet preview" tabIndex={0}>
                  <table className="w-full min-w-max border-collapse text-left text-sm">
                    <caption className="sr-only">
                      Bounded preview of extracted Excel cell values, not accuracy-certified
                    </caption>
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                      <tr><th scope="col" className="border-b px-3 py-2">Row</th>
                        {Array.from({length:preview.visibleColumns},(_,c)=>(
                          <th key={c} scope="col" className="border-b px-3 py-2">
                            {pdfTableCellAddress(0,preview.columnStart+c).replace(/\d+$/,"")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((cells,row)=>(
                        <tr key={row} className="border-t border-slate-200 dark:border-slate-700">
                          <th scope="row" className="bg-slate-50 px-3 py-2 font-semibold dark:bg-slate-900">
                            {preview.rowStart+row+1}
                            <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                              PDF p. {preview.visibleRowPages[row]}
                            </span>
                          </th>
                          {cells.map((value,col)=>(
                            preview.pairedHeaderLayout && preview.rowStart+row===0 && [2,4,6].includes(preview.columnStart+col)
                              ? null :
                            <td key={col}
                              colSpan={preview.pairedHeaderLayout && preview.rowStart+row===0 && [1,3,5].includes(preview.columnStart+col)?2:1}
                              className="max-w-72 whitespace-pre-wrap break-words px-3 py-2 align-top">
                              <button type="button"
                                onClick={()=>showExactCell(preview.rowStart+row,preview.columnStart+col)}
                                aria-label={"Inspect exact cell "+pdfTableCellAddress(preview.rowStart+row,preview.columnStart+col)}
                                className="w-full whitespace-pre-wrap break-words text-left underline-offset-2 hover:underline focus-visible:underline">
                                {value || <span className="text-slate-400">(blank)</span>}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Table preview navigation">
                  <button type="button" onClick={()=>showPreview(Math.max(0,preview.rowStart-PREVIEW_MAX_ROWS),preview.columnStart)}
                    disabled={busy||preview.rowStart===0}
                    className="rounded-lg border p-2 text-sm disabled:opacity-40">Previous 12 rows</button>
                  <button type="button" onClick={()=>showPreview(preview.rowEnd,preview.columnStart)}
                    disabled={busy||preview.rowEnd>=preview.totalRows}
                    className="rounded-lg border p-2 text-sm disabled:opacity-40">Next 12 rows</button>
                  <button type="button" onClick={()=>showPreview(preview.rowStart,Math.max(0,preview.columnStart-PREVIEW_MAX_COLUMNS))}
                    disabled={busy||preview.columnStart===0}
                    className="rounded-lg border p-2 text-sm disabled:opacity-40">Previous 8 columns</button>
                  <button type="button" onClick={()=>showPreview(preview.rowStart,preview.columnEnd)}
                    disabled={busy||preview.columnEnd>=preview.totalColumns}
                    className="rounded-lg border p-2 text-sm disabled:opacity-40">Next 8 columns</button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm font-medium">
                    Go to cell (e.g. J13)
                    <input type="text" value={cellAddressInput}
                      onChange={event=>setCellAddressInput(event.target.value)}
                      placeholder="J13" aria-label="Excel cell address"
                      maxLength={12} className="mt-1 block w-32 rounded-lg border bg-transparent p-2 uppercase"/>
                  </label>
                  <button type="button" onClick={jumpToCell} disabled={busy}
                    className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                    Go to cell
                  </button>
                </div>
                {cellDetail && (
                  <section aria-label="Exact extracted cell details"
                    className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                    <p className="font-semibold">Exact cell {cellDetail.address} · Source PDF page {cellDetail.sourcePage}</p>
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      This is unverified extracted text, not a certified transcription.
                      The XLSX/CSV value is unchanged by reviewing or copying.
                    </p>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-2 dark:bg-slate-900"
                      aria-label="Exact extracted cell text">{cellDetail.value || "(blank cell)"}</pre>
                    <button type="button" onClick={copyExactCell}
                      className="rounded-lg border border-blue-500 p-2 text-sm">Copy exact cell text</button>
                  </section>
                )}
                {cellStatus && <p role="status" className="text-sm text-amber-800 dark:text-amber-200">{cellStatus}</p>}
                {(preview.totalRows>preview.visibleRows||
                  preview.totalColumns>preview.visibleColumns||
                  preview.trimmedCells>0) && (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Only the current preview window and shortened long values are shown.
                    Browse to other rows and columns or inspect exact cells; the downloaded
                    XLSX and CSV retain the complete selected table text.
                  </p>
                )}
              </div>
            )}
            <button type="button" onClick={exportSelected}
              disabled={busy||selectedIndex===null}
              className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
              {busy?"Preparing selected table…":"Export selected table (.xlsx)"}
            </button>
            <button type="button" onClick={exportSelectedCsv}
              disabled={busy||selectedIndex===null}
              className="w-full rounded-xl border border-blue-300 bg-white px-5 py-3 font-semibold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200">
              {busy?"Preparing selected table…":"Export selected table (.csv)"}
            </button>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              CSV retains table cells but not merged headings or a review-notes sheet.
              Formula-like values are text-escaped; verify against the original PDF.
            </p>
          </section>
        )}
        {!busy && output && <>
          <SuccessCard title={outputName.endsWith(".csv")?"CSV table created":"Excel workbook created"}
            description={outputName.endsWith(".csv")?
              "This CSV includes only selected table cell text. It has no review worksheet or header merges; formula-like cells are escaped. Check against the original PDF.":
              "Verified household and FHTC counts may be numeric in supported tables; identifiers, leading zeros and formula-like values remain text. Compare the workbook with the original PDF."}
            fileName={outputName} onDownloadAgain={() => saveAs(output, outputName)}
            onStartAgain={reset} downloadLabel={outputName.endsWith(".csv")?"Download CSV Again":"Download XLSX Again"}
            resetLabel="Convert Another PDF"/>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800 dark:border-amber-900/70 dark:bg-slate-950 dark:text-slate-200">
            <p className="font-semibold text-amber-950 dark:text-amber-200">Extraction review — not certified</p>
            {warnings.map((item, index) => <p className="mt-2" key={index}>{item}</p>)}
          </div>
        </>}
        {!busy && output && inspected && (
          <button type="button" onClick={()=>{
            setOutput(null);setOutputName("");setWarnings([]);setSelectedIndex(null);setPreview(null);
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