"use client";

import WorkspaceGraphOverview from "@/components/workspace/WorkspaceGraphOverview";
import WorkspaceIntelligencePanel from "@/components/workspace/WorkspaceIntelligencePanel";
import {
  groupWorkspaceDocuments,
} from "@/lib/storage/workspaceGraph";
import {
  buildWorkflowRecipesHref,
  type WorkflowRecipeProgress,
} from "@/lib/document-engine";
import {
  getActiveWorkflowRecipeProgress,
  WORKFLOW_PROGRESS_CHANGE_EVENT,
} from "@/lib/storage/workflowProgress";
import {
  buildWorkspaceHandoffHref,
  clearWorkspaceFiles,
  getActiveWorkspaceFileSummary,
  listWorkspaceFileSummaries,
  setActiveWorkspaceFile,
  WORKSPACE_CHANGE_EVENT,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  Check,
  FileText,
  FolderClock,
  GitBranch,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

function formatSize(bytes: number) {
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

const continueActions = [
  {
    label: "Magic Drop",
    route: "/magic-drop",
  },
  {
    label: "Compress",
    route: "/compress-pdf",
  },
  {
    label: "Remove Metadata",
    route:
      "/remove-pdf-metadata",
  },
  {
    label: "Flatten",
    route: "/flatten-pdf",
  },
  {
    label: "Protect",
    route: "/protect-pdf",
  },
  {
    label: "Redact",
    route: "/redact-pdf",
  },
  {
    label: "Crop",
    route: "/crop-pdf",
  },
  {
    label: "Edit Metadata",
    route: "/edit-pdf-metadata",
  },
  {
    label: "Reorder Pages",
    route: "/reorder-pdf-pages",
  },
  {
    label: "Resize Pages",
    route: "/resize-pdf-pages",
  },
  {
    label: "Rotate",
    route: "/rotate-pdf",
  },
  {
    label: "Add Stamp",
    route: "/add-image-stamp-pdf",
  },
  {
    label: "Merge",
    route: "/merge-pdf",
  },
  {
    label: "Split",
    route: "/split-pdf",
  },
  {
    label: "Extract Pages",
    route: "/extract-pdf-pages",
  },
  {
    label: "Inspector",
    route:
      "/document-inspector",
  },
];

export default function ActiveWorkspaceFileCard() {
  const [active, setActive] =
    useState<WorkspaceFileSummary | null>(
      null,
    );
  const [
    versions,
    setVersions,
  ] = useState<
    WorkspaceFileSummary[]
  >([]);
  const [loaded, setLoaded] =
    useState(false);
  const [
    recipeProgress,
    setRecipeProgress,
  ] = useState<WorkflowRecipeProgress | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const [
          nextActive,
          nextVersions,
        ] = await Promise.all([
          getActiveWorkspaceFileSummary(),
          listWorkspaceFileSummaries(),
        ]);
        const nextProgress =
          getActiveWorkflowRecipeProgress();
        const progressFile =
          nextProgress
            ? nextVersions.find(
                (version) =>
                  version.id ===
                  nextProgress.currentWorkspaceFileId,
              ) ?? null
            : null;

        if (!cancelled) {
          setActive(nextActive);
          setVersions(
            nextVersions,
          );
          setRecipeProgress(
            nextActive &&
              nextProgress &&
              progressFile?.documentId ===
                nextActive.documentId
              ? nextProgress
              : null,
          );
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setActive(null);
          setVersions([]);
          setRecipeProgress(
            null,
          );
          setLoaded(true);
        }
      }
    }

    void refresh();

    const onChange = () =>
      void refresh();

    window.addEventListener(
      WORKSPACE_CHANGE_EVENT,
      onChange,
    );
    window.addEventListener(
      WORKFLOW_PROGRESS_CHANGE_EVENT,
      onChange,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        WORKSPACE_CHANGE_EVENT,
        onChange,
      );
      window.removeEventListener(
        WORKFLOW_PROGRESS_CHANGE_EVENT,
        onChange,
      );
    };
  }, []);

  const byId = useMemo(
    () =>
      new Map(
        versions.map(
          (version) => [
            version.id,
            version,
          ],
        ),
      ),
    [versions],
  );

  const documents =
    useMemo(
      () =>
        groupWorkspaceDocuments(
          versions,
        ),
      [versions],
    );

  const activeVersions =
    useMemo(
      () =>
        active
          ? documents.find(
              (document) =>
                document.documentId ===
                active.documentId,
            )?.versions ??
            []
          : [],
      [
        active,
        documents,
      ],
    );

  async function forgetWorkspace() {
    try {
      await clearWorkspaceFiles();
      toast.success(
        "Browser workspace removed.",
      );
    } catch {
      toast.error(
        "The browser workspace could not be removed.",
      );
    }
  }

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
    } catch {
      toast.error(
        "This browser workspace version is no longer available.",
      );
    }
  }

  if (!loaded) {
    return null;
  }

  if (!active) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <FolderClock
          size={26}
          className="text-gray-400"
        />
        <h3 className="mt-4 text-lg font-extrabold text-gray-950 dark:text-white">
          No active browser workspace file
        </h3>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
          Magic Drop can keep multiple local PDF documents in this browser, including versions, branches and multi-parent relationships.
        </p>
        <Link
          href="/magic-drop"
          className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Open Magic Drop
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <FileText size={22} />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
              Active workspace document
            </p>
            <h3 className="mt-2 break-all text-lg font-extrabold text-gray-950 dark:text-white">
              {active.name}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              Version {active.version} ·{" "}
              {formatSize(
                active.size,
              )} · saved locally
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void forgetWorkspace()
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          <Trash2 size={16} />
          Forget workspace
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={buildWorkspaceHandoffHref(
            "/magic-drop",
            active.id,
          )}
          className="inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Reopen in Magic Drop
        </Link>

        <Link
          href={buildWorkspaceHandoffHref(
            "/document-inspector",
            active.id,
          )}
          className="inline-flex rounded-xl border border-blue-200 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-slate-950 dark:text-blue-300"
        >
          Full Inspector
        </Link>
      </div>

      <WorkspaceGraphOverview
        active={active}
        summaries={versions}
        onMakeCurrent={(id) =>
          void makeCurrent(id)
        }
      />

      <WorkspaceIntelligencePanel
        active={active}
        summaries={versions}
        onMakeCurrent={(id) =>
          void makeCurrent(id)
        }
      />

      {recipeProgress && (
        <section
          className={
            "mt-6 rounded-2xl border p-5 " +
            (recipeProgress.status ===
            "BLOCKED_BY_VERIFICATION"
              ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
              : recipeProgress.status ===
                  "COMPLETED"
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20"
                : "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/20")
          }
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">
            Workflow recipe
          </p>
          <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="font-extrabold text-gray-950 dark:text-white">
                {
                  recipeProgress.recipeTitle
                }
              </p>
              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-slate-300">
                {recipeProgress.status ===
                "COMPLETED"
                  ? "Recipe sequence completed. Open the summary to review recorded decisions and verification limits."
                  : recipeProgress.status ===
                      "BLOCKED_BY_VERIFICATION"
                    ? "Recipe paused because a deterministic verification check failed."
                    : "Step " +
                      String(
                        Math.min(
                          recipeProgress.currentStep +
                            1,
                          recipeProgress.steps.length,
                        ),
                      ) +
                      " of " +
                      String(
                        recipeProgress.steps.length,
                      ) +
                      " is ready to resume."}
              </p>
            </div>

            <Link
              href={buildWorkflowRecipesHref(
                recipeProgress.currentWorkspaceFileId,
                recipeProgress.recipeId,
                recipeProgress.currentStep,
              )}
              className={
                "inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition " +
                (recipeProgress.status ===
                "BLOCKED_BY_VERIFICATION"
                  ? "bg-red-600 hover:bg-red-700"
                  : recipeProgress.status ===
                      "COMPLETED"
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : "bg-violet-600 hover:bg-violet-700")
              }
            >
              {recipeProgress.status ===
              "COMPLETED"
                ? "View Recipe Summary"
                : recipeProgress.status ===
                    "BLOCKED_BY_VERIFICATION"
                  ? "Review Recipe"
                  : "Resume Recipe"}
            </Link>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-blue-200 bg-white/80 p-5 dark:border-blue-900 dark:bg-slate-950/40">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
          Continue with current version
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {continueActions.map(
            (action) => (
              <Link
                key={
                  action.route
                }
                href={buildWorkspaceHandoffHref(
                  action.route,
                  active.id,
                )}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {action.label}
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-blue-200 bg-white/80 p-5 dark:border-blue-900 dark:bg-slate-950/40">
        <div className="flex items-start gap-3">
          <GitBranch
            size={20}
            className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300"
          />

          <div>
            <p className="font-extrabold text-gray-950 dark:text-white">
              Version history
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              {activeVersions.length}{" "}
              {activeVersions.length === 1
                ? "version"
                : "versions"}{" "}
              saved for this document. Other workspace documents and branches stay separate in the graph above.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {[...activeVersions]
            .reverse()
            .map((version) => {
              const parent =
                version.parentId
                  ? byId.get(
                      version.parentId,
                    )
                  : null;
              const isActive =
                active.id ===
                version.id;

              return (
                <div
                  key={version.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-gray-950 dark:text-white">
                          Version{" "}
                          {
                            version.version
                          }
                        </span>

                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <Check
                              size={
                                12
                              }
                            />
                            Current
                          </span>
                        )}
                      </div>

                      <p className="mt-2 break-all text-sm font-semibold text-gray-800 dark:text-slate-200">
                        {version.name}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">
                        {version.role ===
                        "source"
                          ? "Original workspace source"
                          : version.operationLabel ||
                            "Derived PDF"}
                        {version.parentIds
                          .length > 1
                          ? " · from " +
                            String(
                              version.parentIds
                                .length,
                            ) +
                            " parent documents"
                          : parent
                            ? " · from Version " +
                              String(
                                parent.version,
                              )
                            : ""}
                        {" · "}
                        {formatSize(
                          version.size,
                        )}
                      </p>
                    </div>

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() =>
                          void makeCurrent(
                            version.id,
                          )
                        }
                        className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                      >
                        Make current
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
