"use client";

import {
  CheckCircle2,
  FilePlus2,
  Files,
  UploadCloud,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  RefObject,
  useState,
} from "react";

type FileUploaderProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  multiple?: boolean;
  title: string;
  description: string;
  buttonText: string;
  helperText: string;
  disabled?: boolean;
};

export default function FileUploader({
  fileInputRef,
  onFileSelection,
  accept = "application/pdf",
  multiple = true,
  title,
  description,
  buttonText,
  helperText,
  disabled = false,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [, setDragDepth] = useState(0);

  function openFilePicker() {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) {
      return;
    }

    setDragDepth((currentDepth) => currentDepth + 1);
    setIsDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) {
      event.dataTransfer.dropEffect = "none";
      return;
    }

    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) {
      return;
    }

    setDragDepth((currentDepth) => {
      const nextDepth = Math.max(0, currentDepth - 1);

      if (nextDepth === 0) {
        setIsDragging(false);
      }

      return nextDepth;
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    setDragDepth(0);
    setIsDragging(false);

    if (disabled) {
      return;
    }

    const droppedFiles = Array.from(event.dataTransfer.files);

    if (droppedFiles.length === 0 || !fileInputRef.current) {
      return;
    }

    const filesToUse = multiple
      ? droppedFiles
      : droppedFiles.slice(0, 1);

    const dataTransfer = new DataTransfer();

    filesToUse.forEach((file) => {
      dataTransfer.items.add(file);
    });

    fileInputRef.current.files = dataTransfer.files;

    fileInputRef.current.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={onFileSelection}
        disabled={disabled}
      />

      <div
        role="group"
        aria-label={title}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative overflow-hidden rounded-3xl border-2 border-dashed px-4 py-5 text-center outline-none transition-all duration-300 sm:px-6 sm:py-6 xl:px-10 xl:py-16 ${
          disabled
            ? "border-gray-200 bg-gray-50 opacity-60 dark:border-slate-800 dark:bg-slate-900"
            : isDragging
              ? "scale-[1.01] border-blue-600 bg-blue-100 shadow-xl shadow-blue-100 dark:bg-blue-950/50 dark:shadow-none"
              : "border-blue-300 bg-blue-50 hover:-translate-y-0.5 hover:border-blue-500 hover:bg-blue-100/70 hover:shadow-lg dark:border-blue-900 dark:bg-slate-900 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-cyan-100/30 opacity-0 transition group-hover:opacity-100 dark:hidden" />

        <div className="relative">
          <div
            className={`mx-auto hidden h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg transition duration-300 xl:flex ${
              isDragging
                ? "scale-110 bg-blue-700 shadow-blue-200"
                : "bg-gradient-to-br from-blue-600 to-cyan-400 shadow-blue-200 group-hover:scale-105"
            }`}
          >
            {isDragging ? (
              <CheckCircle2 size={31} />
            ) : multiple ? (
              <Files size={30} />
            ) : (
              <UploadCloud size={30} />
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white xl:mt-6 xl:text-2xl">
            {isDragging
              ? multiple
                ? "Drop your files here"
                : "Drop your file here"
              : title}
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600 dark:text-slate-400 xl:mt-3 xl:text-base xl:leading-7">
            {isDragging
              ? "Release now to add the selected file."
              : description}
          </p>

          <div className="mt-5 hidden items-center justify-center gap-3 text-sm font-medium text-gray-400 dark:text-slate-500 xl:flex">
            <span className="h-px w-12 bg-gray-300 dark:bg-slate-700" />
            or
            <span className="h-px w-12 bg-gray-300 dark:bg-slate-700" />
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openFilePicker();
            }}
            disabled={disabled}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-200 outline-none transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-none dark:focus-visible:ring-blue-900"
          >
            <FilePlus2 size={20} />
            {buttonText}
          </button>

          <p className="mt-5 text-sm leading-6 text-gray-600 dark:text-slate-300">
            {helperText}
          </p>

          <p className="mt-2 text-xs text-gray-600 dark:text-slate-300">
            You can drag files here or use the browse button above.
          </p>
        </div>
      </div>
    </>
  );
}
