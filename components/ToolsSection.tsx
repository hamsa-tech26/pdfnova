import Link from "next/link";
import {
  Archive,
  ArrowRight,
  FileImage,
  FileOutput,
  FileText,
  Files,
  ImageIcon,
  Layers3,
  RotateCw,
  Scissors,
  UnlockKeyhole,
  WandSparkles,
  Trash2,
  Copy,
  AlignLeft,
  PanelsTopLeft,
  ScanText,
  ListOrdered,
  ArrowDownUp,
  Eraser,
  Hash,
  LockKeyhole,
  Crop,
} from "lucide-react";

const tools = [
  {
    title: "Merge PDF",
    description: "Combine multiple PDF files into one document.",
    href: "/merge-pdf",
    icon: Files,
    accent: "bg-red-50 text-red-600",
  },
  {
    title: "Split PDF",
    description: "Extract selected pages into a separate PDF.",
    href: "/split-pdf",
    icon: Scissors,
    accent: "bg-orange-50 text-orange-600",
  },
  {
    title: "Compress PDF",
    description: "Reduce PDF file size while preserving readable quality.",
    href: "/compress-pdf",
    icon: Archive,
    accent: "bg-amber-50 text-amber-600",
  },
  {
    title: "PDF to Word",
    description: "Convert selectable-text PDFs into editable Word documents.",
    href: "/pdf-to-word",
    icon: FileText,
    accent: "bg-sky-50 text-sky-600",
  },
  {
    title: "Word to PDF",
    description: "Convert readable DOCX content into a PDF document.",
    href: "/word-to-pdf",
    icon: FileOutput,
    accent: "bg-blue-50 text-blue-600",
  },
  {
    title: "JPG to PDF",
    description: "Combine JPG or PNG images into one PDF document.",
    href: "/jpg-to-pdf",
    icon: ImageIcon,
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "PDF to JPG",
    description: "Convert PDF pages into JPG images or download them as a ZIP.",
    href: "/pdf-to-jpg",
    icon: FileImage,
    accent: "bg-violet-50 text-violet-600",
  },
  {
    title: "Organize PDF",
    description: "Reorder, rotate, move, and remove PDF pages visually.",
    href: "/organize-pdf",
    icon: Layers3,
    accent: "bg-cyan-50 text-cyan-600",
  },
  {
    title: "Rotate PDF",
    description: "Rotate every PDF page clockwise, counter-clockwise, or 180 degrees.",
    href: "/rotate-pdf",
    icon: RotateCw,
    accent: "bg-indigo-50 text-indigo-600",
  },
  { title: "Extract PDF Pages", description: "Save selected PDF pages or ranges as a new document.", href: "/extract-pdf-pages", icon: Copy, accent: "bg-lime-50 text-lime-700" },
  { title: "Delete PDF Pages", description: "Remove unwanted pages and download a clean PDF copy.", href: "/delete-pdf-pages", icon: Trash2, accent: "bg-rose-50 text-rose-600" },
  { title: "PDF to Text", description: "Extract selectable PDF text into a plain TXT file.", href: "/pdf-to-text", icon: AlignLeft, accent: "bg-slate-100 text-slate-700" },
  { title: "Flatten PDF", description: "Flatten supported PDF form fields into page content.", href: "/flatten-pdf", icon: PanelsTopLeft, accent: "bg-fuchsia-50 text-fuchsia-600" },
  { title: "OCR PDF", description: "Recognize English text in scanned PDF pages locally.", href: "/ocr-pdf", icon: ScanText, accent: "bg-blue-50 text-blue-700" },
  { title: "Reorder PDF Pages", description: "Create a PDF with pages in the exact order you choose.", href: "/reorder-pdf-pages", icon: ListOrdered, accent: "bg-cyan-50 text-cyan-700" },
  { title: "Reverse PDF Pages", description: "Reverse the complete page order of a PDF in one click.", href: "/reverse-pdf", icon: ArrowDownUp, accent: "bg-orange-50 text-orange-700" },
  { title: "Remove PDF Metadata", description: "Clear common document metadata from a PDF copy.", href: "/remove-pdf-metadata", icon: Eraser, accent: "bg-emerald-50 text-emerald-700" },
  { title: "Add Page Numbers", description: "Add centered page numbers to every PDF page.", href: "/add-page-numbers", icon: Hash, accent: "bg-violet-50 text-violet-700" },
  {
    title: "Crop PDF",
    description: "Trim visible margins from every PDF page in your browser.",
    href: "/crop-pdf",
    icon: Crop,
    accent: "bg-amber-50 text-amber-700",
  },
  {
    title: "Resize PDF Pages",
    description: "Resize pages to A4, Letter, Legal, or A5 without stretching content.",
    href: "/resize-pdf-pages",
    icon: FileOutput,
    accent: "bg-sky-50 text-sky-700",
  },
  {
    title: "Watermark PDF",
    description: "Add custom text or a watermark to PDF pages.",
    href: "/watermark-pdf",
    icon: WandSparkles,
    accent: "bg-pink-50 text-pink-600",
  },
  {
    title: "Protect PDF",
    description: "Add AES-256 opening-password protection to a PDF locally.",
    href: "/protect-pdf",
    icon: LockKeyhole,
    accent: "bg-blue-50 text-blue-700",
  },
  {
    title: "Unlock PDF",
    description: "Remove password protection using the correct password.",
    href: "/unlock-pdf",
    icon: UnlockKeyhole,
    accent: "bg-teal-50 text-teal-600",
  },
];

export default function ToolsSection() {
  return (
    <section id="tools" className="bg-white px-5 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
            PDF Tools
          </p>

          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            Free PDF tools that keep files on your device
          </h2>

          <p className="mt-5 text-lg leading-8 text-gray-600">
            Merge, split, compress, convert, organize, OCR, reorder, number, clean metadata, crop, resize, protect, watermark, and unlock PDFs
            in your browser with no account required.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <Link
                key={tool.title}
                href={tool.href}
                className="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-blue-200 hover:shadow-2xl"
              >
                <div
                  className={
                    "flex h-14 w-14 items-center justify-center rounded-2xl " +
                    tool.accent
                  }
                >
                  <Icon size={28} strokeWidth={2.2} />
                </div>

                <h3 className="mt-6 text-xl font-bold text-gray-900">
                  {tool.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {tool.description}
                </p>

                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                  Use tool
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/dashboard#all-tools"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-800 transition hover:border-blue-300 hover:text-blue-600"
          >
            Open full workspace
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
