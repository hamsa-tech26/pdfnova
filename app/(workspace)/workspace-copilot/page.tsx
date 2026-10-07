"use client";

import {
  comparePdfContentSignals,
  createDocumentArtifact,
  createPdfContentSignal,
  createSafeSharePlan,
  createWorkspaceCopilotAnswers,
  createWorkspaceIntelligenceReport,
  inspectPdfArtifact,
  scanSensitiveText,
  selectWorkspaceCopilotComparisonTarget,
  verifyWorkspaceRelationships,
  type WorkspaceCopilotAnswer,
  type WorkspaceCopilotQuestion,
  type WorkspaceCopilotComparisonContext,
} from "@/lib/document-engine";
import {
  buildWorkspaceHandoffHref,
  buildWorkspaceMultiHandoffHref,
  getActiveWorkspaceFileSummary,
  getWorkspaceFile,
  listWorkspaceFileSummaries,
  setActiveWorkspaceFile,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleHelp,
  FileSearch,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

const questionLabels: Record<
  WorkspaceCopilotQuestion,
  string
> = {
  "which-version":
    "Which version should I use?",
  "what-changed":
    "What changed?",
  "sharing-attention":
    "What needs attention before sharing?",
  "next-step":
    "What should I do next?",
};

export default function WorkspaceCopilotPage() {
  const [
    active,
    setActive,
  ] = useState<WorkspaceFileSummary | null>(
    null,
  );
  const [
    summaries,
    setSummaries,
  ] = useState<
    WorkspaceFileSummary[]
  >([]);
  const [
    answers,
    setAnswers,
  ] = useState<
    WorkspaceCopilotAnswer[]
  >([]);
  const [
    selectedQuestion,
    setSelectedQuestion,
  ] =
    useState<WorkspaceCopilotQuestion>(
      "next-step",
    );
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");
  const [
    comparisonTarget,
    setComparisonTarget,
  ] = useState<
    WorkspaceCopilotComparisonContext | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      setLoading(true);
      setError("");

      try {
        const [
          nextSummaries,
          nextActive,
        ] = await Promise.all([
          listWorkspaceFileSummaries(),
          getActiveWorkspaceFileSummary(),
        ]);

        if (!nextActive) {
          const emptyReport =
            createWorkspaceIntelligenceReport(
              nextSummaries,
              null,
            );
          const emptyVerification =
            verifyWorkspaceRelationships(
              nextSummaries,
            );

          if (!cancelled) {
            setSummaries(
              nextSummaries,
            );
            setActive(null);
            setAnswers(
              createWorkspaceCopilotAnswers(
                {
                  nodes:
                    nextSummaries,
                  report:
                    emptyReport,
                  verification:
                    emptyVerification,
                  activeNodeId:
                    null,
                },
              ),
            );
          }
          return;
        }

        const report =
          createWorkspaceIntelligenceReport(
            nextSummaries,
            nextActive.id,
          );
        const verification =
          verifyWorkspaceRelationships(
            nextSummaries,
          );
        const target =
          selectWorkspaceCopilotComparisonTarget(
            nextSummaries,
            report,
            nextActive.id,
          );

        let comparison:
          | WorkspaceCopilotComparisonContext
          | null = null;
        let safeShare = null;

        const activeFile =
          await getWorkspaceFile(
            nextActive.id,
          );

        if (activeFile) {
          const activeSignalResult =
            await Promise.allSettled([
              createPdfContentSignal(
                activeFile,
              ),
              inspectPdfArtifact(
                createDocumentArtifact(
                  activeFile,
                  {
                    name:
                      activeFile.name,
                    mimeType:
                      activeFile.type,
                    source:
                      "upload",
                  },
                ),
              ),
            ]);

          const activeSignal =
            activeSignalResult[0]
              .status ===
            "fulfilled"
              ? activeSignalResult[0]
                  .value
              : null;
          const inspection =
            activeSignalResult[1]
              .status ===
            "fulfilled"
              ? activeSignalResult[1]
                  .value
              : null;

          if (
            activeSignal &&
            inspection
          ) {
            const sensitive =
              scanSensitiveText(
                activeSignal.rawText ??
                  "",
              );

            safeShare =
              createSafeSharePlan(
                inspection,
                sensitive,
                activeSignal.selectableTextChars,
              );
          }

          if (
            target &&
            activeSignal
          ) {
            const targetSummary =
              nextSummaries.find(
                (summary) =>
                  summary.id ===
                  target.targetNodeId,
              );
            const targetFile =
              await getWorkspaceFile(
                target.targetNodeId,
              );

            if (
              targetSummary &&
              targetFile
            ) {
              try {
                const targetSignal =
                  await createPdfContentSignal(
                    targetFile,
                  );

                comparison = {
                  targetNodeId:
                    target.targetNodeId,
                  targetName:
                    targetSummary.name,
                  reason:
                    target.reason,
                  comparison:
                    comparePdfContentSignals(
                      activeSignal,
                      targetSignal,
                    ),
                };
              } catch {
                comparison =
                  null;
              }
            }
          }
        }

        if (!cancelled) {
          setSummaries(
            nextSummaries,
          );
          setActive(
            nextActive,
          );
          setComparisonTarget(
            comparison,
          );
          setAnswers(
            createWorkspaceCopilotAnswers(
              {
                nodes:
                  nextSummaries,
                report,
                verification,
                activeNodeId:
                  nextActive.id,
                comparison,
                safeShare,
              },
            ),
          );
        }
      } catch (
        analysisError
      ) {
        if (!cancelled) {
          setError(
            analysisError instanceof
              Error
              ? analysisError.message
              : "Workspace Copilot could not analyze the browser-local workspace.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void analyze();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAnswer =
    useMemo(
      () =>
        answers.find(
          (answer) =>
            answer.question ===
            selectedQuestion,
        ) ??
        answers[0] ??
        null,
      [
        answers,
        selectedQuestion,
      ],
    );

  async function makeCurrent(
    id: string,
  ) {
    try {
      await setActiveWorkspaceFile(
        id,
      );
      const next =
        summaries.find(
          (summary) =>
            summary.id ===
            id,
        ) ?? null;
      setActive(next);
      toast.success(
        "Current workspace version updated.",
      );
      window.location.reload();
    } catch {
      toast.error(
        "This browser workspace version is no longer available.",
      );
    }
  }

  function renderAction(
    answer: WorkspaceCopilotAnswer,
  ) {
    const action =
      answer.action;

    if (!action) {
      return null;
    }

    if (
      action.kind ===
      "make-current" &&
      action.targetNodeId
    ) {
      return (
        <button
          type="button"
          onClick={() =>
            void makeCurrent(
              action.targetNodeId!,
            )
          }
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
        >
          {action.label}
          <ArrowRight
            size={16}
          />
        </button>
      );
    }

    let href = "/dashboard";

    if (
      action.kind ===
      "compare-documents" &&
      action.targetNodeIds?.length
    ) {
      href =
        buildWorkspaceMultiHandoffHref(
          "/compare-documents",
          action.targetNodeIds,
        );
    } else if (
      action.kind ===
      "safe-share" &&
      (
        action.targetNodeId ??
        active?.id
      )
    ) {
      href =
        buildWorkspaceHandoffHref(
          "/safe-share",
          action.targetNodeId ??
            active!.id,
        );
    } else if (
      action.kind ===
      "findings-center"
    ) {
      href =
        "/workspace-findings";
    } else if (
      action.kind ===
        "inspect-document" &&
      (
        action.targetNodeId ??
        active?.id
      )
    ) {
      href =
        buildWorkspaceHandoffHref(
          "/document-inspector",
          action.targetNodeId ??
            active!.id,
        );
    }

    return (
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
      >
        {action.label}
        <ArrowRight
          size={16}
        />
      </Link>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm dark:border-violet-900 dark:bg-slate-900">
        <div className="bg-gradient-to-br from-violet-50 via-blue-50 to-cyan-50 p-6 dark:from-violet-950/30 dark:via-blue-950/20 dark:to-cyan-950/20 sm:p-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
                <Bot
                  size={24}
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                    Workspace Copilot V1
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-700 shadow-sm dark:bg-slate-950 dark:text-violet-300">
                    Evidence-backed
                  </span>
                </div>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  Ask the workspace what to do next
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                  Copilot V1 combines stored lineage, relationship verification, local SHA-256/text comparison, and Safe Share checks. It does not send document content to a cloud model.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck
                size={17}
              />
              Browser-local evidence
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <LoaderCircle
            size={19}
            className="animate-spin"
          />
          Building the local evidence brief…
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      )}

      {!loading &&
        !error && (
        <>
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">
                  Current evidence scope
                </p>
                <p className="mt-2 break-all text-lg font-black text-slate-950 dark:text-white">
                  {active?.name ??
                    "No active document"}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {summaries.length} stored state(s)
                  {comparisonTarget
                    ? ` · comparison target: ${comparisonTarget.targetName}`
                    : " · no related comparison target"}
                </p>
              </div>

              <Link
                href="/workspace-findings"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300"
              >
                <FileSearch
                  size={16}
                />
                Review evidence
              </Link>
            </div>
          </section>

          <section className="mt-6 grid gap-3 md:grid-cols-2">
            {(
              Object.keys(
                questionLabels,
              ) as WorkspaceCopilotQuestion[]
            ).map(
              (question) => {
                const answer =
                  answers.find(
                    (item) =>
                      item.question ===
                      question,
                  );
                const activeQuestion =
                  selectedQuestion ===
                  question;

                return (
                  <button
                    key={
                      question
                    }
                    type="button"
                    onClick={() =>
                      setSelectedQuestion(
                        question,
                      )
                    }
                    className={
                      "rounded-2xl border p-5 text-left transition " +
                      (activeQuestion
                        ? "border-violet-400 bg-violet-50 shadow-sm dark:border-violet-700 dark:bg-violet-950/20"
                        : "border-slate-200 bg-white hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900")
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-extrabold text-slate-950 dark:text-white">
                        {
                          questionLabels[
                            question
                          ]
                        }
                      </p>
                      <StatusIcon
                        status={
                          answer?.status ??
                          "not-verified"
                        }
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {answer?.title ??
                        "Evidence not available"}
                    </p>
                  </button>
                );
              },
            )}
          </section>

          {selectedAnswer && (
            <section className="mt-6 rounded-3xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900 dark:bg-slate-900 sm:p-8">
              <div className="flex items-start gap-3">
                <Sparkles
                  size={21}
                  className="mt-1 shrink-0 text-violet-600"
                />
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
                    {
                      questionLabels[
                        selectedAnswer
                          .question
                      ]
                    }
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                    {
                      selectedAnswer.title
                    }
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                    {
                      selectedAnswer.answer
                    }
                  </p>
                </div>
              </div>

              {selectedAnswer.evidence
                .length > 0 && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedAnswer.evidence.map(
                    (
                      evidence,
                      index,
                    ) => (
                      <div
                        key={
                          evidence.label +
                          String(
                            index,
                          )
                        }
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {
                            evidence.label
                          }
                        </p>
                        <p className="mt-2 break-words text-sm font-extrabold text-slate-950 dark:text-white">
                          {
                            evidence.value
                          }
                        </p>
                      </div>
                    ),
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {renderAction(
                  selectedAnswer,
                )}
                {active && (
                  <Link
                    href={buildWorkspaceHandoffHref(
                      "/document-inspector",
                      active.id,
                    )}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    Inspect current document
                  </Link>
                )}
              </div>
            </section>
          )}

          <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-xs leading-6 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
            <strong>
              Copilot V1 boundary:
            </strong>{" "}
            answers are deterministic summaries of evidence Kukureku can currently verify. It does not infer legal meaning, document intent, or hidden/scanned content beyond the declared local checks.
          </section>
        </>
      )}
    </main>
  );
}

function StatusIcon({
  status,
}: {
  status:
    | "ready"
    | "attention"
    | "not-verified";
}) {
  if (
    status ===
    "ready"
  ) {
    return (
      <CheckCircle2
        size={18}
        className="shrink-0 text-emerald-600"
      />
    );
  }

  if (
    status ===
    "attention"
  ) {
    return (
      <AlertTriangle
        size={18}
        className="shrink-0 text-amber-600"
      />
    );
  }

  return (
    <CircleHelp
      size={18}
      className="shrink-0 text-slate-400"
    />
  );
}
