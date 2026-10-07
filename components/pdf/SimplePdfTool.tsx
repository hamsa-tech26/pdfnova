"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import WorkspaceDerivedOutputNotice from "@/components/workspace/WorkspaceDerivedOutputNotice";
import { downloadFile } from "@/lib/downloadFile";
import { calculateHeaderFooterPlacement } from "@/lib/pdf/headerFooterGeometry";
import { reversePdfPagesInPlace } from "@/lib/pdf/pageOrder";
import {
  loadPdfWithoutMetadataMutation,
  savePdfWithoutFormAppearanceMutation,
} from "@/lib/pdf/safeDocument";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { saveDerivedPdfToWorkspace } from "@/lib/storage/workspaceContinuity";
import type { WorkspaceFileSummary } from "@/lib/storage/workspaceFiles";
import { ShieldCheck } from "lucide-react";
import {
  ChangeEvent,
  useRef,
  useState,
} from "react";
import {
  degrees,
  StandardFonts,
  rgb,
} from "pdf-lib";

type Mode =
  | "reverse"
  | "metadata"
  | "numbers";

export default function SimplePdfTool({
  mode,
}: Readonly<{
  mode: Mode;
}>) {
  const input =
    useRef<HTMLInputElement>(null);
  const [file, setFile] =
    useState<File | null>(null);
  const [busy, setBusy] =
    useState(false);
  const [out, setOut] =
    useState<Uint8Array | null>(
      null,
    );
  const [name, setName] =
    useState("");
  const [error, setError] =
    useState("");
  const [
    workspaceOutput,
    setWorkspaceOutput,
  ] = useState<WorkspaceFileSummary | null>(
    null,
  );

  const config = {
    reverse: {
      label: "Reverse PDF Pages",
      title:
        "Reverse PDF page order privately",
      description:
        "Reverse the page order of a PDF in one click, entirely inside your browser.",
      button:
        "Reverse and Download PDF",
      suffix: "reversed",
      operationId:
        "reverse-pdf",
    },
    metadata: {
      label:
        "Remove PDF Metadata",
      title:
        "Remove PDF metadata privately",
      description:
        "Clear common document metadata such as title, author, subject, keywords, creator and producer locally in your browser.",
      button:
        "Remove Metadata and Download",
      suffix:
        "metadata-removed",
      operationId:
        "remove-metadata",
    },
    numbers: {
      label: "Add Page Numbers",
      title:
        "Add page numbers to PDF privately",
      description:
        "Add simple centered page numbers to every PDF page locally in your browser.",
      button:
        "Add Page Numbers and Download",
      suffix: "numbered",
      operationId:
        "add-page-numbers",
    },
  }[mode];

  const reset = () => {
    setFile(null);
    setOut(null);
    setName("");
    setError("");
    setWorkspaceOutput(null);

    if (input.current) {
      input.current.value = "";
    }
  };

  async function choose(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0];

    event.target.value = "";

    if (
      !selectedFile ||
      (!selectedFile.name
        .toLowerCase()
        .endsWith(".pdf") &&
        selectedFile.type !==
          "application/pdf")
    ) {
      setError(
        "Please select a valid PDF file.",
      );
      return;
    }

    if (
      selectedFile.size >
      25 * 1024 * 1024
    ) {
      setError(
        "The PDF file must not be larger than 25 MB.",
      );
      return;
    }

    try {
      await loadPdfWithoutMetadataMutation(
        await selectedFile.arrayBuffer(),
      );
      setFile(selectedFile);
      setOut(null);
      setError("");
      setWorkspaceOutput(null);
    } catch {
      setError(
        "Unable to open this PDF. It may be damaged or password-protected.",
      );
    }
  }

  async function run() {
    if (!file) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const pdf =
        await loadPdfWithoutMetadataMutation(
          await file.arrayBuffer(),
        );

      if (mode === "reverse") {
        reversePdfPagesInPlace(
          pdf,
        );
      } else if (
        mode === "metadata"
      ) {
        pdf.setTitle("");
        pdf.setAuthor("");
        pdf.setSubject("");
        pdf.setKeywords([]);
        pdf.setCreator("");
        pdf.setProducer("");
      } else {
        const font =
          await pdf.embedFont(
            StandardFonts.Helvetica,
          );
        const pages =
          pdf.getPages();

        pages.forEach(
          (page, index) => {
            const text =
              `${index + 1}`;
            const size = 10;
            const width =
              font.widthOfTextAtSize(
                text,
                size,
              );
            const placement =
              calculateHeaderFooterPlacement(
                {
                  box:
                    page.getCropBox(),
                  rotationAngle:
                    page.getRotation()
                      .angle,
                  textWidth:
                    width,
                  fontSize: size,
                  margin: 18,
                  alignment:
                    "center",
                  slot: "footer",
                },
              );

            page.drawText(text, {
              x: placement.x,
              y: placement.y,
              size,
              font,
              color: rgb(
                0.25,
                0.25,
                0.25,
              ),
              rotate: degrees(
                placement.rotation,
              ),
            });
          },
        );
      }

      const bytes =
        await savePdfWithoutFormAppearanceMutation(
          pdf,
        );
      const output =
        `${
          file.name.replace(
            /\.pdf$/i,
            "",
          ) || "kukureku"
        }-${config.suffix}.pdf`;

      downloadFile(
        bytes,
        output,
        "application/pdf",
      );
      setOut(bytes);
      setName(output);

      addRecentFile({
        fileName: output,
        toolName: config.label,
      });

      const saved =
        await saveDerivedPdfToWorkspace(
          {
            sourceFile: file,
            outputBytes: bytes,
            outputFileName:
              output,
            operationId:
              config.operationId,
            operationLabel:
              config.label,
          },
        );

      setWorkspaceOutput(
        saved,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The PDF could not be processed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolLayout
      label={config.label}
      title={config.title}
      description={
        config.description
      }
      tips={[
        {
          title:
            "Original stays unchanged",
          description:
            "Kukureku creates a separate output PDF.",
        },
        {
          title:
            "Private browser processing",
          description:
            "Your PDF is processed locally and is not uploaded.",
        },
        ...(mode === "metadata"
          ? [
              {
                title:
                  "Common metadata only",
                description:
                  "This clears common document information fields. It is not a forensic sanitizer for XMP, attachments, annotations, hidden layers, or other embedded objects.",
              },
            ]
          : []),
      ]}
      faqs={[
        {
          question:
            "Is my PDF uploaded?",
          answer:
            "No. Processing happens locally in your browser.",
        },
        ...(mode === "metadata"
          ? [
              {
                question:
                  "Does this remove every hidden trace?",
                answer:
                  "No. Remove PDF Metadata clears common title, author, subject, keywords, creator, and producer fields only; it does not inspect or remove every possible hidden object or metadata format.",
              },
            ]
          : []),
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <FileUploader
        fileInputRef={input}
        onFileSelection={choose}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose the PDF you want to process."
        buttonText="Choose PDF"
        helperText="PDF · Maximum 25 MB"
        disabled={busy}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              busy
                ? undefined
                : reset
            }
            removeLabel="Remove PDF"
            statusText={
              busy
                ? "Processing PDF"
                : out
                  ? "New PDF created"
                  : "Ready"
            }
          />

          {!out &&
            !error && (
              <ActionButton
                isLoading={
                  busy
                }
                loadingText="Processing PDF..."
                loadingSubtitle="Working locally in your browser."
                buttonText={
                  config.button
                }
                subtitle="Your original PDF stays unchanged."
                onClick={run}
                disabled={busy}
              />
            )}

          {!busy &&
            out && (
              <SuccessCard
                title="Your PDF is ready"
                description="Processing completed successfully."
                fileName={name}
                onDownloadAgain={() =>
                  downloadFile(
                    out,
                    name,
                    "application/pdf",
                  )
                }
                onStartAgain={
                  reset
                }
              />
            )}

          {!busy &&
            workspaceOutput && (
              <WorkspaceDerivedOutputNotice
                file={
                  workspaceOutput
                }
              />
            )}

          {!busy &&
            error && (
              <ErrorCard
                title="Processing failed"
                description={
                  error
                }
                reasons={[
                  "The PDF may be damaged or password-protected.",
                ]}
                onRetry={run}
                onReset={reset}
              />
            )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="text-emerald-600"
        />
        Your PDF stays on your device.
      </div>
    </ToolLayout>
  );
}
