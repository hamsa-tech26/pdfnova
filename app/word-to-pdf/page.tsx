"use client";

import Navbar from "@/components/Navbar";
import ActionButton from "@/components/pdf/ActionButton";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ToolContainer from "@/components/pdf/ToolContainer";
import ToolHeader from "@/components/pdf/ToolHeader";
import { convertWordToPdf } from "@/lib/converters/wordToPdf";
import { downloadFile } from "@/lib/downloadFile";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function isValidWordFile(file: File) {
  return (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx")
  );
}

export default function WordToPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile || !isValidWordFile(selectedFile)) {
      toast.error("Please select a valid DOCX file.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("The Word file must not be larger than 25 MB.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    event.target.value = "";

    toast.success("Word document selected.");
  }

  function removeFile() {
    setFile(null);

    toast.success("Word document removed.");
  }

  async function handleConvert() {
    if (!file) {
      toast.error("Please select a Word document.");
      return;
    }

    setIsConverting(true);

    try {
      const pdfBytes = await convertWordToPdf(file);

      const originalName = file.name.replace(/\.docx$/i, "");
      const outputFileName = `${originalName || "pdfnova-document"}.pdf`;

      downloadFile(
        pdfBytes,
        outputFileName,
        "application/pdf",
      );

      addRecentFile({
        fileName: outputFileName,
        toolName: "Word to PDF",
      });

      toast.success("Word document converted successfully!");

      toast("Download started", {
        description: "Your PDF is being downloaded.",
      });
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "The Word document could not be converted.";

      toast.error(message);
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <ToolHeader
            label="Word to PDF"
            title="Convert a Word document into PDF"
            description="Upload a DOCX file and create a clean, downloadable PDF directly inside your browser."
          />

          <ToolContainer>
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              multiple={false}
              title="Select one Word document"
              description="Choose the DOCX file you want to convert."
              buttonText="Choose DOCX File"
              helperText="Supported format: DOCX · Maximum file size: 25 MB"
            />

            {file && (
              <div className="mt-8 space-y-6">
                <FileCard
                  file={file}
                  onRemove={removeFile}
                  removeLabel="Remove Word document"
                />

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <p className="font-semibold text-amber-900">
                    Browser conversion notice
                  </p>

                  <p className="mt-2 text-sm leading-6 text-amber-700">
                    This version preserves readable text and paragraph
                    structure. Complex tables, images, headers, footers, fonts,
                    and exact Microsoft Word formatting may not be retained.
                  </p>
                </div>

                <ActionButton
                  isLoading={isConverting}
                  loadingText="Converting Word to PDF..."
                  buttonText="Convert and Download PDF"
                  onClick={handleConvert}
                />
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500">
              <ShieldCheck
                size={18}
                className="shrink-0 text-emerald-600"
              />
              Your Word document is processed locally and is not uploaded.
            </div>
          </ToolContainer>
        </div>
      </main>
    </>
  );
}