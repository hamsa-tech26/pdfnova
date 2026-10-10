"use client";

import { downloadFile } from "@/lib/downloadFile";
import { auditWorkspaceVersions } from "@/lib/storage/workspaceAudit";
import { listWorkspaceFileSummaries, getWorkspaceFile, getActiveWorkspaceFileSummary, setActiveWorkspaceFile, WORKSPACE_CHANGE_EVENT, type WorkspaceFileSummary } from "@/lib/storage/workspaceFiles";
import { Database, Download, RefreshCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function WorkspaceHealthPage() {
  const [versions, setVersions] = useState<WorkspaceFileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [summaries, active] = await Promise.all([listWorkspaceFileSummaries(),getActiveWorkspaceFileSummary()]);
      setVersions(summaries);
      setActiveId(active?.id ?? null);
      setError("");
    } catch {
      setError("This browser could not read the local workspace. Check browser storage permissions.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(()=>{
    const frame = window.requestAnimationFrame(()=>void refresh());
    const changed = ()=>void refresh();
    window.addEventListener(WORKSPACE_CHANGE_EVENT,changed);
    return ()=>{
      window.cancelAnimationFrame(frame);
      window.removeEventListener(WORKSPACE_CHANGE_EVENT,changed);
    };
  },[refresh]);
  const health=useMemo(()=>auditWorkspaceVersions(versions),[versions]);
  async function useVersion(id: string) {
    if (switching || id === activeId) return;
    setSwitching(true);
    setNotice("");
    try {
      const file = await getWorkspaceFile(id);
      if (!file) throw new Error("This stored PDF is missing; no active document was changed.");
      await setActiveWorkspaceFile(id);
      setActiveId(id);
      setNotice("This stored version is now active. Other versions have not been overwritten.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This version cannot be opened.");
    } finally {
      setSwitching(false);
    }
  }

  function exportManifest() {
    const manifest = {
      schema: "kukureku-local-manifest-v1",
      exportedAt: new Date().toISOString(),
      warning: "Metadata-only export. Does not contain actual PDF files and cannot restore the workspace.",
      versions: versions.map(v=>({
        id:v.id, name:v.name, size:v.size, savedAt:v.savedAt, documentId:v.documentId,
        version:v.version, relationKind:v.relationKind, parentIds:v.parentIds, operationLabel:v.operationLabel
      }))
    };
    downloadFile(new TextEncoder().encode(JSON.stringify(manifest,null,2)),
      "kukureku-workspace-manifest.json","application/json");
  }
  return <main className="mx-auto w-full max-w-5xl px-4 py-7 text-slate-900 dark:text-white sm:px-7 lg:py-10">
    <section className="rounded-3xl bg-gradient-to-br from-slate-950 to-blue-800 p-6 text-white sm:p-9">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-blue-200"><Database size={20} aria-hidden="true"/> Workspace Health — Version History Foundation</div>
      <h1 className="mt-3 text-3xl font-black">Understand your local document versions</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-blue-100">Review the locally stored version graph and export a metadata-only inventory. This does not upload, inspect, or back up PDF contents.</p>
    </section>
    {loading ? <p role="status" className="mt-6">Reading browser workspace metadata…</p> : error ? <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">{error}</p> : <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Saved versions",health.versionCount],
          ["Documents",health.documentCount],
          ["Listed file MB",(health.totalReferencedBytes/1024/1024).toFixed(2)],
          ["Unavailable parent refs",health.missingParentReferences]
        ].map(([label,value])=><section key={label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></section>)}
      </div>
      {(health.missingParentReferences>0 || health.duplicateIds>0)&&<p role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Some version references are unavailable or repeated. This is a metadata consistency warning, not proof the PDF bytes are corrupted.</p>}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-black">Version inventory</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Select an earlier stored version without overwriting or deleting any other version. This changes the active workspace pointer only.</p>
        {notice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
        {versions.length===0?<p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No stored documents yet. Try Magic Drop to create a workspace version.</p>:
          <ol className="mt-4 space-y-2">{versions.slice(0,50).map(v=><li key={v.id} className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="break-all font-semibold">{v.name}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Version {v.version} · {v.relationKind} · {(v.size/1024/1024).toFixed(2)} MB</p>
            <button type="button" onClick={() => void useVersion(v.id)} disabled={switching || v.id === activeId}
              aria-label={v.id === activeId ? "Current version "+v.name : "Use stored version "+v.name}
              className="mt-3 min-h-11 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-300">
              {v.id === activeId ? "Active version" : "Use this version"}
            </button>
          </li>)}</ol>}
        {versions.length>50&&<p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Showing first 50 of {versions.length} versions. The export includes all version metadata.</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={()=>void refresh()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 font-semibold dark:border-slate-700"><RefreshCcw size={17}/> Refresh inventory</button>
          <button type="button" onClick={exportManifest} disabled={versions.length===0} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-40"><Download size={17}/> Export metadata-only JSON</button>
        </div>
      </section>
      <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300"><ShieldCheck size={18} className="mt-1 shrink-0"/> The export includes filenames and operation history, which may themselves be sensitive. It does not contain PDF bytes and <strong>cannot restore lost files</strong>. Keep your original PDFs backed up separately.</p>
    </>}
    <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold"><Link className="text-blue-700 underline dark:text-blue-300" href="/dashboard">Back to Dashboard</Link><Link className="text-blue-700 underline dark:text-blue-300" href="/workspace-privacy">Privacy Controls</Link></div>
  </main>;
}
