"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import RectPercentControls from "@/components/pdf/RectPercentControls";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import { renderPdfPages, type RenderedPdfPage } from "@/lib/pdf/render";
import {
  createRasterRedactedPdf,
  isUsefulRedactionRect,
  normalizeRedactionRect,
  type RedactionRect,
  type RedactionsByPage,
} from "@/lib/pdf/redaction";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { Eraser, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  ChangeEvent,
  PointerEvent,
  useRef,
  useState,
} from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const tips = [
  { title: "Mark sensitive content precisely", description: "Drag one or more redaction boxes, or enter percentage coordinates when using a keyboard or touch device." },
  { title: "Privacy-safe raster export", description: "The downloaded PDF is rebuilt from rendered page images after redaction, so original page text is not hidden underneath black boxes." },
  { title: "Review before sharing", description: "Check every page and every marked area before distributing the redacted copy." },
];

const faqs = [
  { question: "Is this only a black rectangle?", answer: "No. Kukureku renders the document, paints the redactions into the page pixels, and rebuilds a new PDF from those redacted page images." },
  { question: "What changes in the output?", answer: "The privacy-safe output is rasterized. Selectable text, links, form fields, annotations, and other interactive page objects are not retained." },
  { question: "Is the PDF uploaded?", answer: "No. Preview rendering and redaction are performed locally in your browser." },
];

function pointRatio(event: PointerEvent<HTMLDivElement>, element: HTMLDivElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

export default function RedactPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewRequestRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const [preview, setPreview] = useState<RenderedPdfPage | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [redactions, setRedactions] = useState<RedactionsByPage>({});
  const [draft, setDraft] = useState<RedactionRect | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const currentRects = redactions[selectedPage] ?? [];
  const totalRedactions = Object.values(redactions).reduce((sum, rects) => sum + rects.length, 0);

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  async function renderSelectedPreview(targetFile: File, pageNumber: number) {
    const requestId = ++previewRequestRef.current;
    setIsRenderingPreview(true);
    setErrorMessage("");
    try {
      const pages = await renderPdfPages(targetFile, {
        scale: 1.4,
        quality: 0.9,
        pageNumbers: [pageNumber],
        format: "jpeg",
        maxDimension:
          2400,
      });
      if (requestId !== previewRequestRef.current) return;
      if (!pages[0]) throw new Error("Unable to render the selected page.");
      setPreview(pages[0]);
    } catch (error) {
      if (requestId !== previewRequestRef.current) return;
      console.error(error);
      setPreview(null);
      setErrorMessage("The page preview could not be created.");
    } finally {
      if (requestId === previewRequestRef.current) setIsRenderingPreview(false);
    }
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile || (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf"))) {
      setErrorMessage("Please select a valid PDF file.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage("The PDF file must not be larger than 25 MB.");
      return;
    }
    try {
      const pdf = await PDFDocument.load(await selectedFile.arrayBuffer());
      const count = pdf.getPageCount();
      if (!count) throw new Error("The PDF has no pages.");
      setFile(selectedFile);
      setPageCount(count);
      setSelectedPage(1);
      setRedactions({});
      setDraft(null);
      setPreview(null);
      resetResult();
      void renderSelectedPreview(selectedFile, 1);
      toast.success(String(count) + " pages ready for redaction.");
    } catch {
      setFile(null);
      setErrorMessage("Unable to open this PDF. It may be damaged or password-protected.");
    }
  }

  function startAgain() {
    previewRequestRef.current += 1;
    setFile(null);
    setPageCount(0);
    setSelectedPage(1);
    setPreview(null);
    setRedactions({});
    setDraft(null);
    resetResult();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function choosePage(pageNumber: number) {
    if (!file) return;
    setSelectedPage(pageNumber);
    setPreview(null);
    setDraft(null);
    resetResult();
    void renderSelectedPreview(file, pageNumber);
  }

  function beginRedaction(event: PointerEvent<HTMLDivElement>) {
    if (!previewRef.current || isProcessing) return;
    const point = pointRatio(event, previewRef.current);
    dragStartRef.current = point;
    setDraft({ x: point.x, y: point.y, width: 0, height: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveRedaction(event: PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start || !previewRef.current) return;
    const point = pointRatio(event, previewRef.current);
    setDraft({
      x: start.x,
      y: start.y,
      width: point.x - start.x,
      height: point.y - start.y,
    });
  }

  function endRedaction(event: PointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current;

    if (!start || !previewRef.current) {
      return;
    }

    const point = pointRatio(
      event,
      previewRef.current,
    );

    dragStartRef.current = null;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    const normalized =
      normalizeRedactionRect({
        x: start.x,
        y: start.y,
        width: point.x - start.x,
        height: point.y - start.y,
      });

    setDraft(null);

    if (
      !isUsefulRedactionRect(
        normalized,
      )
    ) {
      return;
    }

    setRedactions((current) => ({
      ...current,
      [selectedPage]: [
        ...(current[
          selectedPage
        ] ?? []),
        normalized,
      ],
    }));

    resetResult();
  }

  function removeLast() {
    setRedactions((current) => {
      const next = { ...current };
      const pageRects = [...(next[selectedPage] ?? [])];
      pageRects.pop();
      if (pageRects.length) next[selectedPage] = pageRects;
      else delete next[selectedPage];
      return next;
    });
    resetResult();
  }

  function clearPage() {
    setRedactions((current) => {
      const next = { ...current };
      delete next[selectedPage];
      return next;
    });
    resetResult();
  }

  async function createRedactedPdf() {
    if (!file || totalRedactions === 0) return;
    setIsProcessing(true);
    setErrorMessage("");
    try {
      const bytes = await createRasterRedactedPdf(file, redactions);
      const baseName = file.name.replace(/\.pdf$/i, "") || "kukureku";
      const generatedFileName = baseName + "-redacted.pdf";
      downloadFile(bytes, generatedFileName, "application/pdf");
      setOutputBytes(bytes);
      setOutputFileName(generatedFileName);
      addRecentFile({ fileName: generatedFileName, toolName: "Redact PDF" });
      toast.success("Redacted PDF created successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "The PDF could not be redacted.");
    } finally {
      setIsProcessing(false);
    }
  }

  const previewRect = (rect: RedactionRect, key: string) => {
    const normalized = normalizeRedactionRect(rect);
    return (
      <div
        key={key}
        className="pointer-events-none absolute bg-black"
        style={{
          left: String(normalized.x * 100) + "%",
          top: String(normalized.y * 100) + "%",
          width: String(normalized.width * 100) + "%",
          height: String(normalized.height * 100) + "%",
        }}
      />
    );
  };

  return (
    <ToolLayout
      label="Redact PDF"
      title="Permanently redact PDF content privately"
      description="Drag over sensitive information, then create a privacy-safe rasterized PDF in which the original page content is not hidden underneath the redaction marks."
      tips={tips}
      faqs={faqs}
      howToTitle="How to redact a PDF"
      howToSteps={[
        { title: "Choose one PDF", description: "Select the document you need to sanitize." },
        { title: "Mark sensitive areas", description: "Choose each page and drag black redaction areas or use the keyboard-friendly percentage controls." },
        { title: "Create the redacted copy", description: "Kukureku rasterizes the pages, applies the redactions, and rebuilds a new PDF." },
      ]}
      maxWidthClassName="max-w-6xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag the PDF you want to redact."
        buttonText="Choose PDF"
        helperText="PDF · Maximum file size: 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={isProcessing ? undefined : startAgain}
            removeLabel="Remove PDF"
            statusText={isProcessing ? "Creating privacy-safe redacted PDF" : String(totalRedactions) + " redaction areas marked"}
          />

          {!outputBytes && (
            <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white">Mark redaction areas</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Drag directly over the page preview, or use the percentage controls below for keyboard-friendly placement. Add as many boxes as needed.</p>
                </div>
                <label className="text-sm font-semibold dark:text-white">
                  Page
                  <select value={selectedPage} onChange={(event) => choosePage(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950 sm:ml-3 sm:mt-0 sm:w-auto">
                    {Array.from({ length: pageCount }, (_, index) => <option key={index + 1} value={index + 1}>Page {index + 1}</option>)}
                  </select>
                </label>
              </div>

              <div className="mt-6">
                {isRenderingPreview && <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-gray-300">Rendering page preview...</div>}

                {!isRenderingPreview && preview && (
                  <div
                    ref={previewRef}
                    onPointerDown={beginRedaction}
                    onPointerMove={moveRedaction}
                    onPointerUp={endRedaction}
                    onPointerCancel={endRedaction}
                    className="relative mx-auto w-full max-w-3xl touch-none cursor-crosshair overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm"
                    style={{ aspectRatio: String(preview.width) + " / " + String(preview.height) }}
                  >
                    <img src={preview.dataUrl} alt={"PDF page " + String(selectedPage) + " preview"} draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
                    {currentRects.map((rect, index) => previewRect(rect, "saved-" + String(index)))}
                    {draft && previewRect(draft, "draft")}
                  </div>
                )}
              </div>

              <div className="mt-5">
                <RectPercentControls
                  label={"Redaction area on page " + String(selectedPage)}
                  value={
                    draft ?? {
                      x: 0.1,
                      y: 0.1,
                      width: 0.4,
                      height: 0.1,
                    }
                  }
                  onChange={(rect) => {
                    setDraft(rect);
                    resetResult();
                  }}
                  onCommit={(rect) => {
                    const normalized = normalizeRedactionRect(rect);
                    if (!isUsefulRedactionRect(normalized)) {
                      setErrorMessage("Choose a larger redaction area.");
                      return;
                    }
                    setRedactions((current) => ({
                      ...current,
                      [selectedPage]: [
                        ...(current[selectedPage] ?? []),
                        normalized,
                      ],
                    }));
                    setDraft(null);
                    resetResult();
                  }}
                  commitLabel="Add redaction area"
                  disabled={isProcessing || isRenderingPreview || !preview}
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={removeLast} disabled={!currentRects.length || isProcessing} className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 outline-none transition hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus-visible:ring-blue-950">Remove last</button>
                <button type="button" onClick={clearPage} disabled={!currentRects.length || isProcessing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 outline-none transition hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus-visible:ring-blue-950"><Eraser size={16} /> Clear this page</button>
              </div>

              <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <TriangleAlert size={19} className="shrink-0" />
                <p>The privacy-safe output rasterizes every page. Selectable text, links, interactive forms, and annotations are removed from the rebuilt PDF. Review the downloaded result before sharing it.</p>
              </div>
            </section>
          )}

          {!outputBytes && totalRedactions > 0 && !errorMessage && (
            <ActionButton
              isLoading={isProcessing}
              loadingText="Applying permanent redactions..."
              loadingSubtitle="Rasterizing pages and rebuilding the PDF locally."
              buttonText="Redact and Download PDF"
              subtitle="Creates a new rasterized copy with the marked content removed from the page pixels."
              onClick={createRedactedPdf}
              disabled={isProcessing || isRenderingPreview}
            />
          )}

          {!isProcessing && outputBytes && (
            <SuccessCard
              title="Your redacted PDF is ready"
              description="A new rasterized PDF was rebuilt after the marked areas were permanently painted into the page images."
              fileName={outputFileName}
              onDownloadAgain={() => downloadFile(outputBytes, outputFileName, "application/pdf")}
              onStartAgain={startAgain}
              downloadLabel="Download Redacted PDF Again"
              resetLabel="Redact Another PDF"
            />
          )}

          {!isProcessing && errorMessage && (
            <ErrorCard
              title="PDF redaction needs attention"
              description={errorMessage}
              reasons={[
                "A PDF page may not be renderable in this browser.",
                "The document may be too large for available browser memory.",
                "The PDF may be password-protected or damaged.",
              ]}
              onRetry={file && totalRedactions > 0 ? createRedactedPdf : undefined}
              onReset={startAgain}
              retryLabel="Retry Redaction"
              resetLabel="Choose Another PDF"
            />
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck size={18} className="text-emerald-600" />
        Redaction and rasterization run locally in your browser. Your PDF is not uploaded.
      </div>
    </ToolLayout>
  );
}
