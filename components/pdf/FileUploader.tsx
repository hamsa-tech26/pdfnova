"use client";

import { FilePlus2, UploadCloud } from "lucide-react";
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
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(event.dataTransfer.files);

    if (droppedFiles.length === 0 || !fileInputRef.current) {
      return;
    }

    const filesToUse = multiple ? droppedFiles : droppedFiles.slice(0, 1);
    const dataTransfer = new DataTransfer();

    filesToUse.forEach((file) => {
      dataTransfer.items.add(file);
    });

    fileInputRef.current.files = dataTransfer.files;
    fileInputRef.current.dispatchEvent(
      new Event("change", { bubbles: true }),
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
      />

      <div
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-all duration-300 ${
          isDragging
            ? "scale-[1.01] border-blue-600 bg-blue-100 shadow-xl shadow-blue-100"
            : "border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100/60"
        }`}
      >
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-white transition ${
            isDragging
              ? "scale-110 bg-blue-700"
              : "bg-gradient-to-br from-blue-600 to-cyan-400"
          }`}
        >
          <UploadCloud size={30} />
        </div>

        <h2 className="mt-6 text-2xl font-bold text-gray-900">
          {isDragging ? "Drop your files here" : title}
        </h2>

        <p className="mt-3 text-gray-600">
          {isDragging
            ? "Release the files to add them."
            : description}
        </p>

        <div className="mt-4 text-sm font-medium text-gray-500">
          or
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"
        >
          <FilePlus2 size={20} />
          {buttonText}
        </button>

        <p className="mt-4 text-sm text-gray-500">{helperText}</p>
      </div>
    </>
  );
}