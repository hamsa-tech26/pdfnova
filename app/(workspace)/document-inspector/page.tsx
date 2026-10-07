"use client";

import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ToolLayout from "@/components/pdf/ToolLayout";
import {
  createDocumentArtifact,
  createDocumentFindings,
  createInspectorChecks,
  inspectPdfArtifact,
  type InspectionReport,
  type InspectorCheckStatus,
} from "@/lib/document-engine";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  CircleOff,
  FileSearch,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  ChangeEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE =
  25 * 1024 * 1024;
const INITIAL_PAGE_ROWS = 25;

const inspectorTips = [
  {
    title: "Treat facts and findings separately",
    description:
      "Facts are deterministic observations such as page count or field count. Findings explain why an observed fact may deserve attention.",
  },
  {
    title: "Read the coverage panel",
    description:
      "NOT CHECKED and NOT SUPPORTED are intentional trust signals. Kukureku does not turn an uninspected area into a false clean result.",
  },
  {
    title: "Inspect before destructive work",
    description:
      "Page geometry, filled forms, XFA, and metadata can affect what should happen before compression, redaction, flattening, or external sharing.",
  },
];

const inspectorFaqs = [
  {
    question: "Does the Inspector modify my PDF?",
    answer:
      "No. Unified Document Inspector V1 only reads deterministic document facts. It does not rewrite or download a modified copy.",
  },
  {
    question: "Does CHECKED mean the PDF is completely safe?",
    answer:
      "No. CHECKED means that specific capability was inspected. The coverage panel also shows areas that were not checked or are not supported.",
  },
  {
    question: "Is my PDF uploaded?",
    answer:
      "No. The current Inspector runs locally inside your browser.",
  },
];

const statusConfig: Record<
  InspectorCheckStatus,
  {
    label: string;
    icon: typeof CheckCircle2;
    badgeClassName: string;
    cardClassName: string;
  }
> = {
  CHECKED: {
    label: "CHECKED",
    icon: CheckCircle2,
    badgeClassName:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    cardClassName:
      "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20",
  },
  ISSUE_FOUND: {
    label: "ISSUE FOUND",
    icon: AlertTriangle,
    badgeClassName:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    cardClassName:
      "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20",
  },
  NOT_CHECKED: {
    label: "NOT CHECKED",
    icon: CircleHelp,
    badgeClassName:
      "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    cardClassName:
      "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950",
  },
  NOT_SUPPORTED: {
    label: "NOT SUPPORTED",
    icon: CircleOff,
    badgeClassName:
      "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
    cardClassName:
      "border-gray-300 bg-gray-50 dark:border-slate-700 dark:bg-slate-950",
  },
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return String(bytes) + " B";
  }

  if (bytes < 1024 * 1024) {
    return (
      (bytes / 1024).toFixed(1) +
      " KB"
    );
  }

  return (
    (
      bytes /
      1024 /
      1024
    ).toFixed(2) + " MB"
  );
}

function formatBox(
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
) {
  return (
    "x " +
    box.x.toFixed(1) +
    " · y " +
    box.y.toFixed(1) +
    " · " +
    box.width.toFixed(1) +
    " × " +
    box.height.toFixed(1)
  );
}

function FactCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-xl font-extrabold text-gray-950 dark:text-white">
        {value}
      </p>

      {note && (
        <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-slate-400">
          {note}
        </p>
      )}
    </div>
  );
}

export default function DocumentInspectorPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [file, setFile] =
    useState<File | null>(null);
  const [report, setReport] =
    useState<InspectionReport | null>(
      null,
    );
  const [
    isInspecting,
    setIsInspecting,
  ] = useState(false);
  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");
  const [
    showAllPages,
    setShowAllPages,
  ] = useState(false);

  const findings = useMemo(
    () =>
      report
        ? createDocumentFindings(
            report,
          )
        : [],
    [report],
  );

  const checks = useMemo(
    () =>
      report
        ? createInspectorChecks(
            report,
          )
        : [],
    [report],
  );

  const metadataEntries = useMemo(
    () =>
      report
        ? Object.entries(
            report.facts.metadata,
          ).filter(
            ([, value]) =>
              value.trim().length >
              0,
          )
        : [],
    [report],
  );

  const visiblePages = useMemo(
    () => {
      if (!report) {
        return [];
      }

      if (showAllPages) {
        return report.facts.pages;
      }

      return report.facts.pages.slice(
        0,
        INITIAL_PAGE_ROWS,
      );
    },
    [report, showAllPages],
  );

  async function inspectFile(
    selectedFile: File,
  ) {
    setFile(selectedFile);
    setReport(null);
    setErrorMessage("");
    setShowAllPages(false);
    setIsInspecting(true);

    try {
      const artifact =
        createDocumentArtifact(
          selectedFile,
          {
            name:
              selectedFile.name,
            mimeType:
              selectedFile.type ||
              "application/pdf",
            source: "upload",
          },
        );

      const inspectionReport =
        await inspectPdfArtifact(
          artifact,
        );

      setReport(
        inspectionReport,
      );

      toast.success(
        "Document inspection completed.",
      );
    } catch (error) {
      console.error(error);

      const message =
        "Kukureku could not inspect this PDF. It may be damaged, password-protected, or unsupported.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsInspecting(false);
    }
  }

  function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0];

    event.target.value = "";

    if (
      !selectedFile ||
      (selectedFile.type !==
        "application/pdf" &&
        !selectedFile.name
          .toLowerCase()
          .endsWith(".pdf"))
    ) {
      const message =
        "Please select a valid PDF file.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (selectedFile.size === 0) {
      const message =
        "The selected PDF is empty.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (
      selectedFile.size >
      MAX_FILE_SIZE
    ) {
      const message =
        "The PDF file must not be larger than 25 MB.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    void inspectFile(
      selectedFile,
    );
  }

  function resetInspector() {
    setFile(null);
    setReport(null);
    setErrorMessage("");
    setShowAllPages(false);
    setIsInspecting(false);

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  }

  return (
    <ToolLayout
      label="Document Intelligence"
      title="Inspect a PDF before you act"
      description="Drop one PDF to see deterministic document facts, issue findings, and the exact limits of what Kukureku did or did not inspect. No false clean result."
      tips={inspectorTips}
      faqs={inspectorFaqs}
      howToTitle="How Unified Document Inspector works"
      howToSteps={[
        {
          title: "Choose one PDF",
          description:
            "Select a PDF up to 25 MB. The file stays in your browser.",
        },
        {
          title: "Kukureku inspects deterministic facts",
          description:
            "Page geometry, common metadata, standard forms, XFA presence, and declared capability coverage are analyzed.",
        },
        {
          title: "Read facts, findings, and coverage",
          description:
            "Use CHECKED, ISSUE FOUND, NOT CHECKED, and NOT SUPPORTED to understand exactly what the result means.",
        },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={
          handleFileSelection
        }
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF to inspect"
        description="Choose or drag a PDF to inspect its structure before editing, sharing, compressing, flattening, or redacting it."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isInspecting}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              isInspecting
                ? undefined
                : resetInspector
            }
            removeLabel="Remove PDF"
            statusText={
              isInspecting
                ? "Inspecting deterministic document facts locally"
                : report
                  ? "Document inspection completed"
                  : "Selected for document inspection"
            }
          />

          {isInspecting && (
            <section
              aria-live="polite"
              className="rounded-3xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/30"
            >
              <div className="flex items-start gap-4">
                <LoaderCircle
                  size={24}
                  className="mt-0.5 shrink-0 animate-spin text-blue-600 dark:text-blue-300"
                />

                <div>
                  <h2 className="text-lg font-extrabold text-blue-950 dark:text-blue-100">
                    Inspecting your PDF
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-blue-800 dark:text-blue-200">
                    Kukureku is reading page geometry, common metadata, standard form fields, and XFA presence. Nothing is being uploaded.
                  </p>
                </div>
              </div>
            </section>
          )}

          {!isInspecting &&
            errorMessage && (
              <ErrorCard
                title="Document inspection failed"
                description={
                  errorMessage
                }
                reasons={[
                  "The PDF may be damaged.",
                  "The PDF may require a password before it can be opened.",
                  "The file may use a structure the current local parser cannot read safely.",
                ]}
                onRetry={
                  file
                    ? () =>
                        void inspectFile(
                          file,
                        )
                    : undefined
                }
                onReset={
                  resetInspector
                }
                retryLabel="Retry Inspection"
                resetLabel="Choose Another PDF"
              />
            )}

          {!isInspecting &&
            report && (
              <>
                <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileSearch
                          size={22}
                          className="text-blue-600 dark:text-blue-300"
                        />

                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                          Inspection coverage
                        </p>
                      </div>

                      <h2 className="mt-3 text-2xl font-extrabold text-gray-950 dark:text-white">
                        What Kukureku checked — and what it did not
                      </h2>

                      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-400">
                        A clean checked capability does not imply that unchecked or unsupported areas are clean. Coverage is explicit by design.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    {checks.map(
                      (check) => {
                        const config =
                          statusConfig[
                            check.status
                          ];
                        const Icon =
                          config.icon;

                        return (
                          <div
                            key={
                              check.id
                            }
                            className={
                              "rounded-2xl border p-4 " +
                              config.cardClassName
                            }
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 items-start gap-3">
                                <Icon
                                  size={
                                    20
                                  }
                                  className="mt-0.5 shrink-0"
                                />

                                <div>
                                  <p className="font-bold text-gray-950 dark:text-white">
                                    {
                                      check.label
                                    }
                                  </p>

                                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
                                    {
                                      check.summary
                                    }
                                  </p>
                                </div>
                              </div>

                              <span
                                className={
                                  "shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide " +
                                  config.badgeClassName
                                }
                              >
                                {
                                  config.label
                                }
                              </span>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                    Document facts
                  </p>

                  <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                    Deterministic facts from this PDF
                  </h2>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FactCard
                      label="File size"
                      value={formatFileSize(
                        report.facts
                          .size,
                      )}
                    />

                    <FactCard
                      label="Pages"
                      value={
                        report.facts
                          .pageCount
                      }
                    />

                    <FactCard
                      label="Rotated pages"
                      value={
                        report.facts
                          .rotatedPageCount
                      }
                    />

                    <FactCard
                      label="Custom CropBoxes"
                      value={
                        report.facts
                          .customCropBoxPageCount
                      }
                    />

                    <FactCard
                      label="Mixed page sizes"
                      value={
                        report.facts
                          .hasMixedPageSizes
                          ? "Yes"
                          : "No"
                      }
                    />

                    <FactCard
                      label="Metadata fields"
                      value={
                        report.facts
                          .commonMetadataFieldsPresent
                          .length
                      }
                      note="Common document-information fields only"
                    />

                    <FactCard
                      label="Form fields"
                      value={
                        report.facts
                          .form.fieldCount
                      }
                      note={
                        String(
                          report.facts
                            .form
                            .filledFieldCount,
                        ) +
                        " filled"
                      }
                    />

                    <FactCard
                      label="XFA"
                      value={
                        report.facts
                          .form.hasXfa
                          ? "Detected"
                          : "Not detected"
                      }
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                    Findings
                  </p>

                  <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                    Issues detected from checked facts
                  </h2>

                  {findings.length >
                  0 ? (
                    <div className="mt-6 space-y-3">
                      {findings.map(
                        (
                          finding,
                        ) => (
                          <div
                            key={
                              finding.id
                            }
                            className={
                              finding.severity ===
                              "warning"
                                ? "rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20"
                                : "rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20"
                            }
                          >
                            <div className="flex items-start gap-3">
                              <AlertTriangle
                                size={
                                  19
                                }
                                className={
                                  finding.severity ===
                                  "warning"
                                    ? "mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
                                    : "mt-0.5 shrink-0 text-blue-700 dark:text-blue-300"
                                }
                              />

                              <div>
                                <p className="font-bold text-gray-950 dark:text-white">
                                  {
                                    finding.title
                                  }
                                </p>

                                <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-slate-300">
                                  {
                                    finding.description
                                  }
                                </p>

                                {finding.evidence && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {Object.entries(
                                      finding.evidence,
                                    ).map(
                                      ([
                                        key,
                                        value,
                                      ]) => (
                                        <span
                                          key={
                                            key
                                          }
                                          className="rounded-lg bg-white/80 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-900/70 dark:text-slate-300"
                                        >
                                          {
                                            key
                                          }
                                          :{" "}
                                          {String(
                                            value,
                                          )}
                                        </span>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                      <div className="flex items-start gap-3">
                        <CheckCircle2
                          size={20}
                          className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300"
                        />

                        <p className="text-sm leading-6 text-emerald-900 dark:text-emerald-200">
                          No issues were found among the capabilities that V1 actually checked. Review the coverage panel before treating this as a broader security or forensic conclusion.
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                      Common metadata
                    </p>

                    <h2 className="mt-2 text-xl font-extrabold text-gray-950 dark:text-white">
                      Document-information fields
                    </h2>

                    {metadataEntries.length >
                    0 ? (
                      <div className="mt-5 space-y-3">
                        {metadataEntries.map(
                          ([
                            key,
                            value,
                          ]) => (
                            <div
                              key={
                                key
                              }
                              className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                            >
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                                {
                                  key
                                }
                              </p>

                              <p className="mt-2 break-words text-sm font-semibold text-gray-900 dark:text-white">
                                {
                                  value
                                }
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
                        No common document-information metadata fields were found.
                      </p>
                    )}

                    <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-slate-400">
                      This does not claim forensic XMP or hidden-object inspection.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                      Forms
                    </p>

                    <h2 className="mt-2 text-xl font-extrabold text-gray-950 dark:text-white">
                      Standard form structure
                    </h2>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {Object.entries(
                        report.facts
                          .form
                          .fieldKinds,
                      ).map(
                        ([
                          kind,
                          count,
                        ]) => (
                          <FactCard
                            key={
                              kind
                            }
                            label={kind.replace(
                              "-",
                              " ",
                            )}
                            value={
                              count
                            }
                          />
                        ),
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                      <p>
                        AcroForm dictionary:{" "}
                        <strong>
                          {report.facts
                            .form
                            .hasAcroForm
                            ? "present"
                            : "not detected"}
                        </strong>
                      </p>

                      <p className="mt-1">
                        Filled standard fields:{" "}
                        <strong>
                          {
                            report
                              .facts
                              .form
                              .filledFieldCount
                          }
                        </strong>
                      </p>

                      <p className="mt-1">
                        XFA:{" "}
                        <strong>
                          {report.facts
                            .form
                            .hasXfa
                            ? "detected"
                            : "not detected"}
                        </strong>
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                        Page geometry
                      </p>

                      <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                        MediaBox, CropBox, size, and rotation
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
                        Dimensions are shown in PDF points. Visible size follows the page CropBox.
                      </p>
                    </div>

                    {report.facts
                      .pageCount >
                      INITIAL_PAGE_ROWS && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowAllPages(
                            (
                              current,
                            ) =>
                              !current,
                          )
                        }
                        className="min-h-11 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 outline-none transition hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-4 focus-visible:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus-visible:ring-blue-950"
                      >
                        {showAllPages
                          ? "Show first 25 pages"
                          : "Show all " +
                            String(
                              report
                                .facts
                                .pageCount,
                            ) +
                            " pages"}
                      </button>
                    )}
                  </div>

                  <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 dark:border-slate-700">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-gray-500 dark:bg-slate-950 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">
                            Page
                          </th>
                          <th className="px-4 py-3">
                            Visible size
                          </th>
                          <th className="px-4 py-3">
                            Rotation
                          </th>
                          <th className="px-4 py-3">
                            MediaBox
                          </th>
                          <th className="px-4 py-3">
                            CropBox
                          </th>
                          <th className="px-4 py-3">
                            Custom CropBox
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {visiblePages.map(
                          (
                            page,
                          ) => (
                            <tr
                              key={
                                page.pageNumber
                              }
                              className="border-t border-gray-200 text-gray-700 dark:border-slate-800 dark:text-slate-300"
                            >
                              <td className="whitespace-nowrap px-4 py-3 font-bold text-gray-950 dark:text-white">
                                {
                                  page.pageNumber
                                }
                              </td>

                              <td className="whitespace-nowrap px-4 py-3">
                                {page.width.toFixed(
                                  1,
                                )}
                                {" × "}
                                {page.height.toFixed(
                                  1,
                                )}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3">
                                {
                                  page.rotation
                                }
                                °
                              </td>

                              <td className="min-w-64 px-4 py-3">
                                {formatBox(
                                  page.mediaBox,
                                )}
                              </td>

                              <td className="min-w-64 px-4 py-3">
                                {formatBox(
                                  page.cropBox,
                                )}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3">
                                {page.hasCustomCropBox
                                  ? "Yes"
                                  : "No"}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!showAllPages &&
                    report.facts
                      .pageCount >
                      INITIAL_PAGE_ROWS && (
                      <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
                        Showing the first 25 pages to keep large-document rendering responsive.
                      </p>
                    )}
                </section>

                <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/20 sm:p-6">
                  <div className="flex items-start gap-3">
                    <ShieldCheck
                      size={21}
                      className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300"
                    />

                    <div>
                      <h2 className="font-extrabold text-blue-950 dark:text-blue-100">
                        Trust meaning
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-blue-900 dark:text-blue-200">
                        CHECKED means the named capability was deterministically inspected. ISSUE FOUND means checked facts triggered a finding. NOT CHECKED means V1 deliberately did not inspect that area. NOT SUPPORTED means Kukureku does not currently claim that inspection capability.
                      </p>
                    </div>
                  </div>
                </section>
              </>
            )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Unified Document Inspector V1 reads supported PDF facts locally in your browser and does not upload the file.
      </div>
    </ToolLayout>
  );
}
