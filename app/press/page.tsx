import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kukureku PDF Press & Directory Kit",
  description:
    "Accurate product facts, short descriptions, category tags, privacy evidence, and brand links for editors, reviewers, directories, and media covering Kukureku PDF.",
  alternates: {
    canonical: "/press",
  },
  openGraph: {
    title: "Kukureku PDF Press & Directory Kit",
    description:
      "Accurate product facts, short descriptions, category tags, privacy evidence, and brand links for editors, reviewers, directories, and media covering Kukureku PDF.",
    url: "/press",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kukureku PDF Press & Directory Kit",
    description:
      "Accurate product facts, short descriptions, category tags, privacy evidence, and brand links for editors, reviewers, directories, and media covering Kukureku PDF.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Kukureku PDF Press & Directory Kit",
      url: `${SITE_URL}/press`,
      description:
        "Factual product information and reference links for Kukureku PDF.",
      isPartOf: {
        "@type": "WebSite",
        name: PRODUCT_NAME,
        url: SITE_URL,
      },
      dateModified: "2026-10-04",
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
          name: "Press & Directory Kit",
          item: `${SITE_URL}/press`,
        },
      ],
    },
  ],
};

const shortDescription =
  "Free private PDF tools that run in your browser, with no account required and supported files processed locally on your device.";

const directoryDescription =
  "Kukureku PDF is a free browser-based PDF workspace for merging, splitting, compressing, converting, organizing, watermarking, and unlocking PDFs. Current supported workflows process files locally on the user's device rather than uploading document contents for server-side conversion, and no Kukureku account is required.";

const longDescription =
  "Kukureku PDF is a free, privacy-first browser workspace for common document tasks. Its current public launch has 30 PDF tools, alongside private workspace experiences for inspection, version tracking, local document comparison, and submission-preparation checks. Supported workflows are designed to process files locally in the browser instead of uploading document contents to Kukureku servers for conversion. The site publishes a Trust Center, a private-processing verification guide, and a controlled launch verification report documenting practical limits and observed test results.";

const tags = [
  "PDF",
  "privacy",
  "browser tools",
  "no upload",
  "productivity",
  "document tools",
  "local processing",
];

export default function PressPage() {
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
              Press & Directory Kit
            </p>

            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Accurate Kukureku PDF facts for editors, reviewers, and directories
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-blue-100">
              This page provides ready-to-use factual copy and verification
              links so third-party listings can describe Kukureku accurately
              without overstating its features or privacy model.
            </p>
          </section>

          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Product", "Kukureku PDF"],
              ["Website", "kukureku.com"],
              ["Current tools", "30"],
              ["Account required", "No"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">
                  {label}
                </p>
                <p className="mt-3 text-xl font-extrabold text-gray-950 dark:text-white">
                  {value}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
              Ready-to-use descriptions
            </h2>

            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
                  Tagline
                </p>
                <p className="mt-2 font-semibold text-gray-950 dark:text-white">
                  Free private PDF tools that keep files on your device.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
                  Short description
                </p>
                <p className="mt-2 leading-7 text-gray-700 dark:text-slate-300">
                  {shortDescription}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
                  Directory description
                </p>
                <p className="mt-2 leading-7 text-gray-700 dark:text-slate-300">
                  {directoryDescription}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
                  Long description
                </p>
                <p className="mt-2 leading-7 text-gray-700 dark:text-slate-300">
                  {longDescription}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Suggested categories and tags
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                Suitable categories include Productivity, PDF Tools, Document
                Utilities, File Conversion, and Privacy Tools.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:border-blue-950 dark:bg-blue-950/30 dark:text-blue-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Brand asset
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                The current Kukureku brand mark is available as an SVG from the
                site. Please do not modify the mark in a way that implies an
                endorsement or feature that Kukureku does not provide.
              </p>

              <a
                href="/brand/kukureku-mark.svg"
                className="mt-5 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Open Kukureku SVG mark
              </a>
            </article>
          </section>

          <section className="rounded-3xl border border-blue-100 bg-blue-50 p-7 dark:border-blue-950 dark:bg-blue-950/20">
            <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
              Evidence and verification links
            </h2>

            <p className="mt-4 max-w-3xl leading-7 text-gray-600 dark:text-slate-300">
              For privacy or performance claims, reviewers should use the current
              product pages and evidence below rather than copying old directory
              descriptions.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/trust"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
              >
                Trust Center
              </Link>
              <Link
                href="/trust/verification"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
              >
                Verification Report
              </Link>
              <Link
                href="/guides/private-pdf-tools"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
              >
                Private Processing Guide
              </Link>
              <Link
                href="/privacy"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
              >
                Privacy Policy
              </Link>
              <a
                href="https://github.com/hamsa-tech26/pdfnova"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-300"
              >
                Public source repository
              </a>
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900 dark:bg-amber-950/20">
            <h2 className="text-2xl font-extrabold text-amber-950 dark:text-amber-100">
              Accuracy note for reviewers
            </h2>

            <p className="mt-4 leading-7 text-amber-900/80 dark:text-amber-200/80">
              Please describe Kukureku&apos;s current launch as 10 browser-based PDF
              tools. Planned AI functionality is labeled as coming soon and should
              not be listed as an available feature. Likewise, the public GitHub
              repository is inspectable source code, but this page does not claim
              an open-source software license.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
