"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  PdfBoundingBox,
} from "@/lib/pdf-engine-v4/model/types";

import {
  loadPdfJs,
} from "@/lib/pdf-engine-v4/reader/pdfJsLoader";

type SuspiciousCellPreviewProps = {
  file: File;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  bounds: PdfBoundingBox;
  cellText?: string;
};

export default function SuspiciousCellPreview({
  file,
  pageNumber,
  pageWidth,
  pageHeight,
  bounds,
  cellText,
}: SuspiciousCellPreviewProps) {
  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      try {
        setErrorMessage("");

        const pdfjsLib =
          await loadPdfJs();

        const arrayBuffer =
          await file.arrayBuffer();

        const loadingTask =
          pdfjsLib.getDocument({
            data: new Uint8Array(
              arrayBuffer,
            ),
          });

        const pdf =
          await loadingTask.promise;

        const page =
          await pdf.getPage(
            pageNumber,
          );

        const viewport =
          page.getViewport({
            scale: 1.5,
          });

        const canvas =
          canvasRef.current;

        if (
          !canvas ||
          cancelled
        ) {
          await loadingTask.destroy();
          return;
        }

        const context =
          canvas.getContext("2d");

        if (!context) {
          await loadingTask.destroy();

          throw new Error(
            "Could not create the PDF preview canvas.",
          );
        }

        canvas.width =
          Math.ceil(
            viewport.width,
          );

        canvas.height =
          Math.ceil(
            viewport.height,
          );

        await page.render({
  canvas,
  canvasContext: context,
  viewport,
}).promise;

        page.cleanup();
        await loadingTask.destroy();
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not render the source PDF page.",
        );
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
    };
  }, [
    file,
    pageNumber,
  ]);

  const left =
    pageWidth > 0
      ? (bounds.x /
          pageWidth) *
        100
      : 0;

  const top =
    pageHeight > 0
      ? ((pageHeight -
          bounds.y -
          bounds.height) /
          pageHeight) *
        100
      : 0;

  const width =
    pageWidth > 0
      ? (bounds.width /
          pageWidth) *
        100
      : 0;

  const height =
    pageHeight > 0
      ? (bounds.height /
          pageHeight) *
        100
      : 0;

  if (errorMessage) {
    return (
      <p className="text-sm text-red-600 dark:text-red-300">
        {errorMessage}
      </p>
    );
  }

  return (
    <div>
      <div className="relative inline-block max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-700">
        <canvas
          ref={canvasRef}
          className="block h-auto max-w-full"
        />

        <div
          className="pointer-events-none absolute border-2 border-amber-500 bg-amber-300/30"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${width}%`,
            height: `${height}%`,
          }}
        />
      </div>

      {cellText && (
        <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
          Highlighted cell:{" "}
          <span className="font-semibold text-gray-700 dark:text-slate-200">
            "{cellText}"
          </span>
        </p>
      )}
    </div>
  );
}