"use client";

import {
  comparePdfContentSignals,
  createPdfContentSignal,
  type PdfContentComparison,
  type PdfContentSignal,
} from "@/lib/document-engine";
import {
  buildWorkspaceHandoffHref,
  buildWorkspaceMultiHandoffHref,
  getWorkspaceFile,
  listWorkspaceFileSummaries,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  groupWorkspaceDocuments,
} from "@/lib/storage/workspaceGraph";
import {
  ArrowRightLeft,
  FileCheck2,
  GitCompareArrows,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

type ComparisonState = {
  left: PdfContentSignal;
  right: PdfContentSignal;
  comparison: PdfContentComparison;
};

const relationshipCopy: Record<
  PdfContentComparison["relationship"],
  {
    title: string;
    detail: string;
  }
> = {
  "exact-duplicate": {
    title:
      "Exact duplicate confirmed",
    detail:
      "The two local files have the same SHA-256 hash. Their bytes are identical.",
  },
  "probable-revision": {
    title:
      "Probable document revision",
    detail:
      "The files are not byte-identical, but their selectable text overlaps strongly enough to treat them as a likely revision pair.",
  },
  related: {
    title:
      "Related document content",
    detail:
      "The files share meaningful selectable-text overlap, but Kukureku does not classify them as a probable revision.",
  },
  distinct: {
    title:
      "Documents appear distinct",
    detail:
      "The available selectable text has low overlap.",
  },
  unverified: {
    title:
      "Text relationship not verified",
    detail:
      "One or both PDFs do not expose enough selectable text for this comparison. Exact duplicate hashing still works.",
  },
};

function formatPercent(
  value: number | null,
) {
  if (value === null) {
    return "Not verified";
  }

  return (
    Math.round(
      value * 100,
    ) + "%"
  );
}

export default function CompareDocumentsPage() {
  const [
    summaries,
    setSummaries,
  ] = useState<
    WorkspaceFileSummary[]
  >([]);
  const [
    leftId,
    setLeftId,
  ] = useState("");
  const [
    rightId,
    setRightId,
  ] = useState("");
  const [
    busy,
    setBusy,
  ] = useState(false);
  const [
    error,
    setError,
  ] = useState("");
  const [
    result,
    setResult,
  ] = useState<ComparisonState | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next =
          await listWorkspaceFileSummaries();

        if (cancelled) {
          return;
        }

        setSummaries(next);

        const params =
          new URLSearchParams(
            window.location.search,
          );
        const requested =
          (params.get(
            "workspaceFiles",
          ) ?? "")
            .split(",")
            .map((value) =>
              value.trim(),
            )
            .filter(Boolean);

        const available =
          new Set(
            next.map(
              (item) =>
                item.id,
            ),
          );
        const valid =
          requested.filter(
            (id) =>
              available.has(id),
          );

        if (
          valid.length >= 2
        ) {
          setLeftId(valid[0]);
          setRightId(valid[1]);
          void compareIds(
            valid[0],
            valid[1],
          );
          return;
        }

        const documents =
          groupWorkspaceDocuments(
            next,
          );

        setLeftId(
          documents[0]?.head
            .id ?? "",
        );
        setRightId(
          documents[1]?.head
            .id ?? "",
        );
      } catch {
        if (!cancelled) {
          setError(
            "Browser workspace documents could not be loaded.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const options =
    useMemo(
      () =>
        groupWorkspaceDocuments(
          summaries,
        ).map(
          (document) =>
            document.head,
        ),
      [summaries],
    );

  const byId =
    useMemo(
      () =>
        new Map(
          summaries.map(
            (summary) => [
              summary.id,
              summary,
            ],
          ),
        ),
      [summaries],
    );

  const leftSummary =
    byId.get(leftId) ??
    null;
  const rightSummary =
    byId.get(rightId) ??
    null;

  async function compareIds(
    selectedLeftId: string,
    selectedRightId: string,
  ) {
    if (
      !selectedLeftId ||
      !selectedRightId ||
      selectedLeftId ===
        selectedRightId
    ) {
      setError(
        "Choose two different workspace documents.",
      );
      return;
    }

    setBusy(true);
    setError("");
    setResult(null);

    try {
      const [
        leftFile,
        rightFile,
      ] = await Promise.all([
        getWorkspaceFile(
          selectedLeftId,
        ),
        getWorkspaceFile(
          selectedRightId,
        ),
      ]);

      if (
        !leftFile ||
        !rightFile
      ) {
        throw new Error(
          "One of the selected workspace documents is no longer available.",
        );
      }

      const [
        left,
        right,
      ] = await Promise.all([
        createPdfContentSignal(
          leftFile,
        ),
        createPdfContentSignal(
          rightFile,
        ),
      ]);

      setResult({
        left,
        right,
        comparison:
          comparePdfContentSignals(
            left,
            right,
          ),
      });
    } catch (
      comparisonError
    ) {
      setError(
        comparisonError instanceof
          Error
          ? comparisonError.message
          : "The documents could not be compared.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function compare() {
    await compareIds(
      leftId,
      rightId,
    );
  }

  const relationship =
    result
      ? relationshipCopy[
          result.comparison
            .relationship
        ]
      : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              <GitCompareArrows
                size={15}
              />
              Compare Documents V1
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Compare two workspace documents
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">
              Kukureku compares exact bytes with local SHA-256 and, when selectable text exists, estimates deterministic text overlap for revision recognition. No document is uploaded.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck
              size={17}
            />
            Browser-local analysis
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              First document
            </span>
            <select
              value={leftId}
              onChange={(event) => {
                setLeftId(
                  event.target.value,
                );
                setResult(null);
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">
                Select document
              </option>
              {options.map(
                (option) => (
                  <option
                    key={
                      option.id
                    }
                    value={
                      option.id
                    }
                  >
                    {
                      option.name
                    }{" "}
                    · V
                    {
                      option.version
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
              Second document
            </span>
            <select
              value={rightId}
              onChange={(event) => {
                setRightId(
                  event.target.value,
                );
                setResult(null);
              }}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">
                Select document
              </option>
              {options.map(
                (option) => (
                  <option
                    key={
                      option.id
                    }
                    value={
                      option.id
                    }
                  >
                    {
                      option.name
                    }{" "}
                    · V
                    {
                      option.version
                    }
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() =>
            void compare()
          }
          disabled={
            busy ||
            !leftId ||
            !rightId ||
            leftId ===
              rightId
          }
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle
              size={18}
              className="animate-spin"
            />
          ) : (
            <ArrowRightLeft
              size={18}
            />
          )}
          {busy
            ? "Comparing locally..."
            : "Compare documents"}
        </button>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
            {error}
          </div>
        )}
      </section>

      {result &&
        relationship && (
        <section className="mt-6 rounded-3xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900 dark:bg-slate-900 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <FileCheck2
                size={21}
              />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                Comparison ready
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                {
                  relationship.title
                }
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                {
                  relationship.detail
                }
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Exact bytes"
              value={
                result
                  .comparison
                  .exactDuplicate
                  ? "Identical"
                  : "Different"
              }
            />
            <Metric
              label="Text similarity"
              value={formatPercent(
                result
                  .comparison
                  .textSimilarity,
              )}
            />
            <Metric
              label="Page delta"
              value={String(
                result
                  .comparison
                  .pageCountDelta,
              )}
            />
            <Metric
              label="Shared text lines"
              value={String(
                result
                  .comparison
                  .commonLineCount,
              )}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <DocumentSignalCard
              title={
                leftSummary?.name ??
                result.left
                  .fileName
              }
              signal={
                result.left
              }
            />
            <DocumentSignalCard
              title={
                rightSummary?.name ??
                result.right
                  .fileName
              }
              signal={
                result.right
              }
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {leftSummary && (
              <Link
                href={buildWorkspaceHandoffHref(
                  "/document-inspector",
                  leftSummary.id,
                )}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                Inspect first
              </Link>
            )}
            {rightSummary && (
              <Link
                href={buildWorkspaceHandoffHref(
                  "/document-inspector",
                  rightSummary.id,
                )}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                Inspect second
              </Link>
            )}
            {leftSummary &&
              rightSummary &&
              !result
                .comparison
                .exactDuplicate && (
                <Link
                  href={buildWorkspaceMultiHandoffHref(
                    "/merge-pdf",
                    [
                      leftSummary.id,
                      rightSummary.id,
                    ],
                  )}
                  className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700"
                >
                  Prepare merge
                </Link>
              )}
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-500">
            Revision recognition is deterministic and based on selectable-text overlap. It is not semantic AI and it does not prove that two documents have the same legal or factual meaning.
          </p>
        </section>
      )}
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
      <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function DocumentSignalCard({
  title,
  signal,
}: {
  title: string;
  signal: PdfContentSignal;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
      <p className="break-all font-extrabold text-slate-950 dark:text-white">
        {title}
      </p>
      <dl className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex justify-between gap-4">
          <dt>Pages</dt>
          <dd className="font-bold">
            {
              signal.pageCount
            }
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>
            Selectable text
          </dt>
          <dd className="font-bold">
            {
              signal.selectableTextChars
            }{" "}
            chars
          </dd>
        </div>
        <div>
          <dt>
            SHA-256
          </dt>
          <dd className="mt-1 break-all font-mono text-[10px]">
            {
              signal.sha256
            }
          </dd>
        </div>
      </dl>
    </article>
  );
}
