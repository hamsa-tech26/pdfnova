"use client";

import Navbar from "@/components/Navbar";
import FileUploader from "@/components/pdf/FileUploader";
import PdfPageCard from "@/components/pdf/PdfPageCard";
import ToolHeader from "@/components/pdf/ToolHeader";
import { downloadFile } from "@/lib/downloadFile";
import { renderPdfPages, type RenderedPdfPage } from "@/lib/pdf/render";
import { FileText, ShieldCheck } from "lucide-react";
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
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile || selectedFile.type !== "application/pdf") {
      toast.error("Please select a PDF file.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setPages([]);
    setSelectedPages([]);
    setIsLoading(true);

    try {
      const renderedPages = await renderPdfPages(selectedFile);

      setPages(renderedPages);

      toast.success(
        `${renderedPages.length} ${
          renderedPages.length === 1 ? "page" : "pages"
        } rendered successfully.`,
      );
    } catch (error) {
      console.error(error);
      setFile(null);

      toast.error(
        "Unable to render this PDF. It may be damaged or password-protected.",
      );
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  function togglePageSelection(pageNumber: number) {
    setSelectedPages((currentPages) =>
      currentPages.includes(pageNumber)
        ? currentPages.filter((page) => page !== pageNumber)
        : [...currentPages, pageNumber].sort((a, b) => a - b),
    );
  }

  function downloadPage(page: RenderedPdfPage) {
    const imageBytes = dataUrlToBytes(page.dataUrl);
    const fileName = `pdfnova-page-${page.pageNumber}.jpg`;

    downloadFile(imageBytes, fileName, "image/jpeg");

    toast.success(`Page ${page.pageNumber} downloaded.`);
  }

  function selectAllPages() {
    setSelectedPages(pages.map((page) => page.pageNumber));
  }

  function clearSelection() {
    setSelectedPages([]);
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <ToolHeader
            label="PDF to JPG"
            title="Convert PDF pages into JPG images"
            description="Upload a PDF, preview every page, select the pages you need, and download them as JPG images."
          />

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-8">
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              multiple={false}
              title="Select one PDF"
              description="Choose the PDF you want to convert."
              buttonText="Choose PDF"
              helperText="Maximum file size: 25 MB"
            />

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
                <p className="font-semibold text-blue-700">
                  Rendering PDF pages...
                </p>

                <p className="mt-2 text-sm text-blue-600">
                  Large PDFs may take a little longer.
                </p>
              </div>
            )}

            {pages.length > 0 && (
              <div className="mt-10">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      PDF Pages ({pages.length})
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                      Selected: {selectedPages.length}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={selectAllPages}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={clearSelection}
                      disabled={selectedPages.length === 0}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {pages.map((page) => (
                    <PdfPageCard
                      key={page.pageNumber}
                      pageNumber={page.pageNumber}
                      dataUrl={page.dataUrl}
                      width={page.width}
                      height={page.height}
                      isSelected={selectedPages.includes(page.pageNumber)}
                      onToggleSelect={() =>
                        togglePageSelection(page.pageNumber)
                      }
                      onDownload={() => downloadPage(page)}
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
          </section>
        </div>
      </main>
    </>
  );
}