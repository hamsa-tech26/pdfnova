import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms for using Peakatee PDF and its browser-based document tools.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <>
      <Navbar />

      <main className="bg-slate-50 px-5 py-12 dark:bg-slate-950 sm:px-6 lg:py-16">
        <article className="mx-auto max-w-3xl rounded-[2rem] border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            Peakatee
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-950 dark:text-white">
            Terms of Use
          </h1>
          <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">
            Last updated: October 2, 2026
          </p>

          <div className="mt-9 space-y-8 text-base leading-8 text-gray-700 dark:text-slate-300">
            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Using Peakatee PDF
              </h2>
              <p className="mt-3">
                You may use the currently available tools for lawful document work. You are responsible for the files you choose to process and for having the rights or permission needed to use them.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Password-protected documents
              </h2>
              <p className="mt-3">
                Use the Unlock PDF tool only on documents you own or are authorized to unlock. Peakatee is not intended to bypass access controls on files you do not have permission to use.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Output and compatibility
              </h2>
              <p className="mt-3">
                Document conversion and compression can change formatting, image quality, metadata, or other file characteristics. Review downloaded results before relying on them for important work.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Availability
              </h2>
              <p className="mt-3">
                Peakatee may improve, replace, limit, or discontinue tools as the service evolves. Features marked Coming Soon are planned features and are not commitments that they will be available on a particular date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                No professional advice
              </h2>
              <p className="mt-3">
                Peakatee provides document utilities, not legal, financial, medical, or other professional advice. You remain responsible for reviewing documents and outputs before using them in consequential decisions.
              </p>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
