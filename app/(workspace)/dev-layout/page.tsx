"use client";

import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ProgressCard from "@/components/pdf/ProgressCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import {
  analyzePdfDocumentLayout,
  type DocumentLayoutAnalysis,
} from "@/lib/layout/layoutAnalyzer";
import { readPdfPages } from "@/lib/layout/pageReader";
import type { PdfPageLayout } from "@/lib/layout/types";
import {
  Braces,
  Columns3,
  FileText,
  LayoutGrid,
  Rows3,
  ScanText,
  ShieldCheck,
} from "lucide-react";
import {
  ChangeEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const viewerTips = [
  {
    title: "Use text-based PDFs",
    description:
      "The current engine reads selectable PDF text. Scanned documents require OCR.",
  },
  {
    title: "Check confidence carefully",
    description:
      "A high score indicates consistent rows, columns, and populated cells, but does not guarantee perfect reconstruction.",
  },
  {
    title: "Use this page for debugging",
    description:
      "The viewer helps us identify incorrect rows, columns, and cells before updating PDF-to-Word.",
  },
];

const viewerFaqs = [
  {
    question: "Is this page visible to normal PDFNova users?",
    answer:
      "This is an internal developer tool used to inspect and improve the PDF layout engine.",
  },
  {
    question: "Does this page modify the PDF?",
    answer:
      "No. It only reads the PDF and displays the detected structure.",
  },
  {
    question: "Is the PDF uploaded to a server?",
    answer:
      "No. Layout analysis runs locally inside your browser.",
  },
];

const analysisSteps = [
  {
    label: "Reading PDF pages",
    description:
      "Extracting words, coordinates, dimensions, and page information.",
  },
  {
    label: "Detecting rows and columns",
    description:
      "Analyzing stable positions across the page.",
  },
  {
    label: "Building table cells",
    description:
      "Assigning words to detected rows and columns.",
  },
];

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export default function DevLayoutPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [pages, setPages] =
    useState<PdfPageLayout[]>([]);

  const [analysis, setAnalysis] =
    useState<DocumentLayoutAnalysis | null>(null);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] =
    useState(1);

  const [errorMessage, setErrorMessage] =
    useState("");

  const statistics = useMemo(() => {
    const totalWords = pages.reduce(
      (sum, page) => sum + page.words.length,
      0,
    );

    const totalLines = pages.reduce(
      (sum, page) => sum + page.lines.length,
      0,
    );

    const totalRows =
      analysis?.pages.reduce(
        (sum, page) =>
          sum + page.rowDetection.rows.length,
        0,
      ) ?? 0;

    const totalColumns =
      analysis?.pages.reduce(
        (sum, page) =>
          sum +
          page.columnDetection.columns.length,
        0,
      ) ?? 0;

    return {
      totalWords,
      totalLines,
      totalRows,
      totalColumns,
    };
  }, [pages, analysis]);

  function resetAnalysis() {
    setPages([]);
    setAnalysis(null);
    setProgress(0);
    setCurrentStep(1);
    setErrorMessage("");
  }

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0];

    if (
      !selectedFile ||
      (selectedFile.type !== "application/pdf" &&
        !selectedFile.name
          .toLowerCase()
          .endsWith(".pdf"))
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
    resetAnalysis();
    setIsAnalyzing(true);
    setProgress(15);
    setCurrentStep(1);

    try {
      const extractedPages =
        await readPdfPages(selectedFile);

      setPages(extractedPages);
      setProgress(55);
      setCurrentStep(2);

      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      const documentAnalysis =
        analyzePdfDocumentLayout(
          extractedPages,
        );

      setProgress(85);
      setCurrentStep(3);

      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      setAnalysis(documentAnalysis);
      setProgress(100);

      toast.success(
        "PDF layout analysis completed.",
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "The PDF layout could not be analyzed.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
      event.target.value = "";
    }
  }

  function removeFile() {
    setFile(null);
    resetAnalysis();

    toast.success("PDF file removed.");
  }

  function chooseAnotherFile() {
    setFile(null);
    resetAnalysis();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <ToolLayout
      label="Developer"
      title="PDF Layout Engine Viewer"
      description="Upload a PDF and inspect how PDFNova detects words, lines, rows, columns, cells, and tables."
      tips={viewerTips}
      faqs={viewerFaqs}
      maxWidthClassName="max-w-7xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF for analysis"
        description="Choose or drag a text-based PDF into the layout engine."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isAnalyzing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              isAnalyzing ? undefined : removeFile
            }
            removeLabel="Remove PDF file"
            statusText={
              isAnalyzing
                ? "Layout analysis in progress"
                : analysis
                  ? "Layout analysis completed"
                  : errorMessage
                    ? "Layout analysis needs attention"
                    : "Ready for layout analysis"
            }
            progress={
              isAnalyzing
                ? progress
                : undefined
            }
          />

          {isAnalyzing && (
            <ProgressCard
              title="Analyzing PDF structure"
              description="PDFNova is reading page geometry and building a structured layout model."
              progress={progress}
              currentStep={currentStep}
              steps={analysisSteps}
              estimatedTime="A few seconds"
            />
          )}

          {!isAnalyzing &&
            errorMessage && (
              <ErrorCard
                title="Layout analysis failed"
                description={errorMessage}
                reasons={[
                  "The PDF may be damaged or password-protected.",
                  "The PDF may contain only scanned images.",
                  "The browser may not have enough memory to analyze the document.",
                ]}
                onReset={chooseAnotherFile}
                resetLabel="Choose Another PDF"
              />
            )}
        </div>
      )}

      {analysis && !isAnalyzing && (
        <div className="mt-8 space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pages"
              value={pages.length}
              icon={FileText}
            />

            <StatCard
              label="Words"
              value={statistics.totalWords}
              icon={ScanText}
            />

            <StatCard
              label="Detected rows"
              value={statistics.totalRows}
              icon={Rows3}
            />

            <StatCard
              label="Average confidence"
              value={formatConfidence(
                analysis.averageConfidence,
              )}
              icon={LayoutGrid}
            />
          </section>

          <section className="space-y-5">
            {analysis.pages.map(
              (pageAnalysis) => {
                const page =
                  pages.find(
                    (item) =>
                      item.pageNumber ===
                      pageAnalysis.pageNumber,
                  );

                return (
                  <article
                    key={pageAnalysis.pageNumber}
                    className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="border-b border-gray-200 px-6 py-5 dark:border-slate-800">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                            Page{" "}
                            {
                              pageAnalysis.pageNumber
                            }
                          </p>

                          <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                            Layout analysis
                          </h2>
                        </div>

                        <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          Confidence:{" "}
                          {formatConfidence(
                            pageAnalysis.confidence,
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-5">
                      <MiniStat
                        label="Words"
                        value={
                          page?.words.length ?? 0
                        }
                      />

                      <MiniStat
                        label="Lines"
                        value={
                          page?.lines.length ?? 0
                        }
                      />

                      <MiniStat
                        label="Rows"
                        value={
                          pageAnalysis.rowDetection
                            .rows.length
                        }
                      />

                      <MiniStat
                        label="Columns"
                        value={
                          pageAnalysis
                            .columnDetection.columns
                            .length
                        }
                      />

                      <MiniStat
                        label="Table"
                        value={
                          pageAnalysis.table
                            ? "Detected"
                            : "Not detected"
                        }
                      />
                    </div>

                    <div className="border-t border-gray-200 p-6 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Columns3
                          size={20}
                          className="text-blue-600"
                        />

                        <h3 className="font-bold text-gray-950 dark:text-white">
                          Detected column positions
                        </h3>
                      </div>

                      {pageAnalysis.columnDetection
                        .columns.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {pageAnalysis.columnDetection.columns.map(
                            (column) => (
                              <span
                                key={column.index}
                                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                              >
                                Column{" "}
                                {column.index + 1}:{" "}
                                {column.x.toFixed(
                                  1,
                                )}
                              </span>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">
                          No stable columns were
                          detected.
                        </p>
                      )}
                    </div>

                    {pageAnalysis.table && (
                      <div className="border-t border-gray-200 p-6 dark:border-slate-800">
                        <h3 className="font-bold text-gray-950 dark:text-white">
                          Detected table cells
                        </h3>

                        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-700">
                          <table className="min-w-full border-collapse text-sm">
                            <tbody>
                              {pageAnalysis.table.rows.map(
                                (row, rowIndex) => (
                                  <tr
                                    key={rowIndex}
                                    className="border-b border-gray-200 last:border-b-0 dark:border-slate-700"
                                  >
                                    {row.cells.map(
                                      (cell) => (
                                        <td
                                          key={
                                            cell.columnIndex
                                          }
                                          className="min-w-40 border-r border-gray-200 px-4 py-3 align-top text-gray-700 last:border-r-0 dark:border-slate-700 dark:text-slate-300"
                                        >
                                          {cell.text ||
                                            "—"}
                                        </td>
                                      ),
                                    )}
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </article>
                );
              },
            )}
          </section>

          <section className="rounded-3xl border border-gray-200 bg-slate-950 p-6 text-white shadow-sm dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Braces
                size={21}
                className="text-cyan-300"
              />

              <h2 className="text-xl font-bold">
                Layout JSON
              </h2>
            </div>

            <pre className="mt-5 max-h-[34rem] overflow-auto rounded-2xl bg-black/40 p-5 text-xs leading-6 text-slate-300">
              {JSON.stringify(
                analysis,
                null,
                2,
              )}
            </pre>
          </section>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        The PDF is analyzed locally inside your
        browser and is not uploaded.
      </div>
    </ToolLayout>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  icon: typeof FileText;
};

function StatCard({
  label,
  value,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
        <Icon size={22} />
      </div>

      <p className="mt-5 text-sm font-semibold text-gray-500 dark:text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-3xl font-extrabold text-gray-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

type MiniStatProps = {
  label: string;
  value: string | number;
};

function MiniStat({
  label,
  value,
}: MiniStatProps) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-extrabold text-gray-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}