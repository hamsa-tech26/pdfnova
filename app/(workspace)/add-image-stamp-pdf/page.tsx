"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import PositionControls from "@/components/pdf/PositionControls";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import { renderPdfPages, type RenderedPdfPage } from "@/lib/pdf/render";
import { calculateSignaturePdfPlacement } from "@/lib/pdf/signaturePlacementGeometry";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { ImagePlus, ShieldCheck, Stamp } from "lucide-react";
import {
  ChangeEvent,
  PointerEvent,
  useRef,
  useState,
} from "react";
import { degrees, PDFDocument } from "pdf-lib";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type Mode = "stamp" | "image";
type ApplyScope = "page" | "all";

const tips = [
  { title: "Place visually", description: "Choose a page, drag the image or stamp on the preview, and adjust its size." },
  { title: "Apply once or everywhere", description: "Place the item on the selected page or repeat the same relative position on every page." },
  { title: "Transparent PNG works best", description: "For logos, seals, and handwritten marks, PNG preserves transparent backgrounds." },
];

const faqs = [
  { question: "Can I add a logo or seal?", answer: "Yes. Upload a PNG or JPG and place it visually on the selected PDF page." },
  { question: "Can I create a text stamp?", answer: "Yes. Type stamp text such as APPROVED, DRAFT, or CONFIDENTIAL and choose its color." },
  { question: "Is my PDF or image uploaded?", answer: "No. Previewing and PDF updates are performed locally in your browser." },
];

function dataUrlToBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("The image data is invalid.");
  const binary = window.atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read the image."));
    reader.onerror = () => reject(new Error("Unable to read the image."));
    reader.readAsDataURL(file);
  });
}

function getImageAspect(dataUrl: string) {
  return new Promise<number>((resolve, reject) => {
    const image = new Image();
    image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0 ? resolve(image.naturalWidth / image.naturalHeight) : reject(new Error("The image has invalid dimensions."));
    image.onerror = () => reject(new Error("Unable to decode the image."));
    image.src = dataUrl;
  });
}

function createTextStamp(text: string, color: string) {
  const value = text.trim().toUpperCase();
  if (!value) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 300;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported in this browser.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 14;
  context.strokeRect(25, 25, 950, 250);
  context.font = "bold 110px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(value.slice(0, 18), 500, 150, 880);
  return {
    dataUrl: canvas.toDataURL("image/png"),
    aspect: canvas.width / canvas.height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function AddImageStampPdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewRequestRef = useRef(0);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const [preview, setPreview] = useState<RenderedPdfPage | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [mode, setMode] = useState<Mode>("stamp");
  const [scope, setScope] = useState<ApplyScope>("page");
  const [stampText, setStampText] = useState("APPROVED");
  const [stampColor, setStampColor] = useState("#dc2626");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState(3.33);
  const [imageName, setImageName] = useState("");
  const [position, setPosition] = useState({ x: 0.62, y: 0.72 });
  const [widthRatio, setWidthRatio] = useState(0.25);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const previewAspect = preview ? preview.width / preview.height : 1;
  const heightRatio = imageDataUrl && preview ? Math.min(0.85, widthRatio * previewAspect / Math.max(imageAspect, 0.01)) : 0;
  const displayX = clamp(position.x, 0, Math.max(0, 1 - widthRatio));
  const displayY = clamp(position.y, 0, Math.max(0, 1 - heightRatio));

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  function resetPlacement() {
    setPosition({ x: 0.62, y: 0.72 });
    setWidthRatio(0.25);
    resetResult();
  }

  async function renderSelectedPreview(targetFile: File, pageNumber: number) {
    const requestId = ++previewRequestRef.current;
    setIsRenderingPreview(true);
    try {
      const pages = await renderPdfPages(targetFile, {
        scale: 1.35,
        quality: 0.9,
        pageNumbers: [pageNumber],
        format: "jpeg",
        maxDimension: 2400,
      });
      if (requestId !== previewRequestRef.current) return;
      if (!pages[0]) throw new Error("Unable to render this page.");
      setPreview(pages[0]);
    } catch (error) {
      if (requestId !== previewRequestRef.current) return;
      console.error(error);
      setPreview(null);
      setErrorMessage("The selected page preview could not be created.");
    } finally {
      if (requestId === previewRequestRef.current) setIsRenderingPreview(false);
    }
  }

  function refreshStamp(text = stampText, color = stampColor) {
    try {
      const generated = createTextStamp(text, color);
      setImageDataUrl(generated?.dataUrl ?? null);
      setImageAspect(generated?.aspect ?? 3.33);
      setImageName("");
      resetResult();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create the stamp.");
    }
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile || (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf"))) {
      setErrorMessage("Please select a valid PDF file.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage("The PDF file must not be larger than 25 MB.");
      return;
    }
    try {
      const pdf = await PDFDocument.load(await selectedFile.arrayBuffer(), { updateMetadata: false });
      const count = pdf.getPageCount();
      setFile(selectedFile);
      setPageCount(count);
      setSelectedPage(1);
      setPreview(null);
      resetPlacement();
      const generated = createTextStamp(stampText, stampColor);
      setImageDataUrl(generated?.dataUrl ?? null);
      setImageAspect(generated?.aspect ?? 3.33);
      void renderSelectedPreview(selectedFile, 1);
      toast.success("PDF ready for image or stamp placement.");
    } catch {
      setFile(null);
      setErrorMessage("Unable to open this PDF. It may be damaged or password-protected.");
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    const valid = selected.type === "image/png" || selected.type === "image/jpeg" || /\.(png|jpe?g)$/i.test(selected.name);
    if (!valid) {
      setErrorMessage("Please choose a PNG, JPG, or JPEG image.");
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      setErrorMessage("The image must not be larger than 5 MB.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(selected);
      setImageDataUrl(dataUrl);
      setImageAspect(await getImageAspect(dataUrl));
      setImageName(selected.name);
      resetPlacement();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load the image.");
    }
  }

  function startAgain() {
    previewRequestRef.current += 1;
    setFile(null);
    setPageCount(0);
    setSelectedPage(1);
    setPreview(null);
    setMode("stamp");
    setScope("page");
    setStampText("APPROVED");
    setStampColor("#dc2626");
    setImageDataUrl(null);
    setImageAspect(3.33);
    setImageName("");
    resetPlacement();
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function choosePage(pageNumber: number) {
    if (!file) return;
    setSelectedPage(pageNumber);
    setPreview(null);
    resetPlacement();
    void renderSelectedPreview(file, pageNumber);
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (!previewRef.current || !imageDataUrl) return;
    const rect = previewRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: (event.clientX - rect.left) / rect.width - displayX,
      y: (event.clientY - rect.top) / rect.height - displayY,
    };
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    setPosition({
      x: clamp((event.clientX - rect.left) / rect.width - dragOffsetRef.current.x, 0, Math.max(0, 1 - widthRatio)),
      y: clamp((event.clientY - rect.top) / rect.height - dragOffsetRef.current.y, 0, Math.max(0, 1 - heightRatio)),
    });
    resetResult();
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (
      !draggingRef.current ||
      !previewRef.current
    ) {
      return;
    }

    const rect =
      previewRef.current.getBoundingClientRect();

    setPosition({
      x: clamp(
        (event.clientX -
          rect.left) /
          rect.width -
          dragOffsetRef.current.x,
        0,
        Math.max(
          0,
          1 - widthRatio,
        ),
      ),
      y: clamp(
        (event.clientY -
          rect.top) /
          rect.height -
          dragOffsetRef.current.y,
        0,
        Math.max(
          0,
          1 - heightRatio,
        ),
      ),
    });

    draggingRef.current = false;
    resetResult();

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

  async function applyImageStamp() {
    if (!file || !imageDataUrl) return;
    setIsProcessing(true);
    setErrorMessage("");
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
      const bytes = dataUrlToBytes(imageDataUrl);
      const image = imageDataUrl.startsWith("data:image/jpeg") || imageDataUrl.startsWith("data:image/jpg") ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
      const targets = scope === "all" ? pdf.getPages().map((_, index) => index) : [selectedPage - 1];

      for (const index of targets) {
        const page = pdf.getPage(index);
        const placement = calculateSignaturePdfPlacement({
          cropBox: page.getCropBox(),
          rotationAngle: page.getRotation().angle,
          xRatio: displayX,
          yRatio: displayY,
          widthRatio,
          signatureAspect: imageAspect,
        });
        page.drawImage(image, {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          rotate: degrees(placement.rotation),
        });
      }

      const output = await pdf.save();
      const baseName = file.name.replace(/\.pdf$/i, "") || "kukureku";
      const generatedFileName = baseName + "-image-stamp.pdf";
      downloadFile(output, generatedFileName, "application/pdf");
      setOutputBytes(output);
      setOutputFileName(generatedFileName);
      addRecentFile({ fileName: generatedFileName, toolName: "Add Image / Stamp PDF" });
      toast.success("Image or stamp added successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "The image or stamp could not be added.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ToolLayout
      label="Add Image / Stamp PDF"
      title="Add an image, logo, or stamp to PDF privately"
      description="Create a text stamp or upload a PNG/JPG, then drag, resize, and place it on one page or every page without uploading your files."
      tips={tips}
      faqs={faqs}
      howToTitle="How to add an image or stamp"
      howToSteps={[
        { title: "Choose a PDF", description: "Select the PDF you want to mark." },
        { title: "Create or upload", description: "Create a text stamp or upload a PNG/JPG image." },
        { title: "Place and download", description: "Drag the item or use the keyboard-friendly position controls, resize it, choose one page or all pages, then save the PDF." },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag the PDF you want to mark."
        buttonText="Choose PDF"
        helperText="PDF · Maximum file size: 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard file={file} onRemove={isProcessing ? undefined : startAgain} removeLabel="Remove PDF" statusText={isProcessing ? "Adding image or stamp" : "Ready for placement"} />

          {!outputBytes && (
            <>
              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => { setMode("stamp"); refreshStamp(); }} className={mode === "stamp" ? "rounded-2xl border border-blue-500 bg-blue-50 p-4 font-bold text-blue-700" : "rounded-2xl border border-gray-200 p-4 font-bold"}><Stamp className="mr-2 inline" size={18} />Text stamp</button>
                  <button type="button" onClick={() => { setMode("image"); setImageDataUrl(null); setImageName(""); resetResult(); }} className={mode === "image" ? "rounded-2xl border border-blue-500 bg-blue-50 p-4 font-bold text-blue-700" : "rounded-2xl border border-gray-200 p-4 font-bold"}><ImagePlus className="mr-2 inline" size={18} />Upload image</button>
                </div>

                {mode === "stamp" ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
                    <label className="text-sm font-semibold dark:text-white">Stamp text
                      <input value={stampText} maxLength={18} onChange={(event) => { setStampText(event.target.value); const generated = createTextStamp(event.target.value, stampColor); setImageDataUrl(generated?.dataUrl ?? null); setImageAspect(generated?.aspect ?? 3.33); resetResult(); }} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 dark:border-slate-700 dark:bg-slate-950" />
                    </label>
                    <label className="text-sm font-semibold dark:text-white">Color
                      <input type="color" value={stampColor} onChange={(event) => { setStampColor(event.target.value); const generated = createTextStamp(stampText, event.target.value); setImageDataUrl(generated?.dataUrl ?? null); setImageAspect(generated?.aspect ?? 3.33); resetResult(); }} className="mt-2 block h-12 w-24 rounded-xl border border-gray-300 p-1" />
                    </label>
                  </div>
                ) : (
                  <div className="mt-5">
                    <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="hidden" onChange={handleImageUpload} />
                    <button type="button" onClick={() => imageInputRef.current?.click()} className="min-h-11 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white outline-none transition hover:bg-blue-700 focus-visible:ring-4 focus-visible:ring-blue-200 dark:focus-visible:ring-blue-950">Choose PNG/JPG</button>
                    <p className="mt-2 text-sm text-gray-500">{imageName || "Transparent PNG is recommended · Maximum 5 MB"}</p>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <h2 className="text-lg font-bold dark:text-white">Place on PDF</h2>
                  <div className="flex flex-wrap gap-3">
                    <select value={selectedPage} onChange={(event) => choosePage(Number(event.target.value))} className="rounded-xl border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      {Array.from({ length: pageCount }, (_, index) => <option key={index + 1} value={index + 1}>Page {index + 1}</option>)}
                    </select>
                    <select value={scope} onChange={(event) => { setScope(event.target.value as ApplyScope); resetResult(); }} className="rounded-xl border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                      <option value="page">Selected page only</option>
                      <option value="all">All pages</option>
                    </select>
                  </div>
                </div>

                {isRenderingPreview && <div className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-dashed">Rendering preview...</div>}

                {!isRenderingPreview && preview && (
                  <div ref={previewRef} className="relative mx-auto mt-6 w-full max-w-3xl overflow-hidden rounded-2xl border bg-white" style={{ aspectRatio: String(preview.width) + " / " + String(preview.height) }}>
                    <img src={preview.dataUrl} alt={"PDF page " + String(selectedPage)} draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
                    {imageDataUrl && (
                      <div
                        aria-hidden="true"
                        onPointerDown={beginDrag}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        className="absolute touch-none cursor-move rounded border-2 border-blue-500"
                        style={{
                          left: String(displayX * 100) + "%",
                          top: String(displayY * 100) + "%",
                          width: String(widthRatio * 100) + "%",
                          height: String(heightRatio * 100) + "%",
                        }}
                      >
                        <img src={imageDataUrl} alt="Image placement preview" draggable={false} className="h-full w-full select-none object-contain" />
                      </div>
                    )}
                  </div>
                )}

                <label className="mt-5 block text-sm font-semibold text-gray-900 dark:text-white">
                  Width: {Math.round(widthRatio * 100)}%
                  <input
                    type="range"
                    min="8"
                    max="70"
                    value={Math.round(widthRatio * 100)}
                    onChange={(event) => {
                      setWidthRatio(Number(event.target.value) / 100);
                      resetResult();
                    }}
                    disabled={!imageDataUrl}
                    className="mt-3 w-full accent-blue-600"
                  />
                </label>

                {imageDataUrl && preview && (
                  <div className="mt-5">
                    <PositionControls
                      label={mode === "stamp" ? "stamp" : "image"}
                      position={{
                        x: displayX,
                        y: displayY,
                      }}
                      maxX={Math.max(0, 1 - widthRatio)}
                      maxY={Math.max(0, 1 - heightRatio)}
                      onChange={(nextPosition) => {
                        setPosition(nextPosition);
                        resetResult();
                      }}
                      disabled={isProcessing}
                    />
                  </div>
                )}
              </section>
            </>
          )}

          {!outputBytes && imageDataUrl && !errorMessage && (
            <ActionButton
              isLoading={isProcessing}
              loadingText="Adding image or stamp..."
              loadingSubtitle="Writing the visual item into the PDF locally."
              buttonText="Add and Download PDF"
              subtitle={scope === "all" ? "The same relative placement will be applied to every page." : "The item will be added to the selected page."}
              onClick={applyImageStamp}
              disabled={isProcessing || isRenderingPreview || !preview}
            />
          )}

          {!isProcessing && outputBytes && (
            <SuccessCard
              title="Your marked PDF is ready"
              description="The image or stamp was added successfully."
              fileName={outputFileName}
              onDownloadAgain={() => downloadFile(outputBytes, outputFileName, "application/pdf")}
              onStartAgain={startAgain}
              downloadLabel="Download PDF Again"
              resetLabel="Mark Another PDF"
            />
          )}

          {!isProcessing && errorMessage && (
            <ErrorCard
              title="Image or stamp needs attention"
              description={errorMessage}
              reasons={[
                "The PDF or image may be damaged or unsupported.",
                "The uploaded image may exceed the supported size.",
                "Your browser may not have enough memory for this document.",
              ]}
              onRetry={file && imageDataUrl ? applyImageStamp : undefined}
              onReset={startAgain}
              retryLabel="Retry"
              resetLabel="Choose Another PDF"
            />
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck size={18} className="text-emerald-600" />
        Your PDF and image are processed locally inside your browser.
      </div>
    </ToolLayout>
  );
}
