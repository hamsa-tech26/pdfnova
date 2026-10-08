"use client";

import {
  PACKAGE_GUARD_PRESETS,
  getPackageGuardPreset,
  type PackageGuardCheck,
  type PackageGuardPolicy,
  type PackageGuardReport,
} from "@/lib/document-engine";
import { runPackageGuard } from "@/lib/package-guard/runPackageGuard";
import {
  loadPackageGuardPolicy,
  loadPackageGuardReport,
  savePackageGuardPolicy,
  savePackageGuardReport,
} from "@/lib/package-guard/storage";
import {
  buildWorkspaceHandoffHref,
  buildWorkspaceMultiHandoffHref,
  listWorkspaceFileSummaries,
} from "@/lib/storage/workspaceFiles";
import { groupWorkspaceDocuments } from "@/lib/storage/workspaceGraph";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  FlaskConical,
  LoaderCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function mbToBytes(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 1024 * 1024) : null;
}

function bytesToMb(value: number | null) {
  return value === null ? "" : String(Math.round((value / 1024 / 1024) * 100) / 100);
}

function actionHref(check: PackageGuardCheck) {
  const action = check.action;
  if (!action) return null;
  if (action.nodeIds.length > 1) return buildWorkspaceMultiHandoffHref(action.route, action.nodeIds);
  if (action.nodeIds.length === 1) return buildWorkspaceHandoffHref(action.route, action.nodeIds[0]);
  return action.route;
}

function statusClasses(status: PackageGuardCheck["status"]) {
  if (status === "PASS") return "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20";
  if (status === "FAIL") return "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20";
  if (status === "WARN") return "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20";
  return "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950";
}

function StatusIcon({ status }: { status: PackageGuardCheck["status"] }) {
  if (status === "PASS") return <CheckCircle2 size={19} className="text-emerald-700" />;
  if (status === "FAIL") return <XCircle size={19} className="text-red-700" />;
  if (status === "WARN") return <AlertTriangle size={19} className="text-amber-700" />;
  return <CircleHelp size={19} className="text-slate-600" />;
}

export default function PackageGuardPage() {
  const [loaded, setLoaded] = useState(false);
  const [documentCount, setDocumentCount] = useState(0);
  const [policy, setPolicy] = useState<PackageGuardPolicy>(() => ({ ...getPackageGuardPreset("strict-submission-review") }));
  const [report, setReport] = useState<PackageGuardReport | null>(null);
  const [running, setRunning] = useState(false);
  const [requiredLabels, setRequiredLabels] = useState("");
  const [maxTotalMb, setMaxTotalMb] = useState("");
  const [maxFileMb, setMaxFileMb] = useState("");
  const [maxDocuments, setMaxDocuments] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const summaries = await listWorkspaceFileSummaries();
        const savedPolicy = loadPackageGuardPolicy();
        const savedReport = loadPackageGuardReport();
        if (cancelled) return;
        setDocumentCount(groupWorkspaceDocuments(summaries).length);
        if (savedPolicy) {
          setPolicy(savedPolicy);
          setRequiredLabels(savedPolicy.requiredFilenameTokens.join(", "));
          setMaxTotalMb(bytesToMb(savedPolicy.maxTotalBytes));
          setMaxFileMb(bytesToMb(savedPolicy.maxFileBytes));
          setMaxDocuments(savedPolicy.maxDocuments === null ? "" : String(savedPolicy.maxDocuments));
        }
        setReport(savedReport);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const effectivePolicy = useMemo<PackageGuardPolicy>(() => ({
    ...policy,
    maxTotalBytes: mbToBytes(maxTotalMb),
    maxFileBytes: mbToBytes(maxFileMb),
    maxDocuments: maxDocuments.trim() ? Math.max(1, Number.parseInt(maxDocuments, 10) || 1) : null,
    requiredFilenameTokens: requiredLabels.split(",").map((item) => item.trim()).filter(Boolean),
  }), [policy, maxTotalMb, maxFileMb, maxDocuments, requiredLabels]);

  function applyPreset(id: string) {
    const next = { ...getPackageGuardPreset(id) };
    setPolicy(next);
    setRequiredLabels("");
    setMaxTotalMb("");
    setMaxFileMb("");
    setMaxDocuments("");
    setReport(null);
  }

  async function run() {
    if (documentCount === 0) {
      toast.error("Add documents to the browser workspace first.");
      return;
    }
    setRunning(true);
    try {
      savePackageGuardPolicy(effectivePolicy);
      const next = await runPackageGuard(effectivePolicy);
      savePackageGuardReport(next);
      setReport(next);
      toast.success("Package Guard completed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Package Guard could not complete.");
    } finally {
      setRunning(false);
    }
  }

  if (!loaded) return null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-cyan-200 bg-white p-6 shadow-sm dark:border-cyan-900 dark:bg-slate-900 sm:p-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">
              <FlaskConical size={15} /> Package Guard V1 · Document CI
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Run acceptance gates before you submit, send, or share</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-400">Package Guard evaluates the current head of every browser-local workspace document against one reusable policy. It reports what passed, what needs review, what blocks the package, and what Kukureku could not verify.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><ShieldCheck size={17} /> Browser-local · no document upload</div>
        </div>
        <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-xs leading-5 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/20 dark:text-cyan-200">This is a Kukureku acceptance gate, not a legal, filing, regulatory, archival, or safety certification. A READY result means only that the configured checks passed for this exact local package snapshot.</div>
      </section>

      {documentCount === 0 ? (
        <section className="mt-6 rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="font-extrabold text-slate-950 dark:text-white">No workspace package yet</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Add one or more PDFs through Magic Drop or the workspace before running Package Guard.</p>
          <Link href="/magic-drop" className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">Open Magic Drop</Link>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div><h2 className="text-xl font-black text-slate-950 dark:text-white">Policy</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{documentCount} current workspace document head(s) will be evaluated.</p></div>
              <select aria-label="Package Guard preset" value={policy.id} onChange={(event) => applyPreset(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                {PACKAGE_GUARD_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">{policy.description}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-bold text-slate-800 dark:text-slate-200">Max package MB<input value={maxTotalMb} onChange={(event) => setMaxTotalMb(event.target.value)} inputMode="decimal" placeholder="No limit" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
              <label className="text-sm font-bold text-slate-800 dark:text-slate-200">Max file MB<input value={maxFileMb} onChange={(event) => setMaxFileMb(event.target.value)} inputMode="decimal" placeholder="No limit" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
              <label className="text-sm font-bold text-slate-800 dark:text-slate-200">Max documents<input value={maxDocuments} onChange={(event) => setMaxDocuments(event.target.value)} inputMode="numeric" placeholder="No limit" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
              <label className="text-sm font-bold text-slate-800 dark:text-slate-200">Required filename labels<input value={requiredLabels} onChange={(event) => setRequiredLabels(event.target.value)} placeholder="application, certificate" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Filename labels are literal filename checks only. Kukureku does not infer that a file named “certificate” is actually a valid certificate.</p>
            <button type="button" onClick={() => void run()} disabled={running} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-extrabold text-white hover:bg-cyan-800 disabled:opacity-60">
              {running ? <LoaderCircle size={18} className="animate-spin" /> : <FlaskConical size={18} />}{running ? "Running local gates…" : "Run Package Guard"}
            </button>
          </section>

          {report && (
            <section className="mt-6">
              <div className={"rounded-3xl border p-6 " + (report.status === "READY" ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20" : report.status === "BLOCKED" ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20" : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20")}>
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div><p className="text-xs font-extrabold uppercase tracking-[0.16em]">Package gate result</p><h2 className="mt-2 text-3xl font-black">{report.status}</h2><p className="mt-2 text-sm leading-6">Snapshot <code>{report.snapshotFingerprint.slice(0, 12)}</code> · {report.documentCount} document(s) · {new Date(report.evaluatedAt).toLocaleString()}</p></div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs"><Metric label="Pass" value={report.summary.passed} /><Metric label="Warn" value={report.summary.warnings} /><Metric label="Fail" value={report.summary.failed} /><Metric label="?" value={report.summary.notVerified} /></div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {report.checks.map((check) => {
                  const href = actionHref(check);
                  return (
                    <article key={check.id} className={"rounded-2xl border p-5 " + statusClasses(check.status)}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0"><StatusIcon status={check.status} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-extrabold text-slate-950 dark:text-white">{check.title}</p><span className="text-xs font-black uppercase tracking-wide">{check.status}</span></div>
                          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{check.detail}</p>
                          {check.evidence.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{check.evidence.slice(0, 6).map((item) => <code key={item} className="rounded bg-white/80 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">{item}</code>)}</div>}
                          {href && check.action && <Link href={href} className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900">{check.action.label}</Link>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <p className="font-extrabold text-slate-900 dark:text-white">Coverage boundary</p>
                {report.coverage.notes.map((note) => <p key={note} className="mt-1">• {note}</p>)}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-slate-900/60"><p className="font-extrabold">{value}</p><p className="opacity-70">{label}</p></div>;
}