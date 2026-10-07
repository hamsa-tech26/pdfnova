"use client";

import {
  getWorkflowContinuationHref,
} from "@/lib/document-engine";
import {
  buildWorkspaceHandoffHref,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  ArrowRight,
  GitBranch,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

export default function WorkspaceDerivedOutputNotice({
  file,
}: Readonly<{
  file: WorkspaceFileSummary | null;
}>) {
  const [
    recipeContinuationHref,
    setRecipeContinuationHref,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (
      !file ||
      typeof window ===
        "undefined"
    ) {
      setRecipeContinuationHref(
        null,
      );
      return;
    }

    setRecipeContinuationHref(
      getWorkflowContinuationHref(
        window.location.search,
        file.id,
      ),
    );
  }, [file]);

  if (!file) {
    return null;
  }

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

          <div className="mt-4 flex flex-wrap gap-3">
            {recipeContinuationHref && (
              <Link
                href={
                  recipeContinuationHref
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Continue Recipe
                <ArrowRight
                  size={15}
                />
              </Link>
            )}

            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
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
