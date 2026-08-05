"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileList from "@/components/pdf/FileList";
import FileUploader from "@/components/pdf/FileUploader";
import type { PdfFileInfo } from "@/components/pdf/PdfFileInfo";
import ProgressCard from "@/components/pdf/ProgressCard";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const mergePdfTips = [
  {
    title: "Arrange files before merging",
    description:
      "Use Move Up and Move Down to set the exact order of the final PDF.",
  },
  {
    title: "Use valid PDF files",
    description:
      "Damaged or password-protected PDFs may prevent the merge from completing.",
  },
  {
    title: "Check the final document",
    description:
      "Open the merged PDF once to confirm that the page order is correct.",
  },
];

const mergePdfFaqs = [
  {
    question: "How many PDF files can I merge?",
    answer:
      "You can add multiple PDF files, provided your browser has enough available memory to process them.",
  },
  {
    question: "Can I change the file order?",
    answer:
      "Yes. Use the Move Up and Move Down buttons before starting the merge.",
  },
  {
    question: "Are my files uploaded?",
    answer:
      "No. The PDFs are merged locally inside your browser.",
  },
];

const mergeSteps = [
  {
    label: "Reading PDF files",
    description: "Opening and validating the selected documents.",
  },
  {
    label: "Combining PDF pages",
    description: "Copying pages into one merged document.",
  },
  {
    label: "Preparing download",
    description: "Finalizing the merged PDF file.",
  },
];

export default function MergePdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<PdfFileInfo[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const [outputBytes, setOutputBytes] =
    useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function resetResultState() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
    setProgress(0);
    setCurrentStep(1);
  }

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFiles = Array.from(
      event.target.files ?? [],
    ).filter((file) => {
      return (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
      );
    });

    if (selectedFiles.length === 0) {
      const message = "Please select valid PDF files.";

      setErrorMessage(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    const oversizedFile = selectedFiles.find(
      (file) => file.size > MAX_FILE_SIZE,
    );

    if (oversizedFile) {
      const message = `${oversizedFile.name} is larger than 25 MB.`;

      setErrorMessage(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    try {
      const selectedFileInfo = await Promise.all(
        selectedFiles.map(async (file) => {
          const fileBytes = await file.arrayBuffer();
          const pdf = await PDFDocument.load(fileBytes);

          return {
            file,
            pageCount: pdf.getPageCount(),
          };
        }),
      );

      setFiles((currentFiles) => [
        ...currentFiles,
        ...selectedFileInfo,
      ]);

      resetResultState();

      toast.success(
        `${selectedFileInfo.length} PDF ${
          selectedFileInfo.length === 1 ? "file" : "files"
        } added successfully.`,
      );
    } catch (selectionError) {
      console.error(selectionError);

      const message =
        "One of the selected PDF files is damaged or password-protected.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      event.target.value = "";
    }
  }

  function removeFile(indexToRemove: number) {
    const removedFileName = files[indexToRemove]?.file.name;

    setFiles((currentFiles) =>
      currentFiles.filter(
        (_, index) => index !== indexToRemove,
      ),
    );

    resetResultState();

    if (removedFileName) {
      toast.success(`${removedFileName} removed.`);
    }
  }

  function moveFileUp(index: number) {
    if (index === 0) {
      return;
    }

    setFiles((currentFiles) => {
      const updatedFiles = [...currentFiles];

      [updatedFiles[index - 1], updatedFiles[index]] = [
        updatedFiles[index],
        updatedFiles[index - 1],
      ];

      return updatedFiles;
    });

    resetResultState();
  }

  function moveFileDown(index: number) {
    setFiles((currentFiles) => {
      if (index === currentFiles.length - 1) {
        return currentFiles;
      }

      const updatedFiles = [...currentFiles];

      [updatedFiles[index], updatedFiles[index + 1]] = [
        updatedFiles[index + 1],
        updatedFiles[index],
      ];

      return updatedFiles;
    });

    resetResultState();
  }

  function startAgain() {
    setFiles([]);
    resetResultState();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function downloadResultAgain() {
    if (!outputBytes || !outputFileName) {
      toast.error("The merged PDF is no longer available.");
      return;
    }

    downloadFile(
      outputBytes,
      outputFileName,
      "application/pdf",
    );

    toast("Download started", {
      description: "Your merged PDF is being downloaded again.",
    });
  }

  async function mergePdfFiles() {
    if (files.length < 2) {
      const message = "Please select at least two PDF files.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsMerging(true);
    setErrorMessage("");
    setOutputBytes(null);
    setOutputFileName("");
    setProgress(12);
    setCurrentStep(1);

    try {
      const mergedPdf = await PDFDocument.create();

      await new Promise((resolve) =>
        setTimeout(resolve, 200),
      );

      setProgress(30);
      setCurrentStep(2);

      for (let index = 0; index < files.length; index += 1) {
        const fileInfo = files[index];
        const fileBytes = await fileInfo.file.arrayBuffer();
        const sourcePdf = await PDFDocument.load(fileBytes);

        const copiedPages = await mergedPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices(),
        );

        copiedPages.forEach((page) =>
          mergedPdf.addPage(page),
        );

        const mergeProgress =
          30 + Math.round(((index + 1) / files.length) * 50);

        setProgress(Math.min(80, mergeProgress));
      }

      setCurrentStep(3);
      setProgress(88);

      const mergedPdfBytes = await mergedPdf.save();
      const generatedFileName = "pdfnova-merged.pdf";

      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      downloadFile(
        mergedPdfBytes,
        generatedFileName,
        "application/pdf",
      );

      setOutputBytes(mergedPdfBytes);
      setOutputFileName(generatedFileName);
      setProgress(100);

      addRecentFile({
        fileName: generatedFileName,
        toolName: "Merge PDF",
      });

      toast.success("PDFs merged successfully!");

      toast("Download started", {
        description: "Your merged PDF is being downloaded.",
      });
    } catch (mergeError) {
      console.error(mergeError);

      const message =
        "The PDF files could not be merged. One of the files may be damaged or password-protected.";

      setErrorMessage(message);
      toast.error("Failed to merge PDF files.");
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <ToolLayout
      label="Merge PDF"
      title="Combine multiple PDFs into one file"
      description="Upload two or more PDF files, arrange them in the correct order, and download one merged document from your private PDFNova workspace."
      tips={mergePdfTips}
      faqs={mergePdfFaqs}
      maxWidthClassName="max-w-6xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple
        title="Select PDF files"
        description="Choose or drag at least two PDF files into the workspace."
        buttonText="Choose PDF Files"
        helperText="Supported format: PDF · Maximum file size: 25 MB per file"
        disabled={isMerging}
      />

      <FileList
        files={files}
        onRemove={removeFile}
        onMoveUp={moveFileUp}
        onMoveDown={moveFileDown}
      />

      {files.length > 0 && (
        <div className="mt-8 space-y-6">
          {isMerging && (
            <ProgressCard
              title="Merging PDF files"
              description="PDFNova is combining the selected documents in the order shown above."
              progress={progress}
              currentStep={currentStep}
              steps={mergeSteps}
              estimatedTime="A few seconds"
            />
          )}

          {!isMerging && outputBytes && (
            <SuccessCard
              title="Your merged PDF is ready"
              description="The selected PDF files were merged successfully and downloaded to your device."
              fileName={outputFileName}
              onDownloadAgain={downloadResultAgain}
              onStartAgain={startAgain}
              downloadLabel="Download Merged PDF Again"
              resetLabel="Merge Another Set"
            />
          )}

          {!isMerging && errorMessage && (
            <ErrorCard
              title="PDF merge failed"
              description={errorMessage}
              reasons={[
                "One of the PDF files may be damaged.",
                "A selected PDF may be password-protected.",
                "Your browser may not have enough memory for the selected files.",
              ]}
              onRetry={
                files.length >= 2 ? mergePdfFiles : undefined
              }
              onReset={startAgain}
              retryLabel="Retry Merge"
              resetLabel="Choose Different Files"
            />
          )}

          {!isMerging &&
            !outputBytes &&
            !errorMessage && (
              <ActionButton
                isLoading={false}
                loadingText="Merging PDFs..."
                loadingSubtitle="Combining pages and preparing the final PDF."
                buttonText="Merge and Download PDF"
                subtitle="Combine the selected files in the order shown above."
                onClick={mergePdfFiles}
                disabled={files.length < 2}
              />
            )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Files are merged locally inside your browser and are not uploaded.
      </div>
    </ToolLayout>
  );
}