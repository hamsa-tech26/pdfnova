"use client";

import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import OrganizeToolbar from "@/components/pdf/OrganizeToolbar";
import PageGrid, {
  type OrganizePageItem,
} from "@/components/pdf/PageGrid";
import ProgressCard from "@/components/pdf/ProgressCard";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import { renderPdfPages } from "@/lib/pdf/render";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import {
  degrees,
  PDFDocument,
} from "pdf-lib";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const organizePdfTips = [
  {
    title: "Arrange pages before saving",
    description:
      "Use Move Up and Move Down to place every page in the required order.",
  },
  {
    title: "Select multiple pages",
    description:
      "Select several pages before using the toolbar to delete them together.",
  },
  {
    title: "Keep at least one page",
    description:
      "PDFNova will not allow every page to be removed from the document.",
  },
];

const organizePdfFaqs = [
  {
    question: "Can I rotate individual PDF pages?",
    answer:
      "Yes. Each page can be rotated separately in 90-degree steps.",
  },
  {
    question: "Does organizing change my original PDF?",
    answer:
      "No. PDFNova creates a separate organized copy and keeps the original file unchanged.",
  },
  {
    question: "Is my PDF uploaded?",
    answer:
      "No. The PDF is rendered and organized locally inside your browser.",
  },
];

const loadingSteps = [
  {
    label: "Reading PDF",
    description:
      "Opening the selected document and checking its pages.",
  },
  {
    label: "Creating previews",
    description:
      "Rendering page thumbnails for the visual organizer.",
  },
  {
    label: "Preparing workspace",
    description:
      "Loading the pages into the PDFNova organizer.",
  },
];

const savingSteps = [
  {
    label: "Reading page arrangement",
    description:
      "Checking the current order, rotations, and deleted pages.",
  },
  {
    label: "Building organized PDF",
    description:
      "Copying and rotating pages in the selected order.",
  },
  {
    label: "Preparing download",
    description:
      "Finalizing the updated PDF document.",
  },
];

export default function OrganizePdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<OrganizePageItem[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  function markDocumentChanged() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0];

    if (
      !selectedFile ||
      (selectedFile.type !== "application/pdf" &&
        !selectedFile.name.toLowerCase().endsWith(".pdf"))
    ) {
      const message = "Please select a valid PDF file.";

      setErrorMessage(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      const message =
        "The PDF file must not be larger than 25 MB.";

      setErrorMessage(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setPages([]);
    setSelectedPageIds([]);
    resetResultState();

    setIsLoading(true);
    setProgress(15);
    setCurrentStep(1);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      setProgress(35);
      setCurrentStep(2);

      const renderedPages = await renderPdfPages(
        selectedFile,
        {
          scale: 1.2,
          quality: 0.85,
        },
      );

      setProgress(85);
      setCurrentStep(3);

      const organizedPages: OrganizePageItem[] =
        renderedPages.map((page) => ({
          id: crypto.randomUUID(),
          originalPageIndex: page.pageNumber - 1,
          pageNumber: page.pageNumber,
          dataUrl: page.dataUrl,
          rotation: 0,
        }));

      if (organizedPages.length === 0) {
        throw new Error(
          "The selected PDF does not contain any readable pages.",
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 120),
      );

      setPages(organizedPages);
      setProgress(100);

      toast.success(
        `${organizedPages.length} ${
          organizedPages.length === 1
            ? "page"
            : "pages"
        } loaded successfully.`,
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to load this PDF. It may be damaged or password-protected.";

      setFile(null);
      setPages([]);
      setSelectedPageIds([]);
      setErrorMessage(message);

      toast.error(message);
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  function removeFile() {
    setFile(null);
    setPages([]);
    setSelectedPageIds([]);
    resetResultState();

    toast.success("PDF file removed.");
  }

  function startAgain() {
    setFile(null);
    setPages([]);
    setSelectedPageIds([]);
    resetResultState();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function togglePageSelection(pageId: string) {
    setSelectedPageIds((currentIds) =>
      currentIds.includes(pageId)
        ? currentIds.filter((id) => id !== pageId)
        : [...currentIds, pageId],
    );
  }

  function selectAllPages() {
    setSelectedPageIds(
      pages.map((page) => page.id),
    );
  }

  function clearSelection() {
    setSelectedPageIds([]);
  }

  function movePageUp(index: number) {
    if (index === 0 || isSaving) {
      return;
    }

    setPages((currentPages) => {
      const updatedPages = [...currentPages];

      [
        updatedPages[index - 1],
        updatedPages[index],
      ] = [
        updatedPages[index],
        updatedPages[index - 1],
      ];

      return updatedPages;
    });

    markDocumentChanged();
  }

  function movePageDown(index: number) {
    if (isSaving) {
      return;
    }

    setPages((currentPages) => {
      if (index === currentPages.length - 1) {
        return currentPages;
      }

      const updatedPages = [...currentPages];

      [
        updatedPages[index],
        updatedPages[index + 1],
      ] = [
        updatedPages[index + 1],
        updatedPages[index],
      ];

      return updatedPages;
    });

    markDocumentChanged();
  }

  function rotatePage(pageId: string) {
    if (isSaving) {
      return;
    }

    setPages((currentPages) =>
      currentPages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              rotation:
                (page.rotation + 90) % 360,
            }
          : page,
      ),
    );

    markDocumentChanged();
  }

  function deletePage(pageId: string) {
    if (isSaving) {
      return;
    }

    if (pages.length <= 1) {
      toast.error(
        "The PDF must keep at least one page.",
      );
      return;
    }

    setPages((currentPages) =>
      currentPages.filter(
        (page) => page.id !== pageId,
      ),
    );

    setSelectedPageIds((currentIds) =>
      currentIds.filter((id) => id !== pageId),
    );

    markDocumentChanged();
    toast.success("Page deleted.");
  }

  function deleteSelectedPages() {
    if (isSaving) {
      return;
    }

    if (selectedPageIds.length === 0) {
      toast.error(
        "Please select at least one page.",
      );
      return;
    }

    if (selectedPageIds.length === pages.length) {
      toast.error(
        "You must keep at least one page.",
      );
      return;
    }

    setPages((currentPages) =>
      currentPages.filter(
        (page) =>
          !selectedPageIds.includes(page.id),
      ),
    );

    setSelectedPageIds([]);
    markDocumentChanged();

    toast.success("Selected pages deleted.");
  }

  function downloadResultAgain() {
    if (!outputBytes || !outputFileName) {
      toast.error(
        "The organized PDF is no longer available.",
      );
      return;
    }

    downloadFile(
      outputBytes,
      outputFileName,
      "application/pdf",
    );

    toast("Download started", {
      description:
        "Your organized PDF is being downloaded again.",
    });
  }

  async function saveOrganizedPdf() {
    if (!file) {
      const message = "Please select a PDF file.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (pages.length === 0) {
      const message =
        "The PDF must contain at least one page.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setOutputBytes(null);
    setOutputFileName("");
    setProgress(15);
    setCurrentStep(1);

    try {
      const sourceBytes =
        await file.arrayBuffer();

      const sourcePdf =
        await PDFDocument.load(sourceBytes);

      const outputPdf =
        await PDFDocument.create();

      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      setProgress(35);
      setCurrentStep(2);

      for (
        let index = 0;
        index < pages.length;
        index += 1
      ) {
        const pageItem = pages[index];

        const [copiedPage] =
          await outputPdf.copyPages(
            sourcePdf,
            [pageItem.originalPageIndex],
          );

        const originalRotation =
          copiedPage.getRotation().angle;

        const finalRotation =
          (originalRotation +
            pageItem.rotation) %
          360;

        copiedPage.setRotation(
          degrees(finalRotation),
        );

        outputPdf.addPage(copiedPage);

        const pageProgress =
          35 +
          Math.round(
            ((index + 1) / pages.length) * 47,
          );

        setProgress(
          Math.min(82, pageProgress),
        );
      }

      setProgress(88);
      setCurrentStep(3);

      const generatedBytes =
        await outputPdf.save();

      const originalName =
        file.name.replace(/\.pdf$/i, "");

      const generatedFileName = `${
        originalName || "pdfnova"
      }-organized.pdf`;

      await new Promise((resolve) =>
        setTimeout(resolve, 150),
      );

      downloadFile(
        generatedBytes,
        generatedFileName,
        "application/pdf",
      );

      setOutputBytes(generatedBytes);
      setOutputFileName(generatedFileName);
      setProgress(100);

      addRecentFile({
        fileName: generatedFileName,
        toolName: "Organize PDF",
      });

      toast.success(
        "PDF organized successfully!",
      );

      toast("Download started", {
        description:
          "Your organized PDF is being downloaded.",
      });
    } catch (error) {
      console.error(error);

      const message =
        "The PDF could not be organized. It may be damaged or password-protected.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ToolLayout
      label="Organize PDF"
      title="Reorder, rotate, and delete PDF pages"
      description="Upload a PDF, arrange its pages visually, remove unwanted pages, rotate individual pages, and download the updated document."
      tips={organizePdfTips}
      faqs={organizePdfFaqs}
      maxWidthClassName="max-w-7xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag the PDF you want to organize."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isLoading || isSaving}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              isLoading || isSaving
                ? undefined
                : removeFile
            }
            removeLabel="Remove PDF file"
            statusText={
              isLoading
                ? "Loading PDF page previews"
                : isSaving
                  ? "Creating organized PDF"
                  : outputBytes
                    ? "Organized PDF created successfully"
                    : errorMessage
                      ? "PDF organization needs attention"
                      : `${pages.length} ${
                          pages.length === 1
                            ? "page"
                            : "pages"
                        } ready to organize`
            }
            progress={
              isLoading || isSaving
                ? progress
                : undefined
            }
          />

          {isLoading && (
            <ProgressCard
              title="Loading PDF pages"
              description="PDFNova is creating visual previews for the page organizer."
              progress={progress}
              currentStep={currentStep}
              steps={loadingSteps}
              estimatedTime="May take a few seconds"
            />
          )}
        </div>
      )}

      {pages.length > 0 && !isLoading && (
        <div className="mt-8 space-y-6">
          <OrganizeToolbar
            totalPages={pages.length}
            selectedPages={
              selectedPageIds.length
            }
            onSelectAll={selectAllPages}
            onClearSelection={clearSelection}
            onDeleteSelected={
              deleteSelectedPages
            }
            onSavePdf={saveOrganizedPdf}
            isSaving={isSaving}
          />

          <PageGrid
            pages={pages}
            selectedPageIds={
              selectedPageIds
            }
            onToggleSelect={
              togglePageSelection
            }
            onMoveUp={movePageUp}
            onMoveDown={movePageDown}
            onRotate={rotatePage}
            onDelete={deletePage}
          />

          {isSaving && (
            <ProgressCard
              title="Creating organized PDF"
              description="PDFNova is applying the new page order, rotations, and deletions."
              progress={progress}
              currentStep={currentStep}
              steps={savingSteps}
              estimatedTime="A few seconds"
            />
          )}

          {!isSaving && outputBytes && (
            <SuccessCard
              title="Your organized PDF is ready"
              description="The page order and rotations were applied successfully, and the updated PDF was downloaded."
              fileName={outputFileName}
              onDownloadAgain={
                downloadResultAgain
              }
              onStartAgain={startAgain}
              downloadLabel="Download PDF Again"
              resetLabel="Organize Another PDF"
            />
          )}

          {!isSaving && errorMessage && (
            <ErrorCard
              title="PDF organization failed"
              description={errorMessage}
              reasons={[
                "The PDF may be damaged or password-protected.",
                "The browser may not have enough memory to process all pages.",
                "One or more PDF pages may contain unsupported content.",
              ]}
              onRetry={saveOrganizedPdf}
              onReset={startAgain}
              retryLabel="Retry Save"
              resetLabel="Choose Another PDF"
            />
          )}
        </div>
      )}

      {!file && errorMessage && (
        <div className="mt-8">
          <ErrorCard
            title="Unable to load PDF"
            description={errorMessage}
            reasons={[
              "The PDF may be damaged.",
              "The PDF may be password-protected.",
              "The selected file may not be a genuine PDF document.",
            ]}
            onReset={startAgain}
            resetLabel="Choose Another PDF"
          />
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Your PDF is processed locally inside your browser and is not uploaded.
      </div>
    </ToolLayout>
  );
}