import Navbar from "@/components/Navbar";

export default function ProtectPdfPage() {
  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
            Protect PDF
          </p>

          <h1 className="mt-4 text-4xl font-extrabold text-gray-950 md:text-6xl">
            Password protection is coming soon
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">
            We are preparing real PDF encryption support for this tool.
          </p>
        </div>
      </main>
    </>
  );
}