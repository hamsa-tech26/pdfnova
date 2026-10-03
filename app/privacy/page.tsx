import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Kukureku PDF handles documents and browser-based processing.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />

      <main className="bg-slate-50 px-5 py-12 dark:bg-slate-950 sm:px-6 lg:py-16">
        <article className="mx-auto max-w-3xl rounded-[2rem] border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
            Kukureku
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-950 dark:text-white">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">
            Last updated: October 2, 2026
          </p>

          <div className="mt-9 space-y-8 text-base leading-8 text-gray-700 dark:text-slate-300">
            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Browser-based document processing
              </h2>
              <p className="mt-3">
                Kukureku PDF is designed so supported current tools process your documents locally in your browser. Those tool workflows do not intentionally upload the contents of your document to Kukureku servers for processing.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Recent activity on your device
              </h2>
              <p className="mt-3">
                The workspace may store limited recent-task information in your browser so you can see recent activity. You can clear that history from the workspace. This local history is separate from the document itself.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Website hosting
              </h2>
              <p className="mt-3">
                Like other websites, the hosting and network providers used to deliver Kukureku may receive ordinary technical request information when pages and site assets are loaded, such as IP address, browser details, timestamps, and requested URLs. This is different from the local document-processing workflow.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Accounts, advertising, and AI features
              </h2>
              <p className="mt-3">
                The current launch does not require an account to use the available PDF tools. Planned Kukureku AI features are not part of the current launch. If a future feature needs cloud processing or changes how document data is handled, this policy should be updated before that feature is enabled.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">
                Your responsibility
              </h2>
              <p className="mt-3">
                Avoid processing documents you are not authorized to access. For especially sensitive material, review the tool description and your organization&apos;s own security requirements before use.
              </p>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
