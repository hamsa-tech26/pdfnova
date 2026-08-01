import Navbar from "@/components/Navbar";
import ToolsSection from "@/components/ToolsSection";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <section className="bg-gradient-to-b from-blue-50 to-white px-6 py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 md:grid-cols-2">
            <div>
              <p className="mb-4 inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                AI-Powered PDF Workspace
              </p>

              <h1 className="text-5xl font-extrabold leading-tight text-gray-900 md:text-6xl">
                Work smarter with every PDF
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-gray-600">
                Merge, split, compress, convert, summarize, and chat with your
                PDF documents in one secure workspace.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <button className="rounded-xl bg-blue-600 px-7 py-4 font-semibold text-white transition hover:bg-blue-700">
                  Start Free
                </button>

                <button className="rounded-xl border border-gray-300 bg-white px-7 py-4 font-semibold text-gray-800 transition hover:bg-gray-50">
                  Explore Tools
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-6 text-sm text-gray-600">
                <span>✓ No installation</span>
                <span>✓ Secure processing</span>
                <span>✓ Works on all devices</span>
              </div>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl">
              <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-12 text-center">
                <div className="text-6xl">📄</div>

                <h2 className="mt-4 text-2xl font-bold text-gray-900">
                  Upload your PDF
                </h2>

                <p className="mt-2 text-gray-600">
                  Drag and drop your document here
                </p>

                <button className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
                  Choose File
                </button>

                <p className="mt-4 text-sm text-gray-500">
                  Maximum file size: 25 MB
                </p>
              </div>
            </div>
          </div>
        </section>

        <ToolsSection />
      </main>
    </>
  );
}