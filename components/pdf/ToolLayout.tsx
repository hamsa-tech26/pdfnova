import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  LockKeyhole,
  Monitor,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type ToolTip = {
  title: string;
  description: string;
};

type ToolFaq = {
  question: string;
  answer: string;
};

type ToolHowToStep = {
  title: string;
  description: string;
};

type ToolLayoutProps = {
  label: string;
  title: string;
  description: string;
  children: ReactNode;
  tips?: ToolTip[];
  faqs?: ToolFaq[];
  howToTitle?: string;
  howToSteps?: ToolHowToStep[];
  guide?: {
    href: string;
    title: string;
    description: string;
  };
  maxWidthClassName?: string;
};

const defaultTips: ToolTip[] = [
  {
    title: "Use supported files",
    description:
      "Choose the recommended file type and keep the file within the stated size limit.",
  },
  {
    title: "Keep this tab open",
    description:
      "Large files may need a little more time while Kukureku PDF processes them.",
  },
  {
    title: "Check the result",
    description:
      "Open the downloaded file once to confirm that everything looks correct.",
  },
];

const relatedTools = [
  { href: "/merge-pdf", label: "Merge PDF" },
  { href: "/split-pdf", label: "Split PDF" },
  { href: "/compress-pdf", label: "Compress PDF" },
  { href: "/pdf-to-word", label: "PDF to Word" },
  { href: "/word-to-pdf", label: "Word to PDF" },
  { href: "/jpg-to-pdf", label: "JPG to PDF" },
  { href: "/pdf-to-jpg", label: "PDF to JPG" },
  { href: "/organize-pdf", label: "Organize PDF" },
  { href: "/watermark-pdf", label: "Watermark PDF" },
  { href: "/unlock-pdf", label: "Unlock PDF" },
];

const defaultFaqs: ToolFaq[] = [
  {
    question: "Are my files uploaded?",
    answer:
      "Supported tools process files inside your browser, so the document stays on your device.",
  },
  {
    question: "Can I use Kukureku PDF for free?",
    answer:
      "The currently available tools can be used from the free workspace.",
  },
  {
    question: "Why might a conversion fail?",
    answer:
      "A file may be damaged, password-protected, unsupported, or too large for the current tool.",
  },
];

export default function ToolLayout({
  label,
  title,
  description,
  children,
  tips = defaultTips,
  faqs = defaultFaqs,
  howToTitle,
  howToSteps,
  guide,
  maxWidthClassName = "max-w-6xl",
}: ToolLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 transition-colors dark:bg-slate-950 sm:px-7 lg:px-8 lg:py-10">
      <div className={`mx-auto ${maxWidthClassName}`}>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 outline-none transition hover:bg-white hover:text-blue-700 focus-visible:ring-4 focus-visible:ring-blue-100 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white dark:focus-visible:ring-blue-950"
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>

        <section className="mt-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white shadow-2xl sm:p-7 md:p-10">
          <div className="grid items-center gap-8 xl:grid-cols-[1.3fr_0.7fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-100 backdrop-blur">
                <Sparkles size={16} />
                {label}
              </div>

              <h1 className="mt-6 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
                {title}
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg sm:leading-8">
                {description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <LockKeyhole size={20} className="text-emerald-200" />

                <p className="mt-3 font-bold">Private</p>

                <p className="mt-1 text-sm text-blue-100">
                  Files stay on your device
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <Zap size={20} className="text-amber-200" />

                <p className="mt-3 font-bold">Fast</p>

                <p className="mt-1 text-sm text-blue-100">
                  Built for quick results
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <Monitor size={20} className="text-cyan-200" />

                <p className="mt-3 font-bold">Browser-based</p>

                <p className="mt-1 text-sm text-blue-100">
                  No software installation
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                <CheckCircle2 size={20} className="text-blue-100" />

                <p className="mt-3 font-bold">Simple</p>

                <p className="mt-1 text-sm text-blue-100">
                  Upload, process, download
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7 md:p-9">
          {children}
        </section>

        {howToTitle && howToSteps && howToSteps.length > 0 && (
          <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
              How it works
            </p>

            <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
              {howToTitle}
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {howToSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-extrabold text-white">
                    {index + 1}
                  </div>

                  <h3 className="mt-4 font-bold text-gray-950 dark:text-white">
                    {step.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6 dark:border-blue-950 dark:bg-blue-950/30">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <Lightbulb size={21} />
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                  Helpful tips
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-gray-950 dark:text-white">
                  Get the best result
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {tips.map((tip) => (
                <div
                  key={tip.title}
                  className="rounded-2xl border border-blue-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="font-bold text-gray-950 dark:text-white">
                    {tip.title}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
                    {tip.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                <HelpCircle size={21} />
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                  Frequently asked
                </p>

                <h2 className="mt-1 text-xl font-extrabold text-gray-950 dark:text-white">
                  Common questions
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                >
                  <summary className="cursor-pointer list-none rounded-lg font-bold text-gray-950 outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:text-white dark:focus-visible:ring-blue-950">
                    <span className="flex items-center justify-between gap-4">
                      {faq.question}

                      <span className="text-xl text-gray-400 transition group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>

                  <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-400">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {guide && (
          <section className="mt-8 rounded-3xl border border-blue-100 bg-blue-50 p-6 dark:border-blue-950 dark:bg-blue-950/30 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
              Learn more
            </p>

            <div className="mt-2 flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                  {guide.title}
                </h2>

                <p className="mt-2 max-w-2xl leading-7 text-gray-600 dark:text-slate-300">
                  {guide.description}
                </p>
              </div>

              <Link
                href={guide.href}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white outline-none transition hover:bg-blue-700 focus-visible:ring-4 focus-visible:ring-blue-200 dark:focus-visible:ring-blue-950"
              >
                Read guide
              </Link>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                Keep working
              </p>

              <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                Need another PDF tool?
              </h2>

              <p className="mt-2 text-gray-600 dark:text-slate-400">
                Continue with another document task from the Kukureku PDF workspace.
              </p>
            </div>

            <div className="flex max-w-2xl flex-wrap gap-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {tool.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}