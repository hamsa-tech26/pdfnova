"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SignaturePad from "@/components/pdf/SignaturePad";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import { renderPdfPages, type RenderedPdfPage } from "@/lib/pdf/render";
import { calculateSignaturePdfPlacement } from "@/lib/pdf/signaturePlacementGeometry";
import { addRecentFile } from "@/lib/storage/recentFiles";
import {
  ImagePlus,
  Keyboard,
  PenLine,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  ChangeEvent,
  PointerEvent,
  useRef,
  useState,
} from "react";
import {
  degrees,
  PDFDocument,
} from "pdf-lib";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_SIGNATURE_IMAGE_SIZE = 5 * 1024 * 1024;

type SignatureMode =
  | "draw"
  | "type"
  | "upload";

type SignaturePosition = {
  x: number;
  y: number;
};

const DEFAULT_POSITION: SignaturePosition = {
  x: 0.35,
  y: 0.72,
};

const tips = [
  {
    title: "Place the signature visually",
    description:
      "Choose the PDF page, then drag the signature on the page preview and adjust its size before saving.",
  },
  {
    title: "Draw, type, or upload",
    description:
      "Create a signature with your mouse, finger, or stylus; type a signature-style name; or upload a PNG/JPG signature image.",
  },
  {
    title: "Visual signature, not certificate signing",
    description:
      "This tool places a visible electronic signature image. It does not create a certificate-based cryptographic digital signature.",
  },
];

const faqs = [
  {
    question: "Is this a cryptographic digital signature?",
    answer:
      "No. Kukureku adds a visible electronic signature to the page. It does not create a certificate-backed digital signature or verify signer identity.",
  },
  {
    question: "Can I choose where the signature appears?",
    answer:
      "Yes. Select the page, drag the signature directly on the preview, and adjust its width before creating the signed copy.",
  },
  {
    question: "Is my PDF or signature uploaded?",
    answer:
      "No. The PDF preview, signature creation, and PDF update run locally inside your browser.",
  },
];

function dataUrlToBytes(
  dataUrl: string,
) {
  const commaIndex =
    dataUrl.indexOf(",");

  if (commaIndex < 0) {
    throw new Error(
      "The signature image is invalid.",
    );
  }

  const base64 =
    dataUrl.slice(
      commaIndex + 1,
    );

  const binary =
    window.atob(base64);

  const bytes =
    new Uint8Array(
      binary.length,
    );

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return bytes;
}

function readFileAsDataUrl(
  file: File,
) {
  return new Promise<string>(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        if (
          typeof reader.result ===
          "string"
        ) {
          resolve(reader.result);
        } else {
          reject(
            new Error(
              "Unable to read the signature image.",
            ),
          );
        }
      };

      reader.onerror = () =>
        reject(
          new Error(
            "Unable to read the signature image.",
          ),
        );

      reader.readAsDataURL(file);
    },
  );
}

function getImageAspect(
  dataUrl: string,
) {
  return new Promise<number>(
    (resolve, reject) => {
      const image =
        new Image();

      image.onload = () => {
        if (
          image.naturalWidth > 0 &&
          image.naturalHeight > 0
        ) {
          resolve(
            image.naturalWidth /
              image.naturalHeight,
          );
        } else {
          reject(
            new Error(
              "The signature image has invalid dimensions.",
            ),
          );
        }
      };

      image.onerror = () =>
        reject(
          new Error(
            "Unable to decode the signature image.",
          ),
        );

      image.src = dataUrl;
    },
  );
}

function createTypedSignature(
  value: string,
) {
  const text = value.trim();

  if (!text) {
    return null;
  }

  const canvas =
    document.createElement(
      "canvas",
    );

  let context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Canvas is not supported in this browser.",
    );
  }

  const font =
    '96px "Brush Script MT", "Segoe Script", cursive';

  context.font = font;

  const measuredWidth =
    context.measureText(
      text,
    ).width;

  canvas.width = Math.max(
    360,
    Math.min(
      1800,
      Math.ceil(
        measuredWidth + 120,
      ),
    ),
  );

  canvas.height = 220;

  context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Canvas is not supported in this browser.",
    );
  }

  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height,
  );

  context.font = font;
  context.fillStyle =
    "#111827";
  context.textBaseline =
    "middle";
  context.fillText(
    text,
    60,
    canvas.height / 2,
  );

  return {
    dataUrl:
      canvas.toDataURL(
        "image/png",
      ),
    aspectRatio:
      canvas.width /
      canvas.height,
  };
}

function clamp(
  value: number,
  min: number,
  max: number,
) {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

export default function SignPdfPage() {
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const signatureImageInputRef =
    useRef<HTMLInputElement>(null);

  const previewContainerRef =
    useRef<HTMLDivElement>(null);

  const previewRequestRef =
    useRef(0);

  const dragOffsetRef =
    useRef({
      x: 0,
      y: 0,
    });

  const isDraggingRef =
    useRef(false);

  const [file, setFile] =
    useState<File | null>(null);

  const [pageCount, setPageCount] =
    useState(0);

  const [
    selectedPage,
    setSelectedPage,
  ] = useState(1);

  const [preview, setPreview] =
    useState<RenderedPdfPage | null>(
      null,
    );

  const [
    isRenderingPreview,
    setIsRenderingPreview,
  ] = useState(false);

  const [
    signatureMode,
    setSignatureMode,
  ] =
    useState<SignatureMode>(
      "draw",
    );

  const [
    signatureDataUrl,
    setSignatureDataUrl,
  ] = useState<string | null>(
    null,
  );

  const [
    signatureAspect,
    setSignatureAspect,
  ] = useState(3);

  const [
    typedSignature,
    setTypedSignature,
  ] = useState("");

  const [
    uploadedSignatureName,
    setUploadedSignatureName,
  ] = useState("");

  const [
    signaturePosition,
    setSignaturePosition,
  ] =
    useState<SignaturePosition>(
      DEFAULT_POSITION,
    );

  const [
    signatureWidthRatio,
    setSignatureWidthRatio,
  ] = useState(0.3);

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

  async function renderSelectedPreview(
    targetFile: File,
    pageNumber: number,
  ) {
    const requestId =
      ++previewRequestRef.current;

    setIsRenderingPreview(
      true,
    );

    setErrorMessage("");

    try {
      const pages =
        await renderPdfPages(
          targetFile,
          {
            scale: 1.35,
            quality: 0.88,
            pageNumbers: [
              pageNumber,
            ],
            format: "jpeg",
          },
        );

      if (
        requestId !==
        previewRequestRef.current
      ) {
        return;
      }

      const rendered =
        pages[0];

      if (!rendered) {
        throw new Error(
          "Unable to render the selected page.",
        );
      }

      setPreview(rendered);
    } catch (error) {
      if (
        requestId !==
        previewRequestRef.current
      ) {
        return;
      }

      console.error(error);
      setPreview(null);
      setErrorMessage(
        "The selected page preview could not be created. The PDF may be damaged or unsupported.",
      );
    } finally {
      if (
        requestId ===
        previewRequestRef.current
      ) {
        setIsRenderingPreview(
          false,
        );
      }
    }
  }

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  function resetPlacement() {
    setSignaturePosition(
      DEFAULT_POSITION,
    );
    setSignatureWidthRatio(
      0.3,
    );
    resetResult();
  }

  function resetSignature() {
    setSignatureMode("draw");
    setSignatureDataUrl(
      null,
    );
    setSignatureAspect(3);
    setTypedSignature("");
    setUploadedSignatureName(
      "",
    );
    resetPlacement();
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
      setSelectedPage(1);
      setPreview(null);
      resetSignature();
      void renderSelectedPreview(
        selectedFile,
        1,
      );

      toast.success(
        `${count} ${count === 1 ? "page" : "pages"} ready for signing.`,
      );
    } catch {
      const message =
        "Unable to open this PDF. It may be damaged or password-protected.";

      setFile(null);
      setPageCount(0);
      setPreview(null);
      setErrorMessage(message);
      toast.error(message);
    }
  }

  function startAgain() {
    previewRequestRef.current += 1;
    setIsRenderingPreview(false);
    setFile(null);
    setPageCount(0);
    setSelectedPage(1);
    setPreview(null);
    resetSignature();

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }

    if (
      signatureImageInputRef.current
    ) {
      signatureImageInputRef.current.value =
        "";
    }
  }

  function chooseMode(
    mode: SignatureMode,
  ) {
    setSignatureMode(mode);
    setSignatureDataUrl(
      null,
    );
    setSignatureAspect(3);
    setTypedSignature("");
    setUploadedSignatureName(
      "",
    );
    resetPlacement();
  }

  function handleDrawnSignature(
    dataUrl: string | null,
    aspectRatio: number,
  ) {
    setSignatureDataUrl(
      dataUrl,
    );
    setSignatureAspect(
      aspectRatio,
    );
    resetResult();
  }

  function handleTypedSignature(
    value: string,
  ) {
    setTypedSignature(value);

    try {
      const generated =
        createTypedSignature(
          value,
        );

      setSignatureDataUrl(
        generated?.dataUrl ??
          null,
      );

      setSignatureAspect(
        generated?.aspectRatio ??
          3,
      );

      resetResult();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create the typed signature.";

      setErrorMessage(message);
    }
  }

  async function handleSignatureImage(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const selected =
      event.target.files?.[0];

    event.target.value = "";

    if (!selected) {
      return;
    }

    const validType =
      selected.type ===
        "image/png" ||
      selected.type ===
        "image/jpeg" ||
      selected.name
        .toLowerCase()
        .endsWith(".png") ||
      selected.name
        .toLowerCase()
        .endsWith(".jpg") ||
      selected.name
        .toLowerCase()
        .endsWith(".jpeg");

    if (!validType) {
      const message =
        "Please choose a PNG, JPG, or JPEG signature image.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (
      selected.size >
      MAX_SIGNATURE_IMAGE_SIZE
    ) {
      const message =
        "The signature image must not be larger than 5 MB.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    try {
      const dataUrl =
        await readFileAsDataUrl(
          selected,
        );

      const aspectRatio =
        await getImageAspect(
          dataUrl,
        );

      setUploadedSignatureName(
        selected.name,
      );

      setSignatureDataUrl(
        dataUrl,
      );

      setSignatureAspect(
        aspectRatio,
      );

      resetPlacement();

      toast.success(
        "Signature image ready.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load the signature image.";

      setErrorMessage(message);
      toast.error(message);
    }
  }

  const previewAspect =
    preview
      ? preview.width /
        preview.height
      : 1;

  const overlayHeightRatio =
    signatureDataUrl &&
    preview
      ? Math.min(
          0.85,
          (signatureWidthRatio *
            previewAspect) /
            Math.max(
              signatureAspect,
              0.01,
            ),
        )
      : 0;

  const displayX =
    clamp(
      signaturePosition.x,
      0,
      Math.max(
        0,
        1 -
          signatureWidthRatio,
      ),
    );

  const displayY =
    clamp(
      signaturePosition.y,
      0,
      Math.max(
        0,
        1 -
          overlayHeightRatio,
      ),
    );

  function beginSignatureDrag(
    event: PointerEvent<HTMLDivElement>,
  ) {
    if (
      isProcessing ||
      !previewContainerRef.current
    ) {
      return;
    }

    const rect =
      previewContainerRef.current.getBoundingClientRect();

    const pointerX =
      (event.clientX -
        rect.left) /
      rect.width;

    const pointerY =
      (event.clientY -
        rect.top) /
      rect.height;

    dragOffsetRef.current = {
      x:
        pointerX -
        displayX,
      y:
        pointerY -
        displayY,
    };

    isDraggingRef.current =
      true;

    event.currentTarget.setPointerCapture(
      event.pointerId,
    );
  }

  function moveSignature(
    event: PointerEvent<HTMLDivElement>,
  ) {
    if (
      !isDraggingRef.current ||
      !previewContainerRef.current
    ) {
      return;
    }

    const rect =
      previewContainerRef.current.getBoundingClientRect();

    const pointerX =
      (event.clientX -
        rect.left) /
      rect.width;

    const pointerY =
      (event.clientY -
        rect.top) /
      rect.height;

    setSignaturePosition({
      x: clamp(
        pointerX -
          dragOffsetRef.current.x,
        0,
        Math.max(
          0,
          1 -
            signatureWidthRatio,
        ),
      ),
      y: clamp(
        pointerY -
          dragOffsetRef.current.y,
        0,
        Math.max(
          0,
          1 -
            overlayHeightRatio,
        ),
      ),
    });

    resetResult();
  }

  function endSignatureDrag(
    event: PointerEvent<HTMLDivElement>,
  ) {
    if (
      !isDraggingRef.current
    ) {
      return;
    }

    isDraggingRef.current =
      false;

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }
  }

  async function signPdf() {
    if (!file) {
      setErrorMessage(
        "Please select a PDF file.",
      );
      return;
    }

    if (
      !signatureDataUrl
    ) {
      setErrorMessage(
        "Create or upload a signature before continuing.",
      );
      return;
    }

    if (
      selectedPage < 1 ||
      selectedPage > pageCount
    ) {
      setErrorMessage(
        "Choose a valid PDF page.",
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

      const page =
        pdf.getPages()[
          selectedPage - 1
        ];

      if (!page) {
        throw new Error(
          "The selected PDF page is not available.",
        );
      }

      const imageBytes =
        dataUrlToBytes(
          signatureDataUrl,
        );

      const embeddedSignature =
        signatureDataUrl.startsWith(
          "data:image/jpeg",
        ) ||
        signatureDataUrl.startsWith(
          "data:image/jpg",
        )
          ? await pdf.embedJpg(
              imageBytes,
            )
          : await pdf.embedPng(
              imageBytes,
            );

      const cropBox =
        page.getCropBox();

      const placement =
        calculateSignaturePdfPlacement(
          {
            cropBox,
            rotationAngle:
              page.getRotation()
                .angle,
            xRatio:
              displayX,
            yRatio:
              displayY,
            widthRatio:
              signatureWidthRatio,
            signatureAspect,
          },
        );

      page.drawImage(
        embeddedSignature,
        {
          x: placement.x,
          y: placement.y,
          width:
            placement.width,
          height:
            placement.height,
          rotate: degrees(
            placement.rotation,
          ),
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
        `${baseName}-signed.pdf`;

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
        toolName: "Sign PDF",
      });

      toast.success(
        "Signature added successfully.",
      );
    } catch (error) {
      console.error(error);

      const message =
        error instanceof Error
          ? error.message
          : "The signature could not be added.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ToolLayout
      label="Sign PDF"
      title="Add a visual signature to PDF privately"
      description="Draw, type, or upload a signature, choose the PDF page, then drag and resize the signature on a page preview. Everything runs locally in your browser."
      tips={tips}
      faqs={faqs}
      howToTitle="How to add a signature to a PDF"
      howToSteps={[
        {
          title:
            "Choose one PDF",
          description:
            "Select the PDF you want to sign, up to 25 MB.",
        },
        {
          title:
            "Create your signature",
          description:
            "Draw it, type your name in a signature style, or upload a PNG/JPG signature image.",
        },
        {
          title:
            "Place and download",
          description:
            "Choose the page, drag and resize the signature on the preview, then create the signed PDF copy.",
        },
      ]}
      maxWidthClassName="max-w-7xl"
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
        description="Choose or drag the PDF you want to add a visual signature to."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
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
                ? "Adding signature"
                : outputBytes
                  ? "Signed PDF created successfully"
                  : isRenderingPreview
                    ? "Rendering page preview"
                    : `${pageCount} ${pageCount === 1 ? "page" : "pages"} ready`
            }
          />

          {!outputBytes && (
            <>
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-bold text-gray-950 dark:text-white">
                  1. Create signature
                </h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {([
                    [
                      "draw",
                      "Draw",
                      PenLine,
                    ],
                    [
                      "type",
                      "Type",
                      Keyboard,
                    ],
                    [
                      "upload",
                      "Upload",
                      ImagePlus,
                    ],
                  ] as const).map(
                    ([
                      mode,
                      label,
                      Icon,
                    ]) => (
                      <button
                        key={
                          mode
                        }
                        type="button"
                        onClick={() =>
                          chooseMode(
                            mode,
                          )
                        }
                        disabled={
                          isProcessing
                        }
                        className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-4 py-3 font-semibold transition ${
                          signatureMode ===
                          mode
                            ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-gray-200 text-gray-700 hover:border-blue-300 dark:border-slate-700 dark:text-slate-200"
                        }`}
                      >
                        <Icon
                          size={
                            19
                          }
                        />
                        {
                          label
                        }
                      </button>
                    ),
                  )}
                </div>

                <div className="mt-5">
                  {signatureMode ===
                    "draw" && (
                    <SignaturePad
                      onChange={
                        handleDrawnSignature
                      }
                      disabled={
                        isProcessing
                      }
                    />
                  )}

                  {signatureMode ===
                    "type" && (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                      <label className="text-sm font-semibold text-gray-900 dark:text-white">
                        Signature name
                        <input
                          type="text"
                          value={
                            typedSignature
                          }
                          onChange={(
                            event,
                          ) =>
                            handleTypedSignature(
                              event
                                .target
                                .value,
                            )
                          }
                          maxLength={
                            70
                          }
                          placeholder="Type your name"
                          disabled={
                            isProcessing
                          }
                          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                        />
                      </label>

                      {signatureDataUrl && (
                        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                          <img
                            src={
                              signatureDataUrl
                            }
                            alt="Typed signature preview"
                            className="mx-auto max-h-32 max-w-full object-contain"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {signatureMode ===
                    "upload" && (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                      <input
                        ref={
                          signatureImageInputRef
                        }
                        type="file"
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        className="hidden"
                        onChange={
                          handleSignatureImage
                        }
                      />

                      <button
                        type="button"
                        onClick={() =>
                          signatureImageInputRef.current?.click()
                        }
                        disabled={
                          isProcessing
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ImagePlus
                          size={
                            19
                          }
                        />
                        Choose Signature Image
                      </button>

                      <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">
                        PNG, JPG, or JPEG · Maximum 5 MB. Transparent PNG works best.
                      </p>

                      {signatureDataUrl && (
                        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
                          <img
                            src={
                              signatureDataUrl
                            }
                            alt="Uploaded signature preview"
                            className="mx-auto max-h-36 max-w-full object-contain"
                          />

                          {uploadedSignatureName && (
                            <p className="mt-3 break-all text-center text-sm font-semibold text-gray-700 dark:text-slate-200">
                              {
                                uploadedSignatureName
                              }
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                  <div>
                    <h2 className="text-lg font-bold text-gray-950 dark:text-white">
                      2. Choose page and place signature
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-slate-400">
                      Drag the signature directly on the preview. The position is saved relative to the selected page.
                    </p>
                  </div>

                  <label className="w-full text-sm font-semibold text-gray-900 dark:text-white md:max-w-[220px]">
                    Sign page
                    <select
                      value={
                        selectedPage
                      }
                      onChange={(
                        event,
                      ) => {
                        const pageNumber =
                          Number(
                            event
                              .target
                              .value,
                          );

                        setSelectedPage(
                          pageNumber,
                        );
                        setPreview(null);
                        resetPlacement();

                        if (file) {
                          void renderSelectedPreview(
                            file,
                            pageNumber,
                          );
                        }
                      }}
                      disabled={
                        isProcessing
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
                    >
                      {Array.from(
                        {
                          length:
                            pageCount,
                        },
                        (
                          _,
                          index,
                        ) => (
                          <option
                            key={
                              index +
                              1
                            }
                            value={
                              index +
                              1
                            }
                          >
                            Page{" "}
                            {index +
                              1}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>

                <div className="mt-6">
                  {isRenderingPreview && (
                    <div className="flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-sm font-semibold text-gray-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                      Rendering page preview...
                    </div>
                  )}

                  {!isRenderingPreview &&
                    preview && (
                      <div
                        ref={
                          previewContainerRef
                        }
                        className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-gray-300 bg-white shadow-sm dark:border-slate-700 ${
                          preview.width >
                          preview.height
                            ? "max-w-4xl"
                            : "max-w-xl"
                        }`}
                        style={{
                          aspectRatio: `${preview.width} / ${preview.height}`,
                        }}
                      >
                        <img
                          src={
                            preview.dataUrl
                          }
                          alt={`PDF page ${selectedPage} preview`}
                          draggable={
                            false
                          }
                          className="absolute inset-0 h-full w-full select-none object-fill"
                        />

                        {signatureDataUrl && (
                          <div
                            role="button"
                            tabIndex={
                              0
                            }
                            aria-label="Drag signature to position it"
                            onPointerDown={
                              beginSignatureDrag
                            }
                            onPointerMove={
                              moveSignature
                            }
                            onPointerUp={
                              endSignatureDrag
                            }
                            onPointerCancel={
                              endSignatureDrag
                            }
                            className="absolute touch-none cursor-move rounded-lg border-2 border-blue-500 bg-white/10 shadow-lg ring-2 ring-blue-200/70"
                            style={{
                              left: `${displayX * 100}%`,
                              top: `${displayY * 100}%`,
                              width: `${signatureWidthRatio * 100}%`,
                              height: `${overlayHeightRatio * 100}%`,
                            }}
                          >
                            <img
                              src={
                                signatureDataUrl
                              }
                              alt="Signature placement preview"
                              draggable={
                                false
                              }
                              className="h-full w-full select-none object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
                  <label className="text-sm font-semibold text-gray-900 dark:text-white">
                    Signature width:{" "}
                    {Math.round(
                      signatureWidthRatio *
                        100,
                    )}
                    %
                    <input
                      type="range"
                      min="10"
                      max="60"
                      step="1"
                      value={Math.round(
                        signatureWidthRatio *
                          100,
                      )}
                      onChange={(
                        event,
                      ) => {
                        setSignatureWidthRatio(
                          Number(
                            event
                              .target
                              .value,
                          ) /
                            100,
                        );
                        resetResult();
                      }}
                      disabled={
                        isProcessing ||
                        !signatureDataUrl
                      }
                      className="mt-3 w-full"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={
                      resetPlacement
                    }
                    disabled={
                      isProcessing ||
                      !signatureDataUrl
                    }
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Reset position
                  </button>
                </div>

                {!signatureDataUrl && (
                  <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    Create or upload a signature above to enable visual placement.
                  </p>
                )}
              </section>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <TriangleAlert
                  size={19}
                  className="mt-0.5 shrink-0"
                />

                <p>
                  This tool places a visible electronic signature image on the PDF. It is not a certificate-based cryptographic digital signature, does not verify identity, and does not by itself guarantee legal validity.
                </p>
              </div>
            </>
          )}

          {!outputBytes &&
            !errorMessage && (
              <ActionButton
                isLoading={
                  isProcessing
                }
                loadingText="Adding signature..."
                loadingSubtitle="Placing the signature on the selected page and preparing the signed copy."
                buttonText="Sign and Download PDF"
                subtitle="Creates a separate signed copy. Your original PDF stays unchanged."
                onClick={
                  signPdf
                }
                disabled={
                  isProcessing ||
                  isRenderingPreview ||
                  !signatureDataUrl ||
                  !preview
                }
              />
            )}

          {!isProcessing &&
            outputBytes && (
              <SuccessCard
                title="Your signed PDF is ready"
                description={`The visual signature was added to page ${selectedPage} successfully.`}
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
                downloadLabel="Download Signed PDF Again"
                resetLabel="Sign Another PDF"
              />
            )}

          {!isProcessing &&
            errorMessage && (
              <ErrorCard
                title="PDF signing needs attention"
                description={
                  errorMessage
                }
                reasons={[
                  "A signature may not have been created or uploaded yet.",
                  "The selected page preview may not match a damaged or unusual PDF page structure.",
                  "The PDF may be password-protected or unsupported.",
                ]}
                onRetry={
                  file &&
                  signatureDataUrl
                    ? signPdf
                    : undefined
                }
                onReset={
                  startAgain
                }
                retryLabel="Retry Signing"
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
        Your PDF and signature are processed locally inside your browser and are not uploaded.
      </div>
    </ToolLayout>
  );
}
