"use client";

import Navbar from "@/components/Navbar";
import FileUploader from "@/components/pdf/FileUploader";
import OrganizeToolbar from "@/components/pdf/OrganizeToolbar";
import PageGrid, {
  type OrganizePageItem,
} from "@/components/pdf/PageGrid";
import ToolHeader from "@/components/pdf/ToolHeader";
import { downloadFile } from "@/lib/downloadFile";
import { renderPdfPages } from "@/lib/pdf/render";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { FileText, ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { PDFDocument, degrees } from "pdf-lib";
import { toast } from "sonner";

export default function OrganizePdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<OrganizePageItem[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile || selectedFile.type !== "application/pdf") {
      toast.error("Please select a valid PDF file.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      toast.error("The PDF file must not be larger than 25 MB.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
    setPages([]);
    setSelectedPageIds([]);
    setIsLoading(true);

    try {
      const renderedPages = await renderPdfPages(selectedFile, {
        scale: 1.2,
        quality: 0.85,
      });

      const organizedPages: OrganizePageItem[] = renderedPages.map(
        (page) => ({
          id: crypto.randomUUID(),
          originalPageIndex: page.pageNumber - 1,
          pageNumber: page.pageNumber,
          dataUrl: page.dataUrl,
          rotation: 0,
        }),
      );

      setPages(organizedPages);

      toast.success(
        `${organizedPages.length} ${
          organizedPages.length === 1 ? "page" : "pages"
        } loaded successfully.`,
      );
    } catch (error) {
      console.error(error);
      setFile(null);

      toast.error(
        "Unable to load this PDF. It may be damaged or password-protected.",
      );
    } finally {
      setIsLoading(false);
      event.target.value = "";
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
    setSelectedPageIds(pages.map((page) => page.id));
  }

  function clearSelection() {
    setSelectedPageIds([]);
  }

  function movePageUp(index: number) {
    if (index === 0) {
      return;
    }

    setPages((currentPages) => {
      const updatedPages = [...currentPages];

      [updatedPages[index - 1], updatedPages[index]] = [
        updatedPages[index],
        updatedPages[index - 1],
      ];

      return updatedPages;
    });
  }

  function movePageDown(index: number) {
    setPages((currentPages) => {
      if (index === currentPages.length - 1) {
        return currentPages;
      }

      const updatedPages = [...currentPages];

      [updatedPages[index], updatedPages[index + 1]] = [
        updatedPages[index + 1],
        updatedPages[index],
      ];

      return updatedPages;
    });
  }

  function rotatePage(pageId: string) {
    setPages((currentPages) =>
      currentPages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              rotation: (page.rotation + 90) % 360,
            }
          : page,
      ),
    );
  }

  function deletePage(pageId: string) {
    setPages((currentPages) =>
      currentPages.filter((page) => page.id !== pageId),
    );

    setSelectedPageIds((currentIds) =>
      currentIds.filter((id) => id !== pageId),
    );

    toast.success("Page deleted.");
  }

  function deleteSelectedPages() {
    if (selectedPageIds.length === 0) {
      toast.error("Please select at least one page.");
      return;
    }

    if (selectedPageIds.length === pages.length) {
      toast.error("You must keep at least one page.");
      return;
    }

    setPages((currentPages) =>
      currentPages.filter(
        (page) => !selectedPageIds.includes(page.id),
      ),
    );

    setSelectedPageIds([]);

    toast.success("Selected pages deleted.");
  }

  async function saveOrganizedPdf() {
    if (!file) {
      toast.error("Please select a PDF file.");
      return;
    }

    if (pages.length === 0) {
      toast.error("The PDF must contain at least one page.");
      return;
    }

    setIsSaving(true);

    try {
      const sourceBytes = await file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(sourceBytes);
      const outputPdf = await PDFDocument.create();

      for (const pageItem of pages) {
        const [copiedPage] = await outputPdf.copyPages(sourcePdf, [
          pageItem.originalPageIndex,
        ]);

        const originalRotation = copiedPage.getRotation().angle;
        const finalRotation =
          (originalRotation + pageItem.rotation) % 360;

        copiedPage.setRotation(degrees(finalRotation));
        outputPdf.addPage(copiedPage);
      }

      const outputBytes = await outputPdf.save();
      const outputFileName = "pdfnova-organized.pdf";

      downloadFile(
        outputBytes,
        outputFileName,
        "application/pdf",
      );

      addRecentFile({
        fileName: outputFileName,
        toolName: "Organize PDF",
      });

      toast.success("PDF organized successfully!");

      toast("Download started", {
        description: "Your organized PDF is being downloaded.",
      });
    } catch (error) {
      console.error(error);

      toast.error(
        "The PDF could not be organized. It may be damaged or password-protected.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <ToolHeader
            label="Organize PDF"
            title="Reorder, rotate, and delete PDF pages"
            description="Upload a PDF, arrange its pages, remove unwanted pages, rotate individual pages, and download the updated document."
          />

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-8">
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              multiple={false}
              title="Select one PDF"
              description="Choose the PDF you want to organize."
              buttonText="Choose PDF"
              helperText="Maximum file size: 25 MB"
            />

            {file && (
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <FileText size={21} />
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">
                    {file.name}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 px-6 py-8 text-center">
                <p className="font-semibold text-blue-700">
                  Loading PDF pages...
                </p>

                <p className="mt-2 text-sm text-blue-600">
                  Large PDFs may take a little longer.
                </p>
              </div>
            )}

            {pages.length > 0 && (
              <div className="mt-8 space-y-6">
                <OrganizeToolbar
                  totalPages={pages.length}
                  selectedPages={selectedPageIds.length}
                  onSelectAll={selectAllPages}
                  onClearSelection={clearSelection}
                  onDeleteSelected={deleteSelectedPages}
                  onSavePdf={saveOrganizedPdf}
                  isSaving={isSaving}
                />

                <PageGrid
                  pages={pages}
                  selectedPageIds={selectedPageIds}
                  onToggleSelect={togglePageSelection}
                  onMoveUp={movePageUp}
                  onMoveDown={movePageDown}
                  onRotate={rotatePage}
                  onDelete={deletePage}
                />
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500">
              <ShieldCheck
                size={18}
                className="shrink-0 text-emerald-600"
              />
              Your PDF is processed inside your browser and is not uploaded.
            </div>
          </section>
        </div>
      </main>
    </>
  );
}