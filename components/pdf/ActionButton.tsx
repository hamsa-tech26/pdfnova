import {
  CheckCircle2,
  Download,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

type ActionButtonProps = {
  isLoading: boolean;
  loadingText: string;
  buttonText: string;
  onClick: () => void;
  disabled?: boolean;
  subtitle?: string;
  loadingSubtitle?: string;
  progress?: number;
  success?: boolean;
  successText?: string;
};

export default function ActionButton({
  isLoading,
  loadingText,
  buttonText,
  onClick,
  disabled = false,
  subtitle = "Your file will be processed and downloaded securely.",
  loadingSubtitle = "Please keep this tab open while processing.",
  progress,
  success = false,
  successText = "Completed successfully",
}: ActionButtonProps) {
  const hasProgress =
    typeof progress === "number" &&
    Number.isFinite(progress);

  const safeProgress = hasProgress
    ? Math.min(100, Math.max(0, progress))
    : 0;

  const isDisabled = disabled || isLoading;

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        className={`group relative w-full overflow-hidden rounded-2xl px-6 py-4 text-left text-white shadow-lg outline-none transition-all duration-300 focus-visible:ring-4 focus-visible:ring-blue-200 ${
          success
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-gradient-to-r from-slate-950 via-blue-900 to-blue-600 hover:-translate-y-0.5 hover:shadow-xl"
        } disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition group-hover:opacity-100" />

        <div className="relative flex items-center gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              success
                ? "bg-white/20"
                : "bg-white/10"
            }`}
          >
            {success ? (
              <CheckCircle2 size={23} />
            ) : isLoading ? (
              <LoaderCircle
                size={23}
                className="animate-spin"
              />
            ) : (
              <Download size={23} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {success
                ? successText
                : isLoading
                  ? loadingText
                  : buttonText}
            </p>

            <p className="mt-1 text-sm leading-5 text-white/75">
              {success
                ? "Your document is ready."
                : isLoading
                  ? loadingSubtitle
                  : subtitle}
            </p>
          </div>

          {!isLoading && !success && (
            <Sparkles
              size={20}
              className="hidden shrink-0 text-cyan-200 transition group-hover:scale-110 sm:block"
            />
          )}
        </div>

        {isLoading && (
          <div className="relative mt-4">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-white/80">
              <span>Processing</span>

              {hasProgress && (
                <span>{Math.round(safeProgress)}%</span>
              )}
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full rounded-full bg-white transition-all duration-300 ${
                  hasProgress
                    ? ""
                    : "w-1/3 animate-pulse"
                }`}
                style={
                  hasProgress
                    ? {
                        width: `${safeProgress}%`,
                      }
                    : undefined
                }
              />
            </div>
          </div>
        )}
      </button>

      {disabled && !isLoading && (
        <p className="mt-3 text-center text-sm text-gray-500">
          Complete the required steps before continuing.
        </p>
      )}
    </div>
  );
}