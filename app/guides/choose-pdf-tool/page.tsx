import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Which PDF Tool Should I Use? A Practical Guide",
  description:
    "Choose the right browser-based PDF tool for merging, compressing, forms, signatures, page editing, OCR and conversion. Includes limitations and checks before sharing.",
  alternates: { canonical: "/guides/choose-pdf-tool" },
};

const choices = [
  { goal: "Combine several PDFs into one", tool: "Merge PDF", href: "/merge-pdf", check: "Confirm the final page order before sharing." },
  { goal: "Reduce a PDF's file size", tool: "Compress PDF", href: "/compress-pdf", check: "Compression results vary. Reopen the file to inspect text and images." },
  { goal: "Move, rotate or delete pages", tool: "Organize PDF", href: "/organize-pdf", check: "Check every affected page, especially forms and annotations." },
  { goal: "Sign a PDF visibly", tool: "Sign PDF", href: "/sign-pdf", check: "A visible signature is not a cryptographic digital signature." },
  { goal: "Fill an existing interactive form", tool: "PDF Form Filler", href: "/pdf-form-filler", check: "Check the saved fields and their visible appearance." },
  { goal: "Read text in a scanned page", tool: "OCR PDF", href: "/ocr-pdf", check: "English OCR can miss or misread characters; compare against the scan." },
  { goal: "Convert selectable text to Word", tool: "PDF to Word", href: "/pdf-to-word", check: "Complex layouts may not match the PDF exactly." },
  { goal: "Protect a PDF with a password", tool: "Protect PDF", href: "/protect-pdf", check: "Keep the password separately and test opening the protected copy." },
];

export default function ChoosePdfToolGuide() {
  return (
    <>
      <Navbar />
      <main className="bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-white sm:px-6 sm:py-14">
        <article className="mx-auto max-w-5xl">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Getting started</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Which PDF tool should I use?</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
            Start with the outcome you want, not the technical name of a tool. These are practical starting points for supported documents—always inspect the downloaded result before using it.
          </p>

          <section aria-labelledby="choose-goal" className="mt-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <h2 id="choose-goal" className="text-2xl font-bold">Choose by your task</h2>
            <div className="mt-5 space-y-3">
              {choices.map(choice => (
                <div key={choice.href} className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 md:grid-cols-[1fr_12rem] md:items-center">
                  <div>
                    <h3 className="font-semibold">{choice.goal}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{choice.check}</p>
                  </div>
                  <Link href={choice.href} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-center font-bold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
                    Open {choice.tool}
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="three-steps" className="mt-8 rounded-3xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-950 dark:bg-blue-950/30 sm:p-7">
            <h2 id="three-steps" className="text-2xl font-bold">A simple three-step routine</h2>
            <ol className="mt-4 list-inside list-decimal space-y-3 leading-7">
              <li><strong>Choose a supported file.</strong> Read the file-type and size limits displayed by the tool.</li>
              <li><strong>Pick your options.</strong> Use preview controls where available; some tools apply changes to all pages.</li>
              <li><strong>Open the download.</strong> Check page order, content, forms, and formatting before sending it elsewhere.</li>
            </ol>
          </section>

          <section aria-labelledby="limitations" className="mt-8 space-y-4 leading-7">
            <h2 id="limitations" className="text-2xl font-bold">When the result needs extra care</h2>
            <p className="text-slate-700 dark:text-slate-300">Scanned pages need OCR, not basic selectable-text extraction. Complex Word layouts and PDF tables can lose structure during conversion. Password-protected or damaged files may be refused, and a PDF signature placed as an image does not provide cryptographic identity verification.</p>
            <p className="text-slate-700 dark:text-slate-300">Supported Kukureku tools process documents inside the browser, but the workspace may retain local document versions or extracted content until cleared. An exported workspace backup is not encrypted. See the <Link href="/privacy" className="font-semibold text-blue-700 underline dark:text-blue-300">privacy policy</Link> for details.</p>
            <p className="text-slate-700 dark:text-slate-300">For several tasks on one file, use <Link href="/workflow-recipes" className="font-semibold text-blue-700 underline dark:text-blue-300">guided workflow recipes</Link>, checking each output along the way.</p>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
