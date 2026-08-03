"use client";

import Navbar from "@/components/Navbar";
import ActionButton from "@/components/pdf/ActionButton";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import PasswordInput from "@/components/pdf/PasswordInput";
import ToolContainer from "@/components/pdf/ToolContainer";
import ToolHeader from "@/components/pdf/ToolHeader";
import { downloadFile } from "@/lib/downloadFile";
import { unlockPdf } from "@/lib/pdf/qpdf";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

export default function UnlockPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
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

    if (!password.trim()) {
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

          <ToolContainer>
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
                <FileCard
                  file={file}
                  onRemove={removeFile}
                  removeLabel="Remove protected PDF"
                />

                <PasswordInput
                  id="pdf-password"
                  label="PDF password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Enter the password"
                />

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
          </ToolContainer>
        </div>
      </main>
    </>
  );
}