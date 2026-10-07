"use client";

import ToolLayout from "@/components/pdf/ToolLayout";
import {
  buildWorkflowRecipesHref,
  buildWorkflowToolHref,
  createDocumentArtifact,
  createWorkflowRecipePlans,
  inspectPdfArtifact,
  isWorkflowRecipeId,
  type WorkflowRecipeAvailability,
  type WorkflowRecipePlan,
  type WorkflowRecipeStepKind,
} from "@/lib/document-engine";
import {
  buildWorkspaceHandoffHref,
  getActiveWorkspaceFileSummary,
  getWorkspaceFile,
  getWorkspaceFileSummary,
  listWorkspaceFileSummaries,
  setActiveWorkspaceFile,
  type WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleOff,
  FileClock,
  ListChecks,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useSearchParams,
} from "next/navigation";

type LoadedWorkspace = {
  summary: WorkspaceFileSummary;
  recipes: WorkflowRecipePlan[];
  operationHistory: string[];
};

const availabilityConfig: Record<
  WorkflowRecipeAvailability,
  {
    label: string;
    className: string;
  }
> = {
  AVAILABLE: {
    label: "AVAILABLE",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  UNAVAILABLE: {
    label: "NOT APPLICABLE",
    className:
      "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300",
  },
  BLOCKED: {
    label: "BLOCKED",
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  },
};

const stepConfig: Record<
  WorkflowRecipeStepKind,
  {
    label: string;
    className: string;
  }
> = {
  REQUIRED: {
    label: "RECIPE STEP",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  },
  OPTIONAL: {
    label: "OPTIONAL",
    className:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  },
  USER_DECISION: {
    label: "YOUR DECISION",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  },
  NOT_NEEDED: {
    label: "NOT NEEDED",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  BLOCKED: {
    label: "BLOCKED",
    className:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  },
};

function formatFeature(
  feature: string,
) {
  return feature
    .split("-")
    .join(" ");
}

function operationHistoryFor(
  summaries: WorkspaceFileSummary[],
  activeId: string,
) {
  const byId = new Map(
    summaries.map(
      (summary) => [
        summary.id,
        summary,
      ],
    ),
  );
  const operations: string[] =
    [];
  const visited = new Set<
    string
  >();

  let current =
    byId.get(activeId);

  while (
    current &&
    !visited.has(current.id)
  ) {
    visited.add(current.id);

    if (
      current.operationId
    ) {
      operations.push(
        current.operationId,
      );
    }

    current =
      current.parentId
        ? byId.get(
            current.parentId,
          )
        : undefined;
  }

  return operations.reverse();
}

function WorkflowRecipesContent() {
  const searchParams =
    useSearchParams();
  const queryString =
    searchParams.toString();
  const recipeParam =
    searchParams.get("recipe");
  const selectedRecipeId =
    isWorkflowRecipeId(
      recipeParam,
    )
      ? recipeParam
      : null;
  const requestedStep = Number(
    searchParams.get(
      "recipeStep",
    ) ?? "0",
  );

  const [
    workspace,
    setWorkspace,
  ] = useState<LoadedWorkspace | null>(
    null,
  );
  const [loaded, setLoaded] =
    useState(false);
  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoaded(false);
      setError("");

      try {
        const params =
          new URLSearchParams(
            queryString,
          );
        const requestedId =
          params.get(
            "workspaceFile",
          );

        const summary =
          requestedId
            ? await getWorkspaceFileSummary(
                requestedId,
              )
            : await getActiveWorkspaceFileSummary();

        if (!summary) {
          if (!cancelled) {
            setWorkspace(
              null,
            );
            setLoaded(true);
          }
          return;
        }

        const file =
          await getWorkspaceFile(
            summary.id,
          );

        if (!file) {
          throw new Error(
            "This browser workspace version is no longer available.",
          );
        }

        const artifact =
          createDocumentArtifact(
            file,
            {
              id: summary.id,
              name:
                summary.name,
              mimeType:
                summary.type,
              source:
                summary.role ===
                "derived"
                  ? "operation"
                  : "upload",
            },
          );

        const report =
          await inspectPdfArtifact(
            artifact,
          );
        const recipes =
          createWorkflowRecipePlans(
            report,
          );
        const summaries =
          await listWorkspaceFileSummaries();

        await setActiveWorkspaceFile(
          summary.id,
        );

        if (!cancelled) {
          setWorkspace({
            summary,
            recipes,
            operationHistory:
              operationHistoryFor(
                summaries,
                summary.id,
              ),
          });
          setLoaded(true);
        }
      } catch (loadError) {
        console.error(
          loadError,
        );

        if (!cancelled) {
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Kukureku could not load this local workspace version.",
          );
          setLoaded(true);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const selectedRecipe =
    useMemo(
      () =>
        selectedRecipeId &&
        workspace
          ? workspace.recipes.find(
              (recipe) =>
                recipe.id ===
                selectedRecipeId,
            ) ?? null
          : null,
      [
        selectedRecipeId,
        workspace,
      ],
    );

  const currentStep =
    selectedRecipe
      ? Math.min(
          selectedRecipe.steps
            .length,
          Number.isInteger(
            requestedStep,
          ) &&
            requestedStep >= 0
            ? requestedStep
            : 0,
        )
      : 0;

  const verifiedFormContinuation =
    Boolean(
      selectedRecipe?.id ===
        "finalize-standard-form" &&
        currentStep > 0 &&
        workspace?.operationHistory.includes(
          "flatten-form",
        ),
    );

  const recipeCanProceed =
    Boolean(
      selectedRecipe &&
        (selectedRecipe.availability ===
          "AVAILABLE" ||
          verifiedFormContinuation),
    );

  return (
    <ToolLayout
      label="Workflow Recipes V1"
      title="Guided PDF workflows with approval at every step"
      description="Choose a goal-driven recipe, review each operation and its known effects, and continue through browser-local PDF versions without automatic edits."
      tips={[
        {
          title:
            "Nothing runs automatically",
          description:
            "A recipe is a guided sequence. You explicitly open and run each modifying tool.",
        },
        {
          title:
            "Every successful result becomes a version",
          description:
            "Supported recipe steps continue from the derived browser-local PDF instead of forcing another upload.",
        },
        {
          title:
            "Recipes do not invent facts",
          description:
            "Kukureku keeps user intent separate from inspected evidence and leaves unknown structures unknown.",
        },
      ]}
      faqs={[
        {
          question:
            "Does starting a recipe change my PDF?",
          answer:
            "No. Opening or advancing a recipe changes nothing. A PDF changes only after you explicitly run a tool.",
        },
        {
          question:
            "Are recipes AI guesses?",
          answer:
            "No. V1 uses fixed workflow definitions plus deterministic local inspection. User-goal steps such as password protection or redaction are clearly labeled as your decision.",
        },
        {
          question:
            "Where are recipe files stored?",
          answer:
            "The active source and supported derived versions stay in this browser's local IndexedDB workspace.",
        },
      ]}
      howToTitle="How Workflow Recipes V1 works"
      howToSteps={[
        {
          title:
            "Choose a local workspace PDF",
          description:
            "Use the current browser workspace version or arrive from Magic Drop.",
        },
        {
          title:
            "Pick a goal",
          description:
            "Choose a recipe such as Prepare for Sharing or Finalize Standard Form.",
        },
        {
          title:
            "Approve one step at a time",
          description:
            "Open a tool, review its effect, run it yourself, then continue from the newly created version.",
        },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      {!loaded && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="flex items-start gap-4">
            <LoaderCircle
              size={24}
              className="mt-0.5 animate-spin text-blue-600"
            />
            <div>
              <h2 className="text-lg font-extrabold text-blue-950 dark:text-blue-100">
                Reading the local workspace
              </h2>
              <p className="mt-2 text-sm leading-6 text-blue-800 dark:text-blue-200">
                Kukureku is inspecting the current browser-local PDF so recipe steps can respect the facts it can actually prove.
              </p>
            </div>
          </div>
        </section>
      )}

      {loaded &&
        error && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
            <div className="flex items-start gap-4">
              <CircleOff
                size={24}
                className="mt-0.5 text-red-600"
              />
              <div>
                <h2 className="text-lg font-extrabold text-red-950 dark:text-red-100">
                  Workflow Recipes could not load this version
                </h2>
                <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">
                  {error}
                </p>
                <Link
                  href="/magic-drop"
                  className="mt-5 inline-flex rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white"
                >
                  Start again with Magic Drop
                </Link>
              </div>
            </div>
          </section>
        )}

      {loaded &&
        !error &&
        !workspace && (
          <section className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
            <FileClock
              size={30}
              className="text-gray-400"
            />
            <h2 className="mt-5 text-2xl font-extrabold text-gray-950 dark:text-white">
              No browser workspace PDF is active
            </h2>
            <p className="mt-3 max-w-3xl leading-7 text-gray-600 dark:text-slate-400">
              Workflow Recipes V1 works with Kukureku's local version graph. Magic Drop a PDF first, then return here without re-uploading it.
            </p>
            <Link
              href="/magic-drop"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Open Magic Drop
              <ArrowRight
                size={17}
              />
            </Link>
          </section>
        )}

      {loaded &&
        !error &&
        workspace && (
          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                    Current browser workspace
                  </p>
                  <h2 className="mt-2 break-all text-xl font-extrabold text-gray-950 dark:text-white">
                    {workspace.summary.name}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                    Version{" "}
                    {workspace.summary.version} ·{" "}
                    {workspace.summary.role ===
                    "source"
                      ? "original source"
                      : workspace.summary.operationLabel ||
                        "derived PDF"}
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                  <ShieldCheck
                    size={17}
                  />
                  Browser-local
                </div>
              </div>
            </section>

            {!selectedRecipe && (
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
                <div className="max-w-4xl">
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                    Choose your goal
                  </p>
                  <h2 className="mt-2 text-3xl font-extrabold text-gray-950 dark:text-white">
                    Workflow Recipes
                  </h2>
                  <p className="mt-3 leading-7 text-gray-600 dark:text-slate-400">
                    These are user-selected goal templates, not claims that your document needs every operation. Facts can mark a step required, optional, unnecessary, or blocked.
                  </p>
                </div>

                <div className="mt-7 grid gap-5 xl:grid-cols-3">
                  {workspace.recipes.map(
                    (recipe) => {
                      const config =
                        availabilityConfig[
                          recipe
                            .availability
                        ];

                      return (
                        <article
                          key={
                            recipe.id
                          }
                          className="flex h-full flex-col rounded-3xl border border-gray-200 bg-gray-50 p-6 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <div>
                            <span
                              className={
                                "inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide " +
                                config.className
                              }
                            >
                              {
                                config.label
                              }
                            </span>
                            <h3 className="mt-4 text-xl font-extrabold text-gray-950 dark:text-white">
                              {
                                recipe.title
                              }
                            </h3>
                            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-400">
                              {
                                recipe.description
                              }
                            </p>
                            <p className="mt-4 text-sm leading-6 text-gray-700 dark:text-slate-300">
                              {
                                recipe.availabilityReason
                              }
                            </p>
                          </div>

                          <ol className="mt-5 space-y-2 text-sm text-gray-700 dark:text-slate-300">
                            {recipe.steps.map(
                              (
                                step,
                              ) => (
                                <li
                                  key={
                                    step.index
                                  }
                                  className="flex gap-2"
                                >
                                  <span className="font-extrabold text-blue-600">
                                    {step.index +
                                      1}
                                    .
                                  </span>
                                  <span>
                                    {
                                      step.title
                                    }
                                  </span>
                                </li>
                              ),
                            )}
                          </ol>

                          <div className="mt-auto pt-6">
                            {recipe.availability ===
                            "AVAILABLE" ? (
                              <Link
                                href={buildWorkflowRecipesHref(
                                  workspace
                                    .summary
                                    .id,
                                  recipe.id,
                                  0,
                                )}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                              >
                                Start{" "}
                                {
                                  recipe.title
                                }
                                <ArrowRight
                                  size={
                                    16
                                  }
                                />
                              </Link>
                            ) : (
                              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                                {recipe.availability ===
                                "BLOCKED"
                                  ? "Recipe blocked by inspected structure"
                                  : "Recipe not applicable to this version"}
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    },
                  )}
                </div>
              </section>
            )}

            {selectedRecipe && (
              <>
                <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
                  <Link
                    href={buildWorkflowRecipesHref(
                      workspace
                        .summary.id,
                    )}
                    className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-300"
                  >
                    <ArrowLeft
                      size={16}
                    />
                    All recipes
                  </Link>

                  <div className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                    <div className="max-w-4xl">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-3xl font-extrabold text-gray-950 dark:text-white">
                          {
                            selectedRecipe.title
                          }
                        </h2>
                        <span
                          className={
                            "rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wide " +
                            (verifiedFormContinuation
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                              : availabilityConfig[
                                  selectedRecipe
                                    .availability
                                ]
                                  .className)
                          }
                        >
                          {verifiedFormContinuation
                            ? "IN PROGRESS"
                            : availabilityConfig[
                                selectedRecipe
                                  .availability
                              ]
                                .label}
                        </span>
                      </div>
                      <p className="mt-4 leading-7 text-gray-600 dark:text-slate-400">
                        {
                          selectedRecipe.description
                        }
                      </p>
                      <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-slate-300">
                        {verifiedFormContinuation
                          ? "The current version history confirms that Flatten PDF already produced a derived version, so the remaining recipe steps can continue even though no interactive form remains."
                          : selectedRecipe.availabilityReason}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 self-start rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
                      <ListChecks
                        size={18}
                      />
                      Approval at every step
                    </div>
                  </div>

                  {selectedRecipe.cautions.length >
                    0 && (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20">
                      <p className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-100">
                        <AlertTriangle
                          size={18}
                        />
                        Recipe boundaries
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-800 dark:text-amber-300">
                        {selectedRecipe.cautions.map(
                          (
                            caution,
                          ) => (
                            <li
                              key={
                                caution
                              }
                            >
                              •{" "}
                              {
                                caution
                              }
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </section>

                {!recipeCanProceed && (
                  <section className="rounded-3xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
                    <div className="flex items-start gap-4">
                      <CircleOff
                        size={24}
                        className="mt-0.5 text-red-600"
                      />
                      <div>
                        <h3 className="text-lg font-extrabold text-red-950 dark:text-red-100">
                          This recipe cannot start from the current version
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">
                          {
                            selectedRecipe.availabilityReason
                          }
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {recipeCanProceed &&
                  currentStep >=
                    selectedRecipe.steps
                      .length && (
                    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20 md:p-8">
                      <div className="flex items-start gap-4">
                        <CheckCircle2
                          size={26}
                          className="mt-0.5 text-emerald-600"
                        />
                        <div>
                          <h3 className="text-xl font-extrabold text-emerald-950 dark:text-emerald-100">
                            Recipe sequence reached its final checkpoint
                          </h3>
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-800 dark:text-emerald-200">
                            Kukureku has reached the end of this guided sequence. This is not a forensic clean certificate; review the current version and the visible recipe boundaries before sharing it.
                          </p>
                          <div className="mt-5 flex flex-wrap gap-3">
                            <Link
                              href={buildWorkspaceHandoffHref(
                                "/magic-drop",
                                workspace
                                  .summary
                                  .id,
                              )}
                              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"
                            >
                              Reinspect current version
                            </Link>
                            <Link
                              href="/dashboard"
                              className="rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-200"
                            >
                              Open Workspace
                            </Link>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                {recipeCanProceed &&
                  currentStep <
                    selectedRecipe.steps
                      .length && (
                    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                        Guided sequence
                      </p>
                      <h3 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                        Step{" "}
                        {currentStep +
                          1}{" "}
                        of{" "}
                        {
                          selectedRecipe
                            .steps
                            .length
                        }
                      </h3>

                      <div className="mt-6 space-y-4">
                        {selectedRecipe.steps.map(
                          (
                            step,
                          ) => {
                            const config =
                              stepConfig[
                                step.kind
                              ];
                            const isCurrent =
                              step.index ===
                              currentStep;
                            const isEarlier =
                              step.index <
                              currentStep;

                            return (
                              <article
                                key={
                                  step.index
                                }
                                className={
                                  "rounded-2xl border p-5 transition " +
                                  (isCurrent
                                    ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20"
                                    : "border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-950")
                                }
                              >
                                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-extrabold text-gray-500 dark:text-slate-400">
                                        Step{" "}
                                        {
                                          step.index +
                                          1
                                        }
                                      </span>
                                      <span
                                        className={
                                          "rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide " +
                                          config.className
                                        }
                                      >
                                        {
                                          config.label
                                        }
                                      </span>
                                      {isEarlier && (
                                        <span className="rounded-full bg-gray-200 px-2.5 py-1 text-[10px] font-bold text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                                          EARLIER STEP
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="mt-3 text-lg font-extrabold text-gray-950 dark:text-white">
                                      {
                                        step.title
                                      }
                                    </h4>
                                    <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-600 dark:text-slate-400">
                                      {
                                        step.reason
                                      }
                                    </p>
                                  </div>

                                  {isCurrent &&
                                    step.kind !==
                                      "BLOCKED" &&
                                    step.kind !==
                                      "NOT_NEEDED" && (
                                      <Link
                                        href={buildWorkflowToolHref(
                                          step.route,
                                          workspace
                                            .summary
                                            .id,
                                          selectedRecipe.id,
                                          step.index,
                                        )}
                                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                                      >
                                        Open{" "}
                                        {
                                          step.title
                                        }
                                        <ArrowRight
                                          size={
                                            16
                                          }
                                        />
                                      </Link>
                                    )}
                                </div>

                                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                    <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-gray-400">
                                      Evidence / intent
                                    </p>
                                    <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-slate-300">
                                      {step.evidence.map(
                                        (
                                          evidence,
                                        ) => (
                                          <li
                                            key={
                                              evidence
                                            }
                                          >
                                            •{" "}
                                            {
                                              evidence
                                            }
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  </div>

                                  {step.effect && (
                                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-gray-400">
                                        Known effect
                                      </p>
                                      <p className="mt-3 text-sm leading-6 text-gray-700 dark:text-slate-300">
                                        {
                                          step.effect
                                            .description
                                        }
                                      </p>
                                      <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-slate-400">
                                        Modifies:{" "}
                                        {step.effect.modifies
                                          .map(
                                            formatFeature,
                                          )
                                          .join(
                                            ", ",
                                          ) ||
                                          "none declared"}
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">
                                        Destroys:{" "}
                                        {step.effect.destroys
                                          .map(
                                            formatFeature,
                                          )
                                          .join(
                                            ", ",
                                          ) ||
                                          "none declared"}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {isCurrent &&
                                  step.kind ===
                                    "NOT_NEEDED" && (
                                    <div className="mt-4">
                                      <Link
                                        href={buildWorkflowRecipesHref(
                                          workspace
                                            .summary
                                            .id,
                                          selectedRecipe.id,
                                          step.index +
                                            1,
                                        )}
                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"
                                      >
                                        Continue to next step
                                        <ArrowRight
                                          size={
                                            16
                                          }
                                        />
                                      </Link>
                                    </div>
                                  )}

                                {isCurrent &&
                                  (step.kind ===
                                    "OPTIONAL" ||
                                    step.kind ===
                                      "USER_DECISION") && (
                                    <div className="mt-4">
                                      <Link
                                        href={buildWorkflowRecipesHref(
                                          workspace
                                            .summary
                                            .id,
                                          selectedRecipe.id,
                                          step.index +
                                            1,
                                        )}
                                        className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                      >
                                        Skip this step
                                        <ArrowRight
                                          size={
                                            16
                                          }
                                        />
                                      </Link>
                                    </div>
                                  )}

                                {isCurrent &&
                                  step.kind ===
                                    "BLOCKED" && (
                                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200">
                                      This operation is blocked for the inspected structure. Kukureku will not offer a tool handoff from this step.
                                    </div>
                                  )}
                              </article>
                            );
                          },
                        )}
                      </div>
                    </section>
                  )}
              </>
            )}

            <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900 dark:bg-blue-950/20">
              <div className="flex items-start gap-4">
                <Sparkles
                  size={23}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <h3 className="font-extrabold text-blue-950 dark:text-blue-100">
                    Workflow Recipes V1 is deliberately conservative
                  </h3>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-800 dark:text-blue-200">
                    Recipes organize approved tools into a sequence. They do not automatically execute operations, identify sensitive content, or turn unchecked structures into safety claims.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
    </ToolLayout>
  );
}

export default function WorkflowRecipesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh]" />
      }
    >
      <WorkflowRecipesContent />
    </Suspense>
  );
}
