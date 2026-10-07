"use client";

import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ToolLayout from "@/components/pdf/ToolLayout";
import {
  createDocumentArtifact,
  createMagicDropPlan,
  inspectPdfArtifact,
  type InspectionReport,
  type MagicDropPlan,
  type MagicDropRecommendationKind,
} from "@/lib/document-engine";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleOff,
  FileSearch,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import {
  ChangeEvent,
  useRef,
  useState,
} from "react";
import {
  buildWorkspaceHandoffHref,
  saveActiveWorkspaceFile,
} from "@/lib/storage/workspaceFiles";
import { toast } from "sonner";

const MAX_FILE_SIZE =
  25 * 1024 * 1024;

const tips = [
  {
    title: "Recommendations come from checked facts",
    description:
      "Magic Drop recommends an operation only when a deterministic document fact supports it. It does not guess sensitive content or user intent.",
  },
  {
    title: "Blocked means stop, not continue",
    description:
      "If a detected structure makes a normal workflow unsafe, Kukureku shows that action as blocked instead of silently trying it.",
  },
  {
    title: "Unknown still means unknown",
    description:
      "Attachments, signatures, JavaScript/actions, and forensic hidden objects are not all inspected in V1. Kukureku keeps those limits visible.",
  },
];

const faqs = [
  {
    question: "Does Magic Drop change my PDF?",
    answer:
      "No. Magic Drop V1 inspects the selected PDF and creates a next-step plan. It does not rewrite, download, or silently modify the document.",
  },
  {
    question: "Is Magic Drop using AI to guess?",
    answer:
      "No. V1 is deterministic. Recommendations are derived from document facts that Kukureku actually inspected.",
  },
  {
    question: "Does my PDF leave my device?",
    answer:
      "No. The current Magic Drop inspection runs locally in your browser.",
  },
];

const statusConfig: Record<
  MagicDropRecommendationKind,
  {
    label: string;
    icon: typeof CheckCircle2;
    className: string;
  }
> = {
  RECOMMENDED: {
    label: "RECOMMENDED",
    icon: CheckCircle2,
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  OPTIONAL: {
    label: "OPTIONAL",
    icon: Sparkles,
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  },
  BLOCKED: {
    label: "BLOCKED",
    icon: CircleOff,
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  },
};

const goalActions = [
  {
    title: "Make the file smaller",
    description:
      "Open Compress PDF when file size is your goal.",
    href: "/compress-pdf",
  },
  {
    title: "Add password protection",
    description:
      "Open Protect PDF when access control is your goal.",
    href: "/protect-pdf",
  },
  {
    title: "Remove visible sensitive content",
    description:
      "Open Redact PDF only when you know what visible content must be removed.",
    href: "/redact-pdf",
  },
  {
    title: "Inspect every supported detail",
    description:
      "Open Document Inspector for the full fact and coverage report.",
    href: "/document-inspector",
  },
];

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

function formatFeature(
  feature: string,
) {
  return feature
    .split("-")
    .join(" ");
}

export default function MagicDropPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);
  const [file, setFile] =
    useState<File | null>(null);
  const [report, setReport] =
    useState<InspectionReport | null>(
      null,
    );
  const [plan, setPlan] =
    useState<MagicDropPlan | null>(
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
    workspaceFileId,
    setWorkspaceFileId,
  ] = useState<string | null>(
    null,
  );
  const [
    workspaceStorageError,
    setWorkspaceStorageError,
  ] = useState("");

  async function runMagicDrop(
    selectedFile: File,
  ) {
    setFile(selectedFile);
    setReport(null);
    setPlan(null);
    setErrorMessage("");
    setWorkspaceFileId(null);
    setWorkspaceStorageError("");
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

      const nextReport =
        await inspectPdfArtifact(
          artifact,
        );
      const nextPlan =
        createMagicDropPlan(
          nextReport,
        );

      try {
        const stored =
          await saveActiveWorkspaceFile(
            selectedFile,
          );

        setWorkspaceFileId(
          stored.id,
        );
      } catch (
        storageError
      ) {
        console.error(
          storageError,
        );
        setWorkspaceStorageError(
          "Magic Drop completed, but this browser could not persist the PDF for automatic handoff. You can still open a tool and choose the file manually.",
        );
      }

      setReport(nextReport);
      setPlan(nextPlan);

      toast.success(
        "Magic Drop plan is ready.",
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

    void runMagicDrop(
      selectedFile,
    );
  }

  function resetMagicDrop() {
    setFile(null);
    setReport(null);
    setPlan(null);
    setErrorMessage("");
    setWorkspaceFileId(null);
    setWorkspaceStorageError("");
    setIsInspecting(false);

    if (fileInputRef.current) {
      fileInputRef.current.value =
        "";
    }
  }

  return (
    <ToolLayout
      label="Kukureku Intelligence"
      title="Drop a PDF. Kukureku finds what matters first."
      description="Magic Drop inspects one PDF locally, turns checked facts into transparent next-step recommendations, and refuses to pretend unknown areas are clean."
      tips={tips}
      faqs={faqs}
      howToTitle="How Magic Drop V1 works"
      howToSteps={[
        {
          title:
            "Drop one PDF",
          description:
            "Choose a PDF up to 25 MB. The file stays in your browser.",
        },
        {
          title:
            "Inspect before recommending",
          description:
            "Kukureku checks supported page geometry, common metadata, standard forms, and XFA presence first.",
        },
        {
          title:
            "You choose the next action",
          description:
            "Recommendations explain why they exist and what the operation may modify or destroy. Magic Drop never auto-edits the file.",
        },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <section className="mb-8 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title:
              "Local inspection",
            text:
              "Supported checks run in your browser.",
          },
          {
            icon: FileSearch,
            title:
              "Fact-derived plan",
            text:
              "Recommendations require inspected evidence.",
          },
          {
            icon: WandSparkles,
            title:
              "No automatic edits",
            text:
              "Nothing changes until you deliberately open a tool.",
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <Icon
                size={22}
                className="text-blue-600 dark:text-blue-300"
              />
              <p className="mt-3 font-bold text-gray-950 dark:text-white">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
                {item.text}
              </p>
            </div>
          );
        })}
      </section>

      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={
          handleFileSelection
        }
        accept=".pdf,application/pdf"
        multiple={false}
        title="Magic Drop one PDF"
        description="Choose or drag a PDF. Kukureku will inspect supported facts first and then show only evidence-based next steps."
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
                : resetMagicDrop
            }
            removeLabel="Remove PDF"
            statusText={
              isInspecting
                ? "Inspecting before recommending any action"
                : plan
                  ? "Magic Drop plan ready"
                  : "Selected for Magic Drop"
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
                    Inspecting before planning
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-blue-800 dark:text-blue-200">
                    Magic Drop is reading supported deterministic facts locally. It will not recommend an operation until inspection finishes.
                  </p>
                </div>
              </div>
            </section>
          )}

          {!isInspecting &&
            errorMessage && (
              <ErrorCard
                title="Magic Drop could not inspect this PDF"
                description={
                  errorMessage
                }
                reasons={[
                  "The PDF may be damaged.",
                  "The PDF may require a password before inspection.",
                  "The current local parser may not safely support this structure.",
                ]}
                onRetry={
                  file
                    ? () =>
                        void runMagicDrop(
                          file,
                        )
                    : undefined
                }
                onReset={
                  resetMagicDrop
                }
                retryLabel="Retry Magic Drop"
                resetLabel="Choose Another PDF"
              />
            )}

          {!isInspecting &&
            report &&
            plan && (
              <>
                <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-gray-200 bg-gradient-to-r from-slate-950 via-blue-950 to-blue-700 p-6 text-white dark:border-slate-800 md:p-8">
                    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-200">
                          Magic Drop plan
                        </p>
                        <h2 className="mt-3 text-3xl font-extrabold">
                          {plan.headline}
                        </h2>
                        <p className="mt-3 max-w-3xl leading-7 text-blue-100">
                          {plan.summary}
                        </p>
                      </div>

                      <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold">
                        <ShieldCheck
                          size={17}
                        />
                        No file changes made
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4 md:p-8">
                    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-950">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                        Pages
                      </p>
                      <p className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                        {
                          report.facts
                            .pageCount
                        }
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-950">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                        File size
                      </p>
                      <p className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                        {formatFileSize(
                          report.facts.size,
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-950">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                        Findings
                      </p>
                      <p className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                        {
                          plan.findingCount
                        }
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-950">
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                        Unknown / unsupported checks
                      </p>
                      <p className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                        {
                          plan.unknownCapabilityCount
                        }
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
                  <div className="max-w-3xl">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                      Evidence-based actions
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                      Recommended next actions
                    </h2>
                    <p className="mt-3 leading-7 text-gray-600 dark:text-slate-400">
                      Every card below explains the inspected evidence and the known operation effect. A missing recommendation does not mean an unchecked structure is absent.
                    </p>
                  </div>

                  {plan.recommendations
                    .length === 0 ? (
                    <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
                      <div className="flex items-start gap-3">
                        <CheckCircle2
                          size={22}
                          className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300"
                        />
                        <div>
                          <p className="font-bold text-emerald-950 dark:text-emerald-100">
                            No fact-derived cleanup recommendation
                          </p>
                          <p className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                            Choose your next action based on what you actually want to accomplish. Magic Drop will not invent a task just to look intelligent.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-5">
                      {plan.recommendations.map(
                        (
                          recommendation,
                        ) => {
                          const config =
                            statusConfig[
                              recommendation
                                .kind
                            ];
                          const Icon =
                            config.icon;

                          return (
                            <article
                              key={
                                recommendation.id
                              }
                              className="rounded-3xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-700 dark:bg-slate-950 md:p-6"
                            >
                              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                                <div>
                                  <span
                                    className={
                                      "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide " +
                                      config.className
                                    }
                                  >
                                    <Icon
                                      size={14}
                                    />
                                    {
                                      config.label
                                    }
                                  </span>

                                  <h3 className="mt-4 text-xl font-extrabold text-gray-950 dark:text-white">
                                    {
                                      recommendation.title
                                    }
                                  </h3>

                                  <p className="mt-3 max-w-4xl leading-7 text-gray-600 dark:text-slate-400">
                                    {
                                      recommendation.reason
                                    }
                                  </p>
                                </div>

                                {recommendation.route &&
                                  recommendation.kind !==
                                    "BLOCKED" && (
                                    <Link
                                      href={
                                        workspaceFileId
                                          ? buildWorkspaceHandoffHref(
                                              recommendation.route,
                                              workspaceFileId,
                                            )
                                          : recommendation.route
                                      }
                                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                                    >
                                      Open{" "}
                                      {
                                        recommendation.title
                                      }
                                      <ArrowRight
                                        size={
                                          16
                                        }
                                      />
                                    </Link>
                                  )}
                              </div>

                              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gray-400">
                                    Inspected evidence
                                  </p>
                                  <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-slate-300">
                                    {recommendation.evidence.map(
                                      (
                                        evidence,
                                      ) => (
                                        <li
                                          key={
                                            evidence
                                          }
                                          className="flex gap-2"
                                        >
                                          <span>
                                            •
                                          </span>
                                          <span>
                                            {
                                              evidence
                                            }
                                          </span>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>

                                {recommendation.effect && (
                                  <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gray-400">
                                      Known effect
                                    </p>
                                    <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-slate-300">
                                      {
                                        recommendation
                                          .effect
                                          .description
                                      }
                                    </p>
                                    <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-slate-400">
                                      Modifies:{" "}
                                      {recommendation
                                        .effect
                                        .modifies
                                        .map(
                                          formatFeature,
                                        )
                                        .join(
                                          ", ",
                                        ) ||
                                        "none declared"}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">
                                      Destroys:{" "}
                                      {recommendation
                                        .effect
                                        .destroys
                                        .map(
                                          formatFeature,
                                        )
                                        .join(
                                          ", ",
                                        ) ||
                                        "none declared"}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {recommendation
                                .effect
                                ?.risks
                                .length ? (
                                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                                  <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                                    <AlertTriangle
                                      size={
                                        17
                                      }
                                    />
                                    Operation risks
                                  </p>
                                  <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
                                    {recommendation.effect.risks.map(
                                      (
                                        risk,
                                      ) => (
                                        <li
                                          key={
                                            risk
                                          }
                                        >
                                          •{" "}
                                          {
                                            risk
                                          }
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              ) : null}
                            </article>
                          );
                        },
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/20 md:p-8">
                  <div className="flex items-start gap-4">
                    <AlertTriangle
                      size={24}
                      className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-extrabold text-amber-950 dark:text-amber-100">
                        What Kukureku still does not know
                      </h2>
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-800 dark:text-amber-300">
                        These limits stay visible because an unchecked area must never become a false clean result.
                      </p>

                      <div className="mt-5 space-y-3">
                        {plan.cautions.map(
                          (caution) => (
                            <div
                              key={
                                caution.id
                              }
                              className="rounded-2xl border border-amber-200 bg-white/70 p-4 dark:border-amber-900 dark:bg-slate-950/40"
                            >
                              <p className="font-bold text-amber-950 dark:text-amber-100">
                                {
                                  caution.title
                                }
                              </p>
                              <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-300">
                                {
                                  caution.description
                                }
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                    Your goal, your choice
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                    Choose another action only if it matches your goal
                  </h2>
                  <p className="mt-3 max-w-4xl leading-7 text-gray-600 dark:text-slate-400">
                    These are navigation options, not Magic Drop recommendations. V1 will not infer that you need compression, password protection, or redaction unless a checked fact supports a recommendation.
                  </p>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {goalActions.map(
                      (action) => (
                        <Link
                          key={
                            action.href
                          }
                          href={
                            workspaceFileId
                              ? buildWorkspaceHandoffHref(
                                  action.href,
                                  workspaceFileId,
                                )
                              : action.href
                          }
                          className="group rounded-2xl border border-gray-200 bg-gray-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-gray-950 dark:text-white">
                                {
                                  action.title
                                }
                              </p>
                              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
                                {
                                  action.description
                                }
                              </p>
                            </div>
                            <ArrowRight
                              size={18}
                              className="mt-1 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-blue-600"
                            />
                          </div>
                        </Link>
                      ),
                    )}
                  </div>

                  <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                    <strong>
                      Browser workspace handoff:
                    </strong>{" "}
                    {workspaceFileId
                      ? "This source PDF is saved locally in this browser. Supported next-step links carry it into the destination tool automatically, without uploading it or asking you to pick the file again."
                      : workspaceStorageError ||
                        "Preparing the local browser workspace for file handoff."}
                  </div>

                  <button
                    type="button"
                    onClick={
                      resetMagicDrop
                    }
                    className="mt-6 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Magic Drop Another PDF
                  </button>
                </section>
              </>
            )}
        </div>
      )}
    </ToolLayout>
  );
}
