"use client";

import ToolLayout from "@/components/pdf/ToolLayout";
import {
  inspectScannerImage,
  type ScannerImageInspection,
  validateScannerDimensions,
} from "@/lib/smart-scan/imageInspection";
import {
  buildWorkspaceHandoffHref,
  ensureWorkspaceSourceFile,
} from "@/lib/storage/workspaceFiles";
import {
  ArrowRight,
  CheckCircle2,
  FileImage,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type SelectedImage = {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  inspection: ScannerImageInspection;
};

const MAX_SIZE_TEXT = "25 MB";

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? (bytes / (1024 * 1024)).toFixed(2) + " MB"
    : Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      reject(new Error("This image could not be opened in your browser. Try another JPG or PNG."));
    };
    image.src = url;
  });
}

export default function SmartScanPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionIdRef = useRef(0);
  const handoffInProgressRef = useRef(false);
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.previewUrl);
    };
  }, [image]);

  async function acceptImage(files: File[]) {
    const selectionId = ++selectionIdRef.current;
    setImage(null);
    setError(null);
    setIsDragging(false);
    setIsChecking(false);

    if (files.length !== 1) {
      setError(files.length === 0
        ? "Choose a JPG or PNG image to continue."
        : "Select one image at a time for this scanner preview.");
      return;
    }

    setIsChecking(true);
    let previewUrl: string | null = null;

    try {
      const inspection = await inspectScannerImage(files[0]);
      if (selectionIdRef.current !== selectionId) return;

      previewUrl = URL.createObjectURL(files[0]);
      const { width, height } = await readImageDimensions(previewUrl);
      if (selectionIdRef.current !== selectionId) return;

      const dimensionError = validateScannerDimensions(width, height);
      if (dimensionError) throw new Error(dimensionError);

      setImage({
        file: files[0],
        previewUrl,
        width,
        height,
        inspection,
      });
      previewUrl = null; // The committed preview owns this object URL.
    } catch (cause) {
      if (selectionIdRef.current === selectionId) {
        setError(cause instanceof Error ? cause.message : "The image could not be checked.");
      }
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (selectionIdRef.current === selectionId) setIsChecking(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    void acceptImage(files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!handoffInProgressRef.current) {
      void acceptImage(Array.from(event.dataTransfer.files));
    }
  }

  function clearImage() {
    if (handoffInProgressRef.current) return;
    selectionIdRef.current += 1;
    setImage(null);
    setError(null);
    setIsChecking(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function openPdfConverter() {
    if (!image || handoffInProgressRef.current) return;
    handoffInProgressRef.current = true;
    setIsHandingOff(true);
    setError(null);

    try {
      // Preserve any PDF currently active in the workspace. The existing
      // handoff bridge retrieves this image locally by its IndexedDB ID.
      const storedFile = await ensureWorkspaceSourceFile(image.file, { activate: false });
      router.push(buildWorkspaceHandoffHref("/jpg-to-pdf", storedFile.id));
    } catch {
      setError("Browser workspace storage is unavailable. Allow storage for this site and try again.");
      handoffInProgressRef.current = false;
      setIsHandingOff(false);
    }
  }

  return (
    <ToolLayout
      label="Smart Scanner · V0.1"
      title="Your image. Your next document."
      description="Drop a picture, inspect it privately, then choose what to do next. Start with JPG or PNG to PDF; smarter document extraction is being developed."
      howToTitle="From image to PDF in three easy steps"
      howToSteps={[
        { title: "Select", description: "Choose or drop one JPG or PNG image (up to 25 MB)." },
        { title: "Review", description: "See the image, dimensions and available conversion options." },
        { title: "Convert", description: "Send your image to the existing JPG-to-PDF tool and download your PDF." },
      ]}
      tips={[
        { title: "Keep it private", description: "Image checks happen in this browser. Continuing saves a local copy in your browser workspace for the converter." },
        { title: "Use a clear image", description: "Crop distractions, use good light, and keep the page straight before photographing it." },
        { title: "Check your PDF", description: "Review the generated document before sharing it with anyone." },
      ]}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
            Smart image intake
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white sm:text-2xl">
            Start with an image
          </h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          <ShieldCheck size={15} /> Browser-only inspection
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={(event) => {
              event.preventDefault();
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
            }}
            onDrop={handleDrop}
            className={
              "relative rounded-3xl border-2 border-dashed p-5 transition sm:p-7 " +
              (isDragging
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30")
            }
          >
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                <UploadCloud size={30} aria-hidden="true" />
              </div>
            </div>
            <h3 className="mt-5 text-center text-lg font-bold text-slate-900 dark:text-white">
              Drop a photo or document image here
            </h3>
            <p className="mt-2 text-center text-sm leading-6 text-slate-600 dark:text-slate-300">
              JPG or PNG · One image · Maximum {MAX_SIZE_TEXT}
            </p>
            <input
              ref={inputRef}
              id="smart-scanner-image"
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={handleFileChange}
              disabled={isHandingOff}
              className="sr-only"
              tabIndex={-1}
              aria-describedby="smart-scanner-helper"
            />
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isHandingOff}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImagePlus size={18} />
                {image ? "Choose another image" : "Choose image"}
              </button>
            </div>
            <p id="smart-scanner-helper" className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Your image is never uploaded by this scanner.
            </p>
          </div>

          <div aria-live="polite" className="mt-4">
            {isChecking && (
              <p className="rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                Checking your image in this browser...
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
                {error}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Image preview</h3>
            {image && (
              <button
                type="button"
                onClick={clearImage}
                disabled={isHandingOff}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Trash2 size={16} /> Remove
              </button>
            )}
          </div>
          {image ? (
            <>
              <div className="mt-3 flex min-h-56 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                {/* Blob URLs stay local and cannot use Next's remote image loader. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.previewUrl}
                  alt={"Preview of " + image.file.name}
                  className="max-h-72 max-w-full object-contain"
                />
              </div>
              <div className="mt-4 flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
                <div className="min-w-0">
                  <p className="break-all text-sm font-bold text-slate-900 dark:text-white">{image.file.name}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {image.inspection.label} · {formatSize(image.file.size)} · {image.width} × {image.height} pixels
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-3 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center dark:border-slate-700 dark:bg-slate-900">
              <FileImage size={46} className="text-slate-300 dark:text-slate-600" />
              <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Your preview will appear here
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Nothing has been selected yet.
              </p>
            </div>
          )}
        </div>
      </div>

      <section className="mt-9 border-t border-slate-200 pt-8 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <ScanLine className="text-blue-700 dark:text-blue-300" size={22} />
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">
            What would you like to do?
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          The available option uses Kukureku&apos;s existing PDF tool. Future options are clearly marked and cannot be selected yet.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border-2 border-blue-300 bg-blue-50/70 p-5 dark:border-blue-700 dark:bg-blue-950/30">
            <div className="flex items-center justify-between">
              <FileText size={26} className="text-blue-700 dark:text-blue-300" />
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                Available
              </span>
            </div>
            <h3 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Image to PDF</h3>
            <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Put your picture on a PDF page and download it.
            </p>
            <button
              type="button"
              onClick={() => { void openPdfConverter(); }}
              disabled={!image || isChecking || isHandingOff}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-900"
            >
              {isHandingOff ? "Preparing image..." : "Convert to PDF"}
              {!isHandingOff && <ArrowRight size={17} />}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <FileSpreadsheet size={26} className="text-slate-500 dark:text-slate-400" />
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Planned
              </span>
            </div>
            <h3 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Image to Excel</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Turn photographed rows and columns into reviewable spreadsheet cells.
            </p>
            <p className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Not available in V0.1
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-center justify-between">
              <Sparkles size={26} className="text-slate-500 dark:text-slate-400" />
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Planned
              </span>
            </div>
            <h3 className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Image to Word</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Extract text and rebuild a document you can edit.
            </p>
            <p className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Not available in V0.1
            </p>
          </div>
        </div>
        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
          <LockKeyhole size={15} className="mt-0.5 shrink-0" />
          We do not send this image to an AI service or a remote server. File-format suggestions are based on local checks, not AI content recognition.
        </p>
      </section>
    </ToolLayout>
  );
}
