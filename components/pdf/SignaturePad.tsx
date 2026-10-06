"use client";

import {
  Eraser,
  PenLine,
} from "lucide-react";
import {
  PointerEvent,
  useRef,
} from "react";

type SignaturePadProps = {
  onChange: (
    dataUrl: string | null,
    aspectRatio: number,
  ) => void;
  disabled?: boolean;
};

export default function SignaturePad({
  onChange,
  disabled = false,
}: SignaturePadProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const isDrawingRef =
    useRef(false);

  function getPoint(
    event: PointerEvent<HTMLCanvasElement>,
  ) {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (event.clientX -
          rect.left) *
        (canvas.width /
          rect.width),
      y:
        (event.clientY -
          rect.top) *
        (canvas.height /
          rect.height),
    };
  }

  function beginDrawing(
    event: PointerEvent<HTMLCanvasElement>,
  ) {
    if (disabled) {
      return;
    }

    const canvas =
      canvasRef.current;

    const context =
      canvas?.getContext("2d");

    if (
      !canvas ||
      !context
    ) {
      return;
    }

    const point =
      getPoint(event);

    context.lineCap =
      "round";
    context.lineJoin =
      "round";
    context.lineWidth = 7;
    context.strokeStyle =
      "#111827";

    context.beginPath();
    context.moveTo(
      point.x,
      point.y,
    );

    isDrawingRef.current =
      true;

    canvas.setPointerCapture(
      event.pointerId,
    );
  }

  function continueDrawing(
    event: PointerEvent<HTMLCanvasElement>,
  ) {
    if (
      disabled ||
      !isDrawingRef.current
    ) {
      return;
    }

    const canvas =
      canvasRef.current;

    const context =
      canvas?.getContext("2d");

    if (
      !canvas ||
      !context
    ) {
      return;
    }

    const point =
      getPoint(event);

    context.lineTo(
      point.x,
      point.y,
    );

    context.stroke();
  }

  function finishDrawing(
    event: PointerEvent<HTMLCanvasElement>,
  ) {
    if (
      !isDrawingRef.current
    ) {
      return;
    }

    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }

    isDrawingRef.current =
      false;

    if (
      canvas.hasPointerCapture(
        event.pointerId,
      )
    ) {
      canvas.releasePointerCapture(
        event.pointerId,
      );
    }

    onChange(
      canvas.toDataURL(
        "image/png",
      ),
      canvas.width /
        canvas.height,
    );
  }

  function clearPad() {
    const canvas =
      canvasRef.current;

    const context =
      canvas?.getContext("2d");

    if (
      !canvas ||
      !context
    ) {
      return;
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height,
    );

    onChange(
      null,
      canvas.width /
        canvas.height,
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-950 dark:text-white">
            <PenLine size={20} />
            Draw signature
          </h3>

          <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-slate-400">
            Draw with a mouse, stylus, or finger. The background stays transparent.
          </p>
        </div>

        <button
          type="button"
          onClick={clearPad}
          disabled={disabled}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus-visible:ring-red-950"
        >
          <Eraser size={16} />
          Clear
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Signature drawing area. Mouse, touch, or stylus drawing only; use Type or Upload mode for keyboard-only signing."
          width={900}
          height={300}
          onPointerDown={
            beginDrawing
          }
          onPointerMove={
            continueDrawing
          }
          onPointerUp={
            finishDrawing
          }
          onPointerCancel={
            finishDrawing
          }
          className="aspect-[3/1] w-full touch-none cursor-crosshair"
          aria-label="Signature drawing pad"
        />
      </div>
    </section>
  );
}
