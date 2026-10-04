import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Kukureku PDF - Private Browser-Based PDF Tools",
  description:
    "Learn how Kukureku PDF keeps document work simple and private with browser-based PDF tools, honest limitations, and no account requirement.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Kukureku PDF - Private Browser-Based PDF Tools",
    description:
      "Learn how Kukureku PDF keeps document work simple and private with browser-based PDF tools, honest limitations, and no account requirement.",
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Kukureku PDF - Private Browser-Based PDF Tools",
    description:
      "Learn how Kukureku PDF keeps document work simple and private with browser-based PDF tools, honest limitations, and no account requirement.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "About Kukureku PDF",
      url: `${SITE_URL}/about`,
      description:
        "About Kukureku PDF and its private browser-based document tools.",
      isPartOf: {
        "@type": "WebSite",
        name: PRODUCT_NAME,
        url: SITE_URL,
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: PRODUCT_NAME,
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "About",
          item: `${SITE_URL}/about`,
        },
      ],
    },
  ],
};

const currentTools = [
  "Merge PDF",
  "Split PDF",
  "Compress PDF",
  "PDF to Word",
  "Word to PDF",
  "JPG to PDF",
  "PDF to JPG",
  "Organize PDF",
  "Watermark PDF",
  "Unlock PDF",
];

export default function AboutPage() {
  return (
    <>
      <Navbar />

      <main className="bg-slate-50 px-5 py-10 dark:bg-slate-950 sm:px-6 lg:py-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />

        <div className="mx-auto max-w-5xl space-y-8">
          <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-8 text-white shadow-2xl sm:p-10 lg:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
              About Kukureku PDF
            </p>

            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Private PDF tools built for everyday document work
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-blue-100">
              Kukureku PDF is a browser-based workspace for common PDF tasks.
              The current tools are designed to process supported files locally
              on your device, without requiring an account or software installation.
            </p>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Why the name Kukureku?
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                Kukureku is inspired by the rooster&apos;s call at dawn: a clear
                signal to start. The product follows the same idea — open a file,
                complete one focused task, download the result, and move on.
              </p>
            </article>

            <article className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Privacy by design
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                Current Kukureku tools run document processing in the browser.
                Supported files stay on your device instead of being uploaded for
                server-side processing. This is especially useful for routine work
                with contracts, reports, statements, forms, and other private files.
              </p>

              <Link
                href="/privacy"
                className="mt-5 inline-flex font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Read the privacy policy
              </Link>
            </article>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
              What you can do today
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-gray-600 dark:text-slate-300">
              The launch workspace currently includes ten working PDF tools:
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {currentTools.map((tool) => (
                <div
                  key={tool}
                  className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  {tool}
                </div>
              ))}
            </div>

            <Link
              href="/#tools"
              className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Browse all PDF tools
            </Link>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900 dark:bg-amber-950/20">
            <h2 className="text-2xl font-extrabold text-amber-950 dark:text-amber-100">
              Honest limitations
            </h2>

            <div className="mt-4 space-y-3 leading-7 text-amber-900/80 dark:text-amber-200/80">
              <p>
                Current tools use a 25 MB file limit, and very large or complex
                documents can also be limited by the memory available in your browser.
              </p>
              <p>
                PDF-to-Word works best with selectable text rather than scanned pages,
                while Word-to-PDF focuses on readable text, headings, lists, and basic
                tables instead of reproducing every advanced Microsoft Word layout feature.
              </p>
              <p>
                Password-protected PDFs should only be unlocked when you own the file
                or have permission to modify it.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
              What comes next
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-gray-600 dark:text-slate-300">
              Kukureku is being expanded carefully around the same principles:
              useful document workflows, clear limitations, and privacy-first processing
              whenever browser technology makes it practical. Planned AI features are
              labeled as coming soon until they are ready for public use.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
