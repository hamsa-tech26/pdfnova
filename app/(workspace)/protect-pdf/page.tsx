import ToolLayout from "@/components/pdf/ToolLayout";
import {
  Clock3,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const protectPdfTips = [
  {
    title: "Use a strong password",
    description:
      "When the tool becomes available, use a password containing letters, numbers, and symbols.",
  },
  {
    title: "Keep your password safe",
    description:
      "A protected PDF may be difficult or impossible to recover if the password is lost.",
  },
  {
    title: "Keep the original file",
    description:
      "Always retain an unprotected backup copy of important documents.",
  },
];

const protectPdfFaqs = [
  {
    question: "Is Protect PDF currently available?",
    answer:
      "Not yet. Secure browser-based PDF encryption support is currently being prepared.",
  },
  {
    question: "Will my PDF be uploaded?",
    answer:
      "The planned version will process supported PDFs locally inside your browser.",
  },
  {
    question: "What protection options are planned?",
    answer:
      "The first version is planned to support opening-password protection. Additional document permissions may be added later.",
  },
];

export default function ProtectPdfPage() {
  return (
    <ToolLayout
      label="Protect PDF"
      title="Add password protection to your PDF"
      description="Secure browser-based PDF encryption is being prepared for the PDFNova workspace."
      tips={protectPdfTips}
      faqs={protectPdfFaqs}
      maxWidthClassName="max-w-6xl"
    >
      <section className="overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-7 text-center shadow-sm dark:border-blue-950 dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 md:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-xl shadow-blue-200 dark:shadow-none">
          <LockKeyhole size={36} />
        </div>

        <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <Clock3 size={16} />
          Coming Soon
        </div>

        <h2 className="mt-5 text-3xl font-extrabold text-gray-950 dark:text-white">
          Real PDF encryption is under development
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600 dark:text-slate-400">
          We are preparing secure password-protection support that will create
          an encrypted copy of your PDF directly inside the browser.
        </p>

        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <KeyRound
              size={23}
              className="mx-auto text-blue-600 dark:text-blue-400"
            />

            <p className="mt-3 font-bold text-gray-950 dark:text-white">
              Password protection
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
              Require a password before the PDF can be opened.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <ShieldCheck
              size={23}
              className="mx-auto text-emerald-600"
            />

            <p className="mt-3 font-bold text-gray-950 dark:text-white">
              Private processing
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
              Planned processing will take place locally in your browser.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <Sparkles
              size={23}
              className="mx-auto text-violet-600 dark:text-violet-400"
            />

            <p className="mt-3 font-bold text-gray-950 dark:text-white">
              Simple workflow
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
              Upload, choose a password, protect, and download.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled
          className="mt-8 cursor-not-allowed rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white opacity-60 dark:bg-slate-700"
        >
          Protection Tool Coming Soon
        </button>
      </section>
    </ToolLayout>
  );
}