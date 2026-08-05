"use client";

import {
  ImagePlus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  MouseEvent,
  RefObject,
  useState,
} from "react";
import { toast } from "sonner";

type ImageWatermarkUploaderProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  imageFile: File | null;
  imagePreview: string | null;
  onImageSelected: (
    file: File,
    preview: string,
  ) => void;
  onRemove: () => void;
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function isValidImage(file: File) {
  const fileName = file.name.toLowerCase();

  return (
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg")
  );
}

export default function ImageWatermarkUploader({
  fileInputRef,
  imageFile,
  imagePreview,
  onImageSelected,
  onRemove,
}: ImageWatermarkUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  function processImage(selectedFile: File) {
    if (!isValidImage(selectedFile)) {
      toast.error("Please select a PNG, JPG, or JPEG image.");
      return;
    }

    if (selectedFile.size > MAX_IMAGE_SIZE) {
      toast.error(
        "The watermark image must not be larger than 10 MB.",
      );
      return;
    }

    const preview = URL.createObjectURL(selectedFile);

    onImageSelected(selectedFile, preview);

    toast.success("Image watermark selected.");
  }

  function handleImageSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    event.stopPropagation();

    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      processImage(selectedFile);
    }

    event.target.value = "";
  }

  function openImagePicker(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    fileInputRef.current?.click();
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDragLeave(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    setIsDragging(false);

    const selectedFile =
      event.dataTransfer.files?.[0];

    if (selectedFile) {
      processImage(selectedFile);
    }
  }

  function handleRemove(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    onRemove();
  }

  return (
    <section
      onClick={(event) => event.stopPropagation()}
      className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950"
    >
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
        Image watermark
      </h3>

      <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
        Upload a PNG, JPG, or JPEG logo, stamp, or signature.
      </p>

      <input
        ref={fileInputRef}
        id="watermark-image-input"
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        className="hidden"
        onClick={(event) => event.stopPropagation()}
        onChange={handleImageSelection}
      />

      {!imageFile ? (
        <div
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-5 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${
            isDragging
              ? "border-blue-600 bg-blue-100 dark:bg-blue-950/50"
              : "border-blue-300 bg-white hover:border-blue-500 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          }`}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
            <ImagePlus size={24} />
          </div>

          <p className="mt-4 font-bold text-gray-900 dark:text-white">
            {isDragging
              ? "Drop the image here"
              : "Choose an image watermark"}
          </p>

          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            Drag and drop an image or browse your computer.
          </p>

          <button
            type="button"
            onClick={openImagePicker}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            <ImagePlus size={19} />
            Choose Image
          </button>

          <p className="mt-4 text-xs text-gray-400">
            PNG, JPG or JPEG · Maximum size: 10 MB
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <img
              src={imagePreview ?? ""}
              alt="Image watermark preview"
              className="mx-auto max-h-48 max-w-full object-contain"
            />
          </div>

          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-all font-semibold text-gray-900 dark:text-white">
                {imageFile.name}
              </p>

              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                {(imageFile.size / 1024).toFixed(1)} KB
              </p>
            </div>

            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
            >
              <Trash2 size={18} />
              Remove
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <ShieldCheck size={17} />
            Image watermark ready
          </div>
        </div>
      )}
    </section>
  );
}