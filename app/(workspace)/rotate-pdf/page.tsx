"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import {
  loadPdfWithoutMetadataMutation,
  savePdfWithoutFormAppearanceMutation,
} from "@/lib/pdf/safeDocument";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { RotateCcw, RotateCw, ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { degrees, PDFDocument } from "pdf-lib";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
type Rotation = 90 | 180 | 270;

const tips = [
  { title: "Rotate every page at once", description: "Choose clockwise, 180 degrees, or counter-clockwise and Kukureku applies it to the whole document." },
  { title: "Your original stays unchanged", description: "Kukureku creates a separate rotated copy instead of modifying the source file." },
  { title: "Private browser processing", description: "The PDF is processed locally on your device and is not uploaded." },
];

const faqs = [
  { question: "Can I rotate a PDF permanently?", answer: "Yes. Kukureku writes the selected rotation into a new PDF so the orientation is preserved when you reopen it." },
  { question: "Can I rotate individual pages?", answer: "Use Organize PDF when you need different rotations for individual pages. Rotate PDF is optimized for rotating the entire document quickly." },
  { question: "Is my PDF uploaded?", answer: "No. Rotation happens locally inside your browser." },
];

export default function RotatePdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState<Rotation>(90);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile || (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf"))) {
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

    try {
      const pdf = await loadPdfWithoutMetadataMutation(await selectedFile.arrayBuffer());
      if (pdf.getPageCount() === 0) throw new Error("The PDF does not contain any pages.");
      setFile(selectedFile);
      resetResult();
      toast.success(`${pdf.getPageCount()} ${pdf.getPageCount() === 1 ? "page" : "pages"} ready to rotate.`);
    } catch {
      const message = "Unable to open this PDF. It may be damaged or password-protected.";
      setFile(null);
      setErrorMessage(message);
      toast.error(message);
    }
  }

  function startAgain() {
    setFile(null);
    setRotation(90);
    resetResult();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function rotatePdf() {
    if (!file) return;
    setIsProcessing(true);
    setErrorMessage("");
    try {
      const pdf = await loadPdfWithoutMetadataMutation(await file.arrayBuffer());
      for (const page of pdf.getPages()) {
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + rotation) % 360));
      }
      const bytes = await savePdfWithoutFormAppearanceMutation(pdf);
      const baseName = file.name.replace(/\.pdf$/i, "") || "kukureku";
      const name = `${baseName}-rotated.pdf`;
      downloadFile(bytes, name, "application/pdf");
      setOutputBytes(bytes);
      setOutputFileName(name);
      addRecentFile({ fileName: name, toolName: "Rotate PDF" });
      toast.success("PDF rotated successfully.");
    } catch {
      const message = "The PDF could not be rotated. It may be damaged or password-protected.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }

  function downloadAgain() {
    if (!outputBytes || !outputFileName) return;
    downloadFile(outputBytes, outputFileName, "application/pdf");
  }

  return (
    <ToolLayout
      label="Rotate PDF"
      title="Rotate PDF pages online, privately"
      description="Rotate every page in a PDF clockwise, counter-clockwise, or 180 degrees directly in your browser. Your file stays on your device."
      tips={tips}
      faqs={faqs}
      howToTitle="How to rotate a PDF"
      howToSteps={[
        { title: "Choose one PDF", description: "Select a PDF from your device, up to 25 MB." },
        { title: "Choose the rotation", description: "Rotate all pages 90 degrees clockwise, 180 degrees, or 90 degrees counter-clockwise." },
        { title: "Rotate and download", description: "Create and download the rotated copy locally in your browser." },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag the PDF you want to rotate."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={isProcessing ? undefined : startAgain}
            removeLabel="Remove PDF file"
            statusText={isProcessing ? "Rotating PDF pages" : outputBytes ? "Rotated PDF created successfully" : "Ready to rotate"}
          />

          {!outputBytes && (
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-gray-950 dark:text-white">Choose rotation</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">The selected rotation will be applied to every page.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {([
                  [90, "90° clockwise", RotateCw],
                  [180, "180°", RotateCw],
                  [270, "90° counter-clockwise", RotateCcw],
                ] as const).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRotation(value)}
                    disabled={isProcessing}
                    className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${rotation === value ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300" : "border-gray-200 text-gray-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200"}`}
                  >
                    <Icon size={19} />{label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!outputBytes && !errorMessage && (
            <ActionButton
              isLoading={isProcessing}
              loadingText="Rotating PDF..."
              loadingSubtitle="Applying the selected orientation to every page."
              buttonText="Rotate and Download PDF"
              subtitle="Creates a new PDF; your original file stays unchanged."
              onClick={rotatePdf}
              disabled={isProcessing}
            />
          )}

          {!isProcessing && outputBytes && (
            <SuccessCard
              title="Your rotated PDF is ready"
              description="The selected rotation was applied successfully and the new PDF was downloaded."
              fileName={outputFileName}
              onDownloadAgain={downloadAgain}
              onStartAgain={startAgain}
              downloadLabel="Download PDF Again"
              resetLabel="Rotate Another PDF"
            />
          )}

          {!isProcessing && errorMessage && (
            <ErrorCard
              title="PDF rotation failed"
              description={errorMessage}
              reasons={["The PDF may be damaged.", "The PDF may be password-protected.", "Your browser may not have enough memory for this document."]}
              onRetry={rotatePdf}
              onReset={startAgain}
              retryLabel="Retry Rotation"
              resetLabel="Choose Another PDF"
            />
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck size={18} className="shrink-0 text-emerald-600" />
        Your PDF is rotated locally inside your browser and is not uploaded.
      </div>
    </ToolLayout>
  );
}
