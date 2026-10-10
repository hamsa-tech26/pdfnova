"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileList from "@/components/pdf/FileList";
import FileUploader from "@/components/pdf/FileUploader";
import type { PdfFileInfo } from "@/components/pdf/PdfFileInfo";
import ProgressCard from "@/components/pdf/ProgressCard";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import WorkspaceDerivedOutputNotice from "@/components/workspace/WorkspaceDerivedOutputNotice";
import WorkspaceMergeSources from "@/components/workspace/WorkspaceMergeSources";
import { downloadFile } from "@/lib/downloadFile";
import { validatePdfBatch } from "@/lib/pdf/pdfBatchValidation";
import { throwIfPdfOperationCancelled } from "@/lib/pdf/operationCancellation";
import { addRecentFile } from "@/lib/storage/recentFiles";
import type {
  WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import { ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";


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
      "You can add up to 20 PDFs, with a 25 MB per-file limit and a 100 MB combined browser-processing limit.",
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
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const readingFilesRef = useRef(false);
  const mergeControllerRef = useRef<AbortController | null>(null);
  const [canCancelMerge, setCanCancelMerge] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [wasCancelled, setWasCancelled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const [outputBytes, setOutputBytes] =
    useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [
    workspaceOutput,
    setWorkspaceOutput,
  ] = useState<WorkspaceFileSummary | null>(
    null,
  );

  function resetResultState() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
    setProgress(0);
    setCurrentStep(1);
    setWorkspaceOutput(null);
    setWasCancelled(false);
  }

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    if (readingFilesRef.current || isMerging) {
      event.target.value = "";
      toast.error("Please finish the current PDF operation before adding more files.");
      return;
    }

    const selectedFiles = Array.from(
      event.target.files ?? [],
    );

    const batchError = validatePdfBatch(
      files.map((item) => item.file),
      selectedFiles,
    );

    if (batchError) {
      setErrorMessage(batchError);
      toast.error(batchError);
      event.target.value = "";
      return;
    }

    readingFilesRef.current = true;
    setIsReadingFiles(true);

    try {
      const [
        { loadPdfWithoutMetadataMutation },
        { assertPageCopySafe },
      ] = await Promise.all([
        import("@/lib/pdf/safeDocument"),
        import("@/lib/pdf/pdfInputSafety"),
      ]);
      const selectedFileInfo: PdfFileInfo[] = [];

      for (const file of selectedFiles) {
        const fileBytes = await file.arrayBuffer();
        const pdf = await loadPdfWithoutMetadataMutation(fileBytes);

        assertPageCopySafe(
          pdf,
          "Merge PDF",
        );

        selectedFileInfo.push({
          file,
          pageCount: pdf.getPageCount(),
        });
      }

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
        selectionError instanceof Error
          ? selectionError.message
          : "One of the selected PDF files is damaged or password-protected.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      readingFilesRef.current = false;
      setIsReadingFiles(false);
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

  function cancelMerge() {
    if (!mergeControllerRef.current || !canCancelMerge) return;
    mergeControllerRef.current.abort();
    setCancelRequested(true);
  }

  function releaseDownloadedCopy() {
    // The browser workspace version is unaffected. This only frees
    // the second, re-downloadable in-memory copy held by this tool page.
    setOutputBytes(null);
    setOutputFileName("");
    setWorkspaceOutput(null);
    toast("Downloaded copy released from this tab", {
      description: "Saved workspace versions and selected sources are unchanged.",
    });
  }

  async function mergePdfFiles() {
    if (isMerging || readingFilesRef.current || mergeControllerRef.current) {
      return;
    }

    if (files.length < 2) {
      const message = "Please select at least two PDF files.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    const controller = new AbortController();
    mergeControllerRef.current = controller;
    setCanCancelMerge(true);
    setCancelRequested(false);
    setWasCancelled(false);
    setIsMerging(true);
    setErrorMessage("");
    setOutputBytes(null);
    setOutputFileName("");
    setProgress(12);
    setCurrentStep(1);

    try {
      const [
        { PDFDocument },
        { loadPdfWithoutMetadataMutation },
        { assertPageCopySafe },
      ] = await Promise.all([
        import("pdf-lib"),
        import("@/lib/pdf/safeDocument"),
        import("@/lib/pdf/pdfInputSafety"),
      ]);
      throwIfPdfOperationCancelled(controller.signal);
      const mergedPdf = await PDFDocument.create();
      throwIfPdfOperationCancelled(controller.signal);

      setProgress(30);
      setCurrentStep(2);

      for (let index = 0; index < files.length; index += 1) {
        throwIfPdfOperationCancelled(controller.signal);
        const fileInfo = files[index];
        const fileBytes = await fileInfo.file.arrayBuffer();
        throwIfPdfOperationCancelled(controller.signal);
        const sourcePdf = await loadPdfWithoutMetadataMutation(
          fileBytes,
        );
        throwIfPdfOperationCancelled(controller.signal);

        assertPageCopySafe(
          sourcePdf,
          "Merge PDF",
        );

        const copiedPages = await mergedPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices(),
        );
        throwIfPdfOperationCancelled(controller.signal);

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
      throwIfPdfOperationCancelled(controller.signal);
      // Downloads already started cannot be recalled. Stop offering
      // cancellation once the output is committed to the browser.
      setCanCancelMerge(false);
      const generatedFileName = "kukureku-merged.pdf";

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

      const { saveComposedPdfToWorkspace } = await import("@/lib/storage/workspaceContinuity");
      const savedWorkspaceDocument =
        await saveComposedPdfToWorkspace(
          {
            sourceFiles:
              files.map(
                (item) =>
                  item.file,
              ),
            outputBytes:
              mergedPdfBytes,
            outputFileName:
              generatedFileName,
            operationId:
              "merge-pdf",
            operationLabel:
              "Merge PDF",
          },
        );
      setWorkspaceOutput(
        savedWorkspaceDocument,
      );

      toast.success("PDFs merged successfully!");

      toast("Download started", {
        description: "Your merged PDF is being downloaded.",
      });
    } catch (mergeError) {
      if (controller.signal.aborted) {
        setErrorMessage("");
        setOutputBytes(null);
        setOutputFileName("");
        setProgress(0);
        setCurrentStep(1);
        setWasCancelled(true);
        toast("Merge cancelled", {
          description: "No partial PDF was downloaded; your selected sources are still available.",
        });
        return;
      }
      console.error(mergeError);

      const message =
        mergeError instanceof Error
          ? mergeError.message
          : "The PDF files could not be merged. One of the files may be damaged or password-protected.";

      setErrorMessage(message);
      toast.error("Failed to merge PDF files.");
    } finally {
      if (mergeControllerRef.current === controller) mergeControllerRef.current = null;
      setCanCancelMerge(false);
      setCancelRequested(false);
      setIsMerging(false);
    }
  }

  return (
    <ToolLayout
      label="Merge PDF"
      title="Merge PDF files online, privately"
      description="Add two or more non-form PDFs, set their order, and combine them locally in your browser. Files are not uploaded, with a 25 MB limit per file and a 100 MB combined browser-processing limit."
      tips={mergePdfTips}
      faqs={mergePdfFaqs}
      howToTitle="How to merge PDF files online"
      howToSteps={[
        {
          title: "Add your PDFs",
          description:
            "Choose two or more PDF files from your device. Each file can be up to 25 MB.",
        },
        {
          title: "Use non-form PDFs",
          description:
            "Interactive PDF forms must be flattened before merging so form structure is not silently damaged.",
        },
        {
          title: "Set the file order",
          description:
            "Use the move controls to arrange the PDFs in the exact order you want.",
        },
        {
          title: "Merge and download",
          description:
            "Combine the pages locally in your browser and download the merged PDF.",
        },
      ]}
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
        disabled={isMerging || isReadingFiles}
      />

      <WorkspaceMergeSources
        fileInputRef={
          fileInputRef
        }
        selectedFiles={files.map(
          (item) => item.file,
        )}
        disabled={isMerging || isReadingFiles}
      />

      {isReadingFiles && (
        <p role="status" aria-live="polite" className="mt-4 text-sm font-semibold text-blue-700 dark:text-blue-300">
          Validating your selected PDFs locally…
        </p>
      )}

      <FileList
        files={files}
        onRemove={removeFile}
        onMoveUp={moveFileUp}
        onMoveDown={moveFileDown}
        disabled={isMerging || isReadingFiles}
      />

      {files.length === 0 && errorMessage && (
        <div className="mt-6">
          <ErrorCard
            title="PDF files could not be selected"
            description={errorMessage}
            reasons={[]}
            onReset={startAgain}
            resetLabel="Choose Other PDFs"
          />
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-8 space-y-6">
          {wasCancelled && !isMerging && (
            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Merge cancelled. No new PDF was downloaded, and your selected files are ready to retry.
            </p>
          )}
          {isMerging && (
            <ProgressCard
              title="Merging PDF files"
              description="Kukureku is combining the selected documents in the order shown above."
              progress={progress}
              currentStep={currentStep}
              steps={mergeSteps}
              estimatedTime="A few seconds"
            />
          )}
          {isMerging && canCancelMerge && (
            <button type="button" onClick={cancelMerge} disabled={cancelRequested}
              className="inline-flex min-h-11 items-center rounded-xl border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {cancelRequested ? "Cancellation requested…" : "Cancel merge"}
            </button>
          )}

          {!isMerging && outputBytes && (
            <>
              <SuccessCard
                title="Your merged PDF is ready"
                description="The selected PDF files were merged successfully and downloaded to your device."
                fileName={outputFileName}
                onDownloadAgain={downloadResultAgain}
                onStartAgain={startAgain}
                downloadLabel="Download Merged PDF Again"
                resetLabel="Merge Another Set"
              />
              <WorkspaceDerivedOutputNotice
                file={
                  workspaceOutput
                }
              />
              <button type="button" onClick={releaseDownloadedCopy}
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Release downloaded copy from memory
              </button>
            </>
          )}

          {!isMerging && errorMessage && (
            <ErrorCard
              title="PDF merge failed"
              description={errorMessage}
              reasons={[
                "One of the PDF files may be damaged.",
                "A selected PDF may be password-protected.",
                "Interactive PDF forms must be flattened before merging.",
                "The selected files may exceed the browser-processing limits.",
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
                disabled={files.length < 2 || isReadingFiles}
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