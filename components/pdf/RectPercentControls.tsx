"use client";

import {
  useMemo,
} from "react";

import {
  normalizedRectFromPercent,
  normalizedRectToPercent,
  type NormalizedRect,
} from "@/lib/pdf/previewAccessibility";

type RectPercentControlsProps = {
  label: string;
  value: NormalizedRect;
  onChange: (
    rect: NormalizedRect,
  ) => void;
  onCommit?: (
    rect: NormalizedRect,
  ) => void;
  commitLabel?: string;
  disabled?: boolean;
};

export default function RectPercentControls({
  label,
  value,
  onChange,
  onCommit,
  commitLabel = "Use this area",
  disabled = false,
}: RectPercentControlsProps) {
  const percent =
    useMemo(
      () =>
        normalizedRectToPercent(
          value,
        ),
      [value],
    );

  function update(
    key:
      | "x"
      | "y"
      | "width"
      | "height",
    rawValue: string,
  ) {
    const parsed =
      Number(rawValue);

    if (
      !Number.isFinite(parsed)
    ) {
      return;
    }

    onChange(
      normalizedRectFromPercent({
        ...percent,
        [key]: parsed,
      }),
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-sm font-bold text-gray-950 dark:text-white">
        Precise area controls
      </p>

      <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">
        Enter percentages from the visible page. This provides a keyboard-friendly alternative to dragging.
      </p>

      <div
        role="group"
        aria-label={label}
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {([
          ["x", "Left %"],
          ["y", "Top %"],
          [
            "width",
            "Width %",
          ],
          [
            "height",
            "Height %",
          ],
        ] as const).map(
          ([key, text]) => (
            <label
              key={key}
              className="text-xs font-semibold text-gray-700 dark:text-slate-300"
            >
              {text}

              <input
                type="number"
                inputMode="decimal"
                min={
                  key === "width" ||
                  key === "height"
                    ? 0.5
                    : 0
                }
                max={100}
                step={0.5}
                value={
                  percent[key]
                }
                onChange={(
                  event,
                ) =>
                  update(
                    key,
                    event.target
                      .value,
                  )
                }
                disabled={
                  disabled
                }
                className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
              />
            </label>
          ),
        )}
      </div>

      {onCommit && (
        <button
          type="button"
          onClick={() =>
            onCommit(value)
          }
          disabled={disabled}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-blue-700 focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-blue-950 sm:w-auto"
        >
          {commitLabel}
        </button>
      )}
    </div>
  );
}
