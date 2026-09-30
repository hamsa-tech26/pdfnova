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
  Scissors,
  UnlockKeyhole,
  WandSparkles,
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
    title: "Watermark PDF",
    description: "Add custom text or a watermark to PDF pages.",
    href: "/watermark-pdf",
    icon: WandSparkles,
    accent: "bg-pink-50 text-pink-600",
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
            Everything you need for everyday PDF work
          </h2>

          <p className="mt-5 text-lg leading-8 text-gray-600">
            Choose a tool and work directly in your browser with a simple,
            focused workflow.
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
