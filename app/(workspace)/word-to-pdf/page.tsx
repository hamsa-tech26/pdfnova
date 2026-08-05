"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ProgressCard from "@/components/pdf/ProgressCard";
import SuccessCard from "@/components/pdf/SuccessCard";
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

const processingSteps = [
  {
    label: "Reading Word document",
    description: "Extracting readable content from the selected DOCX file.",
  },
  {
    label: "Creating PDF pages",
    description: "Formatting paragraphs and generating the PDF document.",
  },
  {
    label: "Preparing download",
    description: "Finalizing your PDF and preparing it for download.",
  },
];

export default function WordToPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const [outputBytes, setOutputBytes] =
    useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function resetResultState() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
    setProgress(0);
    setCurrentStep(1);
  }

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
    resetResultState();
    event.target.value = "";

    toast.success("Word document selected.");
  }

  function removeFile() {
    setFile(null);
    resetResultState();

    toast.success("Word document removed.");
  }

  function startAgain() {
    setFile(null);
    resetResultState();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function downloadResultAgain() {
    if (!outputBytes || !outputFileName) {
      toast.error("The converted PDF is no longer available.");
      return;
    }

    downloadFile(
      outputBytes,
      outputFileName,
      "application/pdf",
    );

    toast("Download started", {
      description: "Your converted PDF is being downloaded again.",
    });
  }

  async function handleConvert() {
    if (!file) {
      toast.error("Please select a Word document.");
      return;
    }

    setIsConverting(true);
    setErrorMessage("");
    setOutputBytes(null);
    setOutputFileName("");
    setProgress(15);
    setCurrentStep(1);

    try {
      await new Promise((resolve) => setTimeout(resolve, 250));

      setProgress(38);
      setCurrentStep(2);

      const pdfBytes = await convertWordToPdf(file);

      setProgress(82);
      setCurrentStep(3);

      const originalName = file.name.replace(/\.docx$/i, "");
      const generatedFileName = `${
        originalName || "pdfnova-document"
      }.pdf`;

      await new Promise((resolve) => setTimeout(resolve, 200));

      downloadFile(
        pdfBytes,
        generatedFileName,
        "application/pdf",
      );

      setOutputBytes(pdfBytes);
      setOutputFileName(generatedFileName);
      setProgress(100);

      addRecentFile({
        fileName: generatedFileName,
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

      setErrorMessage(message);
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
        disabled={isConverting}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={isConverting ? undefined : removeFile}
            removeLabel="Remove Word document"
            statusText={
              isConverting
                ? "Word to PDF conversion in progress"
                : outputBytes
                  ? "Conversion completed successfully"
                  : errorMessage
                    ? "Conversion needs attention"
                    : "Ready for Word to PDF conversion"
            }
            progress={isConverting ? progress : undefined}
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

          {isConverting && (
            <ProgressCard
              title="Converting Word to PDF"
              description="PDFNova is reading your document and creating the downloadable PDF."
              progress={progress}
              currentStep={currentStep}
              steps={processingSteps}
              estimatedTime="A few seconds"
            />
          )}

          {!isConverting && outputBytes && (
            <SuccessCard
              title="Your PDF is ready"
              description="The Word document was converted successfully and downloaded to your device."
              fileName={outputFileName}
              onDownloadAgain={downloadResultAgain}
              onStartAgain={startAgain}
              downloadLabel="Download PDF Again"
              resetLabel="Convert Another Document"
            />
          )}

          {!isConverting && errorMessage && (
            <ErrorCard
              title="Word to PDF conversion failed"
              description={errorMessage}
              reasons={[
                "The DOCX file may contain no readable text.",
                "The file may be damaged or may not be a genuine DOCX document.",
                "The document may contain only scanned images or unsupported objects.",
              ]}
              onRetry={handleConvert}
              onReset={startAgain}
              retryLabel="Retry Conversion"
              resetLabel="Choose Another Document"
            />
          )}

          {!isConverting && !outputBytes && !errorMessage && (
            <ActionButton
              isLoading={false}
              loadingText="Converting Word to PDF..."
              loadingSubtitle="Extracting document text and preparing the PDF."
              buttonText="Convert and Download PDF"
              subtitle="Create and download a PDF directly in your browser."
              onClick={handleConvert}
            />
          )}
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