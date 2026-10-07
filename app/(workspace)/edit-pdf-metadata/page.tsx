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
import {
  applyPdfMetadata,
  readPdfMetadata,
  type PdfMetadataValues,
} from "@/lib/pdf/metadataEditor";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { saveDerivedPdfToWorkspace } from "@/lib/storage/workspaceContinuity";
import { FilePenLine, ShieldCheck, TriangleAlert } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const EMPTY_METADATA: PdfMetadataValues = {
  title: "",
  author: "",
  subject: "",
  keywords: "",
  creator: "",
  producer: "",
};

const tips = [
  { title: "Review existing values first", description: "Kukureku reads the common PDF document information fields before you edit them." },
  { title: "Clear a field by leaving it blank", description: "Blank values are saved as empty common metadata fields in the new PDF copy." },
  { title: "Scope is intentionally clear", description: "This tool edits common document metadata. It is not a complete forensic sanitizer for every possible hidden object or XMP packet." },
];

const faqs = [
  { question: "Which metadata can I edit?", answer: "Title, author, subject, keywords, creator, and producer from the common PDF document information dictionary." },
  { question: "Does this remove every hidden trace?", answer: "No. Use Remove PDF Metadata for simple cleanup, and do not treat either tool as a forensic sanitizer for every possible embedded object or metadata format." },
  { question: "Is my PDF uploaded?", answer: "No. Metadata reading and writing happen locally in your browser." },
];

const fields: Array<{ key: keyof PdfMetadataValues; label: string; placeholder: string }> = [
  { key: "title", label: "Title", placeholder: "Document title" },
  { key: "author", label: "Author", placeholder: "Author or organization" },
  { key: "subject", label: "Subject", placeholder: "Document subject" },
  { key: "keywords", label: "Keywords", placeholder: "Comma-separated keywords" },
  { key: "creator", label: "Creator", placeholder: "Creating application or person" },
  { key: "producer", label: "Producer", placeholder: "PDF producer" },
];

export default function EditPdfMetadataPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<PdfMetadataValues>(EMPTY_METADATA);
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
      setErrorMessage("Please select a valid PDF file.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage("The PDF file must not be larger than 25 MB.");
      return;
    }
    try {
      const pdf = await loadPdfWithoutMetadataMutation(await selectedFile.arrayBuffer());
      setFile(selectedFile);
      setMetadata(readPdfMetadata(pdf));
      resetResult();
      toast.success("PDF metadata loaded.");
    } catch {
      setFile(null);
      setMetadata(EMPTY_METADATA);
      setErrorMessage("Unable to open this PDF. It may be damaged or password-protected.");
    }
  }

  function updateField(key: keyof PdfMetadataValues, value: string) {
    setMetadata((current) => ({ ...current, [key]: value }));
    resetResult();
  }

  function startAgain() {
    setFile(null);
    setMetadata(EMPTY_METADATA);
    resetResult();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function saveMetadata() {
    if (!file) return;
    setIsProcessing(true);
    setErrorMessage("");
    try {
      const pdf = await loadPdfWithoutMetadataMutation(await file.arrayBuffer());
      applyPdfMetadata(pdf, metadata);
      const bytes = await savePdfWithoutFormAppearanceMutation(pdf);
      const baseName = file.name.replace(/\.pdf$/i, "") || "kukureku";
      const generatedFileName = baseName + "-metadata-edited.pdf";
      downloadFile(bytes, generatedFileName, "application/pdf");
      setOutputBytes(bytes);
      setOutputFileName(generatedFileName);
      addRecentFile({ fileName: generatedFileName, toolName: "Edit PDF Metadata" });

      await saveDerivedPdfToWorkspace({
        sourceFile: file,
        outputBytes: bytes,
        outputFileName: generatedFileName,
        operationId: "edit-pdf-metadata",
        operationLabel: "Edit PDF Metadata",
      });
      toast.success("PDF metadata updated successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "The PDF metadata could not be updated.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ToolLayout
      label="Edit PDF Metadata"
      title="Edit PDF metadata privately"
      description="Inspect and update common PDF title, author, subject, keywords, creator, and producer fields directly in your browser."
      tips={tips}
      faqs={faqs}
      howToTitle="How to edit PDF metadata"
      howToSteps={[
        { title: "Choose one PDF", description: "Select the document whose metadata you want to review." },
        { title: "Edit the fields", description: "Update or clear the common document information values." },
        { title: "Save the new copy", description: "Download a separate PDF with the updated common metadata." },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag the PDF whose metadata you want to edit."
        buttonText="Choose PDF"
        helperText="PDF · Maximum file size: 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={isProcessing ? undefined : startAgain}
            removeLabel="Remove PDF"
            statusText={isProcessing ? "Updating metadata" : outputBytes ? "Updated PDF created" : "Metadata ready to edit"}
          />

          {!outputBytes && (
            <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="flex items-center gap-3">
                <FilePenLine size={22} className="text-blue-600" />
                <div>
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white">Common document metadata</h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Review the existing values and change only what you need.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {fields.map((item) => (
                  <label key={item.key} className="text-sm font-semibold text-gray-900 dark:text-white">
                    {item.label}
                    {item.key === "subject" || item.key === "keywords" ? (
                      <textarea
                        rows={3}
                        value={metadata[item.key]}
                        onChange={(event) => updateField(item.key, event.target.value)}
                        placeholder={item.placeholder}
                        className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                      />
                    ) : (
                      <input
                        type="text"
                        value={metadata[item.key]}
                        onChange={(event) => updateField(item.key, event.target.value)}
                        placeholder={item.placeholder}
                        className="mt-2 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                      />
                    )}
                  </label>
                ))}
              </div>

              <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <TriangleAlert size={19} className="shrink-0" />
                <p>This editor changes common PDF document information fields only. It does not promise to edit or remove every possible XMP packet, attachment, annotation, hidden layer, or application-specific metadata object.</p>
              </div>
            </section>
          )}

          {!outputBytes && !errorMessage && (
            <ActionButton
              isLoading={isProcessing}
              loadingText="Updating metadata..."
              loadingSubtitle="Writing the common document information fields locally."
              buttonText="Save Metadata and Download"
              subtitle="Creates a separate PDF copy. Your original file stays unchanged."
              onClick={saveMetadata}
              disabled={isProcessing}
            />
          )}

          {!isProcessing && outputBytes && (
            <SuccessCard
              title="Your updated PDF is ready"
              description="The common document metadata fields were updated successfully."
              fileName={outputFileName}
              onDownloadAgain={() => downloadFile(outputBytes, outputFileName, "application/pdf")}
              onStartAgain={startAgain}
              downloadLabel="Download Updated PDF Again"
              resetLabel="Edit Another PDF"
            />
          )}

          {!isProcessing && errorMessage && (
            <ErrorCard
              title="PDF metadata needs attention"
              description={errorMessage}
              reasons={[
                "The PDF may be password-protected or damaged.",
                "The document may contain unusual metadata structures.",
                "Your browser may not have enough memory for this file.",
              ]}
              onRetry={file ? saveMetadata : undefined}
              onReset={startAgain}
              retryLabel="Retry Save"
              resetLabel="Choose Another PDF"
            />
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck size={18} className="text-emerald-600" />
        Metadata is read and written locally inside your browser.
      </div>
    </ToolLayout>
  );
}
