"use client";

import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ProgressCard from "@/components/pdf/ProgressCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import {
  analyzePdfV4,
  type PdfEngineV4Result,
  type PdfV4TableAnalysis,
} from "@/lib/pdf-engine-v4/pipeline/analyzePdfV4";
import {
  Braces,
  Clock3,
  Columns3,
  FileText,
  Gauge,
  Grid3X3,
  Rows3,
  ScanSearch,
  ShieldCheck,
  Table2,
  Wrench,
} from "lucide-react";
import {
  ChangeEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const inspectorTips = [
  {
    title: "Use real working documents",
    description:
      "Test government reports, engineering tables, DPRs, BOQs, and official status documents.",
  },
  {
    title: "Inspect rejected columns",
    description:
      "Rejected column candidates help explain false or unstable alignments.",
  },
  {
    title: "Check repaired cells",
    description:
      "The repair panel shows any text moved between logical rows after table construction.",
  },
];

const inspectorFaqs = [
  {
    question: "Does the inspector modify the PDF?",
    answer:
      "No. It reads and analyzes the PDF without changing the original document.",
  },
  {
    question: "Is this a public PDFNova tool?",
    answer:
      "No. It is an internal development page used to test and improve PDF Engine V4.",
  },
  {
    question: "Is the PDF uploaded?",
    answer:
      "No. The analysis runs locally inside your browser.",
  },
];

const processingSteps = [
  {
    label: "Reading PDF",
    description:
      "Extracting pages, words, lines, fonts, and geometry.",
  },
  {
    label: "Analyzing structure",
    description:
      "Detecting visual blocks and possible table regions.",
  },
  {
    label: "Building logical tables",
    description:
      "Detecting columns, logical rows, cells, and repair actions.",
  },
];

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMilliseconds(value: number) {
  return `${value.toFixed(1)} ms`;
}

export default function EngineInspectorPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [result, setResult] =
    useState<PdfEngineV4Result | null>(null);

  const [selectedAnalysisIndex, setSelectedAnalysisIndex] =
    useState(0);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [currentStep, setCurrentStep] =
    useState(1);

  const [errorMessage, setErrorMessage] =
    useState("");

  const selectedAnalysis =
    result?.tableAnalyses[
      selectedAnalysisIndex
    ] ?? null;

  const totalRejectedColumns =
    useMemo(() => {
      return (
        result?.tableAnalyses.reduce(
          (sum, analysis) =>
            sum +
            analysis.columnDetection
              .rejectedCandidates.length,
          0,
        ) ?? 0
      );
    }, [result]);

  const totalRepairActions =
    useMemo(() => {
      return (
        result?.tableAnalyses.reduce(
          (sum, analysis) =>
            sum +
            (analysis.cellRepair?.actions.length ?? 0),
          0,
        ) ?? 0
      );
    }, [result]);

  function resetInspector() {
    setResult(null);
    setSelectedAnalysisIndex(0);
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
    resetInspector();
    setIsAnalyzing(true);
    setProgress(12);
    setCurrentStep(1);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 120),
      );

      setProgress(38);
      setCurrentStep(2);

      const analysisResult =
        await analyzePdfV4(
          selectedFile,
          {
            includePossibleTableRegions: true,
          },
        );

      setProgress(82);
      setCurrentStep(3);

      await new Promise((resolve) =>
        setTimeout(resolve, 120),
      );

      setResult(analysisResult);
      setProgress(100);

      toast.success(
        "PDF Engine V4 analysis completed.",
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "PDF Engine V4 could not analyze this document.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
      event.target.value = "";
    }
  }

  function removeFile() {
    setFile(null);
    resetInspector();

    toast.success("PDF file removed.");
  }

  function chooseAnotherPdf() {
    setFile(null);
    resetInspector();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <ToolLayout
      label="Developer"
      title="PDF Engine V4 Inspector"
      description="Run the complete V4 document-analysis pipeline and inspect tables, columns, logical rows, cells, repair actions, confidence scores, and timing."
      tips={inspectorTips}
      faqs={inspectorFaqs}
      maxWidthClassName="max-w-7xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF for V4 analysis"
        description="Choose or drag a government, engineering, DPR, BOQ, or official report."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isAnalyzing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              isAnalyzing
                ? undefined
                : removeFile
            }
            removeLabel="Remove PDF"
            statusText={
              isAnalyzing
                ? "PDF Engine V4 is analyzing this document"
                : result
                  ? "V4 analysis completed"
                  : errorMessage
                    ? "Analysis needs attention"
                    : "Ready for V4 analysis"
            }
            progress={
              isAnalyzing
                ? progress
                : undefined
            }
          />

          {isAnalyzing && (
            <ProgressCard
              title="Running PDF Engine V4"
              description="PDFNova is reading the document, detecting structure, building logical tables, and applying cell repair."
              progress={progress}
              currentStep={currentStep}
              steps={processingSteps}
              estimatedTime="A few seconds"
            />
          )}

          {!isAnalyzing &&
            errorMessage && (
              <ErrorCard
                title="V4 analysis failed"
                description={errorMessage}
                reasons={[
                  "The PDF may be damaged or password-protected.",
                  "The document may contain scanned images without selectable text.",
                  "The browser may not have enough memory for this document.",
                ]}
                onReset={chooseAnotherPdf}
                resetLabel="Choose Another PDF"
              />
            )}
        </div>
      )}

      {result && !isAnalyzing && (
        <div className="mt-8 space-y-8">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Engine confidence"
              value={formatConfidence(
                result.confidence,
              )}
              icon={Gauge}
            />

            <StatCard
              label="Pages"
              value={
                result.statistics.pageCount
              }
              icon={FileText}
            />

            <StatCard
              label="Logical tables"
              value={
                result.statistics
                  .logicalTableCount
              }
              icon={Table2}
            />

            <StatCard
              label="Total time"
              value={formatMilliseconds(
                result.processingTimes.totalMs,
              )}
              icon={Clock3}
            />
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <ScanSearch
                size={23}
                className="text-blue-600"
              />

              <div>
                <h2 className="text-xl font-extrabold text-gray-950 dark:text-white">
                  Pipeline statistics
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  Complete output from the V4 orchestration pipeline.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <MiniStat
                label="Words"
                value={
                  result.statistics.wordCount
                }
              />

              <MiniStat
                label="Lines"
                value={
                  result.statistics.lineCount
                }
              />

              <MiniStat
                label="Visual blocks"
                value={
                  result.statistics.blockCount
                }
              />

              <MiniStat
                label="Candidate regions"
                value={
                  result.statistics
                    .candidateTableRegionCount
                }
              />

              <MiniStat
                label="Confirmed regions"
                value={
                  result.statistics
                    .confirmedTableRegionCount
                }
              />

              <MiniStat
                label="Columns"
                value={
                  result.statistics
                    .detectedColumnCount
                }
              />

              <MiniStat
                label="Logical rows"
                value={
                  result.statistics
                    .detectedRowCount
                }
              />

              <MiniStat
                label="Populated cells"
                value={
                  result.statistics
                    .populatedCellCount
                }
              />

              <MiniStat
                label="Rejected columns"
                value={totalRejectedColumns}
              />

              <MiniStat
                label="Repair actions"
                value={totalRepairActions}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <Clock3
                size={22}
                className="text-blue-600"
              />

              <h2 className="text-xl font-extrabold text-gray-950 dark:text-white">
                Processing times
              </h2>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat
                label="PDF reader"
                value={formatMilliseconds(
                  result.processingTimes
                    .readingMs,
                )}
              />

              <MiniStat
                label="Visual blocks"
                value={formatMilliseconds(
                  result.processingTimes
                    .visualBlockDetectionMs,
                )}
              />

              <MiniStat
                label="Table analysis"
                value={formatMilliseconds(
                  result.processingTimes
                    .tableAnalysisMs,
                )}
              />

              <MiniStat
                label="Total"
                value={formatMilliseconds(
                  result.processingTimes
                    .totalMs,
                )}
              />
            </div>
          </section>

          {result.tableAnalyses.length > 0 ? (
            <>
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-extrabold text-gray-950 dark:text-white">
                  Table analyses
                </h2>

                <div className="mt-5 flex flex-wrap gap-3">
                  {result.tableAnalyses.map(
                    (analysis, index) => (
                      <button
                        key={`${analysis.pageNumber}-${analysis.blockId}`}
                        type="button"
                        onClick={() =>
                          setSelectedAnalysisIndex(
                            index,
                          )
                        }
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          selectedAnalysisIndex ===
                          index
                            ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                        }`}
                      >
                        <p className="font-bold">
                          Table {index + 1}
                        </p>

                        <p className="mt-1 text-xs opacity-75">
                          Page{" "}
                          {analysis.pageNumber}
                        </p>
                      </button>
                    ),
                  )}
                </div>
              </section>

              {selectedAnalysis && (
                <TableAnalysisPanel
                  analysis={selectedAnalysis}
                />
              )}
            </>
          ) : (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900 dark:bg-amber-950/30">
              <h2 className="text-xl font-extrabold text-amber-900 dark:text-amber-200">
                No logical table was built
              </h2>

              <p className="mt-3 text-sm leading-6 text-amber-700 dark:text-amber-300">
                The reader and visual-block stages completed, but no candidate region passed the complete table pipeline.
              </p>
            </section>
          )}

          <section className="rounded-3xl border border-gray-200 bg-slate-950 p-6 text-white shadow-sm dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Braces
                size={21}
                className="text-cyan-300"
              />

              <h2 className="text-xl font-bold">
                Complete V4 result JSON
              </h2>
            </div>

            <pre className="mt-5 max-h-[40rem] overflow-auto rounded-2xl bg-black/40 p-5 text-xs leading-6 text-slate-300">
              {JSON.stringify(
                result,
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
        The complete V4 pipeline runs locally inside your browser.
      </div>
    </ToolLayout>
  );
}

function TableAnalysisPanel({
  analysis,
}: {
  analysis: PdfV4TableAnalysis;
}) {
  const table = analysis.table;
  const repairActions =
    analysis.cellRepair?.actions ?? [];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MiniStat
          label="Region score"
          value={analysis.regionAnalysis.totalScore.toFixed(
            1,
          )}
        />

        <MiniStat
          label="Region confidence"
          value={formatConfidence(
            analysis.regionAnalysis
              .confidence,
          )}
        />

        <MiniStat
          label="Accepted columns"
          value={
            analysis.columnDetection
              .columns.length
          }
        />

        <MiniStat
          label="Logical rows"
          value={
            analysis.rowDetection.rows
              .length
          }
        />

        <MiniStat
          label="Table confidence"
          value={formatConfidence(
            analysis.table?.confidence ??
              analysis.cellBuild.confidence,
          )}
        />

        <MiniStat
          label="Repairs"
          value={repairActions.length}
        />
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Columns3
            size={21}
            className="text-blue-600"
          />

          <h3 className="text-lg font-extrabold text-gray-950 dark:text-white">
            Accepted stable columns
          </h3>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {analysis.columnDetection.columns.map(
            (column, index) => (
              <div
                key={column.id}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
              >
                <p className="font-bold text-emerald-900 dark:text-emerald-200">
                  Column {index + 1}
                </p>

                <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                  X: {column.x.toFixed(1)}
                </p>

                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  Lines:{" "}
                  {column.distinctLineCount}
                </p>

                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                  Confidence:{" "}
                  {formatConfidence(
                    column.confidence,
                  )}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-lg font-extrabold text-gray-950 dark:text-white">
          Rejected column candidates
        </h3>

        {analysis.columnDetection
          .rejectedCandidates.length > 0 ? (
          <div className="mt-5 space-y-3">
            {analysis.columnDetection.rejectedCandidates.map(
              (column) => (
                <div
                  key={column.id}
                  className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <p className="font-bold text-red-900 dark:text-red-200">
                      X:{" "}
                      {column.x.toFixed(1)}
                    </p>

                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                      Confidence:{" "}
                      {formatConfidence(
                        column.confidence,
                      )}
                    </p>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-red-700 dark:text-red-300">
                    {column.reason}
                  </p>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">
            No column candidates were rejected.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Rows3
            size={21}
            className="text-blue-600"
          />

          <h3 className="text-lg font-extrabold text-gray-950 dark:text-white">
            Adaptive logical rows
          </h3>
        </div>

        <div className="mt-5 space-y-3">
          {analysis.rowDetection.rows.map(
            (row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <p className="font-bold text-gray-950 dark:text-white">
                    Logical row{" "}
                    {row.index + 1}
                  </p>

                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                    Score: {row.score}
                  </p>
                </div>

                <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                  {row.reason}
                </p>

                <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-gray-700 dark:bg-slate-900 dark:text-slate-300">
                  {row.lines
                    .map((line) => line.text)
                    .join(" | ")}
                </p>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Wrench
            size={21}
            className="text-blue-600"
          />

          <h3 className="text-lg font-extrabold text-gray-950 dark:text-white">
            Cell Repair Engine V1
          </h3>
        </div>

        {repairActions.length > 0 ? (
          <div className="mt-5 space-y-3">
            {repairActions.map((action) => (
              <div
                key={action.id}
                className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30"
              >
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <p className="font-bold text-blue-900 dark:text-blue-200">
                    {action.type}
                  </p>

                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    Confidence:{" "}
                    {formatConfidence(
                      action.confidence,
                    )}
                  </p>
                </div>

                <p className="mt-3 text-sm font-semibold text-gray-950 dark:text-white">
                  “{action.text}”
                </p>

                <p className="mt-2 text-sm text-blue-800 dark:text-blue-300">
                  Row {action.fromRowIndex + 1},
                  Column {action.fromColumnIndex + 1}
                  {" → "}
                  Row {action.toRowIndex + 1},
                  Column {action.toColumnIndex + 1}
                </p>

                <p className="mt-2 text-sm leading-6 text-blue-700 dark:text-blue-300">
                  {action.reason}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">
            No cell repairs were applied to this table.
          </p>
        )}
        {analysis.cellRepair?.debugCandidates &&
  analysis.cellRepair.debugCandidates.length > 0 && (
    <div className="mt-6">
      <h4 className="text-base font-extrabold text-gray-950 dark:text-white">
        Repair Debug Candidates
      </h4>

      <div className="mt-4 space-y-3">
        {analysis.cellRepair.debugCandidates.map(
          (candidate, index) => (
            <div
              key={`${candidate.rowIndex}-${candidate.columnIndex}-${index}`}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950"
            >
              <p className="font-bold text-gray-950 dark:text-white">
                Row {candidate.rowIndex + 1},
                Column {candidate.columnIndex + 1}
              </p>

              <p className="mt-2 text-sm text-gray-700 dark:text-slate-300">
                {candidate.text}
              </p>

              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                <span>
                  Physical lines:{" "}
                  {candidate.physicalLineCount}
                </span>

                <span>
                  Previous:{" "}
                  {candidate.previousScore.toFixed(2)}
                </span>

                <span>
                  Next:{" "}
                  {candidate.nextScore.toFixed(2)}
                </span>

                <span>
                  Best:{" "}
                  {candidate.bestScore.toFixed(2)}
                </span>

                <span>
                  Threshold:{" "}
                  {candidate.threshold.toFixed(2)}
                </span>
              </div>

              <p className="mt-2 text-sm font-semibold">
                {candidate.accepted
                  ? "Accepted for repair"
                  : "Rejected for repair"}
              </p>
            </div>
          ),
        )}
      </div>
    </div>
  )}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Grid3X3
            size={21}
            className="text-blue-600"
          />

          <h3 className="text-lg font-extrabold text-gray-950 dark:text-white">
            Final logical table preview
          </h3>
        </div>

        {table ? (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-700">
            <table className="min-w-full border-collapse text-sm">
              <tbody>
                {table.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-200 last:border-b-0 dark:border-slate-700"
                  >
                    {row.cells.map(
                      (cell) => (
                        <td
                          key={cell.id}
                          className="min-w-44 border-r border-gray-200 px-4 py-3 align-top text-gray-700 last:border-r-0 dark:border-slate-700 dark:text-slate-300"
                        >
                          {cell.text || "—"}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500 dark:text-slate-400">
            No logical table was produced for this region.
          </p>
        )}
      </section>
    </section>
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

      <p className="mt-2 break-words font-extrabold text-gray-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}
