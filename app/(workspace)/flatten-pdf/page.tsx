"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import {
  flattenStandardPdfForm,
  getPdfFormProcessingError,
  hasPdfXfa,
} from "@/lib/pdf/formFields";
import {
  loadPdfWithoutMetadataMutation,
  savePdfWithoutFormAppearanceMutation,
} from "@/lib/pdf/safeDocument";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const tips = [
  {
    title: "Best for completed standard forms",
    description:
      "Flattening converts current AcroForm field appearances into ordinary page content.",
  },
  {
    title: "Keep the editable original",
    description:
      "The flattened copy is no longer fillable, so keep your source PDF if you may need to edit the form again.",
  },
  {
    title: "XFA forms are refused",
    description:
      "Dynamic XFA forms are not flattened because this browser engine cannot preserve XFA safely.",
  },
];

const faqs = [
  {
    question: "What does flatten PDF mean?",
    answer:
      "It turns supported standard interactive form fields into non-editable page content in a new PDF copy.",
  },
  {
    question: "Will every PDF work?",
    answer:
      "The tool is designed for standard AcroForm PDFs. XFA forms are refused, and unusual custom widgets may not flatten correctly.",
  },
  {
    question: "Is my PDF uploaded?",
    answer:
      "No. Detection, flattening, and saving happen locally in your browser.",
  },
];

export default function FlattenPdfPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [fieldCount, setFieldCount] =
    useState(0);

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [outputBytes, setOutputBytes] =
    useState<Uint8Array | null>(null);

  const [outputFileName, setOutputFileName] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0];

    event.target.value = "";

    if (
      !selectedFile ||
      (selectedFile.type !== "application/pdf" &&
        !selectedFile.name
          .toLowerCase()
          .endsWith(".pdf"))
    ) {
      setErrorMessage(
        "Please select a valid PDF file.",
      );
      return;
    }

    if (
      selectedFile.size >
      MAX_FILE_SIZE
    ) {
      setErrorMessage(
        "The PDF file must not be larger than 25 MB.",
      );
      return;
    }

    try {
      const pdf =
        await loadPdfWithoutMetadataMutation(
          await selectedFile.arrayBuffer(),
        );

      if (hasPdfXfa(pdf)) {
        throw new Error(
          "This PDF contains XFA form data. Kukureku will not flatten it because the XFA structure cannot be preserved safely.",
        );
      }

      const count =
        pdf.getForm().getFields().length;

      if (count === 0) {
        throw new Error(
          "No standard interactive AcroForm fields were found to flatten.",
        );
      }

      setFile(selectedFile);
      setFieldCount(count);
      resetResult();

      toast.success(
        `${count} ${count === 1 ? "form field" : "form fields"} ready to flatten.`,
      );
    } catch (error) {
      setFile(null);
      setFieldCount(0);
      setErrorMessage(
        getPdfFormProcessingError(
          error,
          "Unable to open this PDF. It may be damaged or password-protected.",
        ),
      );
    }
  }

  function startAgain() {
    setFile(null);
    setFieldCount(0);
    resetResult();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function flattenPdf() {
    if (!file) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const pdf =
        await loadPdfWithoutMetadataMutation(
          await file.arrayBuffer(),
        );

      const flattenedCount =
        flattenStandardPdfForm(pdf);

      const bytes =
        await savePdfWithoutFormAppearanceMutation(
          pdf,
        );

      const baseName =
        file.name.replace(
          /\.pdf$/i,
          "",
        ) || "kukureku";

      const generatedFileName =
        `${baseName}-flattened.pdf`;

      downloadFile(
        bytes,
        generatedFileName,
        "application/pdf",
      );

      setOutputBytes(bytes);
      setOutputFileName(
        generatedFileName,
      );

      addRecentFile({
        fileName:
          generatedFileName,
        toolName: "Flatten PDF",
      });

      toast.success(
        `${flattenedCount} ${flattenedCount === 1 ? "field" : "fields"} flattened successfully.`,
      );
    } catch (error) {
      setErrorMessage(
        getPdfFormProcessingError(
          error,
          "The PDF could not be flattened.",
        ),
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ToolLayout
      label="Flatten PDF"
      title="Flatten PDF forms privately"
      description="Flatten supported standard PDF form fields into page content locally in your browser, creating a separate non-editable copy."
      tips={tips}
      faqs={faqs}
      howToTitle="How to flatten a PDF form"
      howToSteps={[
        {
          title: "Choose a PDF form",
          description:
            "Select a PDF containing standard AcroForm fields.",
        },
        {
          title: "Review the detected fields",
          description:
            "Kukureku checks that the PDF contains standard fields and refuses XFA forms.",
        },
        {
          title: "Flatten and download",
          description:
            "Convert the current field appearances into ordinary page content and download the new copy.",
        },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <FileUploader
        fileInputRef={
          fileInputRef
        }
        onFileSelection={
          handleFileSelection
        }
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF form"
        description="Choose the standard PDF form you want to flatten."
        buttonText="Choose PDF"
        helperText="PDF · Maximum 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              isProcessing
                ? undefined
                : startAgain
            }
            removeLabel="Remove PDF"
            statusText={
              isProcessing
                ? "Flattening PDF"
                : outputBytes
                  ? "Flattened PDF created"
                  : `${fieldCount} ${fieldCount === 1 ? "field" : "fields"} ready to flatten`
            }
          />

          {!outputBytes && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <TriangleAlert
                size={19}
                className="mt-0.5 shrink-0"
              />
              <p>
                Flattening removes form editability from the downloaded copy. Keep the original PDF if you may need to change the form later.
              </p>
            </div>
          )}

          {!outputBytes &&
            !errorMessage && (
              <ActionButton
                isLoading={
                  isProcessing
                }
                loadingText="Flattening PDF..."
                loadingSubtitle="Converting standard form field appearances into page content locally."
                buttonText="Flatten and Download PDF"
                subtitle="Creates a separate non-editable copy while leaving your original unchanged."
                onClick={
                  flattenPdf
                }
                disabled={
                  isProcessing
                }
              />
            )}

          {!isProcessing &&
            outputBytes && (
              <SuccessCard
                title="Your flattened PDF is ready"
                description="The standard form fields were converted into non-editable page content."
                fileName={
                  outputFileName
                }
                onDownloadAgain={() =>
                  downloadFile(
                    outputBytes,
                    outputFileName,
                    "application/pdf",
                  )
                }
                onStartAgain={
                  startAgain
                }
                downloadLabel="Download Flattened PDF Again"
                resetLabel="Flatten Another PDF"
              />
            )}

          {!isProcessing &&
            errorMessage && (
              <ErrorCard
                title="Flattening needs attention"
                description={
                  errorMessage
                }
                reasons={[
                  "The PDF may use XFA instead of standard AcroForm fields.",
                  "The PDF may contain unusual custom widgets or unsupported font characters.",
                  "The PDF may be password-protected or damaged.",
                ]}
                onRetry={
                  file
                    ? flattenPdf
                    : undefined
                }
                onReset={
                  startAgain
                }
                retryLabel="Retry Flatten"
                resetLabel="Choose Another PDF"
              />
            )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Your PDF is flattened locally inside your browser and is not uploaded.
      </div>
    </ToolLayout>
  );
}
