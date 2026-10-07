"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import {
  reorderPdfPagesInPlace,
} from "@/lib/pdf/pageOrder";
import {
  loadPdfWithoutMetadataMutation,
  savePdfWithoutFormAppearanceMutation,
} from "@/lib/pdf/safeDocument";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE =
  25 * 1024 * 1024;

function parseOrder(
  value: string,
  total: number,
) {
  const parts = value
    .split(",")
    .map((part) =>
      part.trim(),
    )
    .filter(Boolean);

  if (
    parts.length !== total
  ) {
    throw new Error(
      `Enter all ${total} page numbers exactly once.`,
    );
  }

  const numbers =
    parts.map(Number);

  if (
    numbers.some(
      (number) =>
        !Number.isInteger(
          number,
        ) ||
        number < 1 ||
        number > total,
    ) ||
    new Set(numbers).size !==
      total
  ) {
    throw new Error(
      `Use each page number from 1 to ${total} exactly once.`,
    );
  }

  return numbers.map(
    (number) => number - 1,
  );
}

export default function ReorderPdfPagesPage() {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [total, setTotal] =
    useState(0);

  const [order, setOrder] =
    useState("");

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

  function startAgain() {
    setFile(null);
    setTotal(0);
    setOrder("");
    resetResult();

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0];

    event.target.value = "";

    if (
      !selectedFile ||
      (selectedFile.type !==
        "application/pdf" &&
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

      const pageCount =
        pdf.getPageCount();

      if (pageCount === 0) {
        throw new Error(
          "The PDF does not contain any pages.",
        );
      }

      setFile(selectedFile);
      setTotal(pageCount);
      setOrder(
        Array.from(
          {
            length:
              pageCount,
          },
          (_, index) =>
            index + 1,
        ).join(","),
      );
      resetResult();

      toast.success(
        `${pageCount} ${pageCount === 1 ? "page" : "pages"} ready to reorder.`,
      );
    } catch {
      setFile(null);
      setTotal(0);
      setOrder("");
      setErrorMessage(
        "Unable to open this PDF. It may be damaged or password-protected.",
      );
    }
  }

  async function reorderPdf() {
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

      const indices =
        parseOrder(
          order,
          pdf.getPageCount(),
        );

      reorderPdfPagesInPlace(
        pdf,
        indices,
      );

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
        `${baseName}-reordered.pdf`;

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
        toolName:
          "Reorder PDF Pages",
      });

      toast.success(
        "PDF pages reordered successfully.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Reordering failed.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ToolLayout
      label="Reorder PDF Pages"
      title="Reorder PDF pages privately"
      description="Enter the page order you want and rearrange the existing PDF page tree locally, preserving document metadata and standard form structure."
      tips={[
        {
          title:
            "List every page once",
          description:
            "For a 4-page PDF, try 4,1,2,3.",
        },
        {
          title:
            "Preserves the existing PDF structure",
          description:
            "Pages are reordered inside the same document instead of being copied into a blank PDF.",
        },
        {
          title:
            "Need visual previews?",
          description:
            "Use Organize PDF for a thumbnail-based workflow.",
        },
      ]}
      faqs={[
        {
          question:
            "Is my PDF uploaded?",
          answer:
            "No. Reordering happens locally in your browser.",
        },
        {
          question:
            "Will form fields remain in the PDF?",
          answer:
            "Kukureku reorders the existing page objects rather than copying them into a new document, which helps preserve standard form fields and document metadata.",
        },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <FileUploader
        fileInputRef={
          inputRef
        }
        onFileSelection={
          handleFileSelection
        }
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose a PDF to reorder."
        buttonText="Choose PDF"
        helperText="PDF · Maximum 25 MB"
        disabled={
          isProcessing
        }
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
                ? "Reordering PDF pages"
                : outputBytes
                  ? "Reordered PDF created"
                  : `${total} ${total === 1 ? "page" : "pages"} ready`
            }
          />

          {!outputBytes && (
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <label
                htmlFor="order"
                className="font-bold text-gray-950 dark:text-white"
              >
                New page order
              </label>

              <input
                id="order"
                value={order}
                onChange={(event) => {
                  setOrder(
                    event.target.value,
                  );
                  resetResult();
                }}
                disabled={
                  isProcessing
                }
                className="mt-3 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
              />

              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                Enter all {total} pages, separated by commas.
              </p>
            </div>
          )}

          {!outputBytes &&
            !errorMessage && (
              <ActionButton
                isLoading={
                  isProcessing
                }
                loadingText="Reordering..."
                loadingSubtitle="Rearranging the existing page tree locally."
                buttonText="Reorder and Download PDF"
                subtitle="Your original PDF stays unchanged."
                onClick={
                  reorderPdf
                }
                disabled={
                  isProcessing
                }
              />
            )}

          {!isProcessing &&
            outputBytes && (
              <SuccessCard
                title="Your reordered PDF is ready"
                description="The page order changed successfully while preserving the existing document structure."
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
              />
            )}

          {!isProcessing &&
            errorMessage && (
              <ErrorCard
                title="Reordering needs attention"
                description={
                  errorMessage
                }
                reasons={[
                  "Use every page number exactly once.",
                  "The PDF may be damaged or password-protected.",
                ]}
                onRetry={
                  file
                    ? reorderPdf
                    : undefined
                }
                onReset={
                  startAgain
                }
              />
            )}
        </div>
      )}
    </ToolLayout>
  );
}
