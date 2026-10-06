"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import {
  calculateHeaderFooterPlacement,
  renderHeaderFooterTemplate,
  type PdfHeaderFooterAlignment,
  type PdfHeaderFooterSlot,
} from "@/lib/pdf/headerFooterGeometry";
import { addRecentFile } from "@/lib/storage/recentFiles";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ShieldCheck,
  Type,
} from "lucide-react";
import {
  ChangeEvent,
  useRef,
  useState,
} from "react";
import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { toast } from "sonner";

const MAX_FILE_SIZE =
  25 * 1024 * 1024;
const POINTS_PER_MM = 72 / 25.4;

const tips = [
  {
    title: "Use page number tokens",
    description:
      "Add {page} for the current page and {total} for the total number of pages. Example: Page {page} of {total}.",
  },
  {
    title: "Header and footer are independent",
    description:
      "Use either one or both, with separate left, center, or right alignment.",
  },
  {
    title: "Existing rotation is respected",
    description:
      "Placement is calculated against each page's visible orientation so rotated pages remain readable.",
  },
];

const faqs = [
  {
    question:
      "Can I add page numbers automatically?",
    answer:
      "Yes. Put {page} and {total} in the header or footer text. Kukureku replaces the tokens on every page.",
  },
  {
    question:
      "Can I use different alignment for the header and footer?",
    answer:
      "Yes. Header and footer alignment can each be set to left, center, or right.",
  },
  {
    question: "Is my PDF uploaded?",
    answer:
      "No. Header and footer text is added locally inside your browser.",
  },
];

function hexToRgb(
  hexColor: string,
) {
  const clean =
    hexColor.replace("#", "");

  if (
    !/^[0-9a-f]{6}$/i.test(
      clean,
    )
  ) {
    throw new Error(
      "Please choose a valid text color.",
    );
  }

  return {
    red:
      Number.parseInt(
        clean.slice(0, 2),
        16,
      ) / 255,
    green:
      Number.parseInt(
        clean.slice(2, 4),
        16,
      ) / 255,
    blue:
      Number.parseInt(
        clean.slice(4, 6),
        16,
      ) / 255,
  };
}

function AlignmentButtons({
  value,
  onChange,
  disabled,
}: {
  value: PdfHeaderFooterAlignment;
  onChange: (
    value: PdfHeaderFooterAlignment,
  ) => void;
  disabled: boolean;
}) {
  const choices = [
    ["left", "Left", AlignLeft],
    [
      "center",
      "Center",
      AlignCenter,
    ],
    [
      "right",
      "Right",
      AlignRight,
    ],
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2">
      {choices.map(
        ([choice, label, Icon]) => (
          <button
            key={choice}
            type="button"
            onClick={() =>
              onChange(choice)
            }
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              value === choice
                ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                : "border-gray-200 text-gray-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200"
            }`}
          >
            <Icon size={17} />
            <span className="hidden sm:inline">
              {label}
            </span>
          </button>
        ),
      )}
    </div>
  );
}

export default function HeaderFooterPdfPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [file, setFile] =
    useState<File | null>(null);
  const [pageCount, setPageCount] =
    useState(0);

  const [
    headerText,
    setHeaderText,
  ] = useState("");

  const [
    footerText,
    setFooterText,
  ] = useState(
    "Page {page} of {total}",
  );

  const [
    headerAlignment,
    setHeaderAlignment,
  ] =
    useState<PdfHeaderFooterAlignment>(
      "center",
    );

  const [
    footerAlignment,
    setFooterAlignment,
  ] =
    useState<PdfHeaderFooterAlignment>(
      "center",
    );

  const [fontSize, setFontSize] =
    useState(10);
  const [marginMm, setMarginMm] =
    useState(10);
  const [textColor, setTextColor] =
    useState("#4b5563");

  const [
    isProcessing,
    setIsProcessing,
  ] = useState(false);

  const [
    outputBytes,
    setOutputBytes,
  ] =
    useState<Uint8Array | null>(
      null,
    );

  const [
    outputFileName,
    setOutputFileName,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

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
      (selectedFile.type !==
        "application/pdf" &&
        !selectedFile.name
          .toLowerCase()
          .endsWith(".pdf"))
    ) {
      const message =
        "Please select a valid PDF file.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (
      selectedFile.size >
      MAX_FILE_SIZE
    ) {
      const message =
        "The PDF file must not be larger than 25 MB.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    try {
      const pdf =
        await PDFDocument.load(
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

      toast.success(
        `${count} ${count === 1 ? "page" : "pages"} ready.`,
      );
    } catch {
      const message =
        "Unable to open this PDF. It may be damaged or password-protected.";

      setFile(null);
      setPageCount(0);
      setErrorMessage(message);
      toast.error(message);
    }
  }

  function startAgain() {
    setFile(null);
    setPageCount(0);
    setHeaderText("");
    setFooterText(
      "Page {page} of {total}",
    );
    setHeaderAlignment(
      "center",
    );
    setFooterAlignment(
      "center",
    );
    setFontSize(10);
    setMarginMm(10);
    setTextColor("#4b5563");
    resetResult();

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }
  }

  function handleTextChange(
    slot: PdfHeaderFooterSlot,
    value: string,
  ) {
    if (slot === "header") {
      setHeaderText(value);
    } else {
      setFooterText(value);
    }

    resetResult();
  }

  async function addHeaderFooter() {
    if (!file) {
      setErrorMessage(
        "Please select a PDF file.",
      );
      return;
    }

    if (
      !headerText.trim() &&
      !footerText.trim()
    ) {
      setErrorMessage(
        "Enter header text, footer text, or both.",
      );
      return;
    }

    if (
      !Number.isFinite(fontSize) ||
      fontSize < 6 ||
      fontSize > 36
    ) {
      setErrorMessage(
        "Font size must be between 6 and 36 pt.",
      );
      return;
    }

    if (
      !Number.isFinite(marginMm) ||
      marginMm < 3 ||
      marginMm > 50
    ) {
      setErrorMessage(
        "Margin must be between 3 and 50 mm.",
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");
    setOutputBytes(null);
    setOutputFileName("");

    try {
      const pdf =
        await PDFDocument.load(
          await file.arrayBuffer(),
        );

      const font =
        await pdf.embedFont(
          StandardFonts.Helvetica,
        );

      const color =
        hexToRgb(textColor);

      const margin =
        marginMm *
        POINTS_PER_MM;

      const totalPages =
        pdf.getPageCount();

      pdf
        .getPages()
        .forEach(
          (page, pageIndex) => {
            const pageNumber =
              pageIndex + 1;

            const entries = [
              {
                slot: "header" as const,
                template:
                  headerText.trim(),
                alignment:
                  headerAlignment,
              },
              {
                slot: "footer" as const,
                template:
                  footerText.trim(),
                alignment:
                  footerAlignment,
              },
            ];

            for (const entry of entries) {
              if (
                !entry.template
              ) {
                continue;
              }

              const rendered =
                renderHeaderFooterTemplate(
                  entry.template,
                  pageNumber,
                  totalPages,
                );

              const textWidth =
                font.widthOfTextAtSize(
                  rendered,
                  fontSize,
                );

              const placement =
                calculateHeaderFooterPlacement(
                  {
                    pageWidth:
                      page.getWidth(),
                    pageHeight:
                      page.getHeight(),
                    rotationAngle:
                      page.getRotation()
                        .angle,
                    textWidth,
                    fontSize,
                    margin,
                    alignment:
                      entry.alignment,
                    slot:
                      entry.slot,
                  },
                );

              const availableWidth =
                placement.visibleWidth -
                margin * 2;

              if (
                textWidth >
                availableWidth
              ) {
                throw new Error(
                  `${entry.slot === "header" ? "Header" : "Footer"} text is too long for page ${pageNumber}. Shorten the text, reduce the font size, or reduce the margin.`,
                );
              }

              const minVisibleHeight =
                margin +
                fontSize +
                4;

              if (
                placement.visibleHeight <
                minVisibleHeight * 2
              ) {
                throw new Error(
                  `Page ${pageNumber} is too small for the selected font size and margin.`,
                );
              }

              page.drawText(
                rendered,
                {
                  x: placement.x,
                  y: placement.y,
                  size: fontSize,
                  font,
                  color: rgb(
                    color.red,
                    color.green,
                    color.blue,
                  ),
                  rotate: degrees(
                    placement.rotation,
                  ),
                },
              );
            }
          },
        );

      const bytes =
        await pdf.save();

      const baseName =
        file.name.replace(
          /\.pdf$/i,
          "",
        ) || "kukureku";

      const generatedFileName =
        `${baseName}-header-footer.pdf`;

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
          "Header & Footer PDF",
      });

      toast.success(
        "Header and footer added successfully.",
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "The header and footer could not be added.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ToolLayout
      label="Header & Footer PDF"
      title="Add headers, footers, and page numbers privately"
      description="Add custom header or footer text to every PDF page, including automatic page-number tokens. Choose alignment, font size, margin, and color without uploading your document."
      tips={tips}
      faqs={faqs}
      howToTitle="How to add headers and footers to a PDF"
      howToSteps={[
        {
          title:
            "Choose one PDF",
          description:
            "Select the PDF you want to label, up to 25 MB.",
        },
        {
          title:
            "Customize the text",
          description:
            "Enter header or footer text, use page-number tokens, and choose alignment, font size, margin, and color.",
        },
        {
          title:
            "Apply and download",
          description:
            "Add the text locally to every page and download the new PDF.",
        },
      ]}
      maxWidthClassName="max-w-6xl"
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
        title="Select one PDF"
        description="Choose or drag the PDF you want to add a header, footer, or page numbers to."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
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
                ? "Adding header and footer"
                : outputBytes
                  ? "Updated PDF created successfully"
                  : `${pageCount} ${pageCount === 1 ? "page" : "pages"} ready`
            }
          />

          {!outputBytes && (
            <>
              <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      <Type size={21} />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-950 dark:text-white">
                        Header text
                      </h2>

                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Leave blank if you only need a footer.
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={
                      headerText
                    }
                    onChange={(
                      event,
                    ) =>
                      handleTextChange(
                        "header",
                        event.target
                          .value,
                      )
                    }
                    rows={3}
                    maxLength={160}
                    placeholder="Example: Confidential"
                    disabled={
                      isProcessing
                    }
                    className="mt-5 w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                  />

                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                      Alignment
                    </p>

                    <AlignmentButtons
                      value={
                        headerAlignment
                      }
                      onChange={(
                        value,
                      ) => {
                        setHeaderAlignment(
                          value,
                        );
                        resetResult();
                      }}
                      disabled={
                        isProcessing
                      }
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                      <Type size={21} />
                    </div>

                    <div>
                      <h2 className="font-bold text-gray-950 dark:text-white">
                        Footer text
                      </h2>

                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        Use {"{page}"} and {"{total}"} for automatic numbering.
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={
                      footerText
                    }
                    onChange={(
                      event,
                    ) =>
                      handleTextChange(
                        "footer",
                        event.target
                          .value,
                      )
                    }
                    rows={3}
                    maxLength={160}
                    placeholder="Page {page} of {total}"
                    disabled={
                      isProcessing
                    }
                    className="mt-5 w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                  />

                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                      Alignment
                    </p>

                    <AlignmentButtons
                      value={
                        footerAlignment
                      }
                      onChange={(
                        value,
                      ) => {
                        setFooterAlignment(
                          value,
                        );
                        resetResult();
                      }}
                      disabled={
                        isProcessing
                      }
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-bold text-gray-950 dark:text-white">
                  Appearance
                </h2>

                <div className="mt-5 grid gap-5 sm:grid-cols-3">
                  <label className="text-sm font-semibold text-gray-900 dark:text-white">
                    Font size (pt)
                    <input
                      type="number"
                      min="6"
                      max="36"
                      step="1"
                      value={
                        fontSize
                      }
                      onChange={(
                        event,
                      ) => {
                        setFontSize(
                          Number(
                            event
                              .target
                              .value,
                          ),
                        );
                        resetResult();
                      }}
                      disabled={
                        isProcessing
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    />
                  </label>

                  <label className="text-sm font-semibold text-gray-900 dark:text-white">
                    Edge margin (mm)
                    <input
                      type="number"
                      min="3"
                      max="50"
                      step="1"
                      value={
                        marginMm
                      }
                      onChange={(
                        event,
                      ) => {
                        setMarginMm(
                          Number(
                            event
                              .target
                              .value,
                          ),
                        );
                        resetResult();
                      }}
                      disabled={
                        isProcessing
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    />
                  </label>

                  <label className="text-sm font-semibold text-gray-900 dark:text-white">
                    Text color
                    <div className="mt-2 flex h-[50px] items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950">
                      <input
                        type="color"
                        value={
                          textColor
                        }
                        onChange={(
                          event,
                        ) => {
                          setTextColor(
                            event
                              .target
                              .value,
                          );
                          resetResult();
                        }}
                        disabled={
                          isProcessing
                        }
                        className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0"
                      />

                      <span className="font-mono text-sm text-gray-600 dark:text-slate-300">
                        {textColor}
                      </span>
                    </div>
                  </label>
                </div>

                <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-950 dark:bg-blue-950/30 dark:text-blue-200">
                  <strong>
                    Page-number tokens:
                  </strong>{" "}
                  {"{page}"} becomes the current page number and {"{total}"} becomes the document page count.
                </div>
              </section>
            </>
          )}

          {!outputBytes &&
            !errorMessage && (
              <ActionButton
                isLoading={
                  isProcessing
                }
                loadingText="Adding header and footer..."
                loadingSubtitle="Writing the selected text to every page locally in your browser."
                buttonText="Add Header & Footer and Download"
                subtitle="Creates a new PDF. Your original document stays unchanged."
                onClick={
                  addHeaderFooter
                }
                disabled={
                  isProcessing
                }
              />
            )}

          {!isProcessing &&
            outputBytes && (
              <SuccessCard
                title="Your updated PDF is ready"
                description="The selected header, footer, or page-number text was added successfully."
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
                downloadLabel="Download PDF Again"
                resetLabel="Update Another PDF"
              />
            )}

          {!isProcessing &&
            errorMessage && (
              <ErrorCard
                title="Header and footer needs attention"
                description={
                  errorMessage
                }
                reasons={[
                  "The text may be too long for the selected page, font size, or margin.",
                  "The PDF may be damaged or password-protected.",
                  "A page may use an unusually small or unsupported page structure.",
                ]}
                onRetry={
                  file
                    ? addHeaderFooter
                    : undefined
                }
                onReset={
                  startAgain
                }
                retryLabel="Retry"
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
        Your PDF is updated locally inside your browser and is not uploaded.
      </div>
    </ToolLayout>
  );
}
