"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import PasswordInput from "@/components/pdf/PasswordInput";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import { protectPdf } from "@/lib/pdf/qpdf";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const protectPdfTips = [
  {
    title: "Use a strong password",
    description:
      "Use at least 8 characters and combine words, numbers, or symbols that are difficult to guess.",
  },
  {
    title: "Keep your password safe",
    description:
      "Kukureku does not store your password and cannot recover it later.",
  },
  {
    title: "Keep the original file",
    description:
      "Password protection creates a separate encrypted copy and leaves your original PDF unchanged.",
  },
];

const protectPdfFaqs = [
  {
    question: "What kind of protection is applied?",
    answer:
      "Kukureku uses the browser-based QPDF engine to create an AES-256 encrypted PDF that requires your chosen password to open.",
  },
  {
    question: "Will my PDF or password be uploaded?",
    answer:
      "No. The PDF and password are processed locally inside your browser.",
  },
  {
    question: "Can Kukureku recover a forgotten password?",
    answer:
      "No. Keep your password somewhere safe and retain the original unprotected PDF.",
  },
];

export default function ProtectPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isProtecting, setIsProtecting] = useState(false);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  function resetAll() {
    setFile(null);
    setPassword("");
    setConfirmPassword("");
    resetResult();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (
      !selectedFile ||
      (selectedFile.type !== "application/pdf" &&
        !selectedFile.name.toLowerCase().endsWith(".pdf"))
    ) {
      const message = "Please select a valid PDF file.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      const message = "The PDF file must not be larger than 25 MB.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setFile(selectedFile);
    setPassword("");
    setConfirmPassword("");
    resetResult();
    toast.success("PDF selected.");
  }

  async function handleProtectPdf() {
    if (!file) {
      setErrorMessage("Please select a PDF file.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Use a password with at least 8 characters.");
      return;
    }

    if (password.length > 64) {
      setErrorMessage("Please keep the password to 64 characters or fewer.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The two passwords do not match.");
      return;
    }

    setIsProtecting(true);
    setErrorMessage("");
    setOutputBytes(null);
    setOutputFileName("");

    try {
      const protectedBytes = await protectPdf(file, password);
      const originalName = file.name.replace(/\.pdf$/i, "");
      const generatedFileName = `${originalName || "kukureku"}-protected.pdf`;

      downloadFile(
        protectedBytes,
        generatedFileName,
        "application/pdf",
      );

      setOutputBytes(protectedBytes);
      setOutputFileName(generatedFileName);

      addRecentFile({
        fileName: generatedFileName,
        toolName: "Protect PDF",
      });

      toast.success("PDF protected successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "The PDF could not be protected. The file may already be encrypted, damaged, or unsupported.",
      );
    } finally {
      setIsProtecting(false);
    }
  }

  return (
    <ToolLayout
      label="Protect PDF"
      title="Password protect PDF privately"
      description="Add AES-256 opening-password protection to a PDF locally in your browser. Your file and password are not uploaded."
      tips={protectPdfTips}
      faqs={protectPdfFaqs}
      howToTitle="How to password protect a PDF"
      howToSteps={[
        {
          title: "Choose one PDF",
          description: "Select an unprotected PDF up to 25 MB.",
        },
        {
          title: "Create a password",
          description: "Enter and confirm a strong password with at least 8 characters.",
        },
        {
          title: "Protect and download",
          description: "Encrypt the PDF locally and save the protected copy to your device.",
        },
      ]}
      maxWidthClassName="max-w-6xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag the PDF you want to password protect."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isProtecting}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={isProtecting ? undefined : resetAll}
            removeLabel="Remove PDF"
            statusText={
              isProtecting
                ? "Encrypting PDF locally"
                : outputBytes
                  ? "Protected PDF created successfully"
                  : "Ready for password protection"
            }
          />

          {!outputBytes && (
            <div className="grid gap-5 md:grid-cols-2">
              <PasswordInput
                id="protect-password"
                label="PDF password"
                value={password}
                onChange={(value) => {
                  setPassword(value);
                  resetResult();
                }}
                placeholder="Create a strong password"
              />

              <PasswordInput
                id="protect-password-confirm"
                label="Confirm password"
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  resetResult();
                }}
                placeholder="Enter the same password again"
              />
            </div>
          )}

          {!outputBytes && !errorMessage && (
            <ActionButton
              isLoading={isProtecting}
              loadingText="Protecting PDF..."
              loadingSubtitle="Encrypting your document locally with AES-256."
              buttonText="Protect and Download PDF"
              subtitle="Your file and password stay inside your browser."
              onClick={handleProtectPdf}
              disabled={isProtecting}
            />
          )}

          {!isProtecting && outputBytes && (
            <SuccessCard
              title="Your protected PDF is ready"
              description="AES-256 password protection was applied and the encrypted copy was created."
              fileName={outputFileName}
              onDownloadAgain={() =>
                downloadFile(
                  outputBytes,
                  outputFileName,
                  "application/pdf",
                )
              }
              onStartAgain={resetAll}
              downloadLabel="Download Protected PDF Again"
              resetLabel="Protect Another PDF"
            />
          )}

          {!isProtecting && errorMessage && (
            <ErrorCard
              title="PDF protection needs attention"
              description={errorMessage}
              reasons={[
                "The password may not meet the current requirements.",
                "The source PDF may already be encrypted.",
                "The PDF may be damaged or unsupported.",
              ]}
              onRetry={file ? handleProtectPdf : undefined}
              onReset={resetAll}
              retryLabel="Retry Protection"
              resetLabel="Choose Another PDF"
            />
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck size={18} className="shrink-0 text-emerald-600" />
        AES-256 protection runs locally in your browser. Kukureku does not store your password.
      </div>
    </ToolLayout>
  );
}
