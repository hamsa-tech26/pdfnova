"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import ProgressCard from "@/components/pdf/ProgressCard";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import ImageWatermarkUploader from "@/components/watermark/ImageWatermarkUploader";
import { downloadFile } from "@/lib/downloadFile";
import { addRecentFile } from "@/lib/storage/recentFiles";
import {
  ImageIcon,
  ShieldCheck,
  Type,
} from "lucide-react";
import {
  ChangeEvent,
  useEffect,
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

type WatermarkMode = "text" | "image";

type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const watermarkTips = [
  {
    title: "Keep the watermark readable",
    description:
      "Use moderate opacity and a suitable size so the document remains easy to read.",
  },
  {
    title: "Use PNG for transparent logos",
    description:
      "A PNG image with a transparent background usually produces the cleanest logo watermark.",
  },
  {
    title: "Review the final document",
    description:
      "Open the downloaded PDF and confirm that the watermark position is suitable on every page.",
  },
];

const watermarkFaqs = [
  {
    question: "Is the watermark added to every page?",
    answer:
      "Yes. PDFNova applies the selected text or image watermark to every page of the uploaded PDF.",
  },
  {
    question: "Which watermark image formats are supported?",
    answer:
      "The current version supports PNG, JPG, and JPEG images.",
  },
  {
    question: "Is my PDF uploaded?",
    answer:
      "No. The PDF and watermark image are processed locally inside your browser.",
  },
];

const watermarkSteps = [
  {
    label: "Reading PDF",
    description:
      "Opening the selected document and preparing its pages.",
  },
  {
    label: "Applying watermark",
    description:
      "Adding the selected text or image watermark to every page.",
  },
  {
    label: "Preparing download",
    description:
      "Finalizing the watermarked PDF document.",
  },
];

function hexToRgb(hexColor: string) {
  const cleanHex = hexColor.replace("#", "");

  return {
    red: Number.parseInt(cleanHex.slice(0, 2), 16) / 255,
    green: Number.parseInt(cleanHex.slice(2, 4), 16) / 255,
    blue: Number.parseInt(cleanHex.slice(4, 6), 16) / 255,
  };
}

function getWatermarkPosition(
  position: WatermarkPosition,
  pageWidth: number,
  pageHeight: number,
  watermarkWidth: number,
  watermarkHeight: number,
) {
  const margin = 32;

  switch (position) {
    case "top-left":
      return {
        x: margin,
        y: pageHeight - watermarkHeight - margin,
      };

    case "top-right":
      return {
        x: pageWidth - watermarkWidth - margin,
        y: pageHeight - watermarkHeight - margin,
      };

    case "bottom-left":
      return {
        x: margin,
        y: margin,
      };

    case "bottom-right":
      return {
        x: pageWidth - watermarkWidth - margin,
        y: margin,
      };

    default:
      return {
        x: (pageWidth - watermarkWidth) / 2,
        y: (pageHeight - watermarkHeight) / 2,
      };
  }
}

export default function WatermarkPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [watermarkMode, setWatermarkMode] =
    useState<WatermarkMode>("text");

  const [watermarkText, setWatermarkText] =
    useState("PDFNova");
  const [watermarkColor, setWatermarkColor] =
    useState("#595959");
  const [fontSize, setFontSize] = useState(42);

  const [imageFile, setImageFile] =
    useState<File | null>(null);
  const [imagePreview, setImagePreview] =
    useState<string | null>(null);
  const [imageSize, setImageSize] = useState(30);

  const [opacity, setOpacity] = useState(0.25);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] =
    useState<WatermarkPosition>("center");

  const [isProcessing, setIsProcessing] =
    useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);

  const [outputBytes, setOutputBytes] =
    useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] =
    useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  function resetResultState() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
    setProgress(0);
    setCurrentStep(1);
  }

  function resetWatermarkSettings() {
    setWatermarkMode("text");
    setWatermarkText("PDFNova");
    setWatermarkColor("#595959");
    setFontSize(42);
    setImageSize(30);
    setOpacity(0.25);
    setRotation(45);
    setPosition("center");

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview(null);
  }

  function handleFileSelection(
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
    resetResultState();
    event.target.value = "";

    toast.success("PDF file added successfully.");
  }

  function removeFile() {
    setFile(null);
    resetResultState();

    toast.success("PDF file removed.");
  }

  function handleImageSelected(
    selectedImage: File,
    preview: string,
  ) {
    if (
      selectedImage.type !== "image/png" &&
      selectedImage.type !== "image/jpeg"
    ) {
      URL.revokeObjectURL(preview);
      toast.error("Please select a PNG, JPG, or JPEG image.");
      return;
    }

    if (selectedImage.size > MAX_IMAGE_SIZE) {
      URL.revokeObjectURL(preview);
      toast.error(
        "The watermark image must not be larger than 10 MB.",
      );
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(selectedImage);
    setImagePreview(preview);
    resetResultState();
  }

  function removeImageWatermark() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview(null);
    resetResultState();

    toast.success("Image watermark removed.");
  }

  function changeMode(mode: WatermarkMode) {
    setWatermarkMode(mode);
    resetResultState();
  }

  function startAgain() {
    setFile(null);
    resetWatermarkSettings();
    resetResultState();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function downloadResultAgain() {
    if (!outputBytes || !outputFileName) {
      toast.error(
        "The watermarked PDF is no longer available.",
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
        "Your watermarked PDF is being downloaded again.",
    });
  }

  async function applyWatermark() {
    if (!file) {
      const message = "Please select a PDF file.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (
      watermarkMode === "text" &&
      !watermarkText.trim()
    ) {
      const message = "Please enter watermark text.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (watermarkMode === "image" && !imageFile) {
      const message =
        "Please select a watermark image.";

      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");
    setOutputBytes(null);
    setOutputFileName("");
    setProgress(15);
    setCurrentStep(1);

    try {
      const sourceBytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(sourceBytes);

      await new Promise((resolve) =>
        setTimeout(resolve, 180),
      );

      setProgress(38);
      setCurrentStep(2);

      const pages = pdf.getPages();

      if (watermarkMode === "text") {
        const font = await pdf.embedFont(
          StandardFonts.HelveticaBold,
        );

        const watermarkRgb = hexToRgb(watermarkColor);

        pages.forEach((page, index) => {
          const { width, height } = page.getSize();

          const textWidth = font.widthOfTextAtSize(
            watermarkText,
            fontSize,
          );

          const textHeight =
            font.heightAtSize(fontSize);

          const { x, y } = getWatermarkPosition(
            position,
            width,
            height,
            textWidth,
            textHeight,
          );

          page.drawText(watermarkText, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(
              watermarkRgb.red,
              watermarkRgb.green,
              watermarkRgb.blue,
            ),
            opacity,
            rotate: degrees(rotation),
          });

          const pageProgress =
            38 +
            Math.round(
              ((index + 1) / pages.length) * 42,
            );

          setProgress(Math.min(80, pageProgress));
        });
      } else if (imageFile) {
        const imageBytes =
          await imageFile.arrayBuffer();

        const embeddedImage =
          imageFile.type === "image/png"
            ? await pdf.embedPng(imageBytes)
            : await pdf.embedJpg(imageBytes);

        pages.forEach((page, index) => {
          const { width, height } = page.getSize();

          const targetWidth =
            width * (imageSize / 100);

          const scale =
            targetWidth / embeddedImage.width;

          const targetHeight =
            embeddedImage.height * scale;

          const { x, y } = getWatermarkPosition(
            position,
            width,
            height,
            targetWidth,
            targetHeight,
          );

          page.drawImage(embeddedImage, {
            x,
            y,
            width: targetWidth,
            height: targetHeight,
            opacity,
            rotate: degrees(rotation),
          });

          const pageProgress =
            38 +
            Math.round(
              ((index + 1) / pages.length) * 42,
            );

          setProgress(Math.min(80, pageProgress));
        });
      }

      setProgress(88);
      setCurrentStep(3);

      const generatedBytes = await pdf.save();

      const originalName =
        file.name.replace(/\.pdf$/i, "");

      const generatedFileName = `${
        originalName || "pdfnova"
      }-watermarked.pdf`;

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
        toolName: "Watermark PDF",
      });

      toast.success("Watermark added successfully!");

      toast("Download started", {
        description:
          "Your watermarked PDF is being downloaded.",
      });
    } catch (error) {
      console.error(error);

      const message =
        "The watermark could not be added. The PDF or watermark image may be damaged or unsupported.";

      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }

  const hasValidWatermark =
    watermarkMode === "text"
      ? Boolean(watermarkText.trim())
      : Boolean(imageFile);

  return (
    <ToolLayout
      label="Watermark PDF"
      title="Add text or image watermarks to your PDF"
      description="Upload a PDF, choose a text or image watermark, customize its appearance, and download the updated document from your private PDFNova workspace."
      tips={watermarkTips}
      faqs={watermarkFaqs}
      maxWidthClassName="max-w-6xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag the PDF you want to watermark."
        buttonText="Choose PDF"
        helperText="Supported format: PDF · Maximum file size: 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={
              isProcessing ? undefined : removeFile
            }
            removeLabel="Remove PDF file"
            statusText={
              isProcessing
                ? "Watermark processing in progress"
                : outputBytes
                  ? "Watermark added successfully"
                  : errorMessage
                    ? "Watermark processing needs attention"
                    : "Ready to add watermark"
            }
            progress={
              isProcessing ? progress : undefined
            }
          />

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Watermark type
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => changeMode("text")}
                className={`flex items-center gap-3 rounded-2xl p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  watermarkMode === "text"
                    ? "border-2 border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Type size={22} />

                <div>
                  <p className="font-bold">
                    Text watermark
                  </p>

                  <p className="mt-1 text-sm opacity-75">
                    Add custom text to every page.
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => changeMode("image")}
                className={`flex items-center gap-3 rounded-2xl p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  watermarkMode === "image"
                    ? "border-2 border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border border-gray-300 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <ImageIcon size={22} />

                <div>
                  <p className="font-bold">
                    Image watermark
                  </p>

                  <p className="mt-1 text-sm opacity-75">
                    Add a logo, stamp, or signature.
                  </p>
                </div>
              </button>
            </div>
          </section>

          {watermarkMode === "text" ? (
            <section className="space-y-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="grid gap-6 lg:grid-cols-3">
                <div>
                  <label
                    htmlFor="watermark-text"
                    className="text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    Watermark text
                  </label>

                  <input
                    id="watermark-text"
                    type="text"
                    value={watermarkText}
                    disabled={isProcessing}
                    onChange={(event) => {
                      setWatermarkText(
                        event.target.value,
                      );
                      resetResultState();
                    }}
                    placeholder="Example: CONFIDENTIAL"
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="watermark-position"
                    className="text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    Position
                  </label>

                  <select
                    id="watermark-position"
                    value={position}
                    disabled={isProcessing}
                    onChange={(event) => {
                      setPosition(
                        event.target
                          .value as WatermarkPosition,
                      );
                      resetResultState();
                    }}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                  >
                    <option value="center">
                      Center
                    </option>
                    <option value="top-left">
                      Top left
                    </option>
                    <option value="top-right">
                      Top right
                    </option>
                    <option value="bottom-left">
                      Bottom left
                    </option>
                    <option value="bottom-right">
                      Bottom right
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="watermark-color"
                    className="text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    Text color
                  </label>

                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <input
                      id="watermark-color"
                      type="color"
                      value={watermarkColor}
                      disabled={isProcessing}
                      onChange={(event) => {
                        setWatermarkColor(
                          event.target.value,
                        );
                        resetResultState();
                      }}
                      className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                    />

                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                      {watermarkColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <RangeControl
                  id="font-size"
                  label="Font size"
                  value={fontSize}
                  displayValue={`${fontSize}px`}
                  min={16}
                  max={96}
                  step={2}
                  disabled={isProcessing}
                  onChange={(value) => {
                    setFontSize(value);
                    resetResultState();
                  }}
                />

                <RangeControl
                  id="text-opacity"
                  label="Opacity"
                  value={opacity}
                  displayValue={`${Math.round(
                    opacity * 100,
                  )}%`}
                  min={0.1}
                  max={1}
                  step={0.05}
                  disabled={isProcessing}
                  onChange={(value) => {
                    setOpacity(value);
                    resetResultState();
                  }}
                />

                <RangeControl
                  id="text-rotation"
                  label="Rotation"
                  value={rotation}
                  displayValue={`${rotation}°`}
                  min={-90}
                  max={90}
                  step={5}
                  disabled={isProcessing}
                  onChange={(value) => {
                    setRotation(value);
                    resetResultState();
                  }}
                />
              </div>
            </section>
          ) : (
            <section className="space-y-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
              <ImageWatermarkUploader
                fileInputRef={imageInputRef}
                imageFile={imageFile}
                imagePreview={imagePreview}
                onImageSelected={handleImageSelected}
                onRemove={removeImageWatermark}
              />

              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="image-position"
                    className="text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    Position
                  </label>

                  <select
                    id="image-position"
                    value={position}
                    disabled={isProcessing}
                    onChange={(event) => {
                      setPosition(
                        event.target
                          .value as WatermarkPosition,
                      );
                      resetResultState();
                    }}
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-950"
                  >
                    <option value="center">
                      Center
                    </option>
                    <option value="top-left">
                      Top left
                    </option>
                    <option value="top-right">
                      Top right
                    </option>
                    <option value="bottom-left">
                      Bottom left
                    </option>
                    <option value="bottom-right">
                      Bottom right
                    </option>
                  </select>
                </div>

                <RangeControl
                  id="image-size"
                  label="Image size"
                  value={imageSize}
                  displayValue={`${imageSize}%`}
                  min={10}
                  max={70}
                  step={5}
                  disabled={isProcessing}
                  onChange={(value) => {
                    setImageSize(value);
                    resetResultState();
                  }}
                />

                <RangeControl
                  id="image-opacity"
                  label="Opacity"
                  value={opacity}
                  displayValue={`${Math.round(
                    opacity * 100,
                  )}%`}
                  min={0.1}
                  max={1}
                  step={0.05}
                  disabled={isProcessing}
                  onChange={(value) => {
                    setOpacity(value);
                    resetResultState();
                  }}
                />
              </div>

              <RangeControl
                id="image-rotation"
                label="Rotation"
                value={rotation}
                displayValue={`${rotation}°`}
                min={-90}
                max={90}
                step={5}
                disabled={isProcessing}
                onChange={(value) => {
                  setRotation(value);
                  resetResultState();
                }}
              />
            </section>
          )}

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center dark:border-blue-950 dark:bg-blue-950/30">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
              Watermark preview
            </p>

            <div className="mt-5 flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-blue-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              {watermarkMode === "text" ? (
                <p
                  className="break-all text-center font-bold"
                  style={{
                    color: watermarkColor,
                    fontSize: `${Math.min(
                      fontSize,
                      64,
                    )}px`,
                    opacity,
                    transform: `rotate(${rotation}deg)`,
                  }}
                >
                  {watermarkText || "Watermark"}
                </p>
              ) : imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Image watermark preview"
                  className="max-h-44 object-contain"
                  style={{
                    width: `${imageSize}%`,
                    opacity,
                    transform: `rotate(${rotation}deg)`,
                  }}
                />
              ) : (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Select an image to preview the watermark.
                </p>
              )}
            </div>
          </section>

          {isProcessing && (
            <ProgressCard
              title="Adding watermark to PDF"
              description="PDFNova is applying your selected watermark to every page."
              progress={progress}
              currentStep={currentStep}
              steps={watermarkSteps}
              estimatedTime="A few seconds"
            />
          )}

          {!isProcessing && outputBytes && (
            <SuccessCard
              title="Your watermarked PDF is ready"
              description="The watermark was added successfully and the updated PDF was downloaded."
              fileName={outputFileName}
              onDownloadAgain={downloadResultAgain}
              onStartAgain={startAgain}
              downloadLabel="Download PDF Again"
              resetLabel="Watermark Another PDF"
            />
          )}

          {!isProcessing && errorMessage && (
            <ErrorCard
              title="Watermark processing failed"
              description={errorMessage}
              reasons={[
                "The PDF may be damaged or password-protected.",
                "The watermark image may be damaged or unsupported.",
                "The browser may not have enough available memory.",
              ]}
              onRetry={
                hasValidWatermark
                  ? applyWatermark
                  : undefined
              }
              onReset={startAgain}
              retryLabel="Retry Watermark"
              resetLabel="Choose Another PDF"
            />
          )}

          {!isProcessing &&
            !outputBytes &&
            !errorMessage && (
              <ActionButton
                isLoading={false}
                loadingText="Adding watermark..."
                loadingSubtitle="Applying the watermark and preparing the updated PDF."
                buttonText="Add Watermark and Download"
                subtitle="Apply the current watermark settings to every PDF page."
                onClick={applyWatermark}
                disabled={!hasValidWatermark}
              />
            )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck
          size={18}
          className="shrink-0 text-emerald-600"
        />
        Your PDF and watermark are processed locally and are not
        uploaded.
      </div>
    </ToolLayout>
  );
}

type RangeControlProps = {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

function RangeControl({
  id,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  disabled = false,
  onChange,
}: RangeControlProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-sm font-semibold text-gray-900 dark:text-white"
        >
          {label}
        </label>

        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          {displayValue}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        className="mt-3 w-full disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}