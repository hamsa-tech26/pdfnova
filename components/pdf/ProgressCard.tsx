import {
  CheckCircle2,
  Circle,
  LoaderCircle,
  TimerReset,
  Zap,
} from "lucide-react";

type ProgressStep = {
  label: string;
  description?: string;
};

type ProgressCardProps = {
  title?: string;
  description?: string;
  progress?: number;
  currentStep?: number;
  steps?: ProgressStep[];
  estimatedTime?: string;
};

const defaultSteps: ProgressStep[] = [
  {
    label: "Preparing file",
    description: "Reading and validating your document.",
  },
  {
    label: "Processing document",
    description: "Applying the selected PDF operation.",
  },
  {
    label: "Preparing download",
    description: "Creating the final downloadable file.",
  },
];

export default function ProgressCard({
  title = "Processing your document",
  description = "Please keep this tab open while PDFNova completes the task.",
  progress,
  currentStep = 1,
  steps = defaultSteps,
  estimatedTime,
}: ProgressCardProps) {
  const hasProgress =
    typeof progress === "number" && Number.isFinite(progress);

  const safeProgress = hasProgress
    ? Math.min(100, Math.max(0, progress))
    : 0;

  const safeCurrentStep = Math.min(
    steps.length,
    Math.max(0, currentStep),
  );

  return (
    <section
      aria-live="polite"
      aria-busy="true"
      className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-sm dark:border-blue-950 dark:from-blue-950/40 dark:to-slate-900 md:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none">
            <LoaderCircle
              size={23}
              className="animate-spin"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
              <Zap size={16} />
              PDFNova Processing
            </div>

            <h2 className="mt-2 text-xl font-extrabold text-gray-950 dark:text-white">
              {title}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>

        {estimatedTime && (
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-300">
            <TimerReset size={16} />
            {estimatedTime}
          </div>
        )}
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold text-gray-700 dark:text-slate-300">
            Overall progress
          </span>

          <span className="font-extrabold text-blue-600 dark:text-blue-300">
            {hasProgress
              ? `${Math.round(safeProgress)}%`
              : "Working"}
          </span>
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white shadow-inner dark:bg-slate-800">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ${
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

      <div className="mt-7 grid gap-3">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < safeCurrentStep;
          const isActive = stepNumber === safeCurrentStep;

          return (
            <div
              key={`${step.label}-${stepNumber}`}
              className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
                isActive
                  ? "border-blue-200 bg-white shadow-sm dark:border-blue-900 dark:bg-slate-900"
                  : isCompleted
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-950 dark:bg-emerald-950/30"
                    : "border-transparent bg-white/50 dark:bg-slate-900/50"
              }`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isCompleted
                    ? "bg-emerald-600 text-white"
                    : isActive
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 size={16} />
                ) : isActive ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Circle size={13} />
                )}
              </div>

              <div>
                <p
                  className={`font-bold ${
                    isActive
                      ? "text-blue-700 dark:text-blue-300"
                      : isCompleted
                        ? "text-emerald-800 dark:text-emerald-300"
                        : "text-gray-700 dark:text-slate-300"
                  }`}
                >
                  {step.label}
                </p>

                {step.description && (
                  <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-slate-400">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}