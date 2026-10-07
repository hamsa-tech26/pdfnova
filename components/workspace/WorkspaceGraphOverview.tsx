"use client";

import {
  ArrowRight,
  Check,
  FileText,
  GitBranch,
  GitMerge,
  Network,
} from "lucide-react";
import type {
  WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";

function relationLabel(
  summary: WorkspaceFileSummary,
) {
  if (
    summary.relationKind ===
    "composition"
  ) {
    return "Composition";
  }

  if (
    summary.relationKind ===
    "branch"
  ) {
    return "Branch";
  }

  if (
    summary.relationKind ===
    "revision"
  ) {
    return "Revision";
  }

  return "Source";
}

function relationIcon(
  summary: WorkspaceFileSummary,
) {
  if (
    summary.relationKind ===
    "composition"
  ) {
    return GitMerge;
  }

  if (
    summary.relationKind ===
    "branch"
  ) {
    return GitBranch;
  }

  return FileText;
}

export default function WorkspaceGraphOverview({
  active,
  summaries,
  onMakeCurrent,
}: Readonly<{
  active: WorkspaceFileSummary;
  summaries: WorkspaceFileSummary[];
  onMakeCurrent: (
    id: string,
  ) => void;
}>) {
  const generations =
    [...new Set(
      summaries.map(
        (summary) =>
          summary.generation,
      ),
    )].sort(
      (left, right) =>
        left - right,
    );

  const byGeneration =
    generations.map(
      (generation) => ({
        generation,
        nodes: summaries
          .filter(
            (summary) =>
              summary.generation ===
              generation,
          )
          .sort((left, right) =>
            left.savedAt.localeCompare(
              right.savedAt,
            ),
          ),
      }),
    );

  const byId = new Map(
    summaries.map(
      (summary) => [
        summary.id,
        summary,
      ],
    ),
  );

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-violet-200 bg-white/80 dark:border-violet-900 dark:bg-slate-950/40">
      <div className="border-b border-violet-100 bg-violet-50/70 p-5 dark:border-violet-950 dark:bg-violet-950/20">
        <div className="flex items-start gap-3">
          <Network
            size={21}
            className="mt-0.5 shrink-0 text-violet-700 dark:text-violet-300"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-extrabold text-gray-950 dark:text-white">
                Visual Document Graph V1
              </p>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-700 shadow-sm dark:bg-slate-950 dark:text-violet-300">
                Browser-local
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-400">
              Each node is a stored document state. Columns represent graph generations; parent labels preserve provenance across revisions, branches, and multi-parent compositions.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto p-5">
        <div className="flex min-w-max items-start gap-4">
          {byGeneration.map(
            (
              column,
              columnIndex,
            ) => (
              <div
                key={
                  column.generation
                }
                className="flex items-start gap-4"
              >
                {columnIndex >
                  0 && (
                  <div className="mt-16 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300">
                    <ArrowRight
                      size={17}
                    />
                  </div>
                )}

                <div className="w-72 shrink-0">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-gray-400 dark:text-slate-500">
                    Generation{" "}
                    {
                      column.generation
                    }
                  </p>

                  <div className="space-y-3">
                    {column.nodes.map(
                      (node) => {
                        const Icon =
                          relationIcon(
                            node,
                          );
                        const isActive =
                          node.id ===
                          active.id;
                        const parents =
                          node.parentIds
                            .map(
                              (id) =>
                                byId.get(
                                  id,
                                ),
                            )
                            .filter(
                              (
                                item,
                              ): item is WorkspaceFileSummary =>
                                Boolean(
                                  item,
                                ),
                            );

                        return (
                          <button
                            key={
                              node.id
                            }
                            type="button"
                            onClick={() =>
                              onMakeCurrent(
                                node.id,
                              )
                            }
                            aria-label={
                              "Open graph node " +
                              node.name
                            }
                            className={
                              "block w-full rounded-2xl border p-4 text-left transition " +
                              (isActive
                                ? "border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20"
                                : "border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800")
                            }
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " +
                                  (isActive
                                    ? "bg-emerald-600 text-white"
                                    : "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300")
                                }
                              >
                                <Icon
                                  size={
                                    17
                                  }
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                    {
                                      relationLabel(
                                        node,
                                      )
                                    }
                                  </span>
                                  {isActive && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                      <Check
                                        size={
                                          10
                                        }
                                      />
                                      Current
                                    </span>
                                  )}
                                </div>

                                <p className="mt-2 truncate text-sm font-extrabold text-gray-950 dark:text-white">
                                  {
                                    node.name
                                  }
                                </p>
                                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                                  V
                                  {
                                    node.version
                                  }{" "}
                                  ·{" "}
                                  {
                                    node.parentIds
                                      .length
                                  }{" "}
                                  {node.parentIds
                                    .length ===
                                  1
                                    ? "parent"
                                    : "parents"}
                                </p>

                                {parents.length >
                                  0 && (
                                  <div className="mt-3 border-t border-gray-200 pt-2 dark:border-slate-800">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                      From
                                    </p>
                                    <p className="mt-1 truncate text-xs font-semibold text-gray-600 dark:text-slate-300">
                                      {parents
                                        .map(
                                          (
                                            parent,
                                          ) =>
                                            parent.name,
                                        )
                                        .join(
                                          " + ",
                                        )}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 px-5 py-4 text-xs leading-5 text-gray-500 dark:border-slate-800 dark:text-slate-400">
        Graph position reflects stored lineage metadata, not inferred semantic similarity. Clicking a node makes that exact browser-local state current.
      </div>
    </section>
  );
}
