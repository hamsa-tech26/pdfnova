import {
  AlertTriangle,
  RefreshCcw,
  RotateCcw,
} from "lucide-react";

type ErrorCardProps = {
  title?: string;
  description: string;
  reasons?: string[];
  onRetry?: () => void;
  onReset?: () => void;
  retryLabel?: string;
  resetLabel?: string;
};

const defaultReasons = [
  "The selected file may be damaged.",
  "The file format or encryption may not be supported.",
  "The file may be too large for the current tool.",
];

export default function ErrorCard({
  title = "Something went wrong",
  description,
  reasons = defaultReasons,
  onRetry,
  onReset,
  retryLabel = "Try Again",
  resetLabel = "Choose Another File",
}: ErrorCardProps) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-6 shadow-sm dark:border-red-950 dark:from-red-950/40 dark:to-slate-900 md:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-200 dark:shadow-none">
          <AlertTriangle size={28} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700 dark:text-red-300">
            Processing failed
          </p>

          <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
            {title}
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-slate-400">
            {description}
          </p>

          {reasons.length > 0 && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-white p-4 dark:border-red-900 dark:bg-slate-900">
              <p className="text-sm font-bold text-gray-950 dark:text-white">
                Possible reasons
              </p>

              <ul className="mt-3 space-y-2">
                {reasons.map((reason) => (
                  <li
                    key={reason}
                    className="flex items-start gap-2 text-sm leading-6 text-gray-600 dark:text-slate-400"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(onRetry || onReset) && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-red-700"
                >
                  <RefreshCcw size={18} />
                  {retryLabel}
                </button>
              )}

              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
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