"use client";

import {
  buildWorkflowRecipesHref,
  type WorkflowRecipeProgress,
} from "@/lib/document-engine";
import {
  getWorkflowRecipeProgressSnapshot,
  subscribeWorkflowRecipeProgress,
} from "@/lib/storage/workflowProgress";
import {
  buildWorkspaceHandoffHref,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import {
  useMemo,
  useSyncExternalStore,
} from "react";

function parseProgress(
  raw: string | null,
): WorkflowRecipeProgress | null {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(
      raw,
    ) as WorkflowRecipeProgress;
  } catch {
    return null;
  }
}

function verificationBadge(
  status:
    | "PASS"
    | "PASS_WITH_WARNING"
    | "FAILED"
    | "NOT_VERIFIED",
) {
  if (status === "PASS") {
    return {
      label:
        "Verification PASS",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
      icon: CheckCircle2,
    };
  }

  if (
    status ===
    "PASS_WITH_WARNING"
  ) {
    return {
      label:
        "PASS with warning",
      className:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
      icon: AlertTriangle,
    };
  }

  if (
    status ===
    "NOT_VERIFIED"
  ) {
    return {
      label:
        "Outcome not verified",
      className:
        "border-gray-200 bg-gray-50 text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
      icon: ShieldAlert,
    };
  }

  return {
    label:
      "Verification FAILED",
    className:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200",
    icon: ShieldAlert,
  };
}

export default function WorkspaceDerivedOutputNotice({
  file,
}: Readonly<{
  file: WorkspaceFileSummary | null;
}>) {
  const rawProgress =
    useSyncExternalStore(
      subscribeWorkflowRecipeProgress,
      getWorkflowRecipeProgressSnapshot,
      () => null,
    );
  const progress =
    useMemo(
      () =>
        parseProgress(
          rawProgress,
        ),
      [rawProgress],
    );

  if (!file) {
    return null;
  }

  const recipeStep =
    progress?.steps.find(
      (step) =>
        step.outputVersionId ===
        file.id,
    ) ?? null;
  const verification =
    recipeStep?.verification ??
    null;
  const verificationUi =
    verification
      ? verificationBadge(
          verification.status,
        )
      : null;
  const VerificationIcon =
    verificationUi?.icon ??
    ShieldAlert;

  const canContinueRecipe =
    Boolean(
      progress &&
        recipeStep &&
        recipeStep.state ===
          "COMPLETED" &&
        progress.currentWorkspaceFileId ===
          file.id &&
        progress.status !==
          "BLOCKED_BY_VERIFICATION",
    );

  const recipeHref =
    progress
      ? buildWorkflowRecipesHref(
          file.id,
          progress.recipeId,
          progress.currentStep,
        )
      : null;

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-start gap-3">
        <GitBranch
          size={21}
          className="mt-0.5 shrink-0 text-blue-700 dark:text-blue-300"
        />

        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-blue-950 dark:text-blue-100">
            Saved as Version {file.version} in this browser workspace
          </p>

          <p className="mt-2 text-sm leading-6 text-blue-900 dark:text-blue-200">
            This result is now the current local workspace version. Your original remains available in version history, and no document was uploaded.
          </p>

          {verification &&
            verificationUi && (
            <div
              className={
                "mt-4 rounded-xl border p-4 " +
                verificationUi.className
              }
            >
              <p className="flex items-center gap-2 text-sm font-extrabold">
                <VerificationIcon
                  size={17}
                />
                {
                  verificationUi.label
                }
              </p>
              <p className="mt-2 text-xs leading-5">
                {verification.status ===
                "FAILED"
                  ? "A deterministic post-operation check failed, so Kukureku paused this recipe instead of advancing automatically."
                  : verification.status ===
                      "NOT_VERIFIED"
                    ? "The tool completed, but the shared verifier cannot prove this operation outcome yet. Kukureku records that limit explicitly."
                    : "Kukureku checked the supported post-operation conditions for this recipe step."}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {canContinueRecipe &&
              recipeHref && (
                <Link
                  href={
                    recipeHref
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Continue Recipe
                  <ArrowRight
                    size={15}
                  />
                </Link>
              )}

            {progress?.status ===
              "BLOCKED_BY_VERIFICATION" &&
              recipeHref && (
                <Link
                  href={
                    recipeHref
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Review Failed Verification
                  <ArrowRight
                    size={15}
                  />
                </Link>
              )}

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-slate-950 dark:text-blue-300"
            >
              Open Workspace
            </Link>

            <Link
              href={buildWorkspaceHandoffHref(
                "/magic-drop",
                file.id,
              )}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-slate-950 dark:text-blue-300"
            >
              Continue from this version
              <ArrowRight
                size={15}
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
