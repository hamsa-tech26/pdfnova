"use client";

import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ProgressCard from "@/components/pdf/ProgressCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import SuspiciousCellPreview from "@/components/pdf/SuspiciousCellPreview";
import {
  analyzePdfV4,
  type PdfEngineV4Result,
  type PdfV4TableAnalysis,
} from "@/lib/pdf-engine-v4/pipeline/analyzePdfV4";

import type {
  PdfV4ControlledOcrResult,
} from "@/lib/pdf-engine-v4/ocr/controlledOcrFallback";

import {
  adaptPdfV4OcrWordToPdfWord,
} from "@/lib/pdf-engine-v4/ocr/ocrWordAdapter";

import type {
  PdfBoundingBox,
} from "@/lib/pdf-engine-v4/model/types";

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

type SelectedSource = {
  pageNumber: number;
  bounds: PdfBoundingBox;
  cellText: string;
  tableNumber: number;
  rowNumber: number;
  logicalRowIndex: number;
  columnNumber: number;
  reasons: string[];
};

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

function formatAnalysisOutcome(
  value: string,
) {
  return value
    .split("-")
    .map(
      (part, index) =>
        index === 0
          ? part.charAt(0).toUpperCase() +
            part.slice(1)
          : part,
    )
    .join(" ");
}

function formatMilliseconds(value: number) {
  return `${value.toFixed(1)} ms`;
}

export default function EngineInspectorPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const sourcePreviewRef =
  useRef<HTMLDivElement>(null);  

  const [file, setFile] =
    useState<File | null>(null);

  const [result, setResult] =
    useState<PdfEngineV4Result | null>(null);

  const [ocrResult, setOcrResult] =
    useState<PdfV4ControlledOcrResult | null>(
    null,
  );

  const [selectedAnalysisIndex, setSelectedAnalysisIndex] =
    useState(0);

  const [selectedSource, setSelectedSource] =
  useState<SelectedSource | null>(null);  

  const [
  selectedSourceIndex,
  setSelectedSourceIndex,
] = useState<number | null>(null);

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

  function jumpToSource(
  source: SelectedSource,
  sourceIndex?: number,
) {
  const resolvedIndex =
  sourceIndex ??
  getSourceIssueIndex(source);

const resolvedSource =
  resolvedIndex >= 0
    ? sourceIssues[resolvedIndex] ??
      source
    : source;

setSelectedSource(resolvedSource);

setSelectedSourceIndex(
  resolvedIndex >= 0
    ? resolvedIndex
    : null,
);

  requestAnimationFrame(() => {
    sourcePreviewRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

function navigateSourceIssue(
  direction: -1 | 1,
) {
  if (
    selectedSourceIndex === null ||
    sourceIssues.length === 0
  ) {
    return;
  }

  const nextIndex =
    selectedSourceIndex + direction;

  if (
    nextIndex < 0 ||
    nextIndex >= sourceIssues.length
  ) {
    return;
  }

  jumpToSource(
    sourceIssues[nextIndex],
    nextIndex,
  );
}

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

   const extractionQuality =
  useMemo(() => {
    if (!result) {
      return {
        totalRows: 0,
        reliableRows: 0,
        reviewRows: 0,
        reliabilityRatio: 0,
        reviewItems: [],
      };
    }

    const assessments =
  result.mergedTableReliability.flatMap(
    (
      reliability,
      analysisIndex,
    ) =>
      reliability.rows.map(
        (row) => ({
          analysisIndex,
          row,
        }),
      ),
  );

    const reliableRows =
      assessments.filter(
        ({ row }) =>
          row.status === "reliable",
      ).length;

    const reviewItems =
      assessments.filter(
        ({ row }) =>
          row.status ===
          "needs-review",
      );

    const totalRows =
      assessments.length;

    return {
      totalRows,
      reliableRows,
      reviewRows:
        reviewItems.length,
      reliabilityRatio:
        totalRows === 0
          ? 0
          : reliableRows /
            totalRows,
      reviewItems,
    };
  }, [result]); 

  const sourceIssues =
  useMemo<SelectedSource[]>(() => {
    const issues: SelectedSource[] = [];
    const seenCells =
  new Map<string, number>();

    extractionQuality.reviewItems.forEach(
      ({
        analysisIndex,
        row,
      }) => {
        const provenance =
  row.provenance;

if (!provenance) {
  return;
}

        row.reasons.forEach(
          (reason) => {
            if (
              reason.columnIndex === undefined ||
              reason.cellText === undefined ||
              !reason.cellBounds
            ) {
              return;
            }
            const cellKey = [
  analysisIndex + 1,
  row.serialNumber ?? row.rowIndex,
  provenance.pageNumber,
  reason.columnIndex + 1,
  reason.cellBounds.x,
  reason.cellBounds.y,
  reason.cellBounds.width,
  reason.cellBounds.height,
].join(":");

const existingIssueIndex =
  seenCells.get(cellKey);

if (existingIssueIndex !== undefined) {
  const existingIssue =
    issues[existingIssueIndex];

  if (
    existingIssue &&
    !existingIssue.reasons.includes(
      reason.message,
    )
  ) {
    existingIssue.reasons.push(
      reason.message,
    );
  }

  return;
}

seenCells.set(
  cellKey,
  issues.length,
);

            issues.push({
              pageNumber:
  provenance.pageNumber,
              bounds: reason.cellBounds,
              cellText: reason.cellText,
              tableNumber:
                analysisIndex + 1,
              rowNumber:
                row.serialNumber ??
                row.rowIndex,
                logicalRowIndex:
  row.rowIndex,
              columnNumber:
                reason.columnIndex + 1,
                reasons: [reason.message],
            });
          },
        );
      },
    );

    return issues;
  }, [extractionQuality.reviewItems]);

  function getSourceIssueIndex(
  source: SelectedSource,
) {
  return sourceIssues.findIndex(
    (issue) =>
      issue.pageNumber ===
        source.pageNumber &&
      issue.tableNumber ===
        source.tableNumber &&
      issue.rowNumber ===
        source.rowNumber &&
      issue.columnNumber ===
        source.columnNumber &&
      issue.cellText ===
        source.cellText,
  );
}

  function resetInspector() {
    setResult(null);
    setOcrResult(null);
    setSelectedAnalysisIndex(0);
    setSelectedSource(null);
    setSelectedSourceIndex(null);
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
      enableControlledOcr: true,
    },
  );

      setProgress(82);
      setCurrentStep(3);

      await new Promise((resolve) =>
        setTimeout(resolve, 120),
      );

      setResult(analysisResult);
      setOcrResult(
  analysisResult.controlledOcrResult ?? null,
);
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

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
  <div>
    <span className="font-semibold text-gray-500 dark:text-slate-400">
      Analysis outcome:{" "}
    </span>

    <span className="font-bold text-gray-950 dark:text-white">
      {formatAnalysisOutcome(
        result.analysisOutcome,
      )}
    </span>
  </div>

  <div className="mt-2">
    <span className="font-semibold text-gray-500 dark:text-slate-400">
      Text extraction profile:{" "}
    </span>

    <span className="font-bold text-gray-950 dark:text-white">
      {formatAnalysisOutcome(
        result.textExtractionProfile.status,
      )}
    </span>

    <span className="ml-2 text-gray-500 dark:text-slate-400">
      (
      {result.textExtractionProfile.sufficientTextPageCount} sufficient,{" "}
      {result.textExtractionProfile.lowTextPageCount} low,{" "}
      {result.textExtractionProfile.noTextPageCount} no text
      )
    </span>
  </div>
  <div className="mt-2">
  <span className="font-semibold text-gray-500 dark:text-slate-400">
    OCR decision:{" "}
  </span>

  <span className="font-bold text-gray-950 dark:text-white">
    {formatAnalysisOutcome(
      result.ocrDecision.status,
    )}
  </span>

  {result.ocrDecision.requiredPageNumbers.length >
    0 && (
    <span className="ml-2 text-gray-500 dark:text-slate-400">
      (
      OCR pages:{" "}
      {result.ocrDecision.requiredPageNumbers.join(
        ", ",
      )}
      )
    </span>
  )}

  {result.ocrDecision.reviewPageNumbers.length >
    0 && (
    <span className="ml-2 text-gray-500 dark:text-slate-400">
      (
      Review pages:{" "}
      {result.ocrDecision.reviewPageNumbers.join(
        ", ",
      )}
      )
    </span>
  )}
</div>
</div>

{ocrResult && (
  <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <h2 className="text-xl font-extrabold text-gray-950 dark:text-white">
      Controlled OCR Diagnostics
    </h2>

    <div className="mt-4 space-y-3 text-sm">
      <div>
        <span className="font-semibold text-gray-500 dark:text-slate-400">
          OCR attempted:{" "}
        </span>

        <span className="font-bold text-gray-950 dark:text-white">
          {ocrResult.attempted
            ? "Yes"
            : "No"}
        </span>
      </div>

      <div>
        <span className="font-semibold text-gray-500 dark:text-slate-400">
          Decision:{" "}
        </span>

        <span className="font-bold text-gray-950 dark:text-white">
          {formatAnalysisOutcome(
            ocrResult.decisionStatus,
          )}
        </span>
      </div>

      <div>
        <span className="font-semibold text-gray-500 dark:text-slate-400">
          Processed pages:{" "}
        </span>

        <span className="font-bold text-gray-950 dark:text-white">
          {ocrResult.processedPageNumbers.length >
          0
            ? ocrResult.processedPageNumbers.join(
                ", ",
              )
            : "None"}
        </span>
      </div>

            <div>
        <span className="font-semibold text-gray-500 dark:text-slate-400">
          Retry regions:{" "}
        </span>

        <span className="font-bold text-gray-950 dark:text-white">
          {ocrResult.retryRegions.length}
        </span>
      </div>

      {ocrResult.pages.map((page) => (
        <div
          key={page.pageNumber}
          className="rounded-2xl border border-gray-200 p-4 dark:border-slate-700"
        >
          <div className="font-bold text-gray-950 dark:text-white">
            Page {page.pageNumber}
          </div>

          <div className="mt-1 text-gray-600 dark:text-slate-400">
            OCR confidence:{" "}
            {Math.round(page.confidence)}%
          </div>

          <div className="mt-1 text-gray-600 dark:text-slate-400">
  OCR words:{" "}
  {page.words.length}
</div>

{page.words.length > 0 && (
  <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs dark:bg-slate-800">
    <div className="font-bold text-gray-950 dark:text-white">
      OCR word geometry sample
    </div>

    <div className="mt-2 space-y-1 text-gray-600 dark:text-slate-300">
      {page.words
        .slice(0, 5)
        .map(
          (word, wordIndex) => (
            <div key={wordIndex}>
              "{word.text}" —{" "}
              {Math.round(
                word.confidence,
              )}
              % — [
              {word.bounds.x0},{" "}
              {word.bounds.y0},{" "}
              {word.bounds.x1},{" "}
              {word.bounds.y1}]
            </div>
          ),
        )}
    </div>
  </div>
)}

{page.words.length > 0 &&
  result.document.pages[
    page.pageNumber - 1
  ] && (
    <div className="mt-3 rounded-xl border border-gray-200 p-3 text-xs dark:border-slate-700">
      {(() => {
        const pdfPage =
          result.document.pages[
            page.pageNumber - 1
          ];

        const pdfWord =
          adaptPdfV4OcrWordToPdfWord(
            page.words[0],
            page.pageNumber,
            0,
            page.renderedWidth,
            page.renderedHeight,
            pdfPage.width,
            pdfPage.height,
          );

        return (
          <div className="text-gray-600 dark:text-slate-300">
            PDF-space first word:{" "}
            <span className="font-bold text-gray-950 dark:text-white">
              "{pdfWord.text}"
            </span>
            {" — "}
            [
            {pdfWord.bounds.x.toFixed(1)},{" "}
            {pdfWord.bounds.y.toFixed(1)},{" "}
            {pdfWord.bounds.width.toFixed(1)},{" "}
            {pdfWord.bounds.height.toFixed(1)}
            ]
          </div>
        );
      })()}
    </div>
  )}

          <div className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-gray-800 dark:bg-slate-800 dark:text-slate-200">
            {page.text ||
              "No OCR text recognized."}
          </div>
        </div>
      ))}
            {ocrResult.retryRegions.map(
        (region, regionIndex) => (
          <div
            key={`${region.pageNumber}-${regionIndex}`}
            className="rounded-2xl border border-gray-200 p-4 dark:border-slate-700"
          >
            <div className="font-bold text-gray-950 dark:text-white">
              Retry region — Page{" "}
              {region.pageNumber}
            </div>

            <div className="mt-1 text-gray-600 dark:text-slate-400">
              OCR confidence:{" "}
              {Math.round(
                region.confidence,
              )}
              %
            </div>

            <div className="mt-1 text-gray-600 dark:text-slate-400">
              OCR words:{" "}
              {region.words.length}
            </div>

                        <div className="mt-1 text-gray-600 dark:text-slate-400">
              Rectangle: [
              {region.rectangle.left},{" "}
              {region.rectangle.top},{" "}
              {region.rectangle.width},{" "}
              {region.rectangle.height}]
            </div>

            {region.debugImageDataUrl && (
              <div className="mt-3">
                <div className="mb-2 font-semibold text-gray-700 dark:text-slate-300">
                  Retry crop preview
                </div>

                <img
                  src={
                    region.debugImageDataUrl
                  }
                  alt={`OCR retry crop for page ${region.pageNumber}`}
                  className="max-h-[500px] w-full rounded-xl border border-gray-200 object-contain dark:border-slate-700"
                />
              </div>
            )}

            <div className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-gray-800 dark:bg-slate-800 dark:text-slate-200">
              {region.text ||
                "No retry OCR text recognized."}
            </div>
          </div>
        ),
      )}
    </div>
  </section>
)}

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
  label="Continuation admissions"
  value={
    result.statistics
      .continuationAdmissionCount
  }
/>

<MiniStat
  label="Regions analyzed"
  value={
    result.statistics
      .analyzedTableRegionCount
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
  label="Rejected: insufficient columns"
  value={
    result.statistics
      .rejectedForInsufficientColumns
  }
/>

<MiniStat
  label="Rejected with 0 columns"
  value={
    result.statistics
      .rejectedWithZeroColumns
  }
/>

<MiniStat
  label="Rejected with 1 column"
  value={
    result.statistics
      .rejectedWithOneColumn
  }
/>

<MiniStat
  label="Rejected: no rows"
  value={
    result.statistics
      .rejectedForNoRows
  }
/>

<MiniStat
  label="Rejected: table build"
  value={
    result.statistics
      .rejectedForTableBuildFailure
  }
/>

<MiniStat
  label="Column reject: too few lines"
  value={
    result.statistics
      .rejectedColumnTooFewLines
  }
/>

<MiniStat
  label="Column reject: low support"
  value={
    result.statistics
      .rejectedColumnLowSupport
  }
/>

<MiniStat
  label="Column reject: unstable alignment"
  value={
    result.statistics
      .rejectedColumnUnstableAlignment
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
    <ShieldCheck
      size={23}
      className="text-blue-600"
    />

    <div>
      <h2 className="text-xl font-extrabold text-gray-950 dark:text-white">
        Extraction Quality
      </h2>

      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
        Document-level reliability summary based on rows assessed by Row Reliability V1.
      </p>
    </div>
  </div>
  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
  <MiniStat
    label="Rows analyzed"
    value={
      extractionQuality.totalRows
    }
  />

  <MiniStat
    label="Reliable rows"
    value={
      extractionQuality.reliableRows
    }
  />

  <MiniStat
    label="Needs review"
    value={
      extractionQuality.reviewRows
    }
  />

  <MiniStat
    label="Reliable rate"
    value={formatConfidence(
      extractionQuality.reliabilityRatio,
    )}
  />
</div>
{extractionQuality.reviewItems.length >
  0 && (
  <div className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-slate-700">
    <h3 className="text-sm font-bold text-gray-950 dark:text-white">
      Needs attention
    </h3>

    <div className="mt-3 space-y-3">
      {extractionQuality.reviewItems.map(
        ({
          analysisIndex,
          row,
        }) => (
          <div
            key={`${analysisIndex}-${row.rowIndex}`}
            className={`rounded-xl border p-3 transition ${
  selectedSource &&
selectedSource.tableNumber ===
  analysisIndex + 1 &&
selectedSource.logicalRowIndex ===
  row.rowIndex
    ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
    : "border-transparent bg-gray-50 dark:bg-slate-800"
}`}
          >
            <p className="text-sm font-semibold text-gray-950 dark:text-white">
              Merged Table{" "}
              {analysisIndex + 1}
              {" - "}
              Row{" "}
              {row.serialNumber ??
                row.rowIndex}
            </p>

            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Reliability:{" "}
              {formatConfidence(
                row.score,
              )}
            </p>

            {row.provenance && (
  <div className="mt-2 text-xs text-gray-600 dark:text-slate-300">
    <p>
      Source page:{" "}
      {row.provenance.pageNumber}
    </p>

    <p>
      Original row index:{" "}
      {row.provenance.originalRowIndex}
    </p>

    <p>
      Source region:{" "}
      {row.provenance.blockId}
    </p>
  </div>
)}

            {row.reasons.length > 0 && (
              <div className="mt-2 space-y-1">
                {row.reasons.map(
                  (
                    reason,
                    reasonIndex,
                  ) => (
                    <div
  key={`${reason.code}-${reasonIndex}`}
  className="space-y-1"
>
  <p className="text-xs text-gray-600 dark:text-slate-300">
    • {reason.message}
  </p>

  {reason.columnIndex !== undefined &&
  reason.cellText !== undefined && (
    <div className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-700 dark:bg-slate-800 dark:text-slate-200">
      <p className="font-semibold">
        Suspicious cell - Column{" "}
        {reason.columnIndex + 1}
      </p>

      <p className="mt-1">
        {reason.cellText.trim()
          ? `"${reason.cellText}"`
          : "(empty cell)"}
      </p>
      {reason.sourceFragmentCount !==
  undefined && (
  <p className="mt-2 text-gray-500 dark:text-slate-400">
    Extracted source fragments:{" "}
    {reason.sourceFragmentCount}
  </p>
)}

{reason.sourceFragmentCount !==
  undefined &&
  reason.sourceFragmentCount <= 1 && (
    <p className="mt-1 text-gray-500 dark:text-slate-400">
      Source evidence is limited. No additional extracted
      source fragment is available for this cell. Manual
      verification is recommended.
    </p>
  )}

    </div>
  )}

 {row.provenance &&
  reason.cellBounds &&
  reason.columnIndex !== undefined &&
  reason.cellText !== undefined && (
    <button
      type="button"
      onClick={() =>
        jumpToSource({
          pageNumber:
            row.provenance!.pageNumber,
          bounds: reason.cellBounds!,
          cellText: reason.cellText!,
          tableNumber:
            analysisIndex + 1,
          rowNumber:
            row.serialNumber ??
            row.rowIndex,
            logicalRowIndex:
  row.rowIndex,
          columnNumber:
            reason.columnIndex! + 1,
            reasons: [reason.message],
        })
      }
      className="mt-2 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
    >
      Jump to source
    </button>
  )} 

</div>
                  ),
                )}
              </div>
            )}
          </div>
        ),
      )}
    </div>
  </div>
)}
{file && selectedSource && (
  <div
    ref={sourcePreviewRef}
    className="mt-6 scroll-mt-6 rounded-2xl border border-gray-200 p-4 dark:border-slate-700"
  >
    <h3 className="text-sm font-bold text-gray-950 dark:text-white">
      Focused source preview
    </h3>

    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
      Merged Table {selectedSource.tableNumber}
      {" - "}
      Row {selectedSource.rowNumber}
      {" - "}
      Column {selectedSource.columnNumber}
      {" - "}
      Page {selectedSource.pageNumber}
    </p>
    {selectedSource.reasons.length > 0 && (
  <div className="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-slate-800">
    <p className="text-xs font-semibold text-gray-950 dark:text-white">
      Why this needs review
    </p>

    <div className="mt-2 space-y-1">
      {selectedSource.reasons.map(
        (reason, reasonIndex) => (
          <p
            key={reasonIndex}
            className="text-xs text-gray-600 dark:text-slate-300"
          >
            • {reason}
          </p>
        ),
      )}
    </div>
  </div>
)}
    {selectedSourceIndex !== null && (
  <div className="mt-3 flex items-center gap-3">
    <button
      type="button"
      onClick={() =>
        navigateSourceIssue(-1)
      }
      disabled={
        selectedSourceIndex === 0
      }
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
    >
      Previous issue
    </button>

    <span className="text-xs text-gray-500 dark:text-slate-400">
      {selectedSourceIndex + 1} of{" "}
      {sourceIssues.length}
    </span>

    <button
      type="button"
      onClick={() =>
        navigateSourceIssue(1)
      }
      disabled={
        selectedSourceIndex ===
        sourceIssues.length - 1
      }
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
    >
      Next issue
    </button>
  </div>
)}

    <div className="mt-4">
      <SuspiciousCellPreview
        file={file}
        pageNumber={selectedSource.pageNumber}
        pageWidth={
          result.document.pages[
            selectedSource.pageNumber - 1
          ]?.width ?? 0
        }
        pageHeight={
          result.document.pages[
            selectedSource.pageNumber - 1
          ]?.height ?? 0
        }
        bounds={selectedSource.bounds}
        cellText={selectedSource.cellText}
      />
    </div>
  </div>
)}
<div className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-slate-700">
  <h3 className="text-sm font-bold text-gray-950 dark:text-white">
    Final merged tables
  </h3>

  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {result.mergedTableReliability.map(
      (reliability, tableIndex) => (
        <div
          key={tableIndex}
          className="rounded-xl bg-gray-50 p-3 dark:bg-slate-800"
        >
          <p className="text-sm font-semibold text-gray-950 dark:text-white">
            Merged Table {tableIndex + 1}
          </p>

          <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">
            Rows assessed:{" "}
            {reliability.rows.length}
          </p>
          <p className="text-xs text-gray-600 dark:text-slate-300">
  Analysis mode:{" "}
  {reliability.analysisMode ===
  "serial"
    ? "Serial"
    : "Structural"}
</p>

          <p className="text-xs text-gray-600 dark:text-slate-300">
  Detected serial column:{" "}
  {reliability.serialColumnDiagnostics
    .detectedColumnIndex !== null
    ? `Column ${
        reliability.serialColumnDiagnostics
          .detectedColumnIndex + 1
      }`
    : "Not detected"}
</p>
<p className="text-xs text-gray-600 dark:text-slate-300">
  Sequence confidence:{" "}
  {formatConfidence(
    reliability.serialColumnDiagnostics
      .sequenceConfidence,
  )}
</p>
{reliability.serialColumnDiagnostics
  .candidates.length > 0 && (
  <div className="mt-2 space-y-1">
    {reliability.serialColumnDiagnostics
      .candidates.map(
        (candidate) => (
          <p
            key={candidate.columnIndex}
            className="text-xs text-gray-500 dark:text-slate-400"
          >
            Column{" "}
            {candidate.columnIndex + 1}
            {" - "}
            Numeric values:{" "}
            {candidate.numericValueCount}
            {" - "}
            Sequential pairs:{" "}
            {candidate.sequentialPairCount}
            {" - "}
            Score:{" "}
            {formatConfidence(
              candidate.sequenceConfidence,
            )}
            {" - "}
{reliability.serialColumnDiagnostics
  .detectedColumnIndex ===
candidate.columnIndex
  ? "Selected"
  : "Rejected"}
          </p>
        ),
      )}
  </div>
)}

          <p className="text-xs text-gray-600 dark:text-slate-300">
            Average reliability:{" "}
            {formatConfidence(
              reliability.confidence,
            )}
          </p>

          <p className="text-xs text-gray-600 dark:text-slate-300">
            Needs review:{" "}
            {reliability.reviewRowCount}
          </p>
        </div>
      ),
    )}
  </div>
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

                    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-extrabold text-gray-950 dark:text-white">
              Visual Block Diagnostics
            </h2>

            <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
              Shows how the PDF reader grouped page lines before table detection.
            </p>

            <div className="mt-5 space-y-5">
              {result.document.pages.map(
                (page) => (
                  <div
                    key={page.pageNumber}
                    className="rounded-2xl border border-gray-200 p-4 dark:border-slate-700"
                  >
                    <p className="text-sm font-bold text-gray-950 dark:text-white">
                      Page {page.pageNumber}
                    </p>

                    <div className="mt-2 text-xs text-gray-600 dark:text-slate-400">
  Text extraction:{" "}
  <span className="font-semibold text-gray-950 dark:text-white">
    {formatAnalysisOutcome(
      page.textExtraction.status,
    )}
  </span>
  {" • "}
  Quality:{" "}
  <span className="font-semibold text-gray-950 dark:text-white">
    {Math.round(
      page.textExtraction.qualityScore *
        100,
    )}
    %
  </span>
  {" • "}
  {page.textExtraction.wordCount} words
  {" • "}
  {page.textExtraction.lineCount} lines
  {" • "}
  {page.textExtraction.characterCount} characters
</div>

                    <div className="mt-3 space-y-3">
                      {page.blocks.map(
                        (block, blockIndex) => {
                          const lineCount =
                            block.type ===
                              "paragraph" ||
                            block.type ===
                              "heading"
                              ? block.lines.length
                              : 0;

                          const blockText =
                            block.type ===
                              "paragraph" ||
                            block.type ===
                              "heading"
                              ? block.text
                              : block.type ===
                                  "unknown"
                                ? block.words
                                    .map(
                                      (word) =>
                                        word.text,
                                    )
                                    .join(" ")
                                : "";

                          return (
                            <div
                              key={block.id}
                              className="rounded-xl bg-gray-50 p-3 dark:bg-slate-800"
                            >
                              <p className="text-sm font-semibold text-gray-950 dark:text-white">
                                Block{" "}
                                {blockIndex + 1}
                              </p>

                              <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">
                                Type:{" "}
                                {block.type}
                              </p>

                              <p className="text-xs text-gray-600 dark:text-slate-300">
                                Lines:{" "}
                                {lineCount}
                              </p>

                              <p className="text-xs text-gray-600 dark:text-slate-300">
                                Bounds: x{" "}
                                {block.bounds.x.toFixed(
                                  1,
                                )}
                                , y{" "}
                                {block.bounds.y.toFixed(
                                  1,
                                )}
                                , width{" "}
                                {block.bounds.width.toFixed(
                                  1,
                                )}
                                , height{" "}
                                {block.bounds.height.toFixed(
                                  1,
                                )}
                              </p>

                              <p className="mt-2 break-words text-xs text-gray-500 dark:text-slate-400">
                                {blockText ||
                                  "(No text preview)"}
                              </p>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>

                    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-extrabold text-gray-950 dark:text-white">
              Table Region Diagnostics
            </h2>

            <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
              Shows the table-detection score for every analyzed visual region.
            </p>

            <div className="mt-5 space-y-3">
              {result.candidateRegionDiagnostics.length >
              0 ? (
                result.candidateRegionDiagnostics.map(
                  (region, index) => (
                    <div
                      key={`${region.pageNumber}-${region.blockId}`}
                      className="rounded-xl bg-gray-50 p-4 dark:bg-slate-800"
                    >
                      <p className="text-sm font-semibold text-gray-950 dark:text-white">
                        Table Region{" "}
                        {index + 1}
                      </p>

                      <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">
                        Page:{" "}
                        {region.pageNumber}
                        {" - "}
                        Type:{" "}
                        {region.blockType}
                        {" - "}
                        Lines:{" "}
                        {region.lineCount}
                      </p>

                      <p className="mt-2 text-xs font-semibold text-gray-700 dark:text-slate-200">
                        Total score:{" "}
                        {region.analysis.totalScore.toFixed(
                          1,
                        )}
                        {" - "}
                        {region.analysis.isTable
  ? "Confirmed table"
  : region.admittedAsContinuation
    ? "Admitted as previous-page continuation"
    : region.analysis.totalScore >= 42
      ? "Possible table"
      : "Below candidate threshold"}
                      </p>

                      <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
  Outcome:{" "}
  {region.outcome ===
  "below-threshold"
    ? "Below candidate threshold"
    : region.outcome ===
        "pending"
      ? "Pending analysis"
      : region.outcome ===
          "rejected-insufficient-columns"
        ? "Rejected - insufficient columns"
        : region.outcome ===
            "rejected-no-rows"
          ? "Rejected - no logical rows"
          : region.outcome ===
              "rejected-table-build"
            ? "Rejected - table build failed"
            : "Confirmed"}
</p>

<p className="text-xs text-gray-600 dark:text-slate-300">
  Accepted columns:{" "}
  {region.acceptedColumnCount ??
    "Not analyzed"}
</p>

                      <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
                        Alignment:{" "}
                        {region.analysis.breakdown.alignment.score.toFixed(
                          1,
                        )}
                      </p>

                      <p className="text-xs text-gray-600 dark:text-slate-300">
                        Spacing:{" "}
                        {region.analysis.breakdown.spacing.score.toFixed(
                          1,
                        )}
                      </p>

                      <p className="text-xs text-gray-600 dark:text-slate-300">
                        Density:{" "}
                        {region.analysis.breakdown.density.score.toFixed(
                          1,
                        )}
                      </p>

                      <p className="text-xs text-gray-600 dark:text-slate-300">
                        Header:{" "}
                        {region.analysis.breakdown.header.score.toFixed(
                          1,
                        )}
                      </p>

                      <p className="text-xs text-gray-600 dark:text-slate-300">
                        Numeric:{" "}
                        {region.analysis.breakdown.numericColumn.score.toFixed(
                          1,
                        )}
                      </p>
                    </div>
                  ),
                )
              ) : (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  No candidate table regions were detected.
                </p>
              )}
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

  const rowReliability =
  analysis.rowReliability;  

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
      {rowReliability && (
  <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <h3 className="text-lg font-extrabold text-gray-950 dark:text-white">
      Row Reliability V1
    </h3>

    <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
      Average reliability:{" "}
      {formatConfidence(
        rowReliability.confidence,
      )}
    </p>

    <div className="mt-4 flex flex-wrap gap-3">
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
        Reliable:{" "}
        {
          rowReliability.reliableRowCount
        }
      </span>

      <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
        Needs review:{" "}
        {
          rowReliability.reviewRowCount
        }
      </span>
    </div>

    <div className="mt-5 space-y-3">
      {rowReliability.rows.map(
        (row) => (
          <div
            key={row.rowIndex}
            className="rounded-2xl border border-gray-200 p-4 dark:border-slate-700"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="font-bold text-gray-950 dark:text-white">
                Row{" "}
                {row.serialNumber ??
                  row.rowIndex + 1}
              </p>

              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-950 dark:text-white">
                  {formatConfidence(
                    row.score,
                  )}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    row.status ===
                    "reliable"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  }`}
                >
                  {row.status ===
                  "reliable"
                    ? "Reliable"
                    : "Needs review"}
                </span>
              </div>
            </div>

            {row.reasons.length >
              0 && (
              <div className="mt-3 space-y-1">
               {row.reasons.map(
  (
    reason,
    index,
  ) => (
    <div
      key={`${reason.code}-${index}`}
      className="space-y-1"
    >
      <p className="text-sm text-gray-600 dark:text-slate-300">
        • {reason.message}
      </p>

      {reason.sourceFragmentCount !==
        undefined && (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Extracted source fragments:{" "}
          {reason.sourceFragmentCount}
        </p>
      )}

      {reason.sourceFragmentCount !==
        undefined &&
        reason.sourceFragmentCount <= 1 && (
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Source evidence is limited. No additional
            extracted source fragment is available for this
            cell. Manual verification is recommended.
          </p>
        )}
    </div>
  ),
)}
              </div>
            )}
          </div>
        ),
      )}
    </div>
  </section>
)}

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
{(
  action.fromProvenance ||
  action.toProvenance
) && (
  <div className="mt-3 rounded-xl border border-blue-200 bg-white/60 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-slate-900/40 dark:text-blue-200">
    {action.fromProvenance && (
      <p>
        From source: Page{" "}
        {action.fromProvenance.pageNumber}
        {" - "}
        Original row{" "}
        {
          action.fromProvenance
            .originalRowIndex
        }
        {" - "}
        Column{" "}
        {action.fromColumnIndex + 1}
      </p>
    )}

    {action.toProvenance && (
      <p className="mt-1">
        To source: Page{" "}
        {action.toProvenance.pageNumber}
        {" - "}
        Original row{" "}
        {
          action.toProvenance
            .originalRowIndex
        }
        {" - "}
        Column{" "}
        {action.toColumnIndex + 1}
      </p>
    )}

    {action.fromProvenance && (
      <p className="mt-1 text-blue-600 dark:text-blue-300">
        Source region:{" "}
        {action.fromProvenance.blockId}
      </p>
    )}
  </div>
)}
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

              <div className="mt-2 space-y-1">
  <p className="text-sm font-semibold">
    {candidate.outcome === "accepted"
      ? "Accepted for repair"
      : candidate.outcome ===
          "rejected-safety"
        ? "Rejected by safety guard"
        : "Rejected - score below threshold"}
  </p>

  {candidate.outcome ===
    "rejected-safety" && (
    <p className="text-xs text-gray-600 dark:text-slate-400">
      Score threshold passed, but the
      repair was blocked by a safety
      rule.
    </p>
  )}

  {candidate.decisionReason && (
    <p className="text-xs text-gray-600 dark:text-slate-400">
      {candidate.decisionReason}
    </p>
  )}
</div>
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
