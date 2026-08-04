"use client";

import ActionButton from "@/components/pdf/ActionButton";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ToolLayout from "@/components/pdf/ToolLayout";
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

const wordToPdfTips = [
  {
    title: "Use a genuine DOCX file",
    description:
      "Files renamed from older DOC formats may not contain readable DOCX content.",
  },
  {
    title: "Text-based documents work best",
    description:
      "Scanned pages and image-only documents need OCR before their text can be converted.",
  },
  {
    title: "Review complex formatting",
    description:
      "Tables, text boxes, images, headers, footers, and custom fonts may not match Microsoft Word exactly.",
  },
];

const wordToPdfFaqs = [
  {
    question: "Does PDFNova preserve all Word formatting?",
    answer:
      "This browser version preserves readable text and paragraph structure. Complex formatting may not be retained exactly.",
  },
  {
    question: "Why does an image-only Word document fail?",
    answer:
      "The converter needs extractable text. Image-only or scanned documents require OCR support.",
  },
  {
    question: "Is my Word file uploaded?",
    answer:
      "No. The document is processed locally inside your browser.",
  },
];

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
    <ToolLayout
      label="Word to PDF"
      title="Convert a Word document into PDF"
      description="Upload a DOCX file and create a clean, downloadable PDF directly inside your private PDFNova workspace."
      tips={wordToPdfTips}
      faqs={wordToPdfFaqs}
      maxWidthClassName="max-w-6xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        multiple={false}
        title="Select one Word document"
        description="Choose or drag the DOCX file you want to convert."
        buttonText="Choose DOCX File"
        helperText="Supported format: DOCX · Maximum file size: 25 MB"
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={removeFile}
            removeLabel="Remove Word document"
            statusText="Ready for Word to PDF conversion"
          />

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Browser conversion notice
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-700 dark:text-amber-300">
              This version preserves readable text and paragraph structure.
              Complex tables, images, headers, footers, custom fonts, and exact
              Microsoft Word formatting may not be retained.
            </p>
          </div>

          <ActionButton
            isLoading={isConverting}
            loadingText="Converting Word to PDF..."
            loadingSubtitle="Extracting document text and preparing the PDF."
            buttonText="Convert and Download PDF"
            subtitle="Create and download a PDF directly in your browser."
            onClick={handleConvert}
          />
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Your Word document is processed locally and is not uploaded.
      </div>
    </ToolLayout>
  );
}