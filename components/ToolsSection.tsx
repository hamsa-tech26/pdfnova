export default function ToolsSection() {
  const tools = [
    "Merge PDF",
    "Split PDF",
    "Compress PDF",
    "PDF to Word",
    "Word to PDF",
    "JPG to PDF",
    "OCR PDF",
    "AI Chat",
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="mb-4 text-center text-4xl font-bold">
          Popular PDF Tools
        </h2>

        <p className="mb-12 text-center text-gray-600">
          Everything you need to work with PDF files.
        </p>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {tools.map((tool) => (
            <div
              key={tool}
              className="rounded-2xl border border-gray-200 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 text-4xl">📄</div>

              <h3 className="font-semibold">{tool}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}