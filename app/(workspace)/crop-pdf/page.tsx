"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import {
  loadPdfWithoutMetadataMutation,
  savePdfWithoutFormAppearanceMutation,
} from "@/lib/pdf/safeDocument";
import { calculateVisibleCropBox } from "@/lib/pdf/cropGeometry";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { saveDerivedPdfToWorkspace } from "@/lib/storage/workspaceContinuity";
import { Crop, ShieldCheck, TriangleAlert } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const POINTS_PER_MM = 72 / 25.4;
const MIN_VISIBLE_POINTS = 36;

type CropMargins = {
  top: string;
  right: string;
  bottom: string;
  left: string;
};

const EMPTY_MARGINS: CropMargins = {
  top: "0",
  right: "0",
  bottom: "0",
  left: "0",
};

const tips = [
  {
    title: "Crop the same margins from every page",
    description:
      "Enter top, right, bottom, and left margins in millimeters. Kukureku applies them to each page.",
  },
  {
    title: "Use small values first",
    description:
      "Try 5–10 mm when trimming white borders, then review the downloaded result.",
  },
  {
    title: "Cropping is not redaction",
    description:
      "Crop changes the visible page area but does not securely erase content outside the crop box.",
  },
];

const faqs = [
  {
    question: "Does Crop PDF permanently delete hidden content?",
    answer:
      "No. Cropping changes the visible page area. Content outside the crop box may still exist inside the PDF, so do not use cropping to hide sensitive information.",
  },
  {
    question: "Can I crop different pages by different amounts?",
    answer:
      "This focused tool applies one set of margins to every page. A future visual crop workflow may support page-by-page cropping.",
  },
  {
    question: "Is my PDF uploaded?",
    answer:
      "No. The crop operation runs locally inside your browser.",
  },
];

function parseMargin(value: string, label: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} margin must be 0 mm or more.`);
  }

  if (parsed > 500) {
    throw new Error(`${label} margin is too large.`);
  }

  return parsed * POINTS_PER_MM;
}

export default function CropPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [margins, setMargins] = useState<CropMargins>(EMPTY_MARGINS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (
      !selectedFile ||
      (selectedFile.type !== "application/pdf" &&
        !selectedFile.name.toLowerCase().endsWith(".pdf"))
    ) {
      const message = "Please select a valid PDF file.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      const message = "The PDF file must not be larger than 25 MB.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    try {
      const pdf = await loadPdfWithoutMetadataMutation(await selectedFile.arrayBuffer());
      const count = pdf.getPageCount();

      if (count === 0) {
        throw new Error("The PDF does not contain any pages.");
      }

      setFile(selectedFile);
      setPageCount(count);
      setMargins(EMPTY_MARGINS);
      resetResult();

      toast.success(`${count} ${count === 1 ? "page" : "pages"} ready to crop.`);
    } catch {
      const message =
        "Unable to open this PDF. It may be damaged or password-protected.";
      setFile(null);
      setPageCount(0);
      setErrorMessage(message);
      toast.error(message);
    }
  }

  function setAllMargins(value: string) {
    setMargins({
      top: value,
      right: value,
      bottom: value,
      left: value,
    });
    resetResult();
  }

  function updateMargin(side: keyof CropMargins, value: string) {
    setMargins((current) => ({
      ...current,
      [side]: value,
    }));
    resetResult();
  }

  function startAgain() {
    setFile(null);
    setPageCount(0);
    setMargins(EMPTY_MARGINS);
    resetResult();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function cropPdf() {
    if (!file) {
      setErrorMessage("Please select a PDF file.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const top = parseMargin(margins.top, "Top");
      const right = parseMargin(margins.right, "Right");
      const bottom = parseMargin(margins.bottom, "Bottom");
      const left = parseMargin(margins.left, "Left");

      if (top === 0 && right === 0 && bottom === 0 && left === 0) {
        throw new Error("Enter at least one crop margin greater than 0 mm.");
      }

      const pdf = await loadPdfWithoutMetadataMutation(await file.arrayBuffer());

      pdf.getPages().forEach((page, index) => {
        const box = page.getCropBox();

        try {
          const cropped =
            calculateVisibleCropBox(
              box,
              page.getRotation().angle,
              {
                top,
                right,
                bottom,
                left,
              },
              MIN_VISIBLE_POINTS,
            );

          page.setCropBox(
            cropped.x,
            cropped.y,
            cropped.width,
            cropped.height,
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes(
              "too little visible page area",
            )
          ) {
            throw new Error(
              `The crop margins are too large for page ${index + 1}. Reduce the margins and try again.`,
            );
          }

          throw error;
        }
      });

      const bytes = await savePdfWithoutFormAppearanceMutation(pdf);
      const baseName = file.name.replace(/\.pdf$/i, "") || "kukureku";
      const generatedFileName = `${baseName}-cropped.pdf`;

      downloadFile(bytes, generatedFileName, "application/pdf");

      setOutputBytes(bytes);
      setOutputFileName(generatedFileName);

      addRecentFile({
        fileName: generatedFileName,
        toolName: "Crop PDF",
      });

      await saveDerivedPdfToWorkspace({
        sourceFile: file,
        outputBytes: bytes,
        outputFileName: generatedFileName,
        operationId: "crop-pdf",
        operationLabel: "Crop PDF",
      });

      toast.success("PDF cropped successfully.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The PDF could not be cropped.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ToolLayout
      label="Crop PDF"
      title="Crop PDF pages privately"
      description="Trim visible margins from every PDF page directly in your browser. Enter crop amounts in millimeters and download a separate cropped copy."
      tips={tips}
      faqs={faqs}
      howToTitle="How to crop a PDF"
      howToSteps={[
        {
          title: "Choose one PDF",
          description:
            "Select the PDF you want to crop, up to 25 MB.",
        },
        {
          title: "Set crop margins",
          description:
            "Enter the number of millimeters to trim from the top, right, bottom, and left sides.",
        },
        {
          title: "Crop and download",
          description:
            "Apply the visible crop locally in your browser and download the new PDF.",
        },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag the PDF you want to crop."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={isProcessing ? undefined : startAgain}
            removeLabel="Remove PDF"
            statusText={
              isProcessing
                ? "Cropping PDF pages"
                : outputBytes
                  ? "Cropped PDF created successfully"
                  : `${pageCount} ${pageCount === 1 ? "page" : "pages"} ready to crop`
            }
          />

          {!outputBytes && (
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <Crop size={22} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white">
                    Crop margins
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-slate-400">
                    Enter the amount to hide from each edge. The same values are applied to every page.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {([
                  ["top", "Top"],
                  ["right", "Right"],
                  ["bottom", "Bottom"],
                  ["left", "Left"],
                ] as const).map(([side, label]) => (
                  <label
                    key={side}
                    className="text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    {label} margin (mm)
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="500"
                      step="1"
                      value={margins[side]}
                      onChange={(event) =>
                        updateMargin(side, event.target.value)
                      }
                      disabled={isProcessing}
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAllMargins("5")}
                  disabled={isProcessing}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  5 mm all sides
                </button>

                <button
                  type="button"
                  onClick={() => setAllMargins("10")}
                  disabled={isProcessing}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  10 mm all sides
                </button>

                <button
                  type="button"
                  onClick={() => setAllMargins("0")}
                  disabled={isProcessing}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Reset margins
                </button>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <TriangleAlert size={19} className="mt-0.5 shrink-0" />
                <p>
                  Cropping changes what PDF viewers display, but it does not securely erase hidden content outside the crop area. Use a true redaction tool for sensitive information.
                </p>
              </div>
            </section>
          )}

          {!outputBytes && !errorMessage && (
            <ActionButton
              isLoading={isProcessing}
              loadingText="Cropping PDF..."
              loadingSubtitle="Applying the selected visible margins to every page."
              buttonText="Crop and Download PDF"
              subtitle="Creates a separate cropped copy. Your original file stays unchanged."
              onClick={cropPdf}
              disabled={isProcessing}
            />
          )}

          {!isProcessing && outputBytes && (
            <SuccessCard
              title="Your cropped PDF is ready"
              description="The selected visible margins were applied successfully."
              fileName={outputFileName}
              onDownloadAgain={() =>
                downloadFile(
                  outputBytes,
                  outputFileName,
                  "application/pdf",
                )
              }
              onStartAgain={startAgain}
              downloadLabel="Download Cropped PDF Again"
              resetLabel="Crop Another PDF"
            />
          )}

          {!isProcessing && errorMessage && (
            <ErrorCard
              title="PDF crop needs attention"
              description={errorMessage}
              reasons={[
                "One or more crop margins may be too large.",
                "The PDF may be damaged or password-protected.",
                "The selected PDF may contain unusually small pages.",
              ]}
              onRetry={file ? cropPdf : undefined}
              onReset={startAgain}
              retryLabel="Retry Crop"
              resetLabel="Choose Another PDF"
            />
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck size={18} className="shrink-0 text-emerald-600" />
        Your PDF is cropped locally inside your browser and is not uploaded.
      </div>
    </ToolLayout>
  );
}
