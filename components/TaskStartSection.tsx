import {
  Archive,
  ArrowRight,
  FileText,
  Files,
  Layers3,
  PenLine,
  ScanText,
} from "lucide-react";
import Link from "next/link";

const tasks = [
  {
    title: "Combine PDFs",
    description: "Put two or more PDFs into one file.",
    href: "/merge-pdf",
    icon: Files,
  },
  {
    title: "Make a PDF smaller",
    description: "Try reducing its size before sharing.",
    href: "/compress-pdf",
    icon: Archive,
  },
  {
    title: "Sign a PDF",
    description: "Add a visible signature, not a digital certificate.",
    href: "/sign-pdf",
    icon: PenLine,
  },
  {
    title: "Fill out a PDF form",
    description: "Complete supported interactive form fields.",
    href: "/pdf-form-filler",
    icon: FileText,
  },
  {
    title: "Rearrange PDF pages",
    description: "Move, rotate, or remove pages visually.",
    href: "/organize-pdf",
    icon: Layers3,
  },
  {
    title: "Read a scanned PDF",
    description: "Recognize English text from scanned pages.",
    href: "/ocr-pdf",
    icon: ScanText,
  },
];

export default function TaskStartSection() {
  return (
    <section id="choose-task" aria-labelledby="choose-task-title" className="scroll-mt-24 bg-white px-4 py-10 dark:bg-slate-950 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Start with your task</p>
            <h2 id="choose-task-title" className="mt-2 text-3xl font-extrabold tracking-tight text-gray-950 dark:text-white sm:text-4xl">
              What do you need to do with your PDF?
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600 dark:text-slate-300">
              Choose an action to open the right tool. Your document does not need to be uploaded to an account.
            </p>
          </div>
          <Link href="/guides/choose-pdf-tool" className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-3 py-2 font-semibold text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300">
            Not sure which tool? <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map(({ title, description, href, icon: Icon }) => (
            <Link key={href} href={href}
              className="group flex min-h-32 items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600 dark:hover:bg-slate-800 sm:p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                <Icon size={22} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold text-slate-950 dark:text-white">{title}</span>
                <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</span>
              </span>
              <ArrowRight size={18} aria-hidden="true" className="mt-3 shrink-0 text-blue-700 transition group-hover:translate-x-0.5 dark:text-blue-300" />
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <p><strong>Already have multiple steps?</strong> Try a guided sequence of available tools.</p>
          <Link href="/workflow-recipes" className="inline-flex min-h-11 shrink-0 items-center gap-2 font-bold text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300">
            Guided workflows <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
