"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  LocateFixed,
} from "lucide-react";

import {
  nudgeNormalizedPosition,
  type NormalizedPosition,
} from "@/lib/pdf/previewAccessibility";

type PositionControlsProps = {
  label: string;
  position: NormalizedPosition;
  maxX: number;
  maxY: number;
  onChange: (
    position: NormalizedPosition,
  ) => void;
  disabled?: boolean;
  step?: number;
};

export default function PositionControls({
  label,
  position,
  maxX,
  maxY,
  onChange,
  disabled = false,
  step = 0.02,
}: PositionControlsProps) {
  function nudge(
    deltaX: number,
    deltaY: number,
  ) {
    onChange(
      nudgeNormalizedPosition({
        position,
        deltaX,
        deltaY,
        maxX,
        maxY,
      }),
    );
  }

  const buttonClass =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 outline-none transition hover:border-blue-400 hover:bg-blue-50 focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-blue-950/30 dark:focus-visible:ring-blue-950";

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-gray-950 dark:text-white">
            Keyboard-friendly position
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">
            Use these buttons instead of dragging when using a keyboard or precise placement.
          </p>
        </div>

        <div
          role="group"
          aria-label={label}
          className="grid grid-cols-3 gap-2 self-start"
        >
          <span />

          <button
            type="button"
            aria-label={"Move " + label + " up"}
            title="Move up"
            onClick={() =>
              nudge(0, -step)
            }
            disabled={disabled}
            className={buttonClass}
          >
            <ArrowUp size={18} />
          </button>

          <span />

          <button
            type="button"
            aria-label={"Move " + label + " left"}
            title="Move left"
            onClick={() =>
              nudge(-step, 0)
            }
            disabled={disabled}
            className={buttonClass}
          >
            <ArrowLeft size={18} />
          </button>

          <button
            type="button"
            aria-label={"Center " + label}
            title="Center"
            onClick={() =>
              onChange({
                x:
                  Math.max(
                    0,
                    maxX,
                  ) / 2,
                y:
                  Math.max(
                    0,
                    maxY,
                  ) / 2,
              })
            }
            disabled={disabled}
            className={buttonClass}
          >
            <LocateFixed
              size={18}
            />
          </button>

          <button
            type="button"
            aria-label={"Move " + label + " right"}
            title="Move right"
            onClick={() =>
              nudge(step, 0)
            }
            disabled={disabled}
            className={buttonClass}
          >
            <ArrowRight
              size={18}
            />
          </button>

          <span />

          <button
            type="button"
            aria-label={"Move " + label + " down"}
            title="Move down"
            onClick={() =>
              nudge(0, step)
            }
            disabled={disabled}
            className={buttonClass}
          >
            <ArrowDown size={18} />
          </button>

          <span />
        </div>
      </div>

      <p
        aria-live="polite"
        className="mt-3 text-xs text-gray-500 dark:text-slate-400"
      >
        Position:{" "}
        {Math.round(
          position.x * 100,
        )}
        % from left,{" "}
        {Math.round(
          position.y * 100,
        )}
        % from top.
      </p>
    </div>
  );
}
