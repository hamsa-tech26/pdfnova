"use client";

import Navbar from "@/components/Navbar";
import ActionButton from "@/components/pdf/ActionButton";
import FileUploader from "@/components/pdf/FileUploader";
import ToolHeader from "@/components/pdf/ToolHeader";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { downloadFile } from "@/lib/downloadFile";
import {
  ArrowDown,
  ArrowUp,
  FileImage,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";

type PageSize = "a4" | "fit";

export default function JpgToPdfPage() {
  const [images, setImages] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedImages = Array.from(event.target.files ?? []).filter(
      (file) =>
        file.type === "image/jpeg" ||
        file.type === "image/png",
    );

    if (selectedImages.length === 0) {
      toast.error("Please select JPG or PNG image files.");
      event.target.value = "";
      return;
    }

    setImages((currentImages) => [
      ...currentImages,
      ...selectedImages,
    ]);

    toast.success(
      `${selectedImages.length} ${
        selectedImages.length === 1 ? "image" : "images"
      } added successfully.`,
    );

    event.target.value = "";
  }

  function removeImage(indexToRemove: number) {
    const removedImageName = images[indexToRemove]?.name;

    setImages((currentImages) =>
      currentImages.filter((_, index) => index !== indexToRemove),
    );

    if (removedImageName) {
      toast.success(`${removedImageName} removed.`);
    }
  }

  function moveImageUp(index: number) {
    if (index === 0) return;

    setImages((currentImages) => {
      const updatedImages = [...currentImages];

      [updatedImages[index - 1], updatedImages[index]] = [
        updatedImages[index],
        updatedImages[index - 1],
      ];

      return updatedImages;
    });
  }

  function moveImageDown(index: number) {
    setImages((currentImages) => {
      if (index === currentImages.length - 1) {
        return currentImages;
      }

      const updatedImages = [...currentImages];

      [updatedImages[index], updatedImages[index + 1]] = [
        updatedImages[index + 1],
        updatedImages[index],
      ];

      return updatedImages;
    });
  }

  async function createPdfFromImages() {
    if (images.length === 0) {
      toast.error("Please select at least one image.");
      return;
    }

    setIsCreating(true);

    try {
      const pdf = await PDFDocument.create();

      for (const imageFile of images) {
        const imageBytes = await imageFile.arrayBuffer();

        const embeddedImage =
          imageFile.type === "image/png"
            ? await pdf.embedPng(imageBytes)
            : await pdf.embedJpg(imageBytes);

        const imageWidth = embeddedImage.width;
        const imageHeight = embeddedImage.height;

        let pageWidth = imageWidth;
        let pageHeight = imageHeight;
        let drawWidth = imageWidth;
        let drawHeight = imageHeight;
        let x = 0;
        let y = 0;

        if (pageSize === "a4") {
          pageWidth = 595.28;
          pageHeight = 841.89;

          const margin = 32;
          const availableWidth = pageWidth - margin * 2;
          const availableHeight = pageHeight - margin * 2;

          const scale = Math.min(
            availableWidth / imageWidth,
            availableHeight / imageHeight,
            1,
          );

          drawWidth = imageWidth * scale;
          drawHeight = imageHeight * scale;
          x = (pageWidth - drawWidth) / 2;
          y = (pageHeight - drawHeight) / 2;
        }

        const page = pdf.addPage([pageWidth, pageHeight]);

        page.drawImage(embeddedImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });
      }

      const pdfBytes = await pdf.save();
      const outputFileName = "pdfnova-images.pdf";

      downloadFile(pdfBytes, outputFileName, "application/pdf");

      addRecentFile({
        fileName: outputFileName,
        toolName: "JPG to PDF",
      });

      toast.success("PDF created successfully!");

      toast("Download started", {
        description: "Your image PDF is being downloaded.",
      });
    } catch (creationError) {
      console.error(creationError);

      toast.error(
        "The PDF could not be created. One of the images may be damaged.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <ToolHeader
            label="JPG to PDF"
            title="Turn images into one PDF document"
            description="Upload JPG or PNG images, arrange their order, and download them as a single PDF."
          />

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-10">
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              accept="image/jpeg,image/png"
              multiple
              title="Select image files"
              description="Choose JPG or PNG images from your computer."
              buttonText="Choose Images"
              helperText="Supported formats: JPG and PNG"
            />

            {images.length > 0 && (
              <div className="mt-8">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Selected images ({images.length})
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Arrange the images in the order they should appear.
                  </p>
                </div>

                <div className="mt-4 space-y-4">
                  {images.map((image, index) => (
                    <div
                      key={`${image.name}-${image.lastModified}-${index}`}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                          <FileImage size={21} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="break-words font-semibold text-gray-900">
                            {index + 1}. {image.name}
                          </p>

                          <p className="mt-1 text-sm text-gray-500">
                            {(image.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                        <button
                          type="button"
                          onClick={() => moveImageUp(index)}
                          disabled={index === 0}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowUp size={17} />
                          Move Up
                        </button>

                        <button
                          type="button"
                          onClick={() => moveImageDown(index)}
                          disabled={index === images.length - 1}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowDown size={17} />
                          Move Down
                        </button>

                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={17} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <p className="text-sm font-semibold text-gray-900">
                    Page size
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPageSize("a4")}
                      className={`rounded-2xl p-4 text-left transition ${
                        pageSize === "a4"
                          ? "border-2 border-blue-600 bg-blue-50"
                          : "border border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      <p className="font-bold text-gray-900">A4 pages</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Fit every image neatly on an A4 page.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPageSize("fit")}
                      className={`rounded-2xl p-4 text-left transition ${
                        pageSize === "fit"
                          ? "border-2 border-blue-600 bg-blue-50"
                          : "border border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      <p className="font-bold text-gray-900">
                        Fit to image
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Use each image's original dimensions.
                      </p>
                    </button>
                  </div>
                </div>

                <ActionButton
                  isLoading={isCreating}
                  loadingText="Creating PDF..."
                  buttonText="Create and Download PDF"
                  onClick={createPdfFromImages}
                />
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500">
              <ShieldCheck
                size={18}
                className="shrink-0 text-emerald-600"
              />
              Your images are processed inside your browser and are not
              uploaded.
            </div>
          </section>
        </div>
      </main>
    </>
  );
}