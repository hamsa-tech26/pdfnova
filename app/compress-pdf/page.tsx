"use client";

import Navbar from "@/components/Navbar";
import FileUploader from "@/components/pdf/FileUploader";
import ToolHeader from "@/components/pdf/ToolHeader";
import { FileText, ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

export default function CompressPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile || selectedFile.type !== "application/pdf") {
      toast.error("Please select a valid PDF file.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    event.target.value = "";

    toast.success("PDF file added successfully.");
  }

  function removeFile() {
    setFile(null);
    toast.success("PDF file removed.");
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <ToolHeader
            label="Compress PDF"
            title="Reduce the size of your PDF"
            description="Select a PDF file and choose a compression level to create a smaller document."
          />

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-10">
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              multiple={false}
              title="Select one PDF file"
              description="Choose the PDF document you want to compress."
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
                        {(file.size / 1024 / 1024).toFixed(2)} MB
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
                    Compression level
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      className="rounded-2xl border border-gray-300 bg-white p-4 text-left transition hover:border-blue-400 hover:bg-blue-50"
                    >
                      <p className="font-bold text-gray-900">Low</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Better quality
                      </p>
                    </button>

                    <button
                      type="button"
                      className="rounded-2xl border-2 border-blue-600 bg-blue-50 p-4 text-left"
                    >
                      <p className="font-bold text-blue-700">Medium</p>
                      <p className="mt-1 text-sm text-blue-600">
                        Recommended
                      </p>
                    </button>

                    <button
                      type="button"
                      className="rounded-2xl border border-gray-300 bg-white p-4 text-left transition hover:border-blue-400 hover:bg-blue-50"
                    >
                      <p className="font-bold text-gray-900">High</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Smaller file
                      </p>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-8 w-full rounded-xl bg-gray-950 px-6 py-4 font-semibold text-white transition hover:bg-blue-600"
                >
                  Compress PDF
                </button>
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
              <ShieldCheck size={18} className="text-emerald-600" />
              Your PDF will be processed securely inside your browser.
            </div>
          </section>
        </div>
      </main>
    </>
  );
}