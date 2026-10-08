"use client";

import {
  DEFAULT_PRIVATE_WORKSPACE_INTELLIGENCE_SETTINGS,
  DEFAULT_WORKSPACE_INTELLIGENCE_PRIVACY_POLICY,
  alignPdfPages,
  answerWorkspaceQuestion,
  buildWorkspaceEvidenceIndex,
  comparePdfContentSignals,
  compareWorkspaceSections,
  compareWorkspaceTableSignals,
  createDocumentArtifact,
  createPageLevelDiff,
  createPdfContentSignal,
  createSafeSharePlan,
  createWorkspaceActionPlan,
  createWorkspaceBrief,
  createWorkspaceCopilotAnswers,
  createWorkspaceIntelligenceReport,
  detectMissingInformation,
  detectWorkspaceConceptContradictionsV2,
  enrichPdfContentSignalWithLocalOcr,
  extractWorkspaceFacts,
  extractWorkspaceSections,
  extractWorkspaceTableSignals,
  inspectPdfArtifact,
  mergeEvidenceIndexes,
  scanSensitiveText,
  scoreDocumentCompleteness,
  selectWorkspaceCopilotComparisonTarget,
  verifyWorkspaceRelationships,
  type DocumentCompletenessScore,
  type PageLevelDiffReport,
  type PdfContentSignal,
  type PrivateWorkspaceAnalysisProgress,
  type SectionComparisonFinding,
  type SmartPageAlignmentReport,
  type WorkspaceActionPlan,
  type WorkspaceBrief,
  type WorkspaceCitedAnswer,
  type WorkspaceCopilotAnswer,
  type WorkspaceCopilotComparisonContext,
  type WorkspaceCopilotQuestion,
  type WorkspaceEvidenceIndex,
  type WorkspaceFact,
  type WorkspaceFactContradiction,
  type WorkspaceTableComparisonFinding,
  type WorkspaceTableSignal,
  type MissingInformationFinding,
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
  getWorkspaceIntelligenceCacheRecord,
  loadWorkspaceIntelligenceSettings,
  pruneWorkspaceIntelligenceCache,
  saveWorkspaceIntelligenceCacheRecord,
} from "@/lib/storage/workspaceIntelligenceCache";
import {
  ArrowRight,
  Bot,
  Database,
  FileSearch,
  LoaderCircle,
  ScanText,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
} from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
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

type PrivateSemanticState = {
  active: WorkspaceFileSummary | null;
  summaries: WorkspaceFileSummary[];
  answers: WorkspaceCopilotAnswer[];
  index: WorkspaceEvidenceIndex;
  facts: WorkspaceFact[];
  contradictions: WorkspaceFactContradiction[];
  safeShare: ReturnType<
    typeof createSafeSharePlan
  > | null;
  comparison: WorkspaceCopilotComparisonContext | null;
  diff: PageLevelDiffReport | null;
  alignment: SmartPageAlignmentReport | null;
  sections: SectionComparisonFinding[];
  missing: MissingInformationFinding[];
  tables: WorkspaceTableSignal[];
  tableComparison: WorkspaceTableComparisonFinding[];
  completeness: {
    current: DocumentCompletenessScore | null;
    comparison: DocumentCompletenessScore | null;
  };
  brief: WorkspaceBrief;
  plan: WorkspaceActionPlan;
  cacheHits: number;
  cacheMisses: number;
  ocrPages: number;
};

function buildEvidenceHref(
  evidence: WorkspaceCitedAnswer["evidence"][number],
  query: string,
) {
  const params =
    new URLSearchParams({
      workspaceFile:
        evidence.citation
          .nodeId,
      page:
        String(
          evidence.citation
            .pageNumber,
        ),
      evidence:
        evidence.snippet,
      q: query,
    });

  return (
    "/evidence-viewer?" +
    params.toString()
  );
}

export default function WorkspaceCopilotPage() {
  const [
    state,
    setState,
  ] =
    useState<PrivateSemanticState | null>(
      null,
    );
  const [
    selectedQuestion,
    setSelectedQuestion,
  ] =
    useState<WorkspaceCopilotQuestion>(
      "next-step",
    );
  const [query, setQuery] =
    useState("");
  const [
    queryAnswer,
    setQueryAnswer,
  ] =
    useState<WorkspaceCitedAnswer | null>(
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
  const [
    progress,
    setProgress,
  ] =
    useState<PrivateWorkspaceAnalysisProgress | null>(
      null,
    );
  const abortRef =
    useRef<AbortController | null>(
      null,
    );

  useEffect(() => {
    const controller =
      new AbortController();
    abortRef.current =
      controller;
    let cancelled = false;

    async function analyze() {
      setLoading(true);
      setError("");
      setProgress({
        phase:
          "native-text",
        completed: 0,
        total: 1,
        message:
          "Preparing private workspace intelligence.",
      });

      try {
        const settings =
          loadWorkspaceIntelligenceSettings(
            DEFAULT_PRIVATE_WORKSPACE_INTELLIGENCE_SETTINGS,
          );
        const [
          summaries,
          active,
        ] =
          await Promise.all([
            listWorkspaceFileSummaries(),
            getActiveWorkspaceFileSummary(),
          ]);

        await pruneWorkspaceIntelligenceCache(
          summaries.map(
            (summary) =>
              summary.id,
          ),
        );

        const report =
          createWorkspaceIntelligenceReport(
            summaries,
            active?.id ??
              null,
          );
        const verification =
          verifyWorkspaceRelationships(
            summaries,
          );
        const target =
          selectWorkspaceCopilotComparisonTarget(
            summaries,
            report,
            active?.id ??
              null,
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
        const ordered =
          [
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
          ]
            .filter(
              (
                summary,
                index,
                all,
              ) =>
                all.findIndex(
                  (
                    candidate,
                  ) =>
                    candidate.id ===
                    summary.id,
                ) === index,
            )
            .slice(
              0,
              settings.maxWorkspaceNodes,
            );

        const signals =
          new Map<
            string,
            PdfContentSignal
          >();
        const partialIndexes:
          WorkspaceEvidenceIndex[] =
          [];
        const allFacts:
          WorkspaceFact[] =
          [];
        let cacheHits = 0;
        let cacheMisses = 0;
        let ocrPages = 0;

        for (
          let index = 0;
          index <
          ordered.length;
          index += 1
        ) {
          if (
            controller.signal
              .aborted
          ) {
            throw new DOMException(
              "Workspace intelligence analysis was cancelled.",
              "AbortError",
            );
          }

          const summary =
            ordered[index];
          setProgress({
            phase:
              "native-text",
            completed:
              index,
            total:
              ordered.length,
            message:
              "Checking cached intelligence for " +
              summary.name,
          });

          const cached =
            await getWorkspaceIntelligenceCacheRecord(
              summary,
            );

          if (cached) {
            cacheHits += 1;
            signals.set(
              summary.id,
              cached.signal,
            );
            partialIndexes.push(
              cached.index,
            );
            allFacts.push(
              ...cached.facts,
            );
            ocrPages +=
              (
                cached.signal
                  .pages ?? []
              ).filter(
                (page) =>
                  page.source ===
                  "ocr-tesseract",
              ).length;
            continue;
          }

          cacheMisses += 1;
          const file =
            await getWorkspaceFile(
              summary.id,
            );

          if (!file) {
            continue;
          }

          let signal =
            await createPdfContentSignal(
              file,
            );

          const enriched =
            await enrichPdfContentSignalWithLocalOcr(
              file,
              signal,
              {
                mode:
                  settings.ocrMode,
                maxPages:
                  settings.maxOcrPagesPerDocument,
                abortSignal:
                  controller.signal,
                onProgress:
                  setProgress,
              },
            );

          signal =
            enriched.signal;
          ocrPages +=
            enriched.coverage
              .recognizedPages
              .length;

          const partialIndex =
            buildWorkspaceEvidenceIndex(
              [
                {
                  node:
                    summary,
                  signal,
                },
              ],
              {
                maxNodes: 1,
                maxPages:
                  Math.min(
                    Math.max(
                      signal.pageCount,
                      1,
                    ),
                    settings.maxWorkspacePages,
                  ),
                maxChunks:
                  Math.min(
                    Math.max(
                      signal.pageCount *
                        6,
                      12,
                    ),
                    settings.maxWorkspaceChunks,
                  ),
              },
            );
          const facts =
            extractWorkspaceFacts(
              partialIndex,
            );

          signals.set(
            summary.id,
            signal,
          );
          partialIndexes.push(
            partialIndex,
          );
          allFacts.push(
            ...facts,
          );

          await saveWorkspaceIntelligenceCacheRecord(
            summary,
            {
              signal,
              index:
                partialIndex,
              facts,
            },
          );
        }

        setProgress({
          phase: "index",
          completed:
            ordered.length,
          total:
            ordered.length,
          message:
            "Composing persistent evidence records into the workspace index.",
        });

        const evidenceIndex =
          mergeEvidenceIndexes(
            partialIndexes,
            {
              maxNodes:
                settings.maxWorkspaceNodes,
              maxPages:
                settings.maxWorkspacePages,
              maxChunks:
                settings.maxWorkspaceChunks,
            },
          );
        const contradictions =
          detectWorkspaceConceptContradictionsV2(
            allFacts,
          );

        let safeShare:
          | ReturnType<
              typeof createSafeSharePlan
            >
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
                  {
                    ocrIncluded:
                      (
                        activeSignal.pages ??
                        []
                      ).some(
                        (page) =>
                          page.source ===
                          "ocr-tesseract",
                      ),
                  },
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
        let alignment:
          | SmartPageAlignmentReport
          | null = null;
        let sections:
          SectionComparisonFinding[] =
          [];
        let missing:
          MissingInformationFinding[] =
          [];
        let tableComparison:
          WorkspaceTableComparisonFinding[] =
          [];
        let comparisonCompleteness:
          DocumentCompletenessScore | null =
          null;
        const activeSignal =
          active
            ? signals.get(
                active.id,
              ) ?? null
            : null;
        const activeTables =
          activeSignal
            ? extractWorkspaceTableSignals(
                activeSignal,
              )
            : [];
        const activeCompleteness =
          activeSignal
            ? scoreDocumentCompleteness(
                activeSignal,
              )
            : null;

        if (
          active &&
          target &&
          activeSignal
        ) {
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
            alignment =
              alignPdfPages(
                targetSignal,
                activeSignal,
              );
            sections =
              compareWorkspaceSections(
                extractWorkspaceSections(
                  targetSignal,
                ),
                extractWorkspaceSections(
                  activeSignal,
                ),
              );
            missing =
              detectMissingInformation(
                targetSignal,
                activeSignal,
              );
            const targetTables =
              extractWorkspaceTableSignals(
                targetSignal,
              );
            tableComparison =
              compareWorkspaceTableSignals(
                targetTables,
                activeTables,
              );
            comparisonCompleteness =
              scoreDocumentCompleteness(
                targetSignal,
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
              evidenceIndex,
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
            index:
              evidenceIndex,
            facts:
              allFacts,
            contradictions,
            safeShare,
            comparison,
            diff,
            alignment,
            sections,
            missing,
            tables:
              activeTables,
            tableComparison,
            completeness: {
              current:
                activeCompleteness,
              comparison:
                comparisonCompleteness,
            },
            brief,
            plan,
            cacheHits,
            cacheMisses,
            ocrPages,
          });
          setProgress({
            phase:
              "complete",
            completed:
              ordered.length,
            total:
              ordered.length,
            message:
              "Private Workspace Intelligence is ready.",
          });
        }
      } catch (
        analysisError
      ) {
        if (
          analysisError instanceof
            DOMException &&
          analysisError.name ===
            "AbortError"
        ) {
          if (!cancelled) {
            setError(
              "Workspace intelligence analysis was cancelled.",
            );
          }
        } else if (
          !cancelled
        ) {
          setError(
            analysisError instanceof
              Error
              ? analysisError.message
              : "Private Workspace Intelligence could not analyze the browser-local workspace.",
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
      controller.abort();
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

  function activeDiffContext() {
    if (
      !state?.active ||
      !state.comparison ||
      !state.diff
    ) {
      return null;
    }

    const targetSummary =
      state.summaries.find(
        (summary) =>
          summary.id ===
          state.comparison
            ?.targetNodeId,
      );

    return {
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
            state.active.documentId,
          fileName:
            state.active.name,
          version:
            state.active.version,
          pageNumber: 1,
        },
        {
          nodeId:
            state.comparison
              .targetNodeId,
          documentId:
            targetSummary
              ?.documentId ??
            "",
          fileName:
            state.comparison
              .targetName,
          version:
            targetSummary
              ?.version ?? 1,
          pageNumber: 1,
        },
      ] as const,
    };
  }

  function runQuery(
    event?: FormEvent,
  ) {
    event?.preventDefault();

    if (!state) {
      return;
    }

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
          activeDiff:
            activeDiffContext(),
        },
      ),
    );
  }

  function actionHref(
    step: WorkspaceActionPlan["steps"][number],
  ) {
    if (!step.route) {
      return null;
    }

    return step.targetNodeId
      ? buildWorkspaceHandoffHref(
          step.route,
          step.targetNodeId,
        )
      : step.route;
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <LoaderCircle
              size={20}
              className="animate-spin text-violet-600"
            />
            <div>
              <p className="font-extrabold text-slate-950 dark:text-white">
                Building Private Workspace Intelligence V2
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {progress?.message ??
                  "Loading local evidence…"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              abortRef.current?.abort()
            }
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            <Square
              size={14}
            />
            Cancel analysis
          </button>
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
                <Bot
                  size={24}
                />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                  Workspace Copilot V3 · Private Workspace Intelligence V2
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  Understand clean, scanned, reordered, and evolving PDFs
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
                  Kukureku now reuses persistent browser intelligence, OCRs text-sparse pages locally, aligns moved pages, compares sections and tables, normalizes facts, detects missing information, and keeps every evidence path inspectable.
                </p>
              </div>
            </div>
            <Link
              href="/workspace-privacy"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-300"
            >
              <ShieldCheck
                size={16}
              />
              Privacy controls
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Cache reused"
          value={String(
            state.cacheHits,
          )}
        />
        <Metric
          label="Newly analyzed"
          value={String(
            state.cacheMisses,
          )}
        />
        <Metric
          label="Local OCR pages"
          value={String(
            state.ocrPages,
          )}
        />
        <Metric
          label="Evidence pages"
          value={String(
            state.index.coverage
              .pageCount,
          )}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-blue-200 bg-white p-6 shadow-sm dark:border-blue-900 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <Sparkles
            size={20}
            className="mt-1 shrink-0 text-blue-600"
          />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
              Workspace Brief V2
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
      </section>

      <section className="mt-6 rounded-3xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <Search
            size={20}
            className="mt-1 shrink-0 text-violet-600"
          />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
              Private Semantic Layer V1
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              Ask across native text and local OCR evidence
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
            placeholder="Example: Which file contains the warranty or final contract amount?"
            className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
          <button
            type="submit"
            className="min-h-12 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-700"
          >
            Search evidence
          </button>
        </form>

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
                          href={buildEvidenceHref(
                            evidence,
                            query,
                          )}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline dark:text-blue-300"
                        >
                          <FileSearch
                            size={13}
                          />
                          View evidence
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
                <p className="font-extrabold text-slate-950 dark:text-white">
                  {
                    questionLabels[
                      question
                    ]
                  }
                </p>
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
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">
            {
              selectedAnswer.title
            }
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
            {
              selectedAnswer.answer
            }
          </p>
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
        <InsightCard
          title="Smart Page Alignment V1"
          icon="pages"
          rows={[
            "Same position: " +
              (state.alignment
                ?.summary
                .samePosition ??
                0),
            "Moved: " +
              (state.alignment
                ?.summary.moved ??
                0),
            "Changed: " +
              (state.alignment
                ?.summary.changed ??
                0),
            "Added / removed: " +
              ((state.alignment
                ?.summary.added ??
                0) +
                (state.alignment
                  ?.summary
                  .removed ??
                  0)),
          ]}
        />
        <InsightCard
          title="Document Completeness Intelligence V1"
          icon="scan"
          rows={[
            "Current heuristic score: " +
              (state.completeness
                .current?.score ??
                "Not available") +
              (state.completeness
                .current
                ? "/100"
                : ""),
            "Comparison score: " +
              (state.completeness
                .comparison
                ?.score ??
                "Not available") +
              (state.completeness
                .comparison
                ? "/100"
                : ""),
            "Missing detected sections: " +
              state.missing.length,
            "This score is heuristic, not a legal completeness claim.",
          ]}
        />
        <InsightCard
          title="Section-Level Comparison V1"
          icon="scan"
          rows={[
            "Detected changes: " +
              state.sections.filter(
                (item) =>
                  item.status ===
                  "changed",
              ).length,
            "Added sections: " +
              state.sections.filter(
                (item) =>
                  item.status ===
                  "added",
              ).length,
            "Removed sections: " +
              state.sections.filter(
                (item) =>
                  item.status ===
                  "removed",
              ).length,
            ...state.sections
              .filter(
                (item) =>
                  item.status !==
                  "unchanged",
              )
              .slice(0, 2)
              .map(
                (item) =>
                  item.status +
                  ": " +
                  item.title,
              ),
          ]}
        />
        <InsightCard
          title="Table Intelligence V1"
          icon="database"
          rows={[
            "Current table-like pages: " +
              state.tables.length,
            "Changed table pages: " +
              state.tableComparison.filter(
                (item) =>
                  item.status ===
                  "changed",
              ).length,
            "Added / removed table pages: " +
              state.tableComparison.filter(
                (item) =>
                  item.status ===
                    "added" ||
                  item.status ===
                    "removed",
              ).length,
            "Table detection is confidence-based and remains reviewable.",
          ]}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900 dark:bg-slate-900">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">
          Entity & Fact Normalization V2 · Conflict Detection V2
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {state.facts.length} fact(s) were extracted; {state.contradictions.length} normalized cross-document conflict(s) need review.
        </p>
        {state.contradictions.length >
          0 && (
          <div className="mt-4 space-y-3">
            {state.contradictions
              .slice(0, 4)
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
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {
                        conflict.explanation
                      }
                    </p>
                  </div>
                ),
              )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-slate-900">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">
          Copilot Action Planner V1
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Automatic modifying actions remain disabled.
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

      <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-xs leading-6 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
        <strong>
          Privacy boundary:
        </strong>{" "}
        Cloud AI is {DEFAULT_WORKSPACE_INTELLIGENCE_PRIVACY_POLICY.cloudAiEnabled ? "enabled" : "off"} and document upload for intelligence is {DEFAULT_WORKSPACE_INTELLIGENCE_PRIVACY_POLICY.documentUploadEnabled ? "enabled" : "off"}. Persistent evidence and OCR records remain in browser IndexedDB.
      </section>
    </main>
  );
}

function InsightCard({
  title,
  rows,
  icon,
}: {
  title: string;
  rows: string[];
  icon:
    | "pages"
    | "scan"
    | "database";
}) {
  const Icon =
    icon === "database"
      ? Database
      : ScanText;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <Icon
          size={19}
          className="text-violet-600"
        />
        <h2 className="font-black text-slate-950 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map(
          (row) => (
            <p
              key={row}
              className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400"
            >
              {row}
            </p>
          ),
        )}
      </div>
    </section>
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
        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white"
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
      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white"
    >
      {action.label}
      <ArrowRight
        size={16}
      />
    </Link>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}
