import {
  CheckCircle2,
  Download,
  FileCheck2,
  RotateCcw,
} from "lucide-react";

type SuccessCardProps = {
  title?: string;
  description?: string;
  fileName?: string;
  onDownloadAgain?: () => void;
  onStartAgain?: () => void;
  downloadLabel?: string;
  resetLabel?: string;
};

export default function SuccessCard({
  title = "Your file is ready",
  description = "PDFNova completed the task successfully.",
  fileName,
  onDownloadAgain,
  onStartAgain,
  downloadLabel = "Download Again",
  resetLabel = "Process Another File",
}: SuccessCardProps) {
  return (
    <section
      aria-live="polite"
      className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50 p-6 shadow-sm dark:border-emerald-950 dark:from-emerald-950/40 dark:to-slate-900 md:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 dark:shadow-none">
          <CheckCircle2 size={28} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            <FileCheck2 size={16} />
            Completed
          </div>

          <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
            {title}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-slate-400">
            {description}
          </p>

          {fileName && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-slate-500">
                Output file
              </p>

              <p className="mt-2 break-all font-semibold text-gray-950 dark:text-white">
                {fileName}
              </p>
            </div>
          )}

          {(onDownloadAgain || onStartAgain) && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {onDownloadAgain && (
                <button
                  type="button"
                  onClick={onDownloadAgain}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700"
                >
                  <Download size={18} />
                  {downloadLabel}
                </button>
              )}

              {onStartAgain && (
                <button
                  type="button"
                  onClick={onStartAgain}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <RotateCcw size={18} />
                  {resetLabel}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}