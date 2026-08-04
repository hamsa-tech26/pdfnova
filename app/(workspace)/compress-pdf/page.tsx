"use client";

import Navbar from "@/components/Navbar";
import ActionButton from "@/components/pdf/ActionButton";
import FileUploader from "@/components/pdf/FileUploader";
import ToolHeader from "@/components/pdf/ToolHeader";
import {
  compressPdf,
  type CompressionLevel,
} from "@/lib/pdf/compress";
import { addRecentFile } from "@/lib/storage/recentFiles";
import {
  FileText,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

type CompressionResult = {
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] =
    useState<CompressionLevel>("medium");
  const [isCompressing, setIsCompressing] = useState(false);
  const [result, setResult] = useState<CompressionResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile || selectedFile.type !== "application/pdf") {
      toast.error("Please select a valid PDF file.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      toast.error("The PDF file must not be larger than 25 MB.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setCompressionLevel("medium");
    setResult(null);
    event.target.value = "";

    toast.success("PDF file added successfully.");
  }

  function removeFile() {
    setFile(null);
    setResult(null);
    setCompressionLevel("medium");

    toast.success("PDF file removed.");
  }

  async function handleCompressPdf() {
    if (!file) {
      toast.error("Please select a PDF file.");
      return;
    }

    setIsCompressing(true);
    setResult(null);

    try {
      const compressedResult = await compressPdf(
        file,
        compressionLevel,
      );

      const compressedBuffer = new ArrayBuffer(
        compressedResult.bytes.byteLength,
      );

      new Uint8Array(compressedBuffer).set(
        compressedResult.bytes,
      );

      const blob = new Blob([compressedBuffer], {
        type: "application/pdf",
      });

      const outputFileName = "pdfnova-compressed.pdf";
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = outputFileName;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);

      setResult({
        originalSize: compressedResult.originalSize,
        compressedSize: compressedResult.compressedSize,
        reductionPercent: compressedResult.reductionPercent,
      });

      addRecentFile({
        fileName: outputFileName,
        toolName: "Compress PDF",
      });

      if (
        compressedResult.compressedSize <
        compressedResult.originalSize
      ) {
        toast.success("PDF processed successfully!");
      } else {
        toast.success("PDF processing completed.");
      }

      toast("Download started", {
        description:
          "Your processed PDF is being downloaded.",
      });
    } catch (compressionError) {
      console.error(compressionError);

      toast.error(
        "The PDF could not be processed. It may be damaged or password-protected.",
      );
    } finally {
      setIsCompressing(false);
    }
  }

  const compressionOptions: {
    value: CompressionLevel;
    title: string;
    description: string;
  }[] = [
    {
      value: "low",
      title: "Low",
      description: "Better compatibility",
    },
    {
      value: "medium",
      title: "Medium",
      description: "Recommended",
    },
    {
      value: "high",
      title: "High",
      description: "Maximum optimization",
    },
  ];

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <ToolHeader
            label="Compress PDF"
            title="Reduce the size of your PDF"
            description="Select a PDF file and choose an optimization level to create a smaller document whenever possible."
          />

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-10">
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              multiple={false}
              title="Select one PDF file"
              description="Choose the PDF document you want to optimize."
              buttonText="Choose PDF File"
              helperText="Maximum file size: 25 MB"
            />

            {file && (
              <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <FileText size={21} />
                    </div>

                    <div className="min-w-0">
                      <p className="break-words font-semibold text-gray-900">
                        {file.name}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        Original size: {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={removeFile}
                    className="shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-semibold text-gray-900">
                    Optimization level
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {compressionOptions.map((option) => {
                      const isSelected =
                        compressionLevel === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setCompressionLevel(option.value);
                            setResult(null);
                          }}
                          className={`rounded-2xl p-4 text-left transition ${
                            isSelected
                              ? "border-2 border-blue-600 bg-blue-50"
                              : "border border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50"
                          }`}
                        >
                          <p
                            className={`font-bold ${
                              isSelected
                                ? "text-blue-700"
                                : "text-gray-900"
                            }`}
                          >
                            {option.title}
                          </p>

                          <p
                            className={`mt-1 text-sm ${
                              isSelected
                                ? "text-blue-600"
                                : "text-gray-500"
                            }`}
                          >
                            {option.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ActionButton
                  isLoading={isCompressing}
                  loadingText="Processing PDF..."
                  buttonText="Compress and Download PDF"
                  onClick={handleCompressPdf}
                />

                {result && (
                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <TrendingDown size={20} />

                      <p className="font-bold">
                        Processing result
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-sm text-emerald-700">
                          Original size
                        </p>

                        <p className="mt-1 font-bold text-gray-900">
                          {formatFileSize(result.originalSize)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-emerald-700">
                          Resulting size
                        </p>

                        <p className="mt-1 font-bold text-gray-900">
                          {formatFileSize(result.compressedSize)}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-emerald-700">
                          Size reduction
                        </p>

                        <p className="mt-1 font-bold text-gray-900">
                          {result.reductionPercent}%
                        </p>
                      </div>
                    </div>

                    {result.compressedSize >= result.originalSize && (
                      <p className="mt-4 text-sm leading-6 text-amber-700">
                        This PDF was already well optimized, so its
                        file size could not be reduced further.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500">
              <ShieldCheck
                size={18}
                className="shrink-0 text-emerald-600"
              />
              Your PDF is processed inside your browser and is not
              uploaded.
            </div>
          </section>
        </div>
      </main>
    </>
  );
}