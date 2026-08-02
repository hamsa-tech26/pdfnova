"use client";

import Navbar from "@/components/Navbar";
import ActionButton from "@/components/pdf/ActionButton";
import FileUploader from "@/components/pdf/FileUploader";
import ToolHeader from "@/components/pdf/ToolHeader";
import { FileText, ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

export default function SplitPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pageRange, setPageRange] = useState("");
  const [isSplitting, setIsSplitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile || selectedFile.type !== "application/pdf") {
      setError("Please select a valid PDF file.");
      return;
    }

    setFile(selectedFile);
    setPageRange("");
    setError("");
    event.target.value = "";
  }

  function parsePageRange(range: string, totalPages: number) {
    const pageNumbers = new Set<number>();
    const parts = range.split(",").map((part) => part.trim());

    for (const part of parts) {
      if (!part) continue;

      if (part.includes("-")) {
        const [startText, endText] = part.split("-").map((value) => value.trim());
        const start = Number(startText);
        const end = Number(endText);

        if (
          !Number.isInteger(start) ||
          !Number.isInteger(end) ||
          start < 1 ||
          end > totalPages ||
          start > end
        ) {
          throw new Error("Invalid page range.");
        }

        for (let page = start; page <= end; page += 1) {
          pageNumbers.add(page - 1);
        }
      } else {
        const page = Number(part);

        if (!Number.isInteger(page) || page < 1 || page > totalPages) {
          throw new Error("Invalid page number.");
        }

        pageNumbers.add(page - 1);
      }
    }

    return Array.from(pageNumbers).sort((a, b) => a - b);
  }

  async function splitPdfFile() {
    if (!file) {
      setError("Please select a PDF file.");
      return;
    }

    if (!pageRange.trim()) {
      setError("Please enter the pages you want to extract.");
      return;
    }

    setIsSplitting(true);
    setError("");

    try {
      const sourceBytes = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(sourceBytes);
      const selectedPageIndexes = parsePageRange(
        pageRange,
        sourcePdf.getPageCount(),
      );

      if (selectedPageIndexes.length === 0) {
        setError("Please select at least one page.");
        return;
      }

      const splitPdf = await PDFDocument.create();
      const copiedPages = await splitPdf.copyPages(
        sourcePdf,
        selectedPageIndexes,
      );

      copiedPages.forEach((page) => splitPdf.addPage(page));

      const splitPdfBytes = await splitPdf.save();
      const splitPdfBuffer = new ArrayBuffer(splitPdfBytes.byteLength);
      new Uint8Array(splitPdfBuffer).set(splitPdfBytes);

      const blob = new Blob([splitPdfBuffer], {
        type: "application/pdf",
      });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = "pdfnova-split.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);
    } catch (splitError) {
      console.error(splitError);
      setError(
        "The PDF could not be split. Check the page range and make sure the file is not password-protected.",
      );
    } finally {
      setIsSplitting(false);
    }
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <ToolHeader
            label="Split PDF"
            title="Extract selected pages from your PDF"
            description="Upload one PDF, choose the pages you need, and download them as a new document."
          />

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-10">
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              multiple={false}
              title="Select one PDF file"
              description="Choose the PDF you want to split."
              buttonText="Choose PDF File"
              helperText="Maximum file size: 25 MB"
            />

            {file && (
              <div className="mt-8">
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                    <FileText size={20} />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {file.name}
                    </p>

                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <label
                    htmlFor="page-range"
                    className="text-sm font-semibold text-gray-900"
                  >
                    Pages to extract
                  </label>

                  <input
                    id="page-range"
                    type="text"
                    value={pageRange}
                    onChange={(event) => {
                      setPageRange(event.target.value);
                      setError("");
                    }}
                    placeholder="Example: 1-3, 5, 8-10"
                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />

                  <p className="mt-2 text-sm text-gray-500">
                    Use commas for separate pages and hyphens for ranges.
                  </p>
                </div>

                <ActionButton
                  isLoading={isSplitting}
                  loadingText="Creating split PDF..."
                  buttonText="Split and Download PDF"
                  onClick={splitPdfFile}
                />
              </div>
            )}

            {error && (
              <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
              <ShieldCheck size={18} className="text-emerald-600" />
              Your PDF is processed inside the browser and is not uploaded.
            </div>
          </section>
        </div>
      </main>
    </>
  );
}