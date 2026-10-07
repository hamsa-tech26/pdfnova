"use client";

import {
  createDocumentArtifact,
  createPdfContentSignal,
  createSafeSharePlan,
  inspectPdfArtifact,
  scanSensitiveText,
  type SafeSharePlan,
  type SensitiveTextReport,
} from "@/lib/document-engine";
import {
  buildWorkspaceHandoffHref,
  getActiveWorkspaceFileSummary,
  getWorkspaceFile,
  getWorkspaceFileSummary,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

type SafeShareState = {
  summary: WorkspaceFileSummary;
  plan: SafeSharePlan;
  sensitive: SensitiveTextReport;
  selectableTextChars: number;
};

export default function SafeSharePage() {
  const [
    state,
    setState,
  ] = useState<SafeShareState | null>(
    null,
  );
  const [
    error,
    setError,
  ] = useState("");
  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      try {
        const params =
          new URLSearchParams(
            window.location.search,
          );
        const requestedId =
          params.get(
            "workspaceFile",
          );
        const summary =
          requestedId
            ? await getWorkspaceFileSummary(
                requestedId,
              )
            : await getActiveWorkspaceFileSummary();

        if (!summary) {
          throw new Error(
            "No browser workspace document is available for Safe Share review.",
          );
        }

        const file =
          await getWorkspaceFile(
            summary.id,
          );

        if (!file) {
          throw new Error(
            "The selected browser workspace file is no longer available.",
          );
        }

        const artifact =
          createDocumentArtifact(
            file,
            {
              name:
                file.name,
              mimeType:
                file.type,
              source:
                "upload",
            },
          );

        const [
          inspection,
          content,
        ] = await Promise.all([
          inspectPdfArtifact(
            artifact,
          ),
          createPdfContentSignal(
            file,
          ),
        ]);

        const sensitive =
          scanSensitiveText(
            content.rawText ??
              "",
          );
        const plan =
          createSafeSharePlan(
            inspection,
            sensitive,
            content.selectableTextChars,
          );

        if (!cancelled) {
          setState({
            summary,
            plan,
            sensitive,
            selectableTextChars:
              content.selectableTextChars,
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
              : "Safe Share review could not be completed.",
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm dark:border-blue-900 dark:bg-slate-900 sm:p-8">
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={24}
            className="mt-1 shrink-0 text-blue-600"
          />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
              Safe Share Preparation V1
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              Review before sharing
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              Kukureku checks common metadata, interactive forms, selectable-text sensitive patterns, and declared Inspector coverage locally. It never guarantees that a PDF is safe to share.
            </p>
          </div>
        </div>
      </section>

      {loading && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <LoaderCircle
            size={19}
            className="animate-spin"
          />
          Reviewing the browser-local document…
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      )}

      {state && (
        <>
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="break-all text-lg font-black text-slate-950 dark:text-white">
              {
                state.summary
                  .name
              }
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {
                  state.plan
                    .status
                }
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                {
                  state.selectableTextChars
                }{" "}
                selectable text chars
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
              {
                state.plan
                  .statement
              }
            </p>
          </section>

          <section className="mt-6 space-y-3">
            {state.plan.issues.length ===
            0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    size={20}
                    className="mt-0.5 shrink-0 text-emerald-700"
                  />
                  <p className="text-sm leading-6 text-emerald-900 dark:text-emerald-200">
                    No issue was found in the checks that ran. This is not a guarantee that the document is safe to share.
                  </p>
                </div>
              </div>
            ) : (
              state.plan.issues.map(
                (issue) => (
                  <article
                    key={
                      issue.kind
                    }
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle
                        size={20}
                        className="mt-0.5 shrink-0 text-amber-700"
                      />
                      <div>
                        <p className="font-extrabold text-slate-950 dark:text-white">
                          {
                            issue.title
                          }
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                          {
                            issue.detail
                          }
                        </p>

                        {issue.actionRoute &&
                          issue.actionLabel && (
                          <Link
                            href={buildWorkspaceHandoffHref(
                              issue.actionRoute,
                              state.summary
                                .id,
                            )}
                            className="mt-3 inline-flex rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800"
                          >
                            {
                              issue.actionLabel
                            }
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                ),
              )
            )}
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-black text-slate-950 dark:text-white">
              Sensitive Information Detection Foundation
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Pattern-based assistance only. Matched values are not displayed or persisted by this report.
            </p>

            {state.sensitive
              .signals.length ===
            0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                No supported sensitive-looking text pattern was detected in selectable text.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {state.sensitive.signals.map(
                  (signal) => (
                    <div
                      key={
                        signal.kind
                      }
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <p className="font-extrabold text-slate-950 dark:text-white">
                        {
                          signal.label
                        }
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {
                          signal.count
                        }{" "}
                        match(es) ·{" "}
                        {
                          signal.confidence
                        }
                      </p>
                    </div>
                  ),
                )}
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
              Coverage: selectable text only. Image-only text is not OCR-scanned here, patterns can produce false positives or misses, and Kukureku does not claim semantic postal-address detection.
            </div>
          </section>
        </>
      )}
    </main>
  );
}
