"use client";

import Navbar from "@/components/Navbar";
import ActionButton from "@/components/pdf/ActionButton";
import FileUploader from "@/components/pdf/FileUploader";
import ToolHeader from "@/components/pdf/ToolHeader";
import { downloadFile } from "@/lib/downloadFile";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { FileText, ShieldCheck } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { toast } from "sonner";

type WatermarkPosition =
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

function hexToRgb(hexColor: string) {
  const cleanHex = hexColor.replace("#", "");

  const red = Number.parseInt(cleanHex.slice(0, 2), 16) / 255;
  const green = Number.parseInt(cleanHex.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(cleanHex.slice(4, 6), 16) / 255;

  return {
    red,
    green,
    blue,
  };
}

export default function WatermarkPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [watermarkText, setWatermarkText] = useState("PDFNova");
  const [watermarkColor, setWatermarkColor] = useState("#595959");
  const [fontSize, setFontSize] = useState(42);
  const [opacity, setOpacity] = useState(0.25);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] =
    useState<WatermarkPosition>("center");
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelection(
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
    event.target.value = "";

    toast.success("PDF file added successfully.");
  }

  function removeFile() {
    setFile(null);
    toast.success("PDF file removed.");
  }

  function getWatermarkPosition(
    pageWidth: number,
    pageHeight: number,
    textWidth: number,
    textHeight: number,
  ) {
    const margin = 32;

    switch (position) {
      case "top-left":
        return {
          x: margin,
          y: pageHeight - textHeight - margin,
        };

      case "top-right":
        return {
          x: pageWidth - textWidth - margin,
          y: pageHeight - textHeight - margin,
        };

      case "bottom-left":
        return {
          x: margin,
          y: margin,
        };

      case "bottom-right":
        return {
          x: pageWidth - textWidth - margin,
          y: margin,
        };

      default:
        return {
          x: (pageWidth - textWidth) / 2,
          y: (pageHeight - textHeight) / 2,
        };
    }
  }

  async function applyWatermark() {
    if (!file) {
      toast.error("Please select a PDF file.");
      return;
    }

    if (!watermarkText.trim()) {
      toast.error("Please enter watermark text.");
      return;
    }

    setIsProcessing(true);

    try {
      const sourceBytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(sourceBytes);
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);

      const watermarkRgb = hexToRgb(watermarkColor);

      for (const page of pdf.getPages()) {
        const { width, height } = page.getSize();

        const textWidth = font.widthOfTextAtSize(
          watermarkText,
          fontSize,
        );

        const textHeight = font.heightAtSize(fontSize);

        const { x, y } = getWatermarkPosition(
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
      }

      const outputBytes = await pdf.save();
      const outputFileName = "pdfnova-watermarked.pdf";

      downloadFile(
        outputBytes,
        outputFileName,
        "application/pdf",
      );

      addRecentFile({
        fileName: outputFileName,
        toolName: "Watermark PDF",
      });

      toast.success("Watermark added successfully!");

      toast("Download started", {
        description: "Your watermarked PDF is being downloaded.",
      });
    } catch (error) {
      console.error(error);

      toast.error(
        "The watermark could not be added. The PDF may be damaged or password-protected.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <ToolHeader
            label="Watermark PDF"
            title="Add a text watermark to your PDF"
            description="Upload a PDF, customize the watermark text, color, position, size, opacity, and rotation, then download the updated document."
          />

          <section className="mt-12 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl md:p-10">
            <FileUploader
              fileInputRef={fileInputRef}
              onFileSelection={handleFileSelection}
              multiple={false}
              title="Select one PDF"
              description="Choose the PDF you want to watermark."
              buttonText="Choose PDF"
              helperText="Maximum file size: 25 MB"
            />

            {file && (
              <div className="mt-8 space-y-6">
                <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <FileText size={21} />
                    </div>

                    <div className="min-w-0">
                      <p className="break-words font-semibold text-gray-900">
                        {file.name}
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={removeFile}
                    className="shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div>
                    <label
                      htmlFor="watermark-text"
                      className="text-sm font-semibold text-gray-900"
                    >
                      Watermark text
                    </label>

                    <input
                      id="watermark-text"
                      type="text"
                      value={watermarkText}
                      onChange={(event) =>
                        setWatermarkText(event.target.value)
                      }
                      placeholder="Example: CONFIDENTIAL"
                      className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="watermark-position"
                      className="text-sm font-semibold text-gray-900"
                    >
                      Position
                    </label>

                    <select
                      id="watermark-position"
                      value={position}
                      onChange={(event) =>
                        setPosition(
                          event.target.value as WatermarkPosition,
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="center">Center</option>
                      <option value="top-left">Top left</option>
                      <option value="top-right">Top right</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="bottom-right">
                        Bottom right
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="watermark-color"
                      className="text-sm font-semibold text-gray-900"
                    >
                      Text color
                    </label>

                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2">
                      <input
                        id="watermark-color"
                        type="color"
                        value={watermarkColor}
                        onChange={(event) =>
                          setWatermarkColor(event.target.value)
                        }
                        className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />

                      <input
                        type="text"
                        value={watermarkColor.toUpperCase()}
                        onChange={(event) => {
                          const value = event.target.value;

                          if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                            setWatermarkColor(value);
                          }
                        }}
                        maxLength={7}
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-gray-700 outline-none"
                        aria-label="Watermark color hexadecimal value"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="font-size"
                        className="text-sm font-semibold text-gray-900"
                      >
                        Font size
                      </label>

                      <span className="text-sm font-semibold text-blue-600">
                        {fontSize}px
                      </span>
                    </div>

                    <input
                      id="font-size"
                      type="range"
                      min="16"
                      max="96"
                      step="2"
                      value={fontSize}
                      onChange={(event) =>
                        setFontSize(Number(event.target.value))
                      }
                      className="mt-3 w-full"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="opacity"
                        className="text-sm font-semibold text-gray-900"
                      >
                        Opacity
                      </label>

                      <span className="text-sm font-semibold text-blue-600">
                        {Math.round(opacity * 100)}%
                      </span>
                    </div>

                    <input
                      id="opacity"
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={opacity}
                      onChange={(event) =>
                        setOpacity(Number(event.target.value))
                      }
                      className="mt-3 w-full"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="rotation"
                        className="text-sm font-semibold text-gray-900"
                      >
                        Rotation
                      </label>

                      <span className="text-sm font-semibold text-blue-600">
                        {rotation}°
                      </span>
                    </div>

                    <input
                      id="rotation"
                      type="range"
                      min="-90"
                      max="90"
                      step="5"
                      value={rotation}
                      onChange={(event) =>
                        setRotation(Number(event.target.value))
                      }
                      className="mt-3 w-full"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
                    Watermark preview
                  </p>

                  <div className="mt-5 flex min-h-52 items-center justify-center overflow-hidden rounded-2xl border border-blue-200 bg-white p-6">
                    <p
                      className="break-all text-center font-bold"
                      style={{
                        color: watermarkColor,
                        fontSize: `${Math.min(fontSize, 64)}px`,
                        opacity,
                        transform: `rotate(${rotation}deg)`,
                      }}
                    >
                      {watermarkText || "Watermark"}
                    </p>
                  </div>
                </div>

                <ActionButton
                  isLoading={isProcessing}
                  loadingText="Adding watermark..."
                  buttonText="Add Watermark and Download"
                  onClick={applyWatermark}
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