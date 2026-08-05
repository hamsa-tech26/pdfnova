"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ProgressCard from "@/components/pdf/ProgressCard";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const splitPdfTips = [
  {
    title: "Use page numbers carefully",
    description:
      "Enter individual pages with commas and page ranges with hyphens, such as 1-3, 5, 8-10.",
  },
  {
    title: "Check the total page count",
    description:
      "Every selected page number must exist inside the uploaded PDF.",
  },
  {
    title: "Keep the original document",
    description:
      "PDFNova creates a separate extracted PDF and does not change the original file.",
  },
];

const splitPdfFaqs = [
  {
    question: "How do I select separate pages?",
    answer:
      "Enter the page numbers separated by commas, for example 1, 4, 7.",
  },
  {
    question: "How do I select a page range?",
    answer:
      "Use a hyphen between the first and last page, for example 2-6.",
  },
  {
    question: "Are my PDF files uploaded?",
    answer:
      "No. The PDF is processed locally inside your browser.",
  },
];

const splitSteps = [
  {
    label: "Reading PDF",
    description: "Opening the selected document and checking its pages.",
  },
  {
    label: "Extracting pages",
    description: "Copying the requested pages into a new PDF.",
  },
  {
    label: "Preparing download",
    description: "Finalizing the extracted PDF document.",
  },
];

function parsePageRange(
  range: string,
  totalPages: number,
) {
  const pageNumbers = new Set<number>();

  const parts = range
    .split(",")
    .map((part) => part.trim());

  for (const part of parts) {
    if (!part) {
      continue;
    }

    if (part.includes("-")) {
      const rangeParts = part
        .split("-")
        .map((value) => value.trim());

      if (rangeParts.length !== 2) {
        throw new Error(
          `The page range "${part}" is not valid.`,
        );
      }

      const start = Number(rangeParts[0]);
      const end = Number(rangeParts[1]);

      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end > totalPages ||
        start > end
      ) {
        throw new Error(
          `The page range "${part}" is outside the available 1-${totalPages} pages.`,
        );
      }

      for (let page = start; page <= end; page += 1) {
        pageNumbers.add(page - 1);
      }
    } else {
      const page = Number(part);

      if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > totalPages
      ) {
        throw new Error(
          `Page ${part} is outside the available 1-${totalPages} pages.`,
        );
      }

      pageNumbers.add(page - 1);
    }
  }

  return Array.from(pageNumbers).sort(
    (first, second) => first - second,
  );
}

export default function SplitPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageRange, setPageRange] = useState("");

  const [isSplitting, setIsSplitting] = useState(false);
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

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0];

    if (
      !selectedFile ||
      (selectedFile.type !== "application/pdf" &&
        !selectedFile.name.toLowerCase().endsWith(".pdf"))
    ) {
      const message = "Please select a valid PDF file.";

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

    try {
      const fileBytes = await selectedFile.arrayBuffer();
      const pdf = await PDFDocument.load(fileBytes);

      setFile(selectedFile);
      setPageCount(pdf.getPageCount());
      setPageRange("");
      resetResultState();

      toast.success("PDF file added successfully.");
    } catch (selectionError) {
      console.error(selectionError);

      const message =
        "The selected PDF may be damaged or password-protected.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      event.target.value = "";
    }
  }

  function removeFile() {
    setFile(null);
    setPageCount(0);
    setPageRange("");
    resetResultState();

    toast.success("PDF file removed.");
  }

  function startAgain() {
    setFile(null);
    setPageCount(0);
    setPageRange("");
    resetResultState();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function downloadResultAgain() {
    if (!outputBytes || !outputFileName) {
      toast.error("The extracted PDF is no longer available.");
      return;
    }

    downloadFile(
      outputBytes,
      outputFileName,
      "application/pdf",
    );

    toast("Download started", {
      description:
        "Your extracted PDF is being downloaded again.",
    });
  }

  async function splitPdfFile() {
    if (!file) {
      const message = "Please select a PDF file.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (!pageRange.trim()) {
      const message =
        "Please enter the pages you want to extract.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsSplitting(true);
    setErrorMessage("");
    setOutputBytes(null);
    setOutputFileName("");
    setProgress(15);
    setCurrentStep(1);

    try {
      const sourceBytes = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(sourceBytes);

      await new Promise((resolve) =>
        setTimeout(resolve, 180),
      );

      const selectedPageIndexes = parsePageRange(
        pageRange,
        sourcePdf.getPageCount(),
      );

      if (selectedPageIndexes.length === 0) {
        throw new Error(
          "Please select at least one valid page.",
        );
      }

      setProgress(40);
      setCurrentStep(2);

      const splitPdf = await PDFDocument.create();

      const copiedPages = await splitPdf.copyPages(
        sourcePdf,
        selectedPageIndexes,
      );

      copiedPages.forEach((page) => {
        splitPdf.addPage(page);
      });

      setProgress(82);
      setCurrentStep(3);

      const splitPdfBytes = await splitPdf.save();

      const originalName = file.name.replace(/\.pdf$/i, "");
      const generatedFileName = `${
        originalName || "pdfnova"
      }-extracted.pdf`;

      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      downloadFile(
        splitPdfBytes,
        generatedFileName,
        "application/pdf",
      );

      setOutputBytes(splitPdfBytes);
      setOutputFileName(generatedFileName);
      setProgress(100);

      addRecentFile({
        fileName: generatedFileName,
        toolName: "Split PDF",
      });

      toast.success("PDF pages extracted successfully!");

      toast("Download started", {
        description:
          "Your extracted PDF is being downloaded.",
      });
    } catch (splitError) {
      console.error(splitError);

      const message =
        splitError instanceof Error
          ? splitError.message
          : "The PDF could not be split.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSplitting(false);
    }
  }

  return (
    <ToolLayout
      label="Split PDF"
      title="Extract selected pages from your PDF"
      description="Upload one PDF, choose the pages you need, and download them as a separate document from your private PDFNova workspace."
      tips={splitPdfTips}
      faqs={splitPdfFaqs}
      maxWidthClassName="max-w-6xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF file"
        description="Choose or drag the PDF from which you want to extract pages."
        buttonText="Choose PDF File"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isSplitting}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={isSplitting ? undefined : removeFile}
            removeLabel="Remove PDF file"
            statusText={
              isSplitting
                ? "Page extraction in progress"
                : outputBytes
                  ? "Page extraction completed successfully"
                  : errorMessage
                    ? "Page extraction needs attention"
                    : `Ready to extract from ${pageCount} ${
                        pageCount === 1 ? "page" : "pages"
                      }`
            }
            progress={isSplitting ? progress : undefined}
          />

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <label
              htmlFor="page-range"
              className="text-sm font-semibold text-gray-900 dark:text-white"
            >
              Pages to extract
            </label>

            <input
              id="page-range"
              type="text"
              value={pageRange}
              disabled={isSplitting}
              onChange={(event) => {
                setPageRange(event.target.value);
                resetResultState();
              }}
              placeholder="Example: 1-3, 5, 8-10"
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
            />

            <div className="mt-3 flex flex-col gap-2 text-sm text-gray-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Use commas for separate pages and hyphens for ranges.
              </p>

              <p className="font-semibold text-blue-600 dark:text-blue-400">
                Available pages: 1-{pageCount}
              </p>
            </div>
          </div>

          {isSplitting && (
            <ProgressCard
              title="Extracting PDF pages"
              description="PDFNova is creating a new PDF from your selected page range."
              progress={progress}
              currentStep={currentStep}
              steps={splitSteps}
              estimatedTime="A few seconds"
            />
          )}

          {!isSplitting && outputBytes && (
            <SuccessCard
              title="Your extracted PDF is ready"
              description="The selected pages were copied into a new PDF and downloaded successfully."
              fileName={outputFileName}
              onDownloadAgain={downloadResultAgain}
              onStartAgain={startAgain}
              downloadLabel="Download Extracted PDF Again"
              resetLabel="Split Another PDF"
            />
          )}

          {!isSplitting && errorMessage && (
            <ErrorCard
              title="PDF page extraction failed"
              description={errorMessage}
              reasons={[
                "The entered page number may not exist in the PDF.",
                "The page range format may be incorrect.",
                "The PDF may be damaged or password-protected.",
              ]}
              onRetry={
                file && pageRange.trim()
                  ? splitPdfFile
                  : undefined
              }
              onReset={startAgain}
              retryLabel="Retry Page Extraction"
              resetLabel="Choose Another PDF"
            />
          )}

          {!isSplitting &&
            !outputBytes &&
            !errorMessage && (
              <ActionButton
                isLoading={false}
                loadingText="Creating split PDF..."
                loadingSubtitle="Extracting pages and preparing the new document."
                buttonText="Extract and Download PDF"
                subtitle="Create a new PDF using the selected pages."
                onClick={splitPdfFile}
                disabled={!pageRange.trim()}
              />
            )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Your PDF is processed locally inside your browser and is not uploaded.
      </div>
    </ToolLayout>
  );
}