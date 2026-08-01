"use client";

import Navbar from "@/components/Navbar";
import {
  Download,
  FilePlus2,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";

export default function MergePdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []).filter(
      (file) => file.type === "application/pdf",
    );

    setFiles((currentFiles) => [...currentFiles, ...selectedFiles]);
    setError("");
    event.target.value = "";
  }

  function removeFile(indexToRemove: number) {
    setFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove),
    );
    setError("");
  }

  async function mergePdfFiles() {
    if (files.length < 2) {
      setError("Please select at least two PDF files.");
      return;
    }

    setIsMerging(true);
    setError("");

    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const fileBytes = await file.arrayBuffer();
        const sourcePdf = await PDFDocument.load(fileBytes);
        const copiedPages = await mergedPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices(),
        );

        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], {
        type: "application/pdf",
      });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = "pdfnova-merged.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);
    } catch (mergeError) {
      console.error(mergeError);
      setError(
        "The PDF files could not be merged. One of the files may be damaged or password-protected.",
      );
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
              Merge PDF
            </p>

            <h1 className="mt-3 text-4xl font-extrabold text-gray-900 md:text-6xl">
              Combine multiple PDFs into one file
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">
              Upload two or more PDF files, arrange them in the correct order,
              and download one merged document.
            </p>
          </div>

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-10">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={handleFileSelection}
            />

            <div className="rounded-3xl border-2 border-dashed border-blue-300 bg-blue-50 px-6 py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <Upload size={30} />
              </div>

              <h2 className="mt-6 text-2xl font-bold text-gray-900">
                Select PDF files
              </h2>

              <p className="mt-3 text-gray-600">
                Choose at least two PDF files from your computer.
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                <FilePlus2 size={20} />
                Choose PDF Files
              </button>

              <p className="mt-4 text-sm text-gray-500">
                Maximum file size: 25 MB per file
              </p>
            </div>

            {files.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-bold text-gray-900">
                  Selected files ({files.length})
                </h2>

                <div className="mt-4 space-y-3">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
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

                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="ml-4 rounded-xl p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={mergePdfFiles}
                  disabled={isMerging}
                  className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-6 py-4 font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isMerging ? (
                    <>
                      <LoaderCircle size={20} className="animate-spin" />
                      Merging PDFs...
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      Merge and Download PDF
                    </>
                  )}
                </button>
              </div>
            )}

            {error && (
              <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
              <ShieldCheck size={18} className="text-emerald-600" />
              Files are merged inside your browser and are not uploaded.
            </div>
          </section>
        </div>
      </main>
    </>
  );
}