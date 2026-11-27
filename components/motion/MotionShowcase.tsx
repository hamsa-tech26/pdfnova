"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  FileText,
  Files,
  GitBranch,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import Reveal from "@/components/motion/Reveal";

const sampleFiles = [
  { id: "brief", name: "Project brief.pdf", detail: "PDF · 2.4 MB · Sample document", status: "Ready", tone: "blue" },
  { id: "report", name: "Quarterly report.pdf", detail: "PDF · 1.8 MB · Sample document", status: "Edited", tone: "violet" },
  { id: "invoice", name: "Invoice collection.pdf", detail: "PDF · 840 KB · Sample document", status: "Merged", tone: "emerald" },
];

type View = "recent" | "graph";

export default function MotionShowcase() {
  const [view, setView] = useState<View>("recent");
  const [activeFile, setActiveFile] = useState("brief");
  const [notice, setNotice] = useState("Choose a sample document to preview its workspace state.");

  const selected = sampleFiles.find((file) => file.id === activeFile) ?? sampleFiles[0];

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3 font-extrabold tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white">
              <Files size={21} aria-hidden="true" />
            </span>
            Kukureku <span className="font-medium text-slate-400">/ Motion Lab</span>
          </a>
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-200">
            Design prototype · Sample data only
          </span>
        </header>

        <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:py-20">
          <Reveal className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-200">
              <Sparkles size={16} aria-hidden="true" /> Premium Motion System V1
            </p>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Your documents. <span className="text-blue-300">In motion.</span>
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-300 sm:text-lg">
              A calmer, clearer way to move between PDF tasks, document versions and workspace activity.
              Every interaction is designed to explain what changed without slowing down the work.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#interactive-preview" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-950 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Explore the prototype <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a href="/" className="inline-flex min-h-12 items-center rounded-xl border border-white/20 px-5 py-3 font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                Back to Kukureku
              </a>
            </div>
            <div className="mt-9 grid grid-cols-3 gap-3 border-t border-white/10 pt-6">
              <div><p className="text-2xl font-extrabold">01</p><p className="mt-1 text-xs text-slate-400">Purposeful motion</p></div>
              <div><p className="text-2xl font-extrabold">0</p><p className="mt-1 text-xs text-slate-400">New dependencies</p></div>
              <div><p className="text-2xl font-extrabold">100%</p><p className="mt-1 text-xs text-slate-400">Sample interface</p></div>
            </div>
          </Reveal>

          <Reveal delayMs={100}>
            <div id="interactive-preview" className="rounded-[2rem] border border-white/10 bg-slate-900/90 p-3 shadow-2xl shadow-blue-950/40 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-2 pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-semibold text-slate-400">Workspace preview</span>
                </div>
                <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">Local demo</span>
              </div>

              <div className="grid gap-4 pt-4 md:grid-cols-[150px_1fr]">
                <aside className="hidden space-y-2 md:block">
                  <div className="rounded-xl bg-blue-500/15 px-3 py-3 text-sm font-bold text-blue-200"><Files className="mr-2 inline" size={16}/> My files</div>
                  <div className="rounded-xl px-3 py-3 text-sm text-slate-400"><GitBranch className="mr-2 inline" size={16}/> Versions</div>
                  <div className="rounded-xl px-3 py-3 text-sm text-slate-400"><Star className="mr-2 inline" size={16}/> Favorites</div>
                  <div className="rounded-xl px-3 py-3 text-sm text-slate-400"><LockKeyhole className="mr-2 inline" size={16}/> Privacy</div>
                </aside>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-xs font-semibold text-slate-400">GOOD EVENING</p><h2 className="mt-1 text-xl font-extrabold">Your workspace</h2></div>
                    <button type="button" onClick={() => setNotice("This is a visual prototype. No file was uploaded or processed.")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300">
                      <Plus size={15}/> Add sample
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs text-slate-400">Sample documents</p><p className="mt-2 text-2xl font-extrabold">03</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-xs text-slate-400">Workspace state</p><p className="mt-2 flex items-center gap-2 text-sm font-bold text-emerald-300"><ShieldCheck size={16}/> Private demo</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="inline-flex rounded-xl bg-slate-800 p-1" aria-label="Preview mode">
                      <button type="button" aria-pressed={view === "recent"} onClick={() => setView("recent")} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${view === "recent" ? "bg-blue-500 text-white shadow" : "text-slate-400 hover:text-white"}`}>Recent files</button>
                      <button type="button" aria-pressed={view === "graph"} onClick={() => setView("graph")} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${view === "graph" ? "bg-blue-500 text-white shadow" : "text-slate-400 hover:text-white"}`}>Version graph</button>
                    </div>
                    <button type="button" aria-label="Search sample documents" onClick={() => setNotice("Search is represented as a design preview only.")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/10"><Search size={16}/></button>
                  </div>

                  {view === "recent" ? (
                    <div className="mt-3 space-y-2">
                      {sampleFiles.map((file) => (
                        <button key={file.id} type="button" onClick={() => { setActiveFile(file.id); setNotice(`Selected sample: ${file.name}`); }} aria-pressed={activeFile === file.id} className={`motion-interactive flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${activeFile === file.id ? "border-blue-400/60 bg-blue-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${file.tone === "blue" ? "bg-blue-400/15 text-blue-200" : file.tone === "violet" ? "bg-violet-400/15 text-violet-200" : "bg-emerald-400/15 text-emerald-200"}`}><FileText size={19}/></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{file.name}</span><span className="mt-1 block text-xs text-slate-400">{file.detail}</span></span>
                          <span className="hidden rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 sm:block">{file.status}</span>
                          <MoreHorizontal size={17} className="text-slate-500"/>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-blue-400/40 bg-blue-500/15 p-3 text-blue-200"><FileText size={20}/></div>
                        <div><p className="text-sm font-bold">Project brief.pdf</p><p className="text-xs text-slate-400">Source · Version 1</p></div>
                      </div>
                      <div className="ml-5 h-6 border-l border-dashed border-blue-400/60"/>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-violet-400/40 bg-violet-500/15 p-3 text-violet-200"><GitBranch size={20}/></div>
                        <div><p className="text-sm font-bold">Edited copy</p><p className="text-xs text-slate-400">Branch · Version 2</p></div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">Illustrative relationship only — not connected to stored workspace data.</p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3">
                    <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Selected preview</p><p className="mt-1 truncate text-xs font-bold text-slate-200">{view === "recent" ? selected.name : "Illustrative version graph"}</p></div>
                    <button type="button" onClick={() => setNotice("Download is disabled in this design-only prototype.")} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10"><ArrowDownToLine size={14}/> Preview action</button>
                  </div>
                  <p className="mt-3 min-h-5 text-xs text-slate-400" aria-live="polite">{notice}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="grid gap-4 border-t border-white/10 py-10 sm:grid-cols-3">
          {[
            ["Subtle entrances", "Reveal key content only as it enters the viewport."],
            ["Clear state changes", "Selection and navigation changes remain obvious."],
            ["Accessible by default", "Reduced motion and keyboard interaction are respected."],
          ].map(([title, description], index) => (
            <Reveal key={title} delayMs={index * 70} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm font-extrabold">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
            </Reveal>
          ))}
        </section>

        <footer className="border-t border-white/10 py-6 text-xs leading-6 text-slate-500">
          Kukureku Motion Lab is an isolated visual prototype. All documents and relationships shown here are synthetic. No files are uploaded, stored, processed or downloaded.
        </footer>
      </div>
    </main>
  );
}
