"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { ChangeEvent, RefObject } from "react";
import { toast } from "sonner";

type ImageWatermarkUploaderProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  imageFile: File | null;
  imagePreview: string | null;
  onImageSelected: (file: File, preview: string) => void;
  onRemove: () => void;
};

export default function ImageWatermarkUploader({
  fileInputRef,
  imageFile,
  imagePreview,
  onImageSelected,
  onRemove,
}: ImageWatermarkUploaderProps) {
  function handleImageSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (
      !selectedFile.type.startsWith("image/")
    ) {
      toast.error("Please select a PNG or JPG image.");
      event.target.value = "";
      return;
    }

    const preview = URL.createObjectURL(selectedFile);

    onImageSelected(selectedFile, preview);

    toast.success("Image watermark selected.");

    event.target.value = "";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <h3 className="text-lg font-bold text-gray-900">
        Image Watermark
      </h3>

      <p className="mt-2 text-sm text-gray-500">
        Upload a PNG or JPG logo to use as a watermark.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        hidden
        onChange={handleImageSelection}
      />

      {!imageFile ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-300 bg-white px-5 py-6 font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          <ImagePlus size={22} />
          Choose Image
        </button>
      ) : (
        <div className="mt-5">
          <div className="overflow-hidden rounded-xl border bg-white">
            <img
              src={imagePreview ?? ""}
              alt="Watermark Preview"
              className="mx-auto max-h-48 object-contain"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {imageFile.name}
              </p>

              <p className="text-sm text-gray-500">
                {(imageFile.size / 1024).toFixed(1)} KB
              </p>
            </div>

            <button
              type="button"
              onClick={onRemove}
              className="rounded-xl border border-red-200 px-4 py-2 text-red-600 transition hover:bg-red-50"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}