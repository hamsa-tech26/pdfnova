import {
  Combine,
  Scissors,
  Archive,
  FileText,
  FileOutput,
  Image,
  ScanText,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const tools = [
  {
    title: "Merge PDF",
    description: "Combine multiple PDF files into one document.",
    icon: Combine,
    accent: "bg-red-50 text-red-600",
  },
  {
    title: "Split PDF",
    description: "Separate pages or extract selected sections.",
    icon: Scissors,
    accent: "bg-orange-50 text-orange-600",
  },
  {
    title: "Compress PDF",
    description: "Reduce file size while keeping good quality.",
    icon: Archive,
    accent: "bg-amber-50 text-amber-600",
  },
  {
    title: "PDF to Word",
    description: "Convert PDFs into editable Word documents.",
    icon: FileText,
    accent: "bg-blue-50 text-blue-600",
  },
  {
    title: "Word to PDF",
    description: "Turn Word documents into secure PDF files.",
    icon: FileOutput,
    accent: "bg-indigo-50 text-indigo-600",
  },
  {
    title: "JPG to PDF",
    description: "Convert images into a clean PDF document.",
    icon: Image,
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "OCR PDF",
    description: "Extract editable text from scanned documents.",
    icon: ScanText,
    accent: "bg-violet-50 text-violet-600",
  },
  {
    title: "AI Chat",
    description: "Ask questions and understand your PDF faster.",
    icon: Sparkles,
    accent: "bg-cyan-50 text-cyan-600",
  },
];

export default function ToolsSection() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
            PDF Tools
          </p>

          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            Everything you need for your documents
          </h2>

          <p className="mt-5 text-lg leading-8 text-gray-600">
            Fast, secure, and easy-to-use tools for everyday PDF work.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <button
                key={tool.title}
                type="button"
                className="group rounded-3xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-blue-200 hover:shadow-2xl"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tool.accent}`}
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
              </button>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <button className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-800 transition hover:border-blue-300 hover:text-blue-600">
            View all PDF tools
          </button>
        </div>
      </div>
    </section>
  );
}