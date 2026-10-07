"use client";

import {
  createWorkspaceIntelligenceReport,
  type WorkspaceIntelligenceConfidence,
} from "@/lib/document-engine";
import type {
  WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  Files,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo } from "react";

type WorkspaceIntelligencePanelProps = {
  active: WorkspaceFileSummary;
  summaries: WorkspaceFileSummary[];
};

const confidenceLabel: Record<
  WorkspaceIntelligenceConfidence,
  string
> = {
  certain: "Known",
  strong: "Strong signal",
  possible: "Possible",
};

export default function WorkspaceIntelligencePanel({
  active,
  summaries,
}: WorkspaceIntelligencePanelProps) {
  const report = useMemo(
    () =>
      createWorkspaceIntelligenceReport(
        summaries,
        active.id,
      ),
    [active.id, summaries],
  );

  const relevantFindings = useMemo(() => {
    const activeFindings =
      report.findings.filter(
        (finding) =>
          finding.severity ===
            "attention" ||
          finding.nodeIds.includes(
            active.id,
          ) ||
          finding.documentIds.includes(
            active.documentId,
          ),
      );

    const source =
      activeFindings.length > 0
        ? activeFindings
        : report.findings;
    const seenKinds = new Set<string>();

    return source
      .filter((finding) => {
        if (
          finding.severity ===
          "attention"
        ) {
          return true;
        }

        if (
          seenKinds.has(
            finding.kind,
          )
        ) {
          return false;
        }

        seenKinds.add(
          finding.kind,
        );
        return true;
      })
      .slice(0, 4);
  }, [
    active.documentId,
    active.id,
    report.findings,
  ]);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-violet-200 bg-white dark:border-violet-900 dark:bg-slate-900">
      <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-blue-50 to-cyan-50 p-5 dark:border-violet-950 dark:from-violet-950/30 dark:via-blue-950/20 dark:to-cyan-950/20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <Sparkles size={21} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-extrabold text-gray-950 dark:text-white">
                  Workspace Intelligence V2
                </p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-violet-700 shadow-sm dark:bg-slate-950 dark:text-violet-300">
                  Local graph analysis
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-400">
                Kukureku interprets proven document relationships from your browser-local workspace graph and keeps uncertain signals explicitly labeled.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck size={16} />
            No document content uploaded
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
            <Files size={16} />
            <span className="text-xs font-bold uppercase tracking-wide">
              Documents
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
            {report.summary.documentCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
            <GitBranch size={16} />
            <span className="text-xs font-bold uppercase tracking-wide">
              Stored states
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
            {report.summary.nodeCount}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
            <Sparkles size={16} />
            <span className="text-xs font-bold uppercase tracking-wide">
              Findings
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
            {report.findings.length}
          </p>
        </div>
      </div>

      <div className="px-5 pb-5">
        {relevantFindings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-5 text-sm leading-6 text-gray-600 dark:border-slate-700 dark:text-slate-400">
            No cross-document relationship or graph integrity finding is available yet. Add another document, create a branch, or merge documents to build a richer local graph.
          </div>
        ) : (
          <div className="space-y-3">
            {relevantFindings.map(
              (finding) => (
                <article
                  key={finding.id}
                  className={
                    "rounded-xl border p-4 " +
                    (finding.severity ===
                    "attention"
                      ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20"
                      : "border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-950")
                  }
                >
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <p className="font-bold text-gray-950 dark:text-white">
                        {finding.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-slate-400">
                        {finding.detail}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-gray-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      {
                        confidenceLabel[
                          finding.confidence
                        ]
                      }
                    </span>
                  </div>

                  {finding.nextStep && (
                    <p className="mt-3 text-xs font-medium leading-5 text-gray-500 dark:text-slate-400">
                      {finding.nextStep}
                    </p>
                  )}
                </article>
              ),
            )}
          </div>
        )}

        <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-slate-500">
          Coverage: workspace graph metadata only. Kukureku has not compared PDF text, page appearance, or cryptographic file hashes in this report.
        </p>
      </div>
    </section>
  );
}
