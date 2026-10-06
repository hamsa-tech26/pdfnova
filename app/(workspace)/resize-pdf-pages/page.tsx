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
import {
  PDF_PAGE_SIZE_PRESETS,
  calculateProportionalFitScale,
  resolveResizeTarget,
  type PdfPageSizePreset,
  type PdfResizeOrientation,
} from "@/lib/pdf/resizePageGeometry";
import { addRecentFile } from "@/lib/storage/recentFiles";
import {
  FileOutput,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";

import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const tips = [
  {
    title: "Choose a standard page size",
    description:
      "Resize all pages to A4, Letter, Legal, or A5 with one consistent setting.",
  },
  {
    title: "Auto keeps page orientation",
    description:
      "Auto mode matches each page's visible portrait or landscape orientation, including rotated pages.",
  },
  {
    title: "Content is fitted proportionally",
    description:
      "Kukureku scales page content and common annotations together without stretching the page artwork.",
  },
];

const faqs = [
  {
    question: "Will resizing stretch my PDF content?",
    answer:
      "No. Kukureku uses one proportional scale factor so the original aspect ratio is preserved. Extra page area can remain on the top or right when aspect ratios differ.",
  },
  {
    question: "Are annotations preserved?",
    answer:
      "Kukureku scales common PDF annotations together with page content. Complex interactive forms or unusual annotation types should still be reviewed after download.",
  },
  {
    question: "Is my PDF uploaded?",
    answer:
      "No. Page resizing runs locally inside your browser.",
  },
];

export default function ResizePdfPagesPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [preset, setPreset] =
    useState<PdfPageSizePreset>("a4");
  const [orientation, setOrientation] =
    useState<PdfResizeOrientation>("auto");

  const [isProcessing, setIsProcessing] =
    useState(false);
  const [outputBytes, setOutputBytes] =
    useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
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
      const message =
        "The PDF file must not be larger than 25 MB.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    try {
      const pdf = loadPdfWithoutMetadataMutation(
        await selectedFile.arrayBuffer(),
      );

      const count = pdf.getPageCount();

      if (count === 0) {
        throw new Error(
          "The PDF does not contain any pages.",
        );
      }

      setFile(selectedFile);
      setPageCount(count);
      setPreset("a4");
      setOrientation("auto");
      resetResult();

      toast.success(
        `${count} ${count === 1 ? "page" : "pages"} ready to resize.`,
      );
    } catch {
      const message =
        "Unable to open this PDF. It may be damaged or password-protected.";

      setFile(null);
      setPageCount(0);
      setErrorMessage(message);
      toast.error(message);
    }
  }

  function startAgain() {
    setFile(null);
    setPageCount(0);
    setPreset("a4");
    setOrientation("auto");
    resetResult();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function resizePdfPages() {
    if (!file) {
      setErrorMessage("Please select a PDF file.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");
    setOutputBytes(null);
    setOutputFileName("");

    try {
      const pdf = loadPdfWithoutMetadataMutation(
        await file.arrayBuffer(),
      );

      const pages = pdf.getPages();

      for (const page of pages) {
        const sourceWidth = page.getWidth();
        const sourceHeight = page.getHeight();
        const rotationAngle =
          page.getRotation().angle;

        const target = resolveResizeTarget(
          preset,
          orientation,
          sourceWidth,
          sourceHeight,
          rotationAngle,
        );

        const scale =
          calculateProportionalFitScale(
            sourceWidth,
            sourceHeight,
            target.width,
            target.height,
          );

        page.scale(scale, scale);
        page.setSize(
          target.width,
          target.height,
        );
      }

      const bytes = await savePdfWithoutFormAppearanceMutation(pdf);

      const baseName =
        file.name.replace(/\.pdf$/i, "") ||
        "kukureku";

      const generatedFileName =
        `${baseName}-${preset}-resized.pdf`;

      downloadFile(
        bytes,
        generatedFileName,
        "application/pdf",
      );

      setOutputBytes(bytes);
      setOutputFileName(generatedFileName);

      addRecentFile({
        fileName: generatedFileName,
        toolName: "Resize PDF Pages",
      });

      toast.success(
        "PDF pages resized successfully.",
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "The PDF pages could not be resized.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }

  const selectedPreset =
    PDF_PAGE_SIZE_PRESETS[preset];

  return (
    <ToolLayout
      label="Resize PDF Pages"
      title="Resize PDF pages privately"
      description="Resize every PDF page to A4, Letter, Legal, or A5 while fitting page content proportionally. Processing stays inside your browser."
      tips={tips}
      faqs={faqs}
      howToTitle="How to resize PDF pages"
      howToSteps={[
        {
          title: "Choose one PDF",
          description:
            "Select the PDF you want to resize, up to 25 MB.",
        },
        {
          title: "Choose size and orientation",
          description:
            "Select A4, Letter, Legal, or A5 and choose Auto, Portrait, or Landscape.",
        },
        {
          title: "Resize and download",
          description:
            "Fit the page content proportionally and download the resized PDF copy.",
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
        description="Choose or drag the PDF whose page size you want to standardize."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              isProcessing
                ? undefined
                : startAgain
            }
            removeLabel="Remove PDF"
            statusText={
              isProcessing
                ? "Resizing PDF pages"
                : outputBytes
                  ? "Resized PDF created successfully"
                  : `${pageCount} ${pageCount === 1 ? "page" : "pages"} ready`
            }
          />

          {!outputBytes && (
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <FileOutput size={22} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white">
                    Output page size
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-slate-400">
                    Page artwork is fitted proportionally. The original rotation is preserved.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  Object.entries(
                    PDF_PAGE_SIZE_PRESETS,
                  ) as [
                    PdfPageSizePreset,
                    (typeof PDF_PAGE_SIZE_PRESETS)[PdfPageSizePreset],
                  ][]
                ).map(([value, size]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setPreset(value);
                      resetResult();
                    }}
                    disabled={isProcessing}
                    className={`rounded-2xl border p-4 text-left transition ${
                      preset === value
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/40"
                        : "border-gray-200 hover:border-blue-300 dark:border-slate-700"
                    }`}
                  >
                    <p className="font-bold text-gray-950 dark:text-white">
                      {size.label}
                    </p>

                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      {Math.round(
                        size.width,
                      )} × {Math.round(
                        size.height,
                      )} pt
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-7">
                <p className="text-sm font-bold text-gray-950 dark:text-white">
                  Orientation
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {([
                    [
                      "auto",
                      "Auto",
                      "Match each page's visible orientation.",
                    ],
                    [
                      "portrait",
                      "Portrait",
                      "Use portrait output pages.",
                    ],
                    [
                      "landscape",
                      "Landscape",
                      "Use landscape output pages.",
                    ],
                  ] as const).map(
                    ([
                      value,
                      label,
                      description,
                    ]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setOrientation(
                            value,
                          );
                          resetResult();
                        }}
                        disabled={
                          isProcessing
                        }
                        className={`rounded-2xl border p-4 text-left transition ${
                          orientation ===
                          value
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/40"
                            : "border-gray-200 hover:border-blue-300 dark:border-slate-700"
                        }`}
                      >
                        <p className="font-bold text-gray-950 dark:text-white">
                          {label}
                        </p>

                        <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-slate-400">
                          {description}
                        </p>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-950 dark:bg-blue-950/30 dark:text-blue-200">
                Selected:{" "}
                <strong>
                  {selectedPreset.label}
                </strong>{" "}
                ·{" "}
                <strong>
                  {orientation === "auto"
                    ? "Auto orientation"
                    : orientation ===
                        "portrait"
                      ? "Portrait"
                      : "Landscape"}
                </strong>
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <TriangleAlert
                  size={19}
                  className="mt-0.5 shrink-0"
                />

                <p>
                  Common annotations are scaled with the page content, but complex forms and unusual annotations should be reviewed after download. When page aspect ratios differ, unused space may remain at the top or right instead of stretching content.
                </p>
              </div>
            </section>
          )}

          {!outputBytes &&
            !errorMessage && (
              <ActionButton
                isLoading={isProcessing}
                loadingText="Resizing PDF pages..."
                loadingSubtitle="Fitting content and annotations proportionally to the selected page size."
                buttonText="Resize and Download PDF"
                subtitle="Creates a separate resized copy. Your original PDF stays unchanged."
                onClick={resizePdfPages}
                disabled={isProcessing}
              />
            )}

          {!isProcessing &&
            outputBytes && (
              <SuccessCard
                title="Your resized PDF is ready"
                description="The selected standard page size was applied successfully."
                fileName={outputFileName}
                onDownloadAgain={() =>
                  downloadFile(
                    outputBytes,
                    outputFileName,
                    "application/pdf",
                  )
                }
                onStartAgain={startAgain}
                downloadLabel="Download Resized PDF Again"
                resetLabel="Resize Another PDF"
              />
            )}

          {!isProcessing &&
            errorMessage && (
              <ErrorCard
                title="PDF resize needs attention"
                description={
                  errorMessage
                }
                reasons={[
                  "The PDF may be damaged or password-protected.",
                  "A page may use an unusual page box or annotation structure.",
                  "Your browser may not have enough memory for this document.",
                ]}
                onRetry={
                  file
                    ? resizePdfPages
                    : undefined
                }
                onReset={startAgain}
                retryLabel="Retry Resize"
                resetLabel="Choose Another PDF"
              />
            )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Your PDF is resized locally inside your browser and is not uploaded.
      </div>
    </ToolLayout>
  );
}
