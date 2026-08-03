"use client";

import Navbar from "@/components/Navbar";
import ActionButton from "@/components/pdf/ActionButton";
import FileUploader from "@/components/pdf/FileUploader";
import ToolHeader from "@/components/pdf/ToolHeader";
import { downloadFile } from "@/lib/downloadFile";
import { unlockPdf } from "@/lib/pdf/qpdf";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { Eye, EyeOff, FileText, ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

export default function UnlockPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
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
    setPassword("");
    event.target.value = "";

    toast.success("Protected PDF selected.");
  }

  function removeFile() {
    setFile(null);
    setPassword("");
    toast.success("PDF file removed.");
  }

  async function handleUnlockPdf() {
    if (!file) {
      toast.error("Please select a PDF file.");
      return;
    }

    if (!password) {
      toast.error("Please enter the PDF password.");
      return;
    }

    setIsUnlocking(true);

    try {
      const unlockedBytes = await unlockPdf(file, password);
      const outputFileName = "pdfnova-unlocked.pdf";

      downloadFile(
        unlockedBytes,
        outputFileName,
        "application/pdf",
      );

      addRecentFile({
        fileName: outputFileName,
        toolName: "Unlock PDF",
      });

      toast.success("PDF unlocked successfully!");

      toast("Download started", {
        description: "Your unlocked PDF is being downloaded.",
      });
    } catch (error) {
      console.error(error);

      toast.error(
        "The PDF could not be unlocked. Check the password and make sure the file is password-protected.",
      );
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <ToolHeader
            label="Unlock PDF"
            title="Remove password protection from a PDF"
            description="Upload a password-protected PDF, enter the correct password, and download an unlocked copy."
          />

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-10">
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              multiple={false}
              title="Select one protected PDF"
              description="Choose the password-protected PDF you want to unlock."
              buttonText="Choose PDF"
              helperText="Maximum file size: 25 MB"
            />

            {file && (
              <div className="mt-8 space-y-6">
                <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
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

                <div>
                  <label
                    htmlFor="pdf-password"
                    className="text-sm font-semibold text-gray-900"
                  >
                    PDF password
                  </label>

                  <div className="relative mt-2">
                    <input
                      id="pdf-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      placeholder="Enter the password"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  </div>
                </div>

                <ActionButton
                  isLoading={isUnlocking}
                  loadingText="Unlocking PDF..."
                  buttonText="Unlock and Download PDF"
                  onClick={handleUnlockPdf}
                />
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500">
              <ShieldCheck
                size={18}
                className="shrink-0 text-emerald-600"
              />
              Only unlock PDFs you own or are authorized to modify.
            </div>
          </section>
        </div>
      </main>
    </>
  );
}