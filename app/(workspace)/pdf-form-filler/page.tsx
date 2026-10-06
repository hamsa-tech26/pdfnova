"use client";

import ActionButton from "@/components/pdf/ActionButton";
import ErrorCard from "@/components/pdf/ErrorCard";
import FileCard from "@/components/pdf/FileCard";
import FileUploader from "@/components/pdf/FileUploader";
import SuccessCard from "@/components/pdf/SuccessCard";
import ToolLayout from "@/components/pdf/ToolLayout";
import { downloadFile } from "@/lib/downloadFile";
import {
  applyPdfFormValues,
  describePdfFormFields,
  type PdfFormFieldDescriptor,
  type PdfFormFieldValue,
  type PdfFormValues,
} from "@/lib/pdf/formFields";
import { addRecentFile } from "@/lib/storage/recentFiles";
import { FileInput, ShieldCheck, TriangleAlert } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const tips = [
  { title: "Standard AcroForm support", description: "Fill common text, checkbox, dropdown, option-list, and radio fields." },
  { title: "Editable or flattened", description: "Keep fields interactive or flatten the completed values into the saved copy." },
  { title: "XFA limitation", description: "Dynamic XFA-only forms are not supported by this browser workflow." },
];

const faqs = [
  { question: "Which PDF forms work?", answer: "Standard AcroForm fields are supported. XFA-only and unusual custom widgets may not be editable." },
  { question: "What does flatten mean?", answer: "Flattening turns the current field appearances into page content and removes the interactive fields." },
  { question: "Is form data uploaded?", answer: "No. Your PDF and entered values stay inside your browser." },
];

function initialValues(fields: PdfFormFieldDescriptor[]): PdfFormValues {
  return Object.fromEntries(fields.map((field) => [field.name, field.value]));
}

export default function PdfFormFillerPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<PdfFormFieldDescriptor[]>([]);
  const [values, setValues] = useState<PdfFormValues>({});
  const [hasXfa, setHasXfa] = useState(false);
  const [flatten, setFlatten] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [outputFileName, setOutputFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const supportedFields = hasXfa ? [] : fields.filter((field) => field.kind !== "unsupported");
  const unsupportedCount = fields.length - supportedFields.length;

  function resetResult() {
    setOutputBytes(null);
    setOutputFileName("");
    setErrorMessage("");
  }

  function updateValue(name: string, value: PdfFormFieldValue) {
    setValues((current) => ({ ...current, [name]: value }));
    resetResult();
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
      const described = describePdfFormFields(pdf);
      setFile(selectedFile);
      setFields(described.fields);
      setValues(initialValues(described.fields));
      setHasXfa(described.hasXfa);
      setFlatten(false);
      setOutputBytes(null);
      setOutputFileName("");
      const count = described.fields.filter((field) => field.kind !== "unsupported").length;
      if (described.hasXfa) {
        setErrorMessage("This PDF contains XFA form data. To avoid changing or disconnecting the XFA form structure, Kukureku does not modify this document.");
      } else if (count === 0) {
        setErrorMessage("No supported interactive AcroForm fields were found.");
      } else {
        setErrorMessage("");
        toast.success(String(count) + " supported form " + (count === 1 ? "field" : "fields") + " found.");
      }
    } catch {
      setFile(null);
      setFields([]);
      setValues({});
      setHasXfa(false);
      setErrorMessage("Unable to open this PDF. It may be damaged or password-protected.");
    }
  }

  function startAgain() {
    setFile(null);
    setFields([]);
    setValues({});
    setHasXfa(false);
    setFlatten(false);
    resetResult();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function saveFilledForm() {
    if (!file || supportedFields.length === 0 || hasXfa) return;
    setIsProcessing(true);
    setErrorMessage("");
    try {
      const pdf = await PDFDocument.load(await file.arrayBuffer());
      applyPdfFormValues(pdf, values, flatten);
      const bytes = await pdf.save({ updateFieldAppearances: true });
      const baseName = file.name.replace(/\.pdf$/i, "") || "kukureku";
      const generatedFileName = baseName + (flatten ? "-filled-flattened.pdf" : "-filled.pdf");
      downloadFile(bytes, generatedFileName, "application/pdf");
      setOutputBytes(bytes);
      setOutputFileName(generatedFileName);
      addRecentFile({ fileName: generatedFileName, toolName: "PDF Form Filler" });
      toast.success("PDF form completed successfully.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "The PDF form could not be saved.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <ToolLayout
      label="PDF Form Filler"
      title="Fill PDF forms privately"
      description="Complete existing interactive PDF fields and download an editable or flattened copy without uploading your document."
      tips={tips}
      faqs={faqs}
      howToTitle="How to fill a PDF form"
      howToSteps={[
        { title: "Choose a PDF form", description: "Select a PDF containing standard interactive AcroForm fields." },
        { title: "Complete the fields", description: "Enter text and choose checkbox, dropdown, list, or radio values." },
        { title: "Download the completed copy", description: "Keep fields interactive or flatten them before saving." },
      ]}
      maxWidthClassName="max-w-5xl"
    >
      <FileUploader
        fileInputRef={fileInputRef}
        onFileSelection={handleFileSelection}
        accept=".pdf,application/pdf"
        multiple={false}
        title="Select one PDF form"
        description="Choose or drag an interactive PDF form."
        buttonText="Choose PDF"
        helperText="Standard AcroForm PDFs · Maximum file size: 25 MB"
        disabled={isProcessing}
      />

      {file && (
        <div className="mt-8 space-y-6">
          <FileCard
            file={file}
            onRemove={isProcessing ? undefined : startAgain}
            removeLabel="Remove PDF"
            statusText={isProcessing ? "Saving completed form" : outputBytes ? "Completed PDF created" : String(supportedFields.length) + " supported fields"}
          />

          {!outputBytes && supportedFields.length > 0 && (
            <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <FileInput size={22} className="text-blue-600" />
                <div>
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white">Form fields</h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Values remain local to this browser.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {supportedFields.map((field) => (
                  <div key={field.name} className="rounded-2xl border border-gray-200 p-4 dark:border-slate-800">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label htmlFor={"field-" + field.name} className="break-all text-sm font-bold text-gray-950 dark:text-white">{field.name}</label>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase text-gray-500 dark:bg-slate-800">{field.kind}</span>
                    </div>

                    {field.kind === "text" && (field.multiline ? (
                      <textarea id={"field-" + field.name} rows={4} value={typeof values[field.name] === "string" ? values[field.name] as string : ""} onChange={(event) => updateValue(field.name, event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    ) : (
                      <input id={"field-" + field.name} type="text" value={typeof values[field.name] === "string" ? values[field.name] as string : ""} onChange={(event) => updateValue(field.name, event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    ))}

                    {field.kind === "checkbox" && (
                      <label className="inline-flex items-center gap-3 text-sm font-semibold dark:text-slate-200">
                        <input id={"field-" + field.name} type="checkbox" checked={values[field.name] === true} onChange={(event) => updateValue(field.name, event.target.checked)} className="h-5 w-5 rounded" />
                        Checked
                      </label>
                    )}

                    {(field.kind === "dropdown" || field.kind === "radio") && (
                      <select id={"field-" + field.name} value={typeof values[field.name] === "string" ? values[field.name] as string : ""} onChange={(event) => updateValue(field.name, event.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        <option value="">No selection</option>
                        {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    )}

                    {field.kind === "option-list" && (
                      <select id={"field-" + field.name} multiple value={Array.isArray(values[field.name]) ? values[field.name] as string[] : []} onChange={(event) => updateValue(field.name, Array.from(event.target.selectedOptions, (option) => option.value))} className="min-h-32 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                        {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              <label className="mt-5 flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <input type="checkbox" checked={flatten} onChange={(event) => { setFlatten(event.target.checked); resetResult(); }} className="mt-1 h-5 w-5 rounded" />
                <span>
                  <span className="block font-bold dark:text-white">Flatten completed form</span>
                  <span className="mt-1 block text-sm text-gray-500 dark:text-slate-400">Remove interactive fields after their current appearance is written into the downloaded PDF.</span>
                </span>
              </label>

              {(hasXfa || unsupportedCount > 0) && (
                <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <TriangleAlert size={19} className="shrink-0" />
                  <p>{hasXfa ? "This document also contains XFA data. Only supported AcroForm fields are editable here." : String(unsupportedCount) + " unsupported form fields will remain unchanged."}</p>
                </div>
              )}
            </section>
          )}

          {!outputBytes && supportedFields.length > 0 && !errorMessage && (
            <ActionButton
              isLoading={isProcessing}
              loadingText="Saving completed form..."
              loadingSubtitle="Writing form values locally."
              buttonText="Fill and Download PDF"
              subtitle={flatten ? "The saved copy will be flattened." : "Supported fields will remain interactive."}
              onClick={saveFilledForm}
              disabled={isProcessing}
            />
          )}

          {!isProcessing && outputBytes && (
            <SuccessCard
              title="Your completed PDF form is ready"
              description={flatten ? "Values were saved and flattened." : "Values were saved and supported fields remain interactive."}
              fileName={outputFileName}
              onDownloadAgain={() => downloadFile(outputBytes, outputFileName, "application/pdf")}
              onStartAgain={startAgain}
              downloadLabel="Download Filled PDF Again"
              resetLabel="Fill Another PDF Form"
            />
          )}

          {!isProcessing && errorMessage && (
            <ErrorCard
              title="PDF form needs attention"
              description={errorMessage}
              reasons={[
                "The PDF may use XFA instead of standard AcroForm fields.",
                "Some custom widgets may not be supported.",
                "The PDF may be password-protected or damaged.",
              ]}
              onRetry={file && supportedFields.length > 0 && !hasXfa ? saveFilledForm : undefined}
              onReset={startAgain}
              retryLabel="Retry Save"
              resetLabel="Choose Another PDF"
            />
          )}
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400">
        <ShieldCheck size={18} className="text-emerald-600" />
        Form values are processed locally in your browser and are not uploaded.
      </div>
    </ToolLayout>
  );
}
