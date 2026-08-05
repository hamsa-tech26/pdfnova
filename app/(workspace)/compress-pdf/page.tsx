"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ProgressCard from "@/components/pdf/ProgressCard";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import {
  compressPdf,
  type CompressionLevel,
} from "@/lib/pdf/compress";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck, TrendingDown } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

type CompressionResult = {
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
};

const compressionOptions: {
  value: CompressionLevel;
  title: string;
  description: string;
}[] = [
  {
    value: "low",
    title: "Low",
    description: "Better compatibility",
  },
  {
    value: "medium",
    title: "Medium",
    description: "Recommended",
  },
  {
    value: "high",
    title: "High",
    description: "Maximum optimization",
  },
];

const compressionTips = [
  {
    title: "Choose the right level",
    description:
      "Medium is recommended for most documents. High may provide better optimization but can require more processing time.",
  },
  {
    title: "Some PDFs are already optimized",
    description:
      "A PDF that is already compressed may show little or no additional size reduction.",
  },
  {
    title: "Review the downloaded file",
    description:
      "Open the result once to confirm that the document remains clear and readable.",
  },
];

const compressionFaqs = [
  {
    question: "Why did the PDF size not decrease?",
    answer:
      "The PDF may already be optimized, or it may contain content that cannot be reduced further by the current browser-based compression engine.",
  },
  {
    question: "Which optimization level should I select?",
    answer:
      "Medium is recommended for most files. Low prioritizes compatibility, while High attempts maximum optimization.",
  },
  {
    question: "Is my PDF uploaded?",
    answer:
      "No. The PDF is processed locally inside your browser.",
  },
];

const compressionSteps = [
  {
    label: "Reading PDF",
    description: "Opening and validating the selected document.",
  },
  {
    label: "Optimizing document",
    description: "Applying the selected compression level.",
  },
  {
    label: "Preparing download",
    description: "Finalizing the processed PDF file.",
  },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function CompressPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] =
    useState<CompressionLevel>("medium");

  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const [result, setResult] =
    useState<CompressionResult | null>(null);

  const [outputBytes, setOutputBytes] =
    useState<Uint8Array | null>(null);

  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function resetResultState() {
    setResult(null);
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

    setFile(selectedFile);
    setCompressionLevel("medium");
    resetResultState();

    event.target.value = "";

    toast.success("PDF file added successfully.");
  }

  function removeFile() {
    setFile(null);
    setCompressionLevel("medium");
    resetResultState();

    toast.success("PDF file removed.");
  }

  function startAgain() {
    setFile(null);
    setCompressionLevel("medium");
    resetResultState();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function changeCompressionLevel(
    level: CompressionLevel,
  ) {
    setCompressionLevel(level);
    resetResultState();
  }

  function downloadResultAgain() {
    if (!outputBytes || !outputFileName) {
      toast.error("The compressed PDF is no longer available.");
      return;
    }

    downloadFile(
      outputBytes,
      outputFileName,
      "application/pdf",
    );

    toast("Download started", {
      description:
        "Your processed PDF is being downloaded again.",
    });
  }

  async function handleCompressPdf() {
    if (!file) {
      const message = "Please select a PDF file.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsCompressing(true);
    setErrorMessage("");
    setResult(null);
    setOutputBytes(null);
    setOutputFileName("");
    setProgress(15);
    setCurrentStep(1);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 180),
      );

      setProgress(38);
      setCurrentStep(2);

      const compressedResult = await compressPdf(
        file,
        compressionLevel,
      );

      setProgress(82);
      setCurrentStep(3);

      const originalName = file.name.replace(/\.pdf$/i, "");

      const generatedFileName = `${
        originalName || "pdfnova"
      }-compressed.pdf`;

      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      downloadFile(
        compressedResult.bytes,
        generatedFileName,
        "application/pdf",
      );

      setOutputBytes(compressedResult.bytes);
      setOutputFileName(generatedFileName);

      setResult({
        originalSize: compressedResult.originalSize,
        compressedSize: compressedResult.compressedSize,
        reductionPercent: compressedResult.reductionPercent,
      });

      setProgress(100);

      addRecentFile({
        fileName: generatedFileName,
        toolName: "Compress PDF",
      });

      if (
        compressedResult.compressedSize <
        compressedResult.originalSize
      ) {
        toast.success("PDF compressed successfully!");
      } else {
        toast.success("PDF processing completed.");
      }

      toast("Download started", {
        description:
          "Your processed PDF is being downloaded.",
      });
    } catch (compressionError) {
      console.error(compressionError);

      const message =
        "The PDF could not be processed. It may be damaged or password-protected.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <ToolLayout
      label="Compress PDF"
      title="Reduce the size of your PDF"
      description="Select a PDF, choose an optimization level, and create a smaller document whenever possible inside your private PDFNova workspace."
      tips={compressionTips}
      faqs={compressionFaqs}
      maxWidthClassName="max-w-6xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF file"
        description="Choose or drag the PDF document you want to optimize."
        buttonText="Choose PDF File"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isCompressing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={isCompressing ? undefined : removeFile}
            removeLabel="Remove PDF file"
            statusText={
              isCompressing
                ? "PDF compression in progress"
                : result
                  ? "PDF processing completed successfully"
                  : errorMessage
                    ? "PDF compression needs attention"
                    : "Ready for PDF compression"
            }
            progress={isCompressing ? progress : undefined}
          />

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Optimization level
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
              Choose how strongly PDFNova should attempt to optimize
              the selected document.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {compressionOptions.map((option) => {
                const isSelected =
                  compressionLevel === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isCompressing}
                    onClick={() =>
                      changeCompressionLevel(option.value)
                    }
                    className={`rounded-2xl p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      isSelected
                        ? "border-2 border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                        : "border border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    }`}
                  >
                    <p
                      className={`font-bold ${
                        isSelected
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {option.title}
                    </p>

                    <p
                      className={`mt-1 text-sm ${
                        isSelected
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-500 dark:text-slate-400"
                      }`}
                    >
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {isCompressing && (
            <ProgressCard
              title="Compressing your PDF"
              description="PDFNova is optimizing the selected document using your chosen compression level."
              progress={progress}
              currentStep={currentStep}
              steps={compressionSteps}
              estimatedTime="A few seconds"
            />
          )}

          {!isCompressing && result && outputBytes && (
            <>
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <TrendingDown size={20} />

                  <p className="font-bold">
                    Compression result
                  </p>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-4 dark:bg-slate-900">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Original size
                    </p>

                    <p className="mt-1 font-bold text-gray-900 dark:text-white">
                      {formatFileSize(result.originalSize)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-4 dark:bg-slate-900">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Resulting size
                    </p>

                    <p className="mt-1 font-bold text-gray-900 dark:text-white">
                      {formatFileSize(result.compressedSize)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-white p-4 dark:bg-slate-900">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Size reduction
                    </p>

                    <p className="mt-1 font-bold text-gray-900 dark:text-white">
                      {result.reductionPercent}%
                    </p>
                  </div>
                </div>

                {result.compressedSize >= result.originalSize && (
                  <p className="mt-4 text-sm leading-6 text-amber-700 dark:text-amber-300">
                    This PDF was already well optimized, so its file
                    size could not be reduced further.
                  </p>
                )}
              </section>

              <SuccessCard
                title="Your processed PDF is ready"
                description={
                  result.compressedSize < result.originalSize
                    ? "The PDF was optimized successfully and downloaded to your device."
                    : "The PDF was processed successfully, but it was already well optimized."
                }
                fileName={outputFileName}
                onDownloadAgain={downloadResultAgain}
                onStartAgain={startAgain}
                downloadLabel="Download PDF Again"
                resetLabel="Compress Another PDF"
              />
            </>
          )}

          {!isCompressing && errorMessage && (
            <ErrorCard
              title="PDF compression failed"
              description={errorMessage}
              reasons={[
                "The PDF may be damaged.",
                "The PDF may be password-protected.",
                "The browser may not have enough memory to process the file.",
              ]}
              onRetry={handleCompressPdf}
              onReset={startAgain}
              retryLabel="Retry Compression"
              resetLabel="Choose Another PDF"
            />
          )}

          {!isCompressing &&
            !result &&
            !errorMessage && (
              <ActionButton
                isLoading={false}
                loadingText="Processing PDF..."
                loadingSubtitle="Optimizing the document and preparing the result."
                buttonText="Compress and Download PDF"
                subtitle="Optimize the selected PDF using the chosen level."
                onClick={handleCompressPdf}
              />
            )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Your PDF is processed locally inside your browser and is not
        uploaded.
      </div>
    </ToolLayout>
  );
}