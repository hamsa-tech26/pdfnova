"use client";

import {
  DEFAULT_PRIVATE_WORKSPACE_INTELLIGENCE_SETTINGS,
  type PrivateWorkspaceIntelligenceSettings,
} from "@/lib/document-engine";
import {
  clearWorkspaceIntelligenceCache,
  getWorkspaceIntelligenceCacheStats,
  loadWorkspaceIntelligenceSettings,
  saveWorkspaceIntelligenceSettings,
  type WorkspaceIntelligenceCacheStats,
} from "@/lib/storage/workspaceIntelligenceCache";
import {
  Database,
  EyeOff,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

const emptyStats: WorkspaceIntelligenceCacheStats =
  {
    recordCount: 0,
    pageCount: 0,
    chunkCount: 0,
    ocrPageCount: 0,
    estimatedTextCharacters: 0,
  };

export default function WorkspacePrivacyPage() {
  const [
    settings,
    setSettings,
  ] =
    useState<PrivateWorkspaceIntelligenceSettings>(
      () =>
        loadWorkspaceIntelligenceSettings(
          DEFAULT_PRIVATE_WORKSPACE_INTELLIGENCE_SETTINGS,
        ),
    );
  const [stats, setStats] =
    useState<WorkspaceIntelligenceCacheStats>(
      emptyStats,
    );

  async function refresh() {
    try {
      setStats(
        await getWorkspaceIntelligenceCacheStats(),
      );
    } catch {
      setStats(
        emptyStats,
      );
    }
  }

  useEffect(() => {
    let cancelled = false;

    getWorkspaceIntelligenceCacheStats()
      .then((next) => {
        if (!cancelled) {
          setStats(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStats(
            emptyStats,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function update(
    next: PrivateWorkspaceIntelligenceSettings,
  ) {
    setSettings(next);
    saveWorkspaceIntelligenceSettings(
      next,
    );
  }

  async function clearCache() {
    await clearWorkspaceIntelligenceCache();
    await refresh();
    toast.success(
      "Workspace Intelligence cache cleared.",
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-900 dark:bg-slate-900 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <ShieldCheck
              size={24}
            />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Privacy Control Center V1
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
              Your Workspace Intelligence stays under your control
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              Kukureku stores intelligence records in your browser so unchanged PDFs do not need to be analyzed again. Cloud AI and intelligence uploads remain disabled.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Cached states"
          value={String(
            stats.recordCount,
          )}
        />
        <Metric
          label="Indexed pages"
          value={String(
            stats.pageCount,
          )}
        />
        <Metric
          label="Evidence chunks"
          value={String(
            stats.chunkCount,
          )}
        />
        <Metric
          label="OCR pages"
          value={String(
            stats.ocrPageCount,
          )}
        />
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Database
            size={20}
            className="text-blue-600"
          />
          <h2 className="text-xl font-black text-slate-950 dark:text-white">
            Local intelligence settings
          </h2>
        </div>

        <label className="mt-5 flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <div>
            <p className="font-extrabold text-slate-950 dark:text-white">
              Browser-local OCR for scanned pages
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Auto mode uses Kukureku&apos;s existing Tesseract OCR engine only on text-sparse pages and caches the result locally.
            </p>
          </div>
          <input
            type="checkbox"
            checked={
              settings.ocrMode ===
              "auto"
            }
            onChange={(event) =>
              update({
                ...settings,
                ocrMode:
                  event.target.checked
                    ? "auto"
                    : "off",
              })
            }
            className="mt-1 h-5 w-5"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Maximum OCR pages per document
          </span>
          <input
            type="number"
            min={0}
            max={20}
            value={
              settings.maxOcrPagesPerDocument
            }
            onChange={(event) =>
              update({
                ...settings,
                maxOcrPagesPerDocument:
                  Math.max(
                    0,
                    Math.min(
                      20,
                      Number(
                        event.target.value,
                      ) || 0,
                    ),
                  ),
              })
            }
            className="mt-2 w-36 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </label>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              void refresh()
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            <RefreshCcw
              size={16}
            />
            Refresh storage
          </button>
          <button
            type="button"
            onClick={() =>
              void clearCache()
            }
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 dark:border-red-900 dark:text-red-300"
          >
            <Trash2
              size={16}
            />
            Clear intelligence cache
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-900 dark:bg-violet-950/20">
        <div className="flex items-start gap-3">
          <EyeOff
            size={20}
            className="mt-0.5 shrink-0 text-violet-700 dark:text-violet-300"
          />
          <div>
            <h2 className="font-black text-slate-950 dark:text-white">
              What leaves your browser?
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
              For Workspace Intelligence V2: nothing. PDF bytes, OCR text, page evidence, facts, local concept vectors, and cached indexes remain in browser storage. Any future cloud intelligence mode must be opt-in and show exactly what extracted content would be sent before it is enabled.
            </p>
          </div>
        </div>
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
