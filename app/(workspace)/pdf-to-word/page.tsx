"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ProgressCard from "@/components/pdf/ProgressCard";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { convertPdfToWord } from "@/lib/converters/pdfToWord";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck } from "lucide-react";
import { saveAs } from "file-saver";
import {
  ChangeEvent,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const pdfToWordTips = [
  {
    title: "Use a text-based PDF",
    description:
      "PDFs containing selectable text provide the best conversion results.",
  },
  {
    title: "Scanned PDFs need OCR",
    description:
      "Image-only and scanned documents cannot be converted until OCR support is added.",
  },
  {
    title: "Review the Word document",
    description:
      "Complex layouts, tables, columns, images, fonts, and spacing may not match the original PDF exactly.",
  },
];

const pdfToWordFaqs = [
  {
    question: "Will the Word file look exactly like the PDF?",
    answer:
      "This browser version extracts readable text and places it into an editable Word document. Complex formatting and page layout may not be preserved exactly.",
  },
  {
    question: "Why does a scanned PDF fail?",
    answer:
      "A scanned PDF usually contains page images rather than selectable text. OCR is required to recognize that text.",
  },
  {
    question: "Is my PDF uploaded?",
    answer:
      "No. The selected PDF is processed locally inside your browser.",
  },
];

const processingSteps = [
  {
    label: "Reading PDF",
    description:
      "Opening the selected PDF and checking its pages.",
  },
  {
    label: "Extracting text",
    description:
      "Reading selectable text and rebuilding paragraphs.",
  },
  {
    label: "Creating Word document",
    description:
      "Generating the editable DOCX file for download.",
  },
];

function isValidPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export default function PdfToWordPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [isConverting, setIsConverting] =
    useState(false);

  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] =
    useState(1);

  const [outputBlob, setOutputBlob] =
    useState<Blob | null>(null);

  const [outputFileName, setOutputFileName] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  function resetResultState() {
    setOutputBlob(null);
    setOutputFileName("");
    setErrorMessage("");
    setProgress(0);
    setCurrentStep(1);
  }

  function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0];

    if (
      !selectedFile ||
      !isValidPdf(selectedFile)
    ) {
      const message =
        "Please select a valid PDF file.";

      setErrorMessage(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      const message =
        "The PDF file must not be larger than 25 MB.";

      setErrorMessage(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    resetResultState();
    event.target.value = "";

    toast.success("PDF file selected.");
  }

  function removeFile() {
    setFile(null);
    resetResultState();

    toast.success("PDF file removed.");
  }

  function startAgain() {
    setFile(null);
    resetResultState();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function downloadWordAgain() {
    if (!outputBlob || !outputFileName) {
      toast.error(
        "The Word document is no longer available.",
      );
      return;
    }

    saveAs(outputBlob, outputFileName);

    toast("Download started", {
      description:
        "Your Word document is being downloaded again.",
    });
  }

  async function handleConvert() {
    if (!file) {
      const message =
        "Please select a PDF file.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsConverting(true);
    setErrorMessage("");
    setOutputBlob(null);
    setOutputFileName("");
    setProgress(12);
    setCurrentStep(1);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 180),
      );

      setProgress(35);
      setCurrentStep(2);

      const wordBlob =
        await convertPdfToWord(file);

      setProgress(82);
      setCurrentStep(3);

      const originalName =
        file.name.replace(/\.pdf$/i, "");

      const generatedFileName = `${
        originalName || "pdfnova-document"
      }.docx`;

      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      saveAs(wordBlob, generatedFileName);

      setOutputBlob(wordBlob);
      setOutputFileName(generatedFileName);
      setProgress(100);

      addRecentFile({
        fileName: generatedFileName,
        toolName: "PDF to Word",
      });

      toast.success(
        "PDF converted to Word successfully!",
      );

      toast("Download started", {
        description:
          "Your Word document is being downloaded.",
      });
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "The PDF could not be converted to Word.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <ToolLayout
      label="PDF to Word"
      title="Convert PDF documents into Word files"
      description="Upload a text-based PDF, extract its readable content, and download an editable DOCX document from your private PDFNova workspace."
      tips={pdfToWordTips}
      faqs={pdfToWordFaqs}
      maxWidthClassName="max-w-6xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF document"
        description="Choose or drag the PDF you want to convert into Word."
        buttonText="Choose PDF File"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isConverting}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              isConverting
                ? undefined
                : removeFile
            }
            removeLabel="Remove PDF document"
            statusText={
              isConverting
                ? "PDF to Word conversion in progress"
                : outputBlob
                  ? "Word document created successfully"
                  : errorMessage
                    ? "Conversion needs attention"
                    : "Ready for PDF to Word conversion"
            }
            progress={
              isConverting
                ? progress
                : undefined
            }
          />

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Text extraction notice
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-700 dark:text-amber-300">
              This version converts selectable PDF
              text into an editable Word document.
              Scanned pages, images, tables, columns,
              fonts, and complex layouts may not be
              preserved exactly.
            </p>
          </div>

          {isConverting && (
            <ProgressCard
              title="Converting PDF to Word"
              description="PDFNova is extracting readable text and creating your editable DOCX document."
              progress={progress}
              currentStep={currentStep}
              steps={processingSteps}
              estimatedTime="A few seconds"
            />
          )}

          {!isConverting &&
            outputBlob && (
              <SuccessCard
                title="Your Word document is ready"
                description="The selectable PDF text was converted successfully and downloaded as an editable DOCX file."
                fileName={outputFileName}
                onDownloadAgain={
                  downloadWordAgain
                }
                onStartAgain={startAgain}
                downloadLabel="Download Word Again"
                resetLabel="Convert Another PDF"
              />
            )}

          {!isConverting &&
            errorMessage && (
              <ErrorCard
                title="PDF to Word conversion failed"
                description={errorMessage}
                reasons={[
                  "The PDF may contain only scanned images and no selectable text.",
                  "The PDF may be damaged or password-protected.",
                  "The document may use unsupported text encoding or complex objects.",
                ]}
                onRetry={handleConvert}
                onReset={startAgain}
                retryLabel="Retry Conversion"
                resetLabel="Choose Another PDF"
              />
            )}

          {!isConverting &&
            !outputBlob &&
            !errorMessage && (
              <ActionButton
                isLoading={false}
                loadingText="Converting PDF to Word..."
                loadingSubtitle="Extracting readable text and preparing the DOCX document."
                buttonText="Convert and Download Word"
                subtitle="Create an editable DOCX file directly inside your browser."
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
        Your PDF is processed locally and is not
        uploaded.
      </div>
    </ToolLayout>
  );
}