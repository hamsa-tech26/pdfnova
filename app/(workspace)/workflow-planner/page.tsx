"use client";

import { buildIntentPlan } from "@/lib/workflow/intentPlanner";
import { ArrowRight, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const EXAMPLE = "Merge my PDFs, compress the result, add page numbers and protect it.";

export default function WorkflowPlannerPage() {
  const [input, setInput] = useState("");
  const [request, setRequest] = useState("");
  const [reviewed, setReviewed] = useState<string[]>([]);
  const plan = useMemo(() => buildIntentPlan(request), [request]);

  function makePlan(value = input) {
    setRequest(value.trim());
    setInput(value);
    setReviewed([]);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-7 text-slate-900 dark:text-white sm:px-7 lg:py-10">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-xl sm:p-10">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cyan-200"><Sparkles size={20} aria-hidden="true"/> Workflow Planner V1</div>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Describe your PDF task. Review the steps.</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-blue-100 sm:text-base">Kukureku turns common instructions into manual links to existing browser-local PDF tools. No automatic document edits, no cloud AI, and no file uploads.</p>
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <label htmlFor="workflow-request" className="block text-lg font-extrabold">What would you like to do?</label>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Describe operations only. Do not enter names, passwords, or document contents. Your description stays in this tab.</p>
        <textarea id="workflow-request" value={input} onChange={e=>setInput(e.target.value)} maxLength={1200} rows={4} placeholder={EXAMPLE} className="mt-4 w-full resize-y rounded-2xl border border-slate-300 bg-white p-4 text-base text-slate-900 outline-none focus-visible:ring-4 focus-visible:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white"/>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" disabled={!input.trim()} onClick={()=>makePlan()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Create manual plan <ArrowRight size={18} aria-hidden="true"/></button>
          <button type="button" onClick={()=>makePlan(EXAMPLE)} className="min-h-11 rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Try an example</button>
        </div>
      </section>

      {request && (
        <section aria-live="polite" className="mt-6 space-y-5">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
            <strong>Review required:</strong> This is a deterministic suggestion, not an inspection of your actual PDFs. Open and run every step yourself, verify its output, and choose the correct workspace version before continuing.
          </div>

          {plan.warnings.map((warning, i)=>(
            <p key={i} role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100">{warning}</p>
          ))}

          {plan.steps.length>0 && <>
            <h2 className="text-2xl font-black">Your proposed steps ({plan.steps.length})</h2>
            <ol className="space-y-3">
              {plan.steps.map((step,i)=>(
                <li key={step.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start gap-4">
                    <label className="flex min-h-11 flex-1 cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={reviewed.includes(step.id)} onChange={e=>setReviewed(old=>e.target.checked?[...old,step.id]:old.filter(id=>id!==step.id))} className="mt-1 h-5 w-5 accent-blue-600"/>
                      <span><strong>{i+1}. {step.title}</strong><span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{step.note}</span></span>
                    </label>
                    <Link href={step.href} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Open tool <ArrowRight size={16} aria-hidden="true"/></Link>
                  </div>
                  {step.requiresReview && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300"><ShieldAlert size={17} aria-hidden="true"/> Extra review recommended</p>}
                </li>
              ))}
            </ol>
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><CheckCircle2 size={18} aria-hidden="true"/> Checklist items are for your review only; checking one does not process a file.</p>
          </>}
        </section>
      )}
      <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/workflow-recipes" className="text-blue-700 underline underline-offset-4 dark:text-blue-300">Inspect an existing PDF with Workflow Recipes</Link>
        <Link href="/dashboard" className="text-blue-700 underline underline-offset-4 dark:text-blue-300">Go to Dashboard</Link>
      </div>
    </main>
  );
}
