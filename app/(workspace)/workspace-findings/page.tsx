"use client";

import {
  createWorkspaceIntelligenceReport,
  createWorkspaceRelationshipActions,
  verifyWorkspaceRelationships,
} from "@/lib/document-engine";
import {
  buildWorkspaceHandoffHref,
  buildWorkspaceMultiHandoffHref,
  getActiveWorkspaceFileSummary,
  listWorkspaceFileSummaries,
  setActiveWorkspaceFile,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ListChecks,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

export default function WorkspaceFindingsPage() {
  const [
    summaries,
    setSummaries,
  ] = useState<
    WorkspaceFileSummary[]
  >([]);
  const [
    active,
    setActive,
  ] = useState<WorkspaceFileSummary | null>(
    null,
  );
  const [
    loaded,
    setLoaded,
  ] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [
          nextSummaries,
          nextActive,
        ] = await Promise.all([
          listWorkspaceFileSummaries(),
          getActiveWorkspaceFileSummary(),
        ]);

        if (!cancelled) {
          setSummaries(
            nextSummaries,
          );
          setActive(nextActive);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const report = useMemo(
    () =>
      createWorkspaceIntelligenceReport(
        summaries,
        active?.id ?? null,
      ),
    [
      active?.id,
      summaries,
    ],
  );

  const verification =
    useMemo(
      () =>
        verifyWorkspaceRelationships(
          summaries,
        ),
      [summaries],
    );

  const actions = useMemo(
    () =>
      createWorkspaceRelationshipActions(
        summaries,
        report,
        active?.id ?? null,
      ),
    [
      active?.id,
      report,
      summaries,
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
          (item) =>
            item.id === id,
        ) ?? null;
      setActive(next);
      toast.success(
        "Current workspace document updated.",
      );
    } catch {
      toast.error(
        "This browser workspace document is no longer available.",
      );
    }
  }

  if (!loaded) {
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              <ListChecks
                size={15}
              />
              Workspace Findings Center
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              Review what Kukureku knows—and what it does not
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              This center combines deterministic workspace lineage findings with cross-document relationship verification. It does not infer document meaning from the graph.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck
              size={17}
            />
            Browser-local metadata
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Documents"
            value={String(
              report.summary
                .documentCount,
            )}
          />
          <Metric
            label="Stored states"
            value={String(
              report.summary
                .nodeCount,
            )}
          />
          <Metric
            label="Findings"
            value={String(
              report.findings
                .length,
            )}
          />
          <Metric
            label="Verification"
            value={
              verification.status
            }
          />
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">
          Cross-Document Verification V1
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Verifies stored parent references, revision continuity, branch provenance, and multi-parent composition structure.
        </p>

        <div className="mt-5 space-y-3">
          {verification.checks.map(
            (check) => {
              const Icon =
                check.status ===
                "PASS"
                  ? CheckCircle2
                  : check.status ===
                      "FAILED"
                    ? AlertTriangle
                    : CircleHelp;

              return (
                <article
                  key={check.id}
                  className={
                    "rounded-2xl border p-4 " +
                    (check.status ===
                    "PASS"
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20"
                      : check.status ===
                          "FAILED"
                        ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                        : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950")
                  }
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      size={19}
                      className="mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="font-extrabold text-slate-950 dark:text-white">
                        {
                          check.title
                        }
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {
                          check.detail
                        }
                      </p>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">
          Workspace intelligence findings
        </h2>

        {report.findings.length ===
        0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
            No relationship finding is available yet.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {report.findings.map(
              (finding) => {
                const findingActions =
                  actions.filter(
                    (action) =>
                      action.sourceFindingId ===
                      finding.id,
                  );

                return (
                  <article
                    key={finding.id}
                    className={
                      "rounded-2xl border p-5 " +
                      (finding.severity ===
                      "attention"
                        ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"
                        : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950")
                    }
                  >
                    <div className="flex flex-col justify-between gap-2 sm:flex-row">
                      <div>
                        <p className="font-extrabold text-slate-950 dark:text-white">
                          {
                            finding.title
                          }
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                          {
                            finding.detail
                          }
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-slate-500">
                        {
                          finding.confidence
                        }
                      </span>
                    </div>

                    {findingActions.length >
                      0 && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        {findingActions.map(
                          (action) => {
                            if (
                              action.kind ===
                              "make-current"
                            ) {
                              return (
                                <button
                                  key={
                                    action.id
                                  }
                                  type="button"
                                  onClick={() =>
                                    void makeCurrent(
                                      action.targetNodeId,
                                    )
                                  }
                                  className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700"
                                >
                                  {
                                    action.label
                                  }
                                </button>
                              );
                            }

                            const targets =
                              action.targetNodeIds?.length
                                ? action.targetNodeIds
                                : [
                                    active?.id ??
                                      action.targetNodeId,
                                    action.targetNodeId,
                                  ];
                            const href =
                              action.kind ===
                              "compare-documents"
                                ? buildWorkspaceMultiHandoffHref(
                                    "/compare-documents",
                                    targets,
                                  )
                                : action.kind ===
                                    "prepare-merge"
                                  ? buildWorkspaceMultiHandoffHref(
                                      "/merge-pdf",
                                      targets,
                                    )
                                  : buildWorkspaceHandoffHref(
                                      "/document-inspector",
                                      action.targetNodeId,
                                    );

                            return (
                              <Link
                                key={
                                  action.id
                                }
                                href={href}
                                className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 dark:border-violet-900 dark:bg-slate-900 dark:text-violet-300"
                              >
                                {
                                  action.label
                                }
                              </Link>
                            );
                          },
                        )}
                      </div>
                    )}
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </main>
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
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-xl font-black text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}
