"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import WorkspaceDerivedOutputNotice from "@/components/workspace/WorkspaceDerivedOutputNotice";
import { downloadFile } from "@/lib/downloadFile";
import {
  removePdfPagesInPlace,
} from "@/lib/pdf/pageOrder";
import {
  assertPageCopySafe,
} from "@/lib/pdf/pdfInputSafety";
import {
  loadPdfWithoutMetadataMutation,
  savePdfWithoutFormAppearanceMutation,
} from "@/lib/pdf/safeDocument";
import {
  addRecentFile,
} from "@/lib/storage/recentFiles";
import {
  saveBranchedPdfToWorkspace,
} from "@/lib/storage/workspaceContinuity";
import type {
  WorkspaceFileSummary,
} from "@/lib/storage/workspaceFiles";
import {
  ShieldCheck,
} from "lucide-react";
import {
  ChangeEvent,
  useRef,
  useState,
} from "react";
import {
  PDFDocument,
} from "pdf-lib";
import {
  toast,
} from "sonner";

const MAX =
  25 * 1024 * 1024;

export type PageMode =
  | "extract"
  | "delete";

export type Props = {
  mode: PageMode;
  label: string;
  title: string;
  description: string;
};

function parsePages(
  value: string,
  total: number,
) {
  const selected =
    new Set<number>();

  for (const raw of value.split(",")) {
    const token =
      raw.trim();

    if (!token) {
      continue;
    }

    const range =
      token.match(
        /^(\d+)\s*-\s*(\d+)$/,
      );

    if (range) {
      const start =
        Number(range[1]);
      const end =
        Number(range[2]);

      if (
        start < 1 ||
        end < 1 ||
        start > total ||
        end > total ||
        start > end
      ) {
        throw new Error(
          `Use page numbers from 1 to ${total}.`,
        );
      }

      for (
        let page = start;
        page <= end;
        page += 1
      ) {
        selected.add(
          page - 1,
        );
      }

      continue;
    }

    if (
      /^\d+$/.test(
        token,
      )
    ) {
      const page =
        Number(token);

      if (
        page < 1 ||
        page > total
      ) {
        throw new Error(
          `Use page numbers from 1 to ${total}.`,
        );
      }

      selected.add(
        page - 1,
      );
      continue;
    }

    throw new Error(
      "Enter pages like 1,3,5-8.",
    );
  }

  if (!selected.size) {
    throw new Error(
      "Enter at least one page number.",
    );
  }

  return [
    ...selected,
  ].sort(
    (left, right) =>
      left - right,
  );
}

export default function PageSelectionTool({
  mode,
  label,
  title,
  description,
}: Props) {
  const input =
    useRef<HTMLInputElement>(
      null,
    );
  const [file, setFile] =
    useState<File | null>(
      null,
    );
  const [total, setTotal] =
    useState(0);
  const [pages, setPages] =
    useState("");
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

  function reset() {
    setFile(null);
    setTotal(0);
    setPages("");
    setOut(null);
    setName("");
    setError("");
    setWorkspaceOutput(
      null,
    );

    if (input.current) {
      input.current.value =
        "";
    }
  }

  async function choose(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0];

    event.target.value =
      "";

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
      MAX
    ) {
      setError(
        "The PDF file must not be larger than 25 MB.",
      );
      return;
    }

    try {
      const pdf =
        await loadPdfWithoutMetadataMutation(
          await selectedFile.arrayBuffer(),
        );

      if (
        mode ===
        "extract"
      ) {
        assertPageCopySafe(
          pdf,
          "Extract PDF Pages",
        );
      }

      setFile(
        selectedFile,
      );
      setTotal(
        pdf.getPageCount(),
      );
      setPages("");
      setOut(null);
      setError("");
      setWorkspaceOutput(
        null,
      );

      toast.success(
        `${pdf.getPageCount()} pages ready.`,
      );
    } catch (selectionError) {
      setError(
        selectionError instanceof
          Error
          ? selectionError.message
          : "Unable to open this PDF. It may be damaged or password-protected.",
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
      const source =
        await loadPdfWithoutMetadataMutation(
          await file.arrayBuffer(),
        );

      if (
        mode ===
        "extract"
      ) {
        assertPageCopySafe(
          source,
          "Extract PDF Pages",
        );
      }

      const chosen =
        parsePages(
          pages,
          source.getPageCount(),
        );
      let result:
        PDFDocument;

      if (
        mode ===
        "extract"
      ) {
        result =
          await PDFDocument.create();
        const copied =
          await result.copyPages(
            source,
            chosen,
          );

        copied.forEach(
          (page) =>
            result.addPage(
              page,
            ),
        );
      } else {
        result = source;
        removePdfPagesInPlace(
          result,
          chosen,
        );
      }

      const bytes =
        await savePdfWithoutFormAppearanceMutation(
          result,
        );
      const base =
        file.name.replace(
          /\.pdf$/i,
          "",
        ) ||
        "kukureku";
      const output =
        `${base}-${
          mode === "extract"
            ? "extracted"
            : "pages-removed"
        }.pdf`;

      downloadFile(
        bytes,
        output,
        "application/pdf",
      );
      setOut(bytes);
      setName(output);

      addRecentFile({
        fileName: output,
        toolName: label,
      });

      if (
        mode ===
        "extract"
      ) {
        setWorkspaceOutput(
          await saveBranchedPdfToWorkspace(
            {
              sourceFile:
                file,
              outputBytes:
                bytes,
              outputFileName:
                output,
              operationId:
                "extract-pdf-pages",
              operationLabel:
                "Extract PDF Pages",
            },
          ),
        );
      } else {
        setWorkspaceOutput(
          null,
        );
      }

      toast.success(
        "PDF processed successfully.",
      );
    } catch (runError) {
      setError(
        runError instanceof
          Error
          ? runError.message
          : "The PDF could not be processed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolLayout
      label={label}
      title={title}
      description={
        description
      }
      tips={[
        {
          title:
            "Use page numbers or ranges",
          description:
            "Enter selections such as 1,3,5-8.",
        },
        {
          title:
            "Original stays unchanged",
          description:
            "A new PDF is created instead of modifying your source.",
        },
        {
          title:
            "Private processing",
          description:
            "The PDF is processed locally in your browser.",
        },
      ]}
      faqs={[
        {
          question:
            "Can I select several pages?",
          answer:
            "Yes. Combine individual pages and ranges, for example 1,3,5-8.",
        },
        {
          question:
            "Are files uploaded?",
          answer:
            "No. Processing happens locally in your browser.",
        },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <FileUploader
        fileInputRef={input}
        onFileSelection={
          choose
        }
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag your PDF."
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
                  ? "New PDF created successfully"
                  : `${total} pages ready`
            }
          />

          {!out && (
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <label
                className="text-sm font-bold text-gray-950 dark:text-white"
                htmlFor="pages"
              >
                Pages to{" "}
                {mode}
              </label>
              <input
                id="pages"
                value={pages}
                onChange={(
                  event,
                ) =>
                  setPages(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Example: 1,3,5-8"
                className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <p className="mt-2 text-sm text-gray-500">
                This PDF has{" "}
                {total} pages.
              </p>
            </div>
          )}

          {!out &&
            !error && (
              <ActionButton
                isLoading={
                  busy
                }
                loadingText="Processing PDF..."
                loadingSubtitle="Working locally in your browser."
                buttonText={
                  mode ===
                  "extract"
                    ? "Extract and Download Pages"
                    : "Delete Pages and Download"
                }
                subtitle="Your original PDF stays unchanged."
                onClick={run}
                disabled={
                  busy
                }
              />
            )}

          {!busy &&
            out && (
              <>
                <SuccessCard
                  title="Your new PDF is ready"
                  description="The requested page operation was completed successfully."
                  fileName={
                    name
                  }
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
                {mode ===
                  "extract" && (
                  <WorkspaceDerivedOutputNotice
                    file={
                      workspaceOutput
                    }
                  />
                )}
              </>
            )}

          {!busy &&
            error && (
              <ErrorCard
                title="PDF processing needs attention"
                description={
                  error
                }
                reasons={[
                  "Check the page numbers and ranges.",
                  "The PDF may be damaged or password-protected.",
                  ...(mode ===
                  "extract"
                    ? [
                        "Interactive PDF forms must be flattened before page extraction.",
                      ]
                    : []),
                ]}
                onRetry={
                  file
                    ? run
                    : undefined
                }
                onReset={
                  reset
                }
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
