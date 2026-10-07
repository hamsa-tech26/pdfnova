"use client";

import {
  buildWorkspaceHandoffHref,
  clearWorkspaceFiles,
  getActiveWorkspaceFileSummary,
  WORKSPACE_CHANGE_EVENT,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  FileText,
  FolderClock,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
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

export default function ActiveWorkspaceFileCard() {
  const [active, setActive] =
    useState<WorkspaceFileSummary | null>(
      null,
    );
  const [loaded, setLoaded] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next =
          await getActiveWorkspaceFileSummary();

        if (!cancelled) {
          setActive(next);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setActive(null);
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

    return () => {
      cancelled = true;
      window.removeEventListener(
        WORKSPACE_CHANGE_EVENT,
        onChange,
      );
    };
  }, []);

  async function forgetFile() {
    try {
      await clearWorkspaceFiles();
      toast.success(
        "Browser workspace file removed.",
      );
    } catch {
      toast.error(
        "The browser workspace file could not be removed.",
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
          Magic Drop can keep one active PDF locally in this browser so supported tools can receive it without another file picker.
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
              Active browser workspace
            </p>
            <h3 className="mt-2 break-all text-lg font-extrabold text-gray-950 dark:text-white">
              {active.name}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              {formatSize(
                active.size,
              )} · saved locally in this browser
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void forgetFile()
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          <Trash2 size={16} />
          Forget file
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
    </div>
  );
}
