"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import { renderPdfPages, type RenderedPdfPage } from "@/lib/pdf/render";
import {
  normalizeVisibleRect,
  visibleRectToPdfPlacement,
  type VisibleRect,
} from "@/lib/pdf/visibleRectGeometry";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { FormInput, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import {
  ChangeEvent,
  PointerEvent,
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

const MAX_FILE_SIZE = 25 * 1024 * 1024;

type FieldType = "text" | "checkbox" | "dropdown";

type FieldDefinition = {
  id: number;
  name: string;
  type: FieldType;
  page: number;
  rect: VisibleRect;
  options: string[];
};

const tips = [
  { title: "Draw fields visually", description: "Choose a field type, drag its area on the page preview, then add it to the form." },
  { title: "Use unique field names", description: "Every interactive field needs a unique name so PDF readers can store its value correctly." },
  { title: "Create text, checkbox, and dropdown fields", description: "This first form-builder workflow focuses on the most common field types and keeps the result editable." },
];

const faqs = [
  { question: "Does this create a fillable PDF?", answer: "Yes. Kukureku adds standard AcroForm text fields, checkboxes, and dropdowns that compatible PDF readers can fill." },
  { question: "Can I add fields to multiple pages?", answer: "Yes. Choose a page, draw fields, then switch pages and continue building the form." },
  { question: "Is the PDF uploaded?", answer: "No. Page previews and form-field creation run locally in your browser." },
];

function pointRatio(event: PointerEvent<HTMLDivElement>, element: HTMLDivElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
  };
}

function parseOptions(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((option) => option.trim())
    .filter(Boolean);
}

export default function CreateFillablePdfPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewRequestRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const nextIdRef = useRef(1);

  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPage, setSelectedPage] = useState(1);
  const [preview, setPreview] = useState<RenderedPdfPage | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [fieldName, setFieldName] = useState("field_1");
  const [dropdownOptions, setDropdownOptions] = useState("Option 1, Option 2");
  const [pendingRect, setPendingRect] = useState<VisibleRect | null>(null);
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const currentPageFields = fields.filter((field) => field.page === selectedPage);

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
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
      });
      if (requestId !== previewRequestRef.current) return;
      if (!pages[0]) throw new Error("Unable to render the selected page.");
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
      const pdf = await PDFDocument.load(await selectedFile.arrayBuffer());
      const count = pdf.getPageCount();
      setFile(selectedFile);
      setPageCount(count);
      setSelectedPage(1);
      setPreview(null);
      setFields([]);
      setPendingRect(null);
      setFieldType("text");
      setFieldName("field_1");
      setDropdownOptions("Option 1, Option 2");
      nextIdRef.current = 1;
      resetResult();
      void renderSelectedPreview(selectedFile, 1);
      toast.success("PDF ready for form fields.");
    } catch {
      setFile(null);
      setErrorMessage("Unable to open this PDF. It may be damaged or password-protected.");
    }
  }

  function startAgain() {
    previewRequestRef.current += 1;
    setFile(null);
    setPageCount(0);
    setSelectedPage(1);
    setPreview(null);
    setFields([]);
    setPendingRect(null);
    resetResult();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function choosePage(pageNumber: number) {
    if (!file) return;
    setSelectedPage(pageNumber);
    setPreview(null);
    setPendingRect(null);
    resetResult();
    void renderSelectedPreview(file, pageNumber);
  }

  function beginDraw(event: PointerEvent<HTMLDivElement>) {
    if (!previewRef.current || isProcessing) return;
    const start = pointRatio(event, previewRef.current);
    dragStartRef.current = start;
    setPendingRect({ x: start.x, y: start.y, width: 0, height: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDraw(event: PointerEvent<HTMLDivElement>) {
    if (!dragStartRef.current || !previewRef.current) return;
    const point = pointRatio(event, previewRef.current);
    setPendingRect({
      x: dragStartRef.current.x,
      y: dragStartRef.current.y,
      width: point.x - dragStartRef.current.x,
      height: point.y - dragStartRef.current.y,
    });
  }

  function endDraw(event: PointerEvent<HTMLDivElement>) {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (pendingRect) setPendingRect(normalizeVisibleRect(pendingRect));
  }

  function addField() {
    const name = fieldName.trim();
    if (!pendingRect || pendingRect.width < 0.005 || pendingRect.height < 0.005) {
      setErrorMessage("Drag a visible field area on the page preview first.");
      return;
    }
    if (!name) {
      setErrorMessage("Enter a field name.");
      return;
    }
    if (fields.some((field) => field.name === name)) {
      setErrorMessage("Every new field needs a unique name.");
      return;
    }
    const options = fieldType === "dropdown" ? parseOptions(dropdownOptions) : [];
    if (fieldType === "dropdown" && options.length < 2) {
      setErrorMessage("Add at least two dropdown options.");
      return;
    }

    const id = nextIdRef.current++;
    setFields((current) => [
      ...current,
      { id, name, type: fieldType, page: selectedPage, rect: pendingRect, options },
    ]);
    setPendingRect(null);
    setFieldName("field_" + String(id + 1));
    resetResult();
  }

  function removeField(id: number) {
    setFields((current) => current.filter((field) => field.id !== id));
    resetResult();
  }

  async function createFillablePdf() {
    if (!file || fields.length === 0) return;
    setIsProcessing(true);
    setErrorMessage("");
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      const form = pdf.getForm();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const existingNames = new Set(form.getFields().map((field) => field.getName()));

      for (const definition of fields) {
        if (existingNames.has(definition.name)) {
          throw new Error("The PDF already contains a form field named " + definition.name + ". Rename the new field and try again.");
        }

        const page = pdf.getPage(definition.page - 1);
        const placement = visibleRectToPdfPlacement(
          page.getCropBox(),
          page.getRotation().angle,
          definition.rect,
        );

        const appearance = {
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
          rotate: degrees(placement.rotation),
          borderColor: rgb(0.25, 0.35, 0.5),
          backgroundColor: rgb(1, 1, 1),
          borderWidth: 1,
        };

        if (definition.type === "text") {
          const field = form.createTextField(definition.name);
          field.addToPage(page, { ...appearance, font });
        } else if (definition.type === "checkbox") {
          const field = form.createCheckBox(definition.name);
          field.addToPage(page, appearance);
        } else {
          const field = form.createDropdown(definition.name);
          field.setOptions(definition.options);
          field.addToPage(page, { ...appearance, font });
        }

        existingNames.add(definition.name);
      }

      form.updateFieldAppearances(font);
      const bytes = await pdf.save({ updateFieldAppearances: true });
      const baseName = file.name.replace(/\.pdf$/i, "") || "kukureku";
      const generatedFileName = baseName + "-fillable.pdf";
      downloadFile(bytes, generatedFileName, "application/pdf");
      setOutputBytes(bytes);
      setOutputFileName(generatedFileName);
      addRecentFile({ fileName: generatedFileName, toolName: "Create Fillable PDF" });
      toast.success("Fillable PDF created successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "The fillable PDF could not be created.");
    } finally {
      setIsProcessing(false);
    }
  }

  function overlay(rect: VisibleRect, label: string, pending = false) {
    const normalized = normalizeVisibleRect(rect);
    return (
      <div
        className={pending ? "pointer-events-none absolute border-2 border-dashed border-amber-500 bg-amber-200/20" : "pointer-events-none absolute border-2 border-blue-500 bg-blue-200/20"}
        style={{
          left: String(normalized.x * 100) + "%",
          top: String(normalized.y * 100) + "%",
          width: String(normalized.width * 100) + "%",
          height: String(normalized.height * 100) + "%",
        }}
      >
        {!pending && <span className="absolute -top-6 left-0 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">{label}</span>}
      </div>
    );
  }

  return (
    <ToolLayout
      label="Create Fillable PDF"
      title="Create fillable PDF forms privately"
      description="Draw standard interactive text fields, checkboxes, and dropdowns on PDF page previews, then download a fillable AcroForm PDF without uploading your document."
      tips={tips}
      faqs={faqs}
      howToTitle="How to create a fillable PDF"
      howToSteps={[
        { title: "Choose a PDF", description: "Select the document that will become your form." },
        { title: "Draw form fields", description: "Choose a field type, drag its area on the preview, name it, and add it." },
        { title: "Create the fillable copy", description: "Kukureku adds the interactive AcroForm fields and downloads the new PDF." },
      ]}
      maxWidthClassName="max-w-7xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF"
        description="Choose or drag the PDF you want to make fillable."
        buttonText="Choose PDF"
        helperText="PDF · Maximum file size: 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard file={file} onRemove={isProcessing ? undefined : startAgain} removeLabel="Remove PDF" statusText={isProcessing ? "Creating fillable form" : String(fields.length) + " new form fields"} />

          {!outputBytes && (
            <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2"><FormInput size={21} className="text-blue-600" /><h2 className="text-lg font-bold dark:text-white">New field</h2></div>

                <label className="mt-5 block text-sm font-semibold dark:text-white">Field type
                  <select value={fieldType} onChange={(event) => { setFieldType(event.target.value as FieldType); resetResult(); }} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                    <option value="text">Text field</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                </label>

                <label className="mt-4 block text-sm font-semibold dark:text-white">Unique field name
                  <input value={fieldName} onChange={(event) => { setFieldName(event.target.value); resetResult(); }} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 dark:border-slate-700 dark:bg-slate-950" />
                </label>

                {fieldType === "dropdown" && (
                  <label className="mt-4 block text-sm font-semibold dark:text-white">Dropdown options
                    <textarea rows={4} value={dropdownOptions} onChange={(event) => { setDropdownOptions(event.target.value); resetResult(); }} className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 dark:border-slate-700 dark:bg-slate-950" />
                    <span className="mt-1 block text-xs text-gray-500">Separate options with commas, semicolons, or new lines.</span>
                  </label>
                )}

                <button type="button" onClick={addField} disabled={!pendingRect} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">Add field to page</button>

                <div className="mt-6 border-t border-gray-200 pt-5 dark:border-slate-800">
                  <h3 className="font-bold dark:text-white">Added fields</h3>
                  <div className="mt-3 space-y-2">
                    {fields.length === 0 && <p className="text-sm text-gray-500">No fields added yet.</p>}
                    {fields.map((field) => (
                      <div key={field.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-slate-800">
                        <div className="min-w-0"><p className="truncate font-semibold">{field.name}</p><p className="text-xs text-gray-500">{field.type} · page {field.page}</p></div>
                        <button type="button" onClick={() => removeField(field.id)} aria-label={"Remove " + field.name} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold dark:text-white">Draw field area</h2>
                    <p className="text-sm text-gray-500">Drag on the page preview, then click Add field to page.</p>
                  </div>
                  <select value={selectedPage} onChange={(event) => choosePage(Number(event.target.value))} className="rounded-xl border border-gray-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
                    {Array.from({ length: pageCount }, (_, index) => <option key={index + 1} value={index + 1}>Page {index + 1}</option>)}
                  </select>
                </div>

                {isRenderingPreview && <div className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-dashed">Rendering preview...</div>}

                {!isRenderingPreview && preview && (
                  <div
                    ref={previewRef}
                    onPointerDown={beginDraw}
                    onPointerMove={moveDraw}
                    onPointerUp={endDraw}
                    onPointerCancel={endDraw}
                    className="relative mx-auto mt-6 w-full max-w-3xl touch-none cursor-crosshair overflow-hidden rounded-2xl border bg-white"
                    style={{ aspectRatio: String(preview.width) + " / " + String(preview.height) }}
                  >
                    <img src={preview.dataUrl} alt={"PDF page " + String(selectedPage)} draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
                    {currentPageFields.map((field) => <div key={field.id}>{overlay(field.rect, field.name)}</div>)}
                    {pendingRect && overlay(pendingRect, "pending", true)}
                  </div>
                )}

                <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <TriangleAlert size={19} className="shrink-0" />
                  <p>Interactive form support varies between PDF viewers. Test the downloaded form in your intended viewer before distributing it widely.</p>
                </div>
              </div>
            </section>
          )}

          {!outputBytes && fields.length > 0 && !errorMessage && (
            <ActionButton
              isLoading={isProcessing}
              loadingText="Creating fillable PDF..."
              loadingSubtitle="Adding interactive form widgets locally."
              buttonText="Create Fillable PDF"
              subtitle={"Adds " + String(fields.length) + " new interactive form fields."}
              onClick={createFillablePdf}
              disabled={isProcessing || isRenderingPreview}
            />
          )}

          {!isProcessing && outputBytes && (
            <SuccessCard
              title="Your fillable PDF is ready"
              description="The new interactive AcroForm fields were added successfully."
              fileName={outputFileName}
              onDownloadAgain={() => downloadFile(outputBytes, outputFileName, "application/pdf")}
              onStartAgain={startAgain}
              downloadLabel="Download Fillable PDF Again"
              resetLabel="Build Another Fillable PDF"
            />
          )}

          {!isProcessing && errorMessage && (
            <ErrorCard
              title="Fillable PDF needs attention"
              description={errorMessage}
              reasons={[
                "A new field name may conflict with an existing field.",
                "A field area may be too small or outside the visible page.",
                "The PDF may be password-protected or damaged.",
              ]}
              onRetry={file && fields.length > 0 ? createFillablePdf : undefined}
              onReset={startAgain}
              retryLabel="Retry Build"
              resetLabel="Choose Another PDF"
            />
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck size={18} className="text-emerald-600" />
        Form design and PDF updates are processed locally inside your browser.
      </div>
    </ToolLayout>
  );
}
