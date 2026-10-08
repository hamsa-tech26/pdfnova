"use client";

import {
  DEFAULT_WORKSPACE_INTELLIGENCE_PRIVACY_POLICY,
  answerWorkspaceQuestion,
  buildWorkspaceEvidenceIndex,
  comparePdfContentSignals,
  createDocumentArtifact,
  createPageLevelDiff,
  createPdfContentSignal,
  createSafeSharePlan,
  createWorkspaceActionPlan,
  createWorkspaceBrief,
  createWorkspaceCopilotAnswers,
  createWorkspaceIntelligenceReport,
  detectWorkspaceFactContradictions,
  extractWorkspaceFacts,
  inspectPdfArtifact,
  scanSensitiveText,
  selectWorkspaceCopilotComparisonTarget,
  verifyWorkspaceRelationships,
  type PdfContentSignal,
  type SafeSharePlan,
  type WorkspaceActionPlan,
  type WorkspaceBrief,
  type WorkspaceCitedAnswer,
  type WorkspaceCopilotAnswer,
  type WorkspaceCopilotComparisonContext,
  type WorkspaceCopilotQuestion,
  type WorkspaceEvidenceIndex,
  type WorkspaceFact,
  type WorkspaceFactContradiction,
  type PageLevelDiffReport,
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
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
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

type SemanticState = {
  active: WorkspaceFileSummary | null;
  summaries: WorkspaceFileSummary[];
  answers: WorkspaceCopilotAnswer[];
  index: WorkspaceEvidenceIndex;
  facts: WorkspaceFact[];
  contradictions: WorkspaceFactContradiction[];
  safeShare: SafeSharePlan | null;
  comparison: WorkspaceCopilotComparisonContext | null;
  diff: PageLevelDiffReport | null;
  brief: WorkspaceBrief;
  plan: WorkspaceActionPlan;
};

function emptyIndex(): WorkspaceEvidenceIndex {
  return {
    pages: [],
    chunks: [],
    indexedNodeIds: [],
    skippedNodeIds: [],
    coverage: {
      mode:
        "browser-local-selectable-text",
      maxNodes: 10,
      maxPages: 160,
      maxChunks: 480,
      pageCount: 0,
      chunkCount: 0,
      truncated: false,
      notes: [],
    },
  };
}

export default function WorkspaceCopilotPage() {
  const [
    state,
    setState,
  ] = useState<SemanticState | null>(
    null,
  );
  const [
    selectedQuestion,
    setSelectedQuestion,
  ] =
    useState<WorkspaceCopilotQuestion>(
      "next-step",
    );
  const [
    query,
    setQuery,
  ] = useState("");
  const [
    queryAnswer,
    setQueryAnswer,
  ] = useState<WorkspaceCitedAnswer | null>(
    null,
  );
  const [
    loading,
    setLoading,
  ] = useState(true);
  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      setLoading(true);
      setError("");

      try {
        const [
          summaries,
          active,
        ] = await Promise.all([
          listWorkspaceFileSummaries(),
          getActiveWorkspaceFileSummary(),
        ]);
        const report =
          createWorkspaceIntelligenceReport(
            summaries,
            active?.id ?? null,
          );
        const verification =
          verifyWorkspaceRelationships(
            summaries,
          );
        const target =
          selectWorkspaceCopilotComparisonTarget(
            summaries,
            report,
            active?.id ?? null,
          );

        const priorityIds = [
          active?.id,
          target?.targetNodeId,
        ].filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        );
        const ordered = [
          ...priorityIds
            .map(
              (id) =>
                summaries.find(
                  (summary) =>
                    summary.id ===
                    id,
                ),
            )
            .filter(
              (
                value,
              ): value is WorkspaceFileSummary =>
                Boolean(value),
            ),
          ...summaries.filter(
            (summary) =>
              !priorityIds.includes(
                summary.id,
              ),
          ),
        ];
        const uniqueOrdered =
          ordered.filter(
            (
              summary,
              index,
              all,
            ) =>
              all.findIndex(
                (candidate) =>
                  candidate.id ===
                  summary.id,
              ) === index,
          );
        const signalInputs: Array<{
          node: WorkspaceFileSummary;
          signal: PdfContentSignal;
        }> = [];
        const signals =
          new Map<
            string,
            PdfContentSignal
          >();
        let indexedPages = 0;

        for (
          const summary of uniqueOrdered.slice(
            0,
            10,
          )
        ) {
          if (
            indexedPages >= 160
          ) {
            break;
          }

          const file =
            await getWorkspaceFile(
              summary.id,
            );

          if (!file) {
            continue;
          }

          try {
            const signal =
              await createPdfContentSignal(
                file,
              );

            signalInputs.push({
              node: summary,
              signal,
            });
            signals.set(
              summary.id,
              signal,
            );
            indexedPages +=
              signal.pageCount;
          } catch {
            // A single unsupported or damaged file must not block the workspace brief.
          }
        }

        const index =
          buildWorkspaceEvidenceIndex(
            signalInputs,
          );
        const facts =
          extractWorkspaceFacts(
            index,
          );
        const contradictions =
          detectWorkspaceFactContradictions(
            facts,
          );
        let safeShare:
          | SafeSharePlan
          | null = null;

        if (active) {
          const activeFile =
            await getWorkspaceFile(
              active.id,
            );
          const activeSignal =
            signals.get(
              active.id,
            );

          if (
            activeFile &&
            activeSignal
          ) {
            try {
              const inspection =
                await inspectPdfArtifact(
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
                );
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
            } catch {
              safeShare =
                null;
            }
          }
        }

        let comparison:
          | WorkspaceCopilotComparisonContext
          | null = null;
        let diff:
          | PageLevelDiffReport
          | null = null;

        if (
          active &&
          target
        ) {
          const activeSignal =
            signals.get(
              active.id,
            );
          const targetSignal =
            signals.get(
              target.targetNodeId,
            );
          const targetSummary =
            summaries.find(
              (summary) =>
                summary.id ===
                target.targetNodeId,
            );

          if (
            activeSignal &&
            targetSignal &&
            targetSummary
          ) {
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
            diff =
              createPageLevelDiff(
                targetSignal,
                activeSignal,
              );
          }
        }

        const answers =
          createWorkspaceCopilotAnswers(
            {
              nodes:
                summaries,
              report,
              verification,
              activeNodeId:
                active?.id ??
                null,
              comparison,
              safeShare,
            },
          );
        const plan =
          createWorkspaceActionPlan(
            {
              nodes:
                summaries,
              activeNodeId:
                active?.id ??
                null,
              verification,
              safeShare,
              contradictions,
            },
          );
        const brief =
          createWorkspaceBrief(
            {
              nodes:
                summaries,
              report,
              verification,
              contradictions,
              evidenceIndex:
                index,
              safeShare,
              actionPlan:
                plan,
            },
          );

        if (!cancelled) {
          setState({
            active,
            summaries,
            answers,
            index,
            facts,
            contradictions,
            safeShare,
            comparison,
            diff,
            brief,
            plan,
          });
        }
      } catch (
        analysisError
      ) {
        if (!cancelled) {
          setError(
            analysisError instanceof
              Error
              ? analysisError.message
              : "Semantic Workspace Intelligence could not analyze the browser-local workspace.",
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
        state?.answers.find(
          (answer) =>
            answer.question ===
            selectedQuestion,
        ) ??
        state?.answers[0] ??
        null,
      [
        selectedQuestion,
        state,
      ],
    );

  async function makeCurrent(
    id: string,
  ) {
    try {
      await setActiveWorkspaceFile(
        id,
      );
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

  function runQuery(
    event?: FormEvent,
  ) {
    event?.preventDefault();

    if (!state) {
      return;
    }

    const activeDiff =
      state.active &&
      state.comparison &&
      state.diff
        ? {
            otherName:
              state.comparison
                .targetName,
            report:
              state.diff,
            citations: [
              {
                nodeId:
                  state.active.id,
                documentId:
                  state.active
                    .documentId,
                fileName:
                  state.active.name,
                version:
                  state.active
                    .version,
                pageNumber: 1,
              },
              {
                nodeId:
                  state.comparison
                    .targetNodeId,
                documentId:
                  state.summaries.find(
                    (summary) =>
                      summary.id ===
                      state.comparison
                        ?.targetNodeId,
                  )
                    ?.documentId ??
                  "",
                fileName:
                  state.comparison
                    .targetName,
                version:
                  state.summaries.find(
                    (summary) =>
                      summary.id ===
                      state.comparison
                        ?.targetNodeId,
                  )
                    ?.version ?? 1,
                pageNumber: 1,
              },
            ] as const,
          }
        : null;

    setQueryAnswer(
      answerWorkspaceQuestion(
        query,
        {
          index:
            state.index,
          facts:
            state.facts,
          contradictions:
            state.contradictions,
          activeDiff,
        },
      ),
    );
  }

  function actionHref(
    step: WorkspaceActionPlan["steps"][number],
  ) {
    if (
      !step.route
    ) {
      return null;
    }

    if (
      step.targetNodeId
    ) {
      return buildWorkspaceHandoffHref(
        step.route,
        step.targetNodeId,
      );
    }

    return step.route;
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <LoaderCircle
            size={19}
            className="animate-spin"
          />
          Building the browser-local semantic evidence index…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      </main>
    );
  }

  if (!state) {
    return null;
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
                    Workspace Copilot V2
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-700 shadow-sm dark:bg-slate-950 dark:text-violet-300">
                    Semantic Workspace Intelligence V1
                  </span>
                </div>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  Ask across the entire workspace
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                  Search page-level evidence, extract structured facts, identify labeled conflicts, review page-level changes, and plan safe next actions. Core intelligence stays browser-local.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck
                size={17}
              />
              Local Evidence Mode
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-blue-200 bg-white p-6 shadow-sm dark:border-blue-900 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <Sparkles
            size={20}
            className="mt-1 shrink-0 text-blue-600"
          />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
              Workspace Brief V1
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              {state.brief.headline}
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {state.brief.summary.map(
            (item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
              >
                {item}
              </div>
            ),
          )}
        </div>

        {state.brief.attention.length >
          0 && (
          <div className="mt-5 space-y-2">
            {state.brief.attention.map(
              (item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200"
                >
                  <AlertTriangle
                    size={17}
                    className="mt-0.5 shrink-0"
                  />
                  {item}
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <Search
            size={20}
            className="mt-1 shrink-0 text-violet-600"
          />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
              Evidence-Cited Copilot V2
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              Ask a question across local PDFs
            </h2>
          </div>
        </div>

        <form
          onSubmit={runQuery}
          className="mt-5 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value,
              )
            }
            placeholder="Example: What is the final contract amount?"
            className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <button
            type="submit"
            className="min-h-12 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-700"
          >
            Search evidence
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "What changed?",
            "Are there conflicting amounts or dates?",
            "What is the final amount?",
            "Which document mentions payment terms?",
          ].map(
            (prompt) => (
              <button
                key={prompt}
                type="button"
                aria-label={
                  "Search evidence: " +
                  prompt
                }
                onClick={() => {
                  setQuery(prompt);
                  setQueryAnswer(
                    answerWorkspaceQuestion(
                      prompt,
                      {
                        index:
                          state.index,
                        facts:
                          state.facts,
                        contradictions:
                          state.contradictions,
                        activeDiff:
                          state.active &&
                          state.comparison &&
                          state.diff
                            ? {
                                otherName:
                                  state
                                    .comparison
                                    .targetName,
                                report:
                                  state.diff,
                                citations: [
                                  {
                                    nodeId:
                                      state.active.id,
                                    documentId:
                                      state.active.documentId,
                                    fileName:
                                      state.active.name,
                                    version:
                                      state.active.version,
                                    pageNumber:
                                      1,
                                  },
                                  {
                                    nodeId:
                                      state.comparison.targetNodeId,
                                    documentId:
                                      state.summaries.find(
                                        (summary) =>
                                          summary.id ===
                                          state.comparison?.targetNodeId,
                                      )?.documentId ??
                                      "",
                                    fileName:
                                      state.comparison.targetName,
                                    version:
                                      state.summaries.find(
                                        (summary) =>
                                          summary.id ===
                                          state.comparison?.targetNodeId,
                                      )?.version ??
                                      1,
                                    pageNumber:
                                      1,
                                  },
                                ],
                              }
                            : null,
                      },
                    ),
                  );
                }}
                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-300"
              >
                {prompt}
              </button>
            ),
          )}
        </div>

        {queryAnswer && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              {queryAnswer.basis}
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
              {queryAnswer.title}
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-400">
              {queryAnswer.answer}
            </p>

            {queryAnswer.evidence.length >
              0 && (
              <div className="mt-5 space-y-3">
                {queryAnswer.evidence.map(
                  (
                    evidence,
                    index,
                  ) => (
                    <article
                      key={
                        evidence.citation
                          .nodeId +
                        ":" +
                        evidence.citation
                          .pageNumber +
                        ":" +
                        index
                      }
                      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-extrabold text-violet-700 dark:text-violet-300">
                          {
                            evidence
                              .citation
                              .fileName
                          }{" "}
                          · Page{" "}
                          {
                            evidence
                              .citation
                              .pageNumber
                          }{" "}
                          · V
                          {
                            evidence
                              .citation
                              .version
                          }
                        </p>
                        <Link
                          href={buildWorkspaceHandoffHref(
                            "/document-inspector",
                            evidence
                              .citation
                              .nodeId,
                          )}
                          className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-300"
                        >
                          Inspect source
                        </Link>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {
                          evidence.snippet
                        }
                      </p>
                    </article>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        {(
          Object.keys(
            questionLabels,
          ) as WorkspaceCopilotQuestion[]
        ).map(
          (question) => {
            const answer =
              state.answers.find(
                (item) =>
                  item.question ===
                  question,
              );
            const activeQuestion =
              selectedQuestion ===
              question;

            return (
              <button
                key={question}
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
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">
            {
              questionLabels[
                selectedAnswer.question
              ]
            }
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
            {
              selectedAnswer.title
            }
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
            {
              selectedAnswer.answer
            }
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selectedAnswer.evidence.map(
              (
                evidence,
                index,
              ) => (
                <div
                  key={
                    evidence.label +
                    index
                  }
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {
                      evidence.label
                    }
                  </p>
                  <p className="mt-2 text-sm font-extrabold text-slate-950 dark:text-white">
                    {
                      evidence.value
                    }
                  </p>
                </div>
              ),
            )}
          </div>

          <div className="mt-5">
            <CopilotAction
              answer={
                selectedAnswer
              }
              active={
                state.active
              }
              makeCurrent={
                makeCurrent
              }
            />
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900 dark:bg-slate-900">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">
            Contradiction & Conflict Detection V1
          </h2>
          {state.contradictions
            .length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
              No labeled amount, date, or document-number conflict was found across indexed documents.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {state.contradictions
                .slice(0, 5)
                .map(
                  (conflict) => (
                    <div
                      key={
                        conflict.id
                      }
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20"
                    >
                      <p className="font-extrabold text-slate-950 dark:text-white">
                        {
                          conflict.label
                        }
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {
                          conflict.explanation
                        }
                      </p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        {
                          conflict.facts.length
                        }{" "}
                        cited value(s)
                      </p>
                    </div>
                  ),
                )}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm dark:border-blue-900 dark:bg-slate-900">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">
            Document Facts Extraction V1
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {state.facts.length} structured fact(s) extracted from selectable text.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ...new Set(
                state.facts.map(
                  (fact) =>
                    fact.kind,
                ),
              ),
            ].map(
              (kind) => (
                <span
                  key={kind}
                  className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                >
                  {kind}:{" "}
                  {
                    state.facts.filter(
                      (fact) =>
                        fact.kind ===
                        kind,
                    ).length
                  }
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {state.diff && (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">
            Page-Level Difference Intelligence V1
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Comparison by page number against{" "}
            {
              state.comparison
                ?.targetName
            }.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-5">
            {Object.entries(
              state.diff.summary,
            ).map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                    {value}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-slate-900">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">
          Copilot Action Planner V1
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Every modifying step requires explicit user confirmation. Automatic execution is disabled.
        </p>

        <div className="mt-5 space-y-3">
          {state.plan.steps.map(
            (step) => {
              const href =
                actionHref(step);

              return (
                <div
                  key={step.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Step{" "}
                      {step.order}
                    </p>
                    <p className="mt-1 font-extrabold text-slate-950 dark:text-white">
                      {
                        step.label
                      }
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {
                        step.reason
                      }
                    </p>
                  </div>
                  {href && (
                    <Link
                      href={href}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
                    >
                      Prepare
                      <ArrowRight
                        size={16}
                      />
                    </Link>
                  )}
                </div>
              );
            },
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">
          Privacy Architecture for AI
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Mode"
            value="Local Evidence"
          />
          <Metric
            label="Cloud AI"
            value="Off"
          />
          <Metric
            label="Document upload"
            value="Off"
          />
        </div>
        <p className="mt-4 text-xs leading-6 text-slate-500 dark:text-slate-400">
          {
            DEFAULT_WORKSPACE_INTELLIGENCE_PRIVACY_POLICY.notes.join(
              " ",
            )
          }
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-xs leading-6 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
        <strong>
          Evidence coverage:
        </strong>{" "}
        {state.index.coverage.pageCount} page(s),{" "}
        {state.index.coverage.chunkCount} chunk(s),{" "}
        {state.index.indexedNodeIds.length} stored state(s).
        {state.index.coverage.truncated
          ? " V1 limits were reached, so coverage is partial."
          : " The selected states fit within V1 index limits."}{" "}
        Scanned/image-only text is not OCR-expanded by this index.
      </section>
    </main>
  );
}

function CopilotAction({
  answer,
  active,
  makeCurrent,
}: {
  answer: WorkspaceCopilotAnswer;
  active: WorkspaceFileSummary | null;
  makeCurrent: (
    id: string,
  ) => Promise<void>;
}) {
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
        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
      >
        {action.label}
      </button>
    );
  }

  let href = "/dashboard";

  if (
    action.kind ===
      "compare-documents" &&
    action.targetNodeIds
  ) {
    href =
      buildWorkspaceMultiHandoffHref(
        "/compare-documents",
        action.targetNodeIds,
      );
  } else if (
    action.kind ===
    "findings-center"
  ) {
    href =
      "/workspace-findings";
  } else if (
    action.kind ===
    "safe-share"
  ) {
    const id =
      action.targetNodeId ??
      active?.id;

    if (id) {
      href =
        buildWorkspaceHandoffHref(
          "/safe-share",
          id,
        );
    }
  } else if (
    action.kind ===
    "inspect-document"
  ) {
    const id =
      action.targetNodeId ??
      active?.id;

    if (id) {
      href =
        buildWorkspaceHandoffHref(
          "/document-inspector",
          id,
        );
    }
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700"
    >
      {action.label}
      <ArrowRight
        size={16}
      />
    </Link>
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

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 font-black text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}
