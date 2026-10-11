"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import {
  recognizePdfV4OcrFilePages,
} from "@/lib/pdf-engine-v4/ocr/ocrRecognizer";
import { formatPdfV4OcrPageExport } from "@/lib/pdf-engine-v4/ocr/ocrTextExport";
import {
  loadPdfWithoutMetadataMutation,
} from "@/lib/pdf/safeDocument";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { saveAs } from "file-saver";
import { ChangeEvent, useRef, useState } from "react";

const MAX_FILE_SIZE =
  25 * 1024 * 1024;

export default function OcrPdfPage() {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [pageCount, setPageCount] =
    useState(0);

  const [completedPages, setCompletedPages] =
    useState(0);

  const [busy, setBusy] =
    useState(false);

  const [output, setOutput] =
    useState<Blob | null>(null);

  const [outputName, setOutputName] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  function resetResult() {
    setCompletedPages(0);
    setOutput(null);
    setOutputName("");
    setErrorMessage("");
  }

  function startAgain() {
    setFile(null);
    setPageCount(0);
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

      const count =
        pdf.getPageCount();

      if (count === 0) {
        throw new Error(
          "The PDF does not contain any pages.",
        );
      }

      setFile(selectedFile);
      setPageCount(count);
      resetResult();
    } catch {
      setFile(null);
      setPageCount(0);
      setErrorMessage(
        "Unable to open this PDF. It may be damaged or password-protected.",
      );
    }
  }

  async function runOcr() {
    if (!file) {
      return;
    }

    setBusy(true);
    setErrorMessage("");
    setOutput(null);
    setOutputName("");
    setCompletedPages(0);

    try {
      const results =
        await recognizePdfV4OcrFilePages(
          file,
          Array.from(
            {
              length:
                pageCount,
            },
            (_, index) =>
              index + 1,
          ),
          {},
          (completed) => {
            setCompletedPages(
              completed,
            );
          },
        );

      const text =
        results
          .map(formatPdfV4OcrPageExport)
          .join("\n\n");

      if (
        !text
          .replace(
            /--- Page \d+ ---/g,
            "",
          )
          .trim()
      ) {
        throw new Error(
          "OCR could not detect readable English text.",
        );
      }

      const blob =
        new Blob(
          [text],
          {
            type:
              "text/plain;charset=utf-8",
          },
        );

      const name =
        `${file.name.replace(/\.pdf$/i, "") || "kukureku"}-ocr.txt`;

      saveAs(blob, name);

      setOutput(blob);
      setOutputName(name);

      addRecentFile({
        fileName: name,
        toolName: "OCR PDF",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "OCR failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolLayout
      label="OCR PDF"
      title="OCR scanned PDF to text privately"
      description="Recognize English text from scanned PDFs locally. The TXT preserves raw OCR and includes review notes for identifiers and form checkboxes; an optional column view may help with complicated layouts, but neither is a verified transcript."
      tips={[
        {
          title:
            "English OCR",
          description:
            "This public OCR workflow currently recognizes English text.",
        },
        {
          title:
            "Clear scans work best",
          description:
            "Higher-resolution, straight pages generally improve recognition.",
        },
        {
          title:
            "Memory-aware processing",
          description:
            "Pages are rendered and recognized one at a time instead of keeping every full-resolution OCR image in memory.",
        },
      ]}
      faqs={[
        {
          question:
            "Is my scanned PDF uploaded?",
          answer:
            "No. Rendering and OCR run locally in your browser.",
        },
        {
          question:
            "What does it download?",
          answer:
            "A plain TXT file containing recognized English text page by page.",
        },
      ]}
      howToTitle="How to OCR a scanned PDF"
      howToSteps={[
        {
          title:
            "Choose one scanned PDF",
          description:
            "Select a PDF up to 25 MB.",
        },
        {
          title:
            "Run local OCR",
          description:
            "Kukureku renders and recognizes each page sequentially on your device.",
        },
        {
          title:
            "Download the text",
          description:
            "Save the original OCR text with unverified review notes, plus an optional column preview when supported by word positions.",
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
        title="Select one scanned PDF"
        description="Choose a PDF for English OCR."
        buttonText="Choose PDF"
        helperText="PDF · Maximum 25 MB"
        disabled={busy}
      />

      {!file && errorMessage && (
        <div className="mt-6">
          <ErrorCard
            title="PDF could not be selected"
            description={errorMessage}
            reasons={[]}
            onReset={startAgain}
            resetLabel="Choose Another PDF"
          />
        </div>
      )}

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              busy
                ? undefined
                : startAgain
            }
            removeLabel="Remove PDF"
            statusText={
              busy
                ? `Running OCR locally · ${completedPages}/${pageCount} pages`
                : output
                  ? "OCR text created"
                  : `${pageCount} ${pageCount === 1 ? "page" : "pages"} ready for OCR`
            }
          />

          {!output &&
            !errorMessage && (
              <ActionButton
                isLoading={busy}
                loadingText="Recognizing text..."
                loadingSubtitle={
                  pageCount > 0
                    ? `Processed ${completedPages} of ${pageCount} pages. Large scanned PDFs may take several minutes.`
                    : "Running OCR locally in your browser."
                }
                buttonText="Run OCR and Download TXT"
                subtitle="English OCR runs entirely on your device."
                onClick={
                  runOcr
                }
                disabled={busy}
              />
            )}

          {!busy &&
            output && (
              <SuccessCard
                title="OCR text is ready"
                description="Recognized English text was saved as a TXT file."
                fileName={
                  outputName
                }
                onDownloadAgain={() =>
                  saveAs(
                    output,
                    outputName,
                  )
                }
                onStartAgain={
                  startAgain
                }
                downloadLabel="Download OCR Text Again"
                resetLabel="OCR Another PDF"
              />
            )}

          {!busy &&
            errorMessage && (
              <ErrorCard
                title="OCR could not finish"
                description={
                  errorMessage
                }
                reasons={[
                  "The scan may be too faint or unclear.",
                  "The PDF may be damaged or password-protected.",
                  "OCR currently recognizes English text only.",
                ]}
                onRetry={
                  file
                    ? runOcr
                    : undefined
                }
                onReset={
                  startAgain
                }
                retryLabel="Retry OCR"
                resetLabel="Choose Another PDF"
              />
            )}
        </div>
      )}
    </ToolLayout>
  );
}
