"use client";

import Navbar from "@/components/Navbar";
import ActionButton from "@/components/pdf/ActionButton";
import FileList from "@/components/pdf/FileList";
import FileUploader from "@/components/pdf/FileUploader";
import type { PdfFileInfo } from "@/components/pdf/PdfFileInfo";
import ToolHeader from "@/components/pdf/ToolHeader";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";

export default function MergePdfPage() {
  const [files, setFiles] = useState<PdfFileInfo[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(event.target.files ?? []).filter(
      (file) => file.type === "application/pdf",
    );

    if (selectedFiles.length === 0) {
      const message = "Please select valid PDF files.";

      setError(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    try {
      const selectedFileInfo = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileBytes = await file.arrayBuffer();
          const pdf = await PDFDocument.load(fileBytes);

          return {
            file,
            pageCount: pdf.getPageCount(),
          };
        }),
      );

      setFiles((currentFiles) => [
        ...currentFiles,
        ...selectedFileInfo,
      ]);

      setError("");

      toast.success(
        `${selectedFileInfo.length} PDF ${
          selectedFileInfo.length === 1 ? "file" : "files"
        } added successfully.`,
      );
    } catch (selectionError) {
      console.error(selectionError);

      const message =
        "One of the selected PDF files is damaged or password-protected.";

      setError(message);
      toast.error(message);
    } finally {
      event.target.value = "";
    }
  }

  function removeFile(indexToRemove: number) {
    const removedFileName = files[indexToRemove]?.file.name;

    setFiles((currentFiles) =>
      currentFiles.filter((_, index) => index !== indexToRemove),
    );

    setError("");

    if (removedFileName) {
      toast.success(`${removedFileName} removed.`);
    }
  }

  function moveFileUp(index: number) {
    if (index === 0) return;

    setFiles((currentFiles) => {
      const updatedFiles = [...currentFiles];

      [updatedFiles[index - 1], updatedFiles[index]] = [
        updatedFiles[index],
        updatedFiles[index - 1],
      ];

      return updatedFiles;
    });
  }

  function moveFileDown(index: number) {
    setFiles((currentFiles) => {
      if (index === currentFiles.length - 1) {
        return currentFiles;
      }

      const updatedFiles = [...currentFiles];

      [updatedFiles[index], updatedFiles[index + 1]] = [
        updatedFiles[index + 1],
        updatedFiles[index],
      ];

      return updatedFiles;
    });
  }

  async function mergePdfFiles() {
    if (files.length < 2) {
      const message = "Please select at least two PDF files.";

      setError(message);
      toast.error(message);
      return;
    }

    setIsMerging(true);
    setError("");

    try {
      const mergedPdf = await PDFDocument.create();

      for (const fileInfo of files) {
        const fileBytes = await fileInfo.file.arrayBuffer();
        const sourcePdf = await PDFDocument.load(fileBytes);

        const copiedPages = await mergedPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices(),
        );

        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();

      const mergedPdfBuffer = new ArrayBuffer(
        mergedPdfBytes.byteLength,
      );

      new Uint8Array(mergedPdfBuffer).set(mergedPdfBytes);

      const blob = new Blob([mergedPdfBuffer], {
        type: "application/pdf",
      });

      const outputFileName = "pdfnova-merged.pdf";
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = outputFileName;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);

      addRecentFile({
        fileName: outputFileName,
        toolName: "Merge PDF",
      });

      toast.success("PDF merged successfully!");

      toast("Download started", {
        description: "Your merged PDF is being downloaded.",
      });
    } catch (mergeError) {
      console.error(mergeError);

      const message =
        "The PDF files could not be merged. One of the files may be damaged or password-protected.";

      setError(message);
      toast.error("Failed to merge PDF files.");
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <ToolHeader
            label="Merge PDF"
            title="Combine multiple PDFs into one file"
            description="Upload two or more PDF files, arrange them in the correct order, and download one merged document."
          />

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-10">
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              title="Select PDF files"
              description="Choose at least two PDF files from your computer."
              buttonText="Choose PDF Files"
              helperText="Maximum file size: 25 MB per file"
            />

            <FileList
              files={files}
              onRemove={removeFile}
              onMoveUp={moveFileUp}
              onMoveDown={moveFileDown}
            />

            {files.length > 0 && (
              <ActionButton
                isLoading={isMerging}
                loadingText="Merging PDFs..."
                buttonText="Merge and Download PDF"
                onClick={mergePdfFiles}
              />
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