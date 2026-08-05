"use client";

import ActionButton from "@/components/pdf/ActionButton";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import PasswordInput from "@/components/pdf/PasswordInput";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import { unlockPdf } from "@/lib/pdf/qpdf";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const unlockPdfTips = [
  {
    title: "Use the correct password",
    description:
      "The PDF cannot be unlocked unless the password entered matches the document password.",
  },
  {
    title: "Use a valid protected PDF",
    description:
      "Damaged files or documents using unsupported encryption may not be processed.",
  },
  {
    title: "Keep the original file",
    description:
      "PDFNova creates a separate unlocked copy and does not modify your original document.",
  },
];

const unlockPdfFaqs = [
  {
    question: "Does PDFNova store my PDF password?",
    answer:
      "No. The password is used only inside your browser while processing the selected PDF.",
  },
  {
    question: "Why does unlocking fail with the correct password?",
    answer:
      "The PDF may be damaged, use unsupported encryption, or contain restrictions that the current browser engine cannot process.",
  },
  {
    question: "Can I unlock any PDF?",
    answer:
      "Only unlock documents you own or are authorized to modify.",
  },
];

export default function UnlockPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0];

    if (
      !selectedFile ||
      (selectedFile.type !== "application/pdf" &&
        !selectedFile.name.toLowerCase().endsWith(".pdf"))
    ) {
      toast.error("Please select a valid PDF file.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
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
      const originalName = file.name.replace(/\.pdf$/i, "");
      const outputFileName = `${originalName || "pdfnova"}-unlocked.pdf`;

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
        "The PDF could not be unlocked. Check the password and make sure the file is a valid password-protected PDF.",
      );
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <ToolLayout
      label="Unlock PDF"
      title="Remove password protection from a PDF"
      description="Upload a protected PDF, enter the correct password, and download an unlocked copy directly from your private PDFNova workspace."
      tips={unlockPdfTips}
      faqs={unlockPdfFaqs}
      maxWidthClassName="max-w-6xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one protected PDF"
        description="Choose or drag the password-protected PDF you want to unlock."
        buttonText="Choose Protected PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={removeFile}
            removeLabel="Remove protected PDF"
            statusText="Ready for password removal"
          />

          <PasswordInput
            id="pdf-password"
            label="PDF password"
            value={password}
            onChange={setPassword}
            placeholder="Enter the PDF password"
          />

          <ActionButton
            isLoading={isUnlocking}
            loadingText="Unlocking PDF..."
            loadingSubtitle="Removing password protection and preparing your file."
            buttonText="Unlock and Download PDF"
            subtitle="Create an unlocked copy directly inside your browser."
            onClick={handleUnlockPdf}
          />
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Only unlock PDFs you own or are authorized to modify.
      </div>
    </ToolLayout>
  );
}