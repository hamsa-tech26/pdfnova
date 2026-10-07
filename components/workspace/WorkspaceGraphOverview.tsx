"use client";

import {
  getWorkspaceChildren,
  getWorkspaceParents,
  groupWorkspaceDocuments,
} from "@/lib/storage/workspaceGraph";
import type {
  WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  Check,
  Files,
  GitFork,
  GitMerge,
} from "lucide-react";

function relationLabel(
  summary: WorkspaceFileSummary,
) {
  if (
    summary.relationKind ===
    "composition"
  ) {
    return "Composed document";
  }

  if (
    summary.relationKind ===
    "branch"
  ) {
    return "Child document";
  }

  if (
    summary.relationKind ===
    "revision"
  ) {
    return (
      summary.operationLabel ??
      "Derived version"
    );
  }

  return "Source document";
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
  const documents =
    groupWorkspaceDocuments(
      summaries,
    );
  const parents =
    getWorkspaceParents(
      active,
      summaries,
    );
  const children =
    getWorkspaceChildren(
      active,
      summaries,
    );

  return (
    <section className="mt-6 rounded-2xl border border-violet-200 bg-white/80 p-5 dark:border-violet-900 dark:bg-slate-950/40">
      <div className="flex items-start gap-3">
        <Files
          size={20}
          className="mt-0.5 shrink-0 text-violet-700 dark:text-violet-300"
        />
        <div>
          <p className="font-extrabold text-gray-950 dark:text-white">
            Documents in workspace
          </p>
          <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-slate-400">
            {documents.length}{" "}
            {documents.length === 1
              ? "document"
              : "documents"}{" "}
            stored locally. Each document can have its own versions while Merge, Split and Extract preserve graph relationships.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {documents.map(
          (document) => {
            const isActive =
              document.documentId ===
              active.documentId;

            return (
              <div
                key={
                  document.documentId
                }
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                        {
                          relationLabel(
                            document.head,
                          )
                        }
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <Check
                            size={12}
                          />
                          Current
                        </span>
                      )}
                    </div>

                    <p className="mt-2 max-w-full truncate text-sm font-extrabold text-gray-950 dark:text-white">
                      {
                        document.head
                          .name
                      }
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">
                      {
                        document.versions
                          .length
                      }{" "}
                      {document.versions
                        .length ===
                      1
                        ? "version"
                        : "versions"}
                      {" · "}
                      {
                        document.head
                          .rootIds
                          .length
                      }{" "}
                      {document.head
                        .rootIds
                        .length ===
                      1
                        ? "source root"
                        : "source roots"}
                    </p>
                  </div>

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() =>
                        onMakeCurrent(
                          document.head
                            .id,
                        )
                      }
                      className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300"
                    >
                      Make current
                    </button>
                  )}
                </div>
              </div>
            );
          },
        )}
      </div>

      {(parents.length > 0 ||
        children.length >
          0) && (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {parents.length >
            0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-slate-300">
                <GitMerge
                  size={15}
                />
                Parent documents
              </p>
              <div className="mt-3 space-y-2">
                {parents.map(
                  (parent) => (
                    <p
                      key={
                        parent.id
                      }
                      className="truncate text-sm font-semibold text-gray-800 dark:text-slate-200"
                    >
                      {
                        parent.name
                      }
                    </p>
                  ),
                )}
              </div>
            </div>
          )}

          {children.length >
            0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-slate-300">
                <GitFork
                  size={15}
                />
                Child documents
              </p>
              <div className="mt-3 space-y-2">
                {children.map(
                  (child) => (
                    <button
                      key={
                        child.id
                      }
                      type="button"
                      onClick={() =>
                        onMakeCurrent(
                          child.id,
                        )
                      }
                      className="block max-w-full truncate text-left text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
                    >
                      {
                        child.name
                      }
                    </button>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
