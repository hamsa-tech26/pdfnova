"use client";

import {
  getWorkspaceFile,
  getWorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  ArrowLeft,
  FileSearch,
  Highlighter,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

function highlightText(
  text: string,
  query: string,
) {
  const terms = [
    ...new Set(
      query
        .split(/\s+/)
        .map((term) =>
          term.trim(),
        )
        .filter(
          (term) =>
            term.length >= 2,
        ),
    ),
  ];

  if (
    !text ||
    terms.length === 0
  ) {
    return text;
  }

  const escaped =
    terms
      .map((term) =>
        term.replace(
          /[.*+?^$()|[\]{}\\]/g,
          "\\$&",
        ),
      )
      .join("|");
  const expression =
    new RegExp(
      "(" + escaped + ")",
      "gi",
    );
  const parts =
    text.split(
      expression,
    );

  return parts.map(
    (part, index) => {
      const matched =
        terms.some(
          (term) =>
            part.toLowerCase() ===
            term.toLowerCase(),
        );

      return matched ? (
        <mark
          key={
            part +
            index
          }
          className="rounded bg-yellow-200 px-0.5 text-slate-950 dark:bg-yellow-400"
        >
          {part}
        </mark>
      ) : (
        <span
          key={
            part +
            index
          }
        >
          {part}
        </span>
      );
    },
  );
}

export default function EvidenceViewerPage() {
  const [fileUrl, setFileUrl] =
    useState("");
  const [name, setName] =
    useState("");
  const [pageNumber, setPageNumber] =
    useState(1);
  const [evidence, setEvidence] =
    useState("");
  const [query, setQuery] =
    useState("");
  const [error, setError] =
    useState("");
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    async function load() {
      try {
        const params =
          new URLSearchParams(
            window.location.search,
          );
        const id =
          params.get(
            "workspaceFile",
          );
        const requestedPage =
          Number(
            params.get(
              "page",
            ) ?? "1",
          );
        const nextEvidence =
          params.get(
            "evidence",
          ) ?? "";
        const nextQuery =
          params.get(
            "q",
          ) ?? "";

        if (!id) {
          throw new Error(
            "No workspace evidence source was selected.",
          );
        }

        const [
          file,
          summary,
        ] = await Promise.all([
          getWorkspaceFile(id),
          getWorkspaceFileSummary(
            id,
          ),
        ]);

        if (
          !file ||
          !summary
        ) {
          throw new Error(
            "The cited browser-local document is no longer available.",
          );
        }

        objectUrl =
          URL.createObjectURL(
            file,
          );

        if (!cancelled) {
          setFileUrl(
            objectUrl,
          );
          setName(
            summary.name,
          );
          setPageNumber(
            Number.isFinite(
              requestedPage,
            ) &&
              requestedPage > 0
              ? Math.floor(
                  requestedPage,
                )
              : 1,
          );
          setEvidence(
            nextEvidence,
          );
          setQuery(
            nextQuery,
          );
        }
      } catch (
        loadError
      ) {
        if (!cancelled) {
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Evidence could not be opened.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(
          objectUrl,
        );
      }
    };
  }, []);

  const viewerUrl =
    useMemo(
      () =>
        fileUrl
          ? fileUrl +
            "#page=" +
            pageNumber +
            "&zoom=page-width"
          : "",
      [
        fileUrl,
        pageNumber,
      ],
    );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm dark:border-violet-900 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              <FileSearch
                size={15}
              />
              Evidence Viewer V1
            </div>
            <h1 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
              Exact source evidence
            </h1>
            <p className="mt-2 break-all text-sm text-slate-600 dark:text-slate-400">
              {name ||
                "Browser-local PDF"}{" "}
              · Page{" "}
              {pageNumber}
            </p>
          </div>

          <Link
            href="/workspace-copilot"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <ArrowLeft
              size={16}
            />
            Back to Copilot
          </Link>
        </div>
      </section>

      {loading && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <LoaderCircle
            size={19}
            className="animate-spin"
          />
          Opening cited page locally…
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        fileUrl && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <iframe
              title="Cited PDF page"
              src={
                viewerUrl
              }
              className="h-[72vh] min-h-[620px] w-full"
            />
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-yellow-200 bg-white p-5 shadow-sm dark:border-yellow-900 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Highlighter
                  size={18}
                  className="text-yellow-700 dark:text-yellow-300"
                />
                <h2 className="font-black text-slate-950 dark:text-white">
                  Highlighted evidence
                </h2>
              </div>
              <div className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-300">
                {evidence
                  ? highlightText(
                      evidence,
                      query,
                    )
                  : "No text snippet was supplied with this citation. The exact cited page is still shown on the left."}
              </div>
            </section>

            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-xs leading-6 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
              <div className="flex items-start gap-2">
                <ShieldCheck
                  size={17}
                  className="mt-0.5 shrink-0"
                />
                <p>
                  The PDF and evidence remain browser-local. The highlight is applied to the cited extracted snippet; Kukureku does not modify the PDF.
                </p>
              </div>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
