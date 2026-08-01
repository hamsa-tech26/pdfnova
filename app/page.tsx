import Navbar from "@/components/Navbar";
import ToolsSection from "@/components/ToolsSection";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900">
            Welcome to PDFNova
          </h1>

          <p className="mt-4 text-lg text-gray-600">
            The Smart AI-Powered PDF Toolkit
          </p>

          <button className="mt-8 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
            Start Free
          </button>
        </div>
      </main>

      <ToolsSection />
    </>
  );
}