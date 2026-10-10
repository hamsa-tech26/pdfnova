"use client";

import FileUploader from "@/components/pdf/FileUploader";
import ErrorCard from "@/components/pdf/ErrorCard";
import PdfPageCard from "@/components/pdf/PdfPageCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import {
  forEachRenderedPdfPage,
  renderPdfPages,
  countPdfPages,
  pdfPreviewPageNumbers,
  PDF_JPG_PREVIEW_BATCH_SIZE,
  type RenderedPdfPage,
} from "@/lib/pdf/render";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { nextJpgZipByteCount } from "@/lib/pdf/jpgZipBudget";
import { PdfOperationCancelledError, throwIfPdfOperationCancelled } from "@/lib/pdf/operationCancellation";
import JSZip from "jszip";
import {
  Archive,
  FileText,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1];
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export default function PdfToJpgPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<RenderedPdfPage[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [previewStart, setPreviewStart] = useState(1);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const operationRef = useRef(false);
  const zipControllerRef = useRef<AbortController | null>(null);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipTotal, setZipTotal] = useState(0);
  const [zipPhase, setZipPhase] = useState<"rendering" | "packaging">("rendering");
  const [isCancellingZip, setIsCancellingZip] = useState(false);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingZip, setIsCreatingZip] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    if (operationRef.current || isCreatingZip) {
      event.target.value = "";
      return;
    }
    operationRef.current = true;
    const selectedFile = event.target.files?.[0];

    if (!selectedFile || selectedFile.type !== "application/pdf") {
      setErrorMessage("Please select a valid PDF file.");
      toast.error("Please select a valid PDF file.");
      event.target.value = "";
      operationRef.current = false;
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      setErrorMessage("The PDF file must not be larger than 25 MB.");
      toast.error("The PDF file must not be larger than 25 MB.");
      event.target.value = "";
      operationRef.current = false;
      return;
    }

    setFile(selectedFile);
    setErrorMessage("");
    setPages([]);
    setPageCount(0);
    setPreviewStart(1);
    setSelectedPages([]);
    setIsLoading(true);

    try {
      const count = await countPdfPages(selectedFile);
      const firstPages = pdfPreviewPageNumbers(1, count);
      const renderedPages = await renderPdfPages(
        selectedFile,
        {
          pageNumbers: firstPages,
          scale: 1.25,
          quality: 0.84,
          format: "jpeg",
          maxDimension: 1800,
        },
      );
      setPageCount(count);
      setPages(renderedPages);
      toast.success(
        `PDF ready: ${count} pages. Showing ${renderedPages.length} preview thumbnails.`,
      );
    } catch (error) {
      console.error(error);
      setFile(null);

      const message = "Unable to render this PDF. It may be damaged or password-protected.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      operationRef.current = false;
      setIsLoading(false);
      event.target.value = "";
    }
  }

  async function changePreview(start: number) {
    if (!file || isPreviewing || isCreatingZip || operationRef.current) return;
    const pageNumbers = pdfPreviewPageNumbers(start, pageCount);
    if (!pageNumbers.length) return;
    operationRef.current = true;
    setIsPreviewing(true);
    try {
      const newPages = await renderPdfPages(file, {
        pageNumbers,
        scale: 1.25,
        quality: 0.84,
        format: "jpeg",
        maxDimension: 1800,
      });
      setPages(newPages);
      setPreviewStart(start);
    } catch (error) {
      console.error(error);
      setErrorMessage("Unable to preview this page range. The original PDF remains available.");
    } finally {
      operationRef.current = false;
      setIsPreviewing(false);
    }
  }

  function togglePageSelection(pageNumber: number) {
    if (operationRef.current) return;
    setSelectedPages((currentPages) =>
      currentPages.includes(pageNumber)
        ? currentPages.filter((page) => page !== pageNumber)
        : [...currentPages, pageNumber].sort((a, b) => a - b),
    );
  }

  async function downloadPage(page: RenderedPdfPage) {
    if (!file || operationRef.current) return;
    operationRef.current = true;

    try {
      const outputPages =
        await renderPdfPages(
          file,
          {
            pageNumbers: [
              page.pageNumber,
            ],
            scale: 2,
            quality: 0.92,
            format: "jpeg",
            maxDimension:
              3200,
          },
        );

      const outputPage =
        outputPages[0];

      if (!outputPage) {
        throw new Error(
          "The selected page could not be rendered.",
        );
      }

      const imageBytes =
        dataUrlToBytes(
          outputPage.dataUrl,
        );

      const fileName =
        `kukureku-page-${page.pageNumber}.jpg`;

      downloadFile(
        imageBytes,
        fileName,
        "image/jpeg",
      );

      addRecentFile({
        fileName,
        toolName:
          "PDF to JPG",
      });

      toast.success(
        `Page ${page.pageNumber} downloaded.`,
      );
    } catch (error) {
      console.error(error);
      toast.error(
        `Page ${page.pageNumber} could not be rendered for download.`,
      );
    } finally {
      operationRef.current = false;
    }
  }

  function selectAllPages() {
    if (operationRef.current) return;
    setSelectedPages(Array.from({length: pageCount}, (_, i) => i + 1));
  }

  function clearSelection() {
    if (operationRef.current) return;
    setSelectedPages([]);
  }

  async function downloadPagesAsZip(
    pageNumbers: number[],
    zipFileName: string,
  ) {
    if (pageNumbers.length === 0) {
      toast.error("Please select at least one page.");
      return;
    }

    if (operationRef.current) return;
    operationRef.current = true;
    const controller = new AbortController();
    zipControllerRef.current = controller;
    setZipProgress(0);
    setZipTotal(pageNumbers.length);
    setZipPhase("rendering");
    setIsCancellingZip(false);
    setErrorMessage("");
    setIsCreatingZip(true);

    try {
      if (!file) {
        throw new Error(
          "The source PDF is no longer available.",
        );
      }

      const zip = new JSZip();
      let renderedCount = 0;
      let archiveBytes = 0;

      await forEachRenderedPdfPage(
        file,
        {
          pageNumbers,
          scale: 2,
          quality: 0.92,
          format: "jpeg",
          maxDimension: 3200,
          signal: controller.signal,
        },
        (page) => {
          throwIfPdfOperationCancelled(controller.signal);
          const imageBytes =
            dataUrlToBytes(
              page.dataUrl,
            );

          archiveBytes = nextJpgZipByteCount(archiveBytes, imageBytes.byteLength);

          const imageFileName =
            `kukureku-page-${page.pageNumber}.jpg`;

          zip.file(
            imageFileName,
            imageBytes,
            {
              compression:
                "STORE",
            },
          );

          renderedCount += 1;
          setZipProgress(renderedCount);
        },
      );

      if (
        renderedCount !==
        pageNumbers.length
      ) {
        throw new Error(
          "One or more selected pages could not be rendered.",
        );
      }

      throwIfPdfOperationCancelled(controller.signal);
      setZipPhase("packaging");
      const zipBytes =
        await zip.generateAsync({
          type: "uint8array",
          compression: "STORE",
        });

      // Cancellation during JSZip packaging must not emit any partial download.
      throwIfPdfOperationCancelled(controller.signal);
      downloadFile(zipBytes, zipFileName, "application/zip");

      addRecentFile({
        fileName: zipFileName,
        toolName: "PDF to JPG",
      });

      toast.success(
        `${renderedCount} ${
          renderedCount === 1 ? "page" : "pages"
        } added to ZIP successfully.`,
      );

      toast("Download started", {
        description: "Your JPG images are being downloaded as a ZIP file.",
      });
    } catch (error) {
      if (error instanceof PdfOperationCancelledError || (error instanceof Error && error.name === "AbortError")) {
        toast("JPG export cancelled. No partial ZIP was downloaded.");
      } else {
        console.error(error);
        const message = error instanceof Error ? error.message : "The ZIP file could not be created.";
        setErrorMessage(message);
        toast.error(message);
      }
    } finally {
      zipControllerRef.current = null;
      operationRef.current = false;
      setIsCreatingZip(false);
      setIsCancellingZip(false);
    }
  }

  async function downloadSelectedPages() {
    await downloadPagesAsZip(
      selectedPages,
      "kukureku-selected-jpg-pages.zip",
    );
  }

  async function downloadAllPages() {
    const allPageNumbers = Array.from({length: pageCount}, (_, i) => i + 1);

    await downloadPagesAsZip(
      allPageNumbers,
      "kukureku-all-jpg-pages.zip",
    );
  }

  return (
    <ToolLayout
      label="PDF to JPG"
      title="Convert PDF pages to JPG images"
      description="Convert selected PDF pages to JPG images locally in your browser. Download images individually or together as a ZIP without uploading the PDF."
      howToTitle="How to convert PDF pages to JPG"
      howToSteps={[
        {
          title: "Add one PDF",
          description:
            "Choose the PDF whose pages you want to convert, up to 25 MB.",
        },
        {
          title: "Select pages",
          description:
            "Preview the document and choose the pages you want as JPG images.",
        },
        {
          title: "Export the images",
          description:
            "Convert locally and download individual JPG files or a ZIP.",
        },
      ]}
    >
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              multiple={false}
              title="Select one PDF"
              description="Choose the PDF you want to convert."
              buttonText="Choose PDF"
              helperText="Maximum file size: 25 MB"
              disabled={isLoading || isPreviewing || isCreatingZip}
            />

            {errorMessage && (
              <div className="mt-6">
                <ErrorCard
                  title="PDF processing needs attention"
                  description={errorMessage}
                  reasons={[]}
                  onReset={() => setErrorMessage("")}
                  resetLabel="Dismiss Error"
                />
              </div>
            )}

            {file && (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <FileText size={21} />
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">
                    {file.name}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-8 text-center">
                <LoaderCircle
                  size={28}
                  className="mx-auto animate-spin text-blue-600"
                />

                <p className="mt-4 font-semibold text-blue-700">
                  Rendering PDF pages...
                </p>

                <p className="mt-2 text-sm text-blue-600">
                  Large PDFs may take a little longer.
                </p>
              </div>
            )}

            {pageCount > 0 && (
              <div className="mt-10">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      PDF Pages ({pageCount})
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Selected: {selectedPages.length}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllPages}
                      disabled={
                        selectedPages.length === pageCount || isCreatingZip || isPreviewing || isLoading
                      }
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={selectedPages.length === 0 || isCreatingZip || isPreviewing || isLoading}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={downloadSelectedPages}
                    disabled={
                      selectedPages.length === 0 || isCreatingZip || isPreviewing
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreatingZip ? (
                      <LoaderCircle
                        size={19}
                        className="animate-spin"
                      />
                    ) : (
                      <Archive size={19} />
                    )}

                    Download Selected as ZIP
                  </button>

                  <button
                    type="button"
                    onClick={downloadAllPages}
                    disabled={isCreatingZip || isPreviewing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3 font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreatingZip ? (
                      <LoaderCircle
                        size={19}
                        className="animate-spin"
                      />
                    ) : (
                      <Archive size={19} />
                    )}

                    Download All as ZIP
                  </button>
                </div>

                {isCreatingZip && (
                  <div role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                    <p className="font-semibold">{isCancellingZip ? "Cancellation requested. Finishing the current safe step…" : zipPhase === "packaging" ? "Packaging ZIP archive…" : `Rendering JPG ${zipProgress} of ${zipTotal}…`}</p>
                    <p className="mt-1">No partial archive will be downloaded if you cancel. The ZIP has a 64 MB image-data safety limit.</p>
                    <button type="button" onClick={() => {zipControllerRef.current?.abort(); setIsCancellingZip(true);}} disabled={isCancellingZip} className="mt-3 min-h-11 rounded-lg border border-blue-400 bg-white px-4 py-2 font-semibold disabled:opacity-50">Cancel ZIP export</button>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <span role="status">Previewing pages {previewStart}–{Math.min(pageCount, previewStart + PDF_JPG_PREVIEW_BATCH_SIZE - 1)} of {pageCount}. Only eight preview images are retained at a time. All pages remain available for export.</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void changePreview(Math.max(1, previewStart - PDF_JPG_PREVIEW_BATCH_SIZE))}
                      disabled={previewStart === 1 || isPreviewing || isCreatingZip}
                      className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold disabled:opacity-40 dark:border-slate-700">Previous previews</button>
                    <button type="button" onClick={() => void changePreview(previewStart + PDF_JPG_PREVIEW_BATCH_SIZE)}
                      disabled={previewStart + PDF_JPG_PREVIEW_BATCH_SIZE > pageCount || isPreviewing || isCreatingZip}
                      className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold disabled:opacity-40 dark:border-slate-700">Next previews</button>
                  </div>
                </div>
                {isPreviewing && <p role="status" className="mt-3 text-sm font-semibold text-blue-700">Loading the next preview group…</p>}
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {pages.map((page) => (
                    <PdfPageCard
                      key={page.pageNumber}
                      pageNumber={page.pageNumber}
                      dataUrl={page.dataUrl}
                      width={page.width}
                      height={page.height}
                      isSelected={selectedPages.includes(
                        page.pageNumber,
                      )}
                      onToggleSelect={() =>
                        togglePageSelection(page.pageNumber)
                      }
                      onDownload={() => {
                        void downloadPage(page);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500">
              <ShieldCheck
                size={18}
                className="shrink-0 text-emerald-600"
              />
              Your PDF is processed inside your browser and is not uploaded.
            </div>
  </ToolLayout>
  );
}
