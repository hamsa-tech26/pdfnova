import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kukureku PDF Trust Center - Privacy, Processing & Limits",
  description:
    "Review how Kukureku PDF processes files, which tools run locally in the browser, current file limits, analytics disclosure, and ways to verify the no-upload workflow.",
  alternates: {
    canonical: "/trust",
  },
  openGraph: {
    title: "Kukureku PDF Trust Center - Privacy, Processing & Limits",
    description:
      "Review how Kukureku PDF processes files, which tools run locally in the browser, current file limits, analytics disclosure, and ways to verify the no-upload workflow.",
    url: "/trust",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kukureku PDF Trust Center - Privacy, Processing & Limits",
    description:
      "Review how Kukureku PDF processes files, which tools run locally in the browser, current file limits, analytics disclosure, and ways to verify the no-upload workflow.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Kukureku PDF Trust Center",
      url: `${SITE_URL}/trust`,
      description:
        "Kukureku PDF processing, privacy, limits, analytics, and verification information.",
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
          name: "Trust Center",
          item: `${SITE_URL}/trust`,
        },
      ],
    },
  ],
};

const toolRows = [
  {
    tool: "Merge PDF",
    href: "/merge-pdf",
    input: "PDF",
    limit: "25 MB per PDF",
    note: "Combines pages locally in the browser.",
  },
  {
    tool: "Split PDF",
    href: "/split-pdf",
    input: "PDF",
    limit: "25 MB",
    note: "Extracts selected pages locally.",
  },
  {
    tool: "Compress PDF",
    href: "/compress-pdf",
    input: "PDF",
    limit: "25 MB",
    note: "Optimizes locally; reduction depends on the source file.",
  },
  {
    tool: "PDF to Word",
    href: "/pdf-to-word",
    input: "PDF",
    limit: "25 MB",
    note: "Best for selectable-text PDFs; scanned pages need OCR.",
  },
  {
    tool: "Word to PDF",
    href: "/word-to-pdf",
    input: "DOCX",
    limit: "25 MB",
    note: "Supports readable text, headings, lists, and basic tables.",
  },
  {
    tool: "JPG to PDF",
    href: "/jpg-to-pdf",
    input: "JPG / PNG",
    limit: "Browser memory",
    note: "Embeds selected images into a PDF locally.",
  },
  {
    tool: "PDF to JPG",
    href: "/pdf-to-jpg",
    input: "PDF",
    limit: "25 MB",
    note: "Renders selected pages as JPG images locally.",
  },
  {
    tool: "Organize PDF",
    href: "/organize-pdf",
    input: "PDF",
    limit: "25 MB",
    note: "Reorders, rotates, moves, and removes pages locally.",
  },
  {
    tool: "Watermark PDF",
    href: "/watermark-pdf",
    input: "PDF",
    limit: "25 MB",
    note: "Adds text or image watermarks locally.",
  },
  {
    tool: "Unlock PDF",
    href: "/unlock-pdf",
    input: "Protected PDF",
    limit: "25 MB",
    note: "Uses the correct password locally for files you are authorized to modify.",
  },
];

export default function TrustPage() {
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

        <div className="mx-auto max-w-6xl space-y-8">
          <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-8 text-white shadow-2xl sm:p-10 lg:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
              Trust Center
            </p>

            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              What Kukureku does with your files — and how to verify it
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-blue-100">
              Kukureku&apos;s current PDF tools are designed to process supported
              files locally in your browser. This page documents the current
              processing model, practical limits, analytics disclosure, and
              verification paths in one place.
            </p>
          </section>

          <section className="grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Document processing",
                value: "Local browser processing",
                text: "Current supported tool workflows do not intentionally upload document contents to Kukureku servers for processing.",
              },
              {
                title: "Account requirement",
                value: "No account required",
                text: "The current launch tools can be used without creating a Kukureku account.",
              },
              {
                title: "Website analytics",
                value: "Vercel Web Analytics",
                text: "Page-view analytics are separate from document processing and are disclosed in the Privacy Policy.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
                  {item.title}
                </p>
                <h2 className="mt-3 text-xl font-extrabold text-gray-950 dark:text-white">
                  {item.value}
                </h2>
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-400">
                  {item.text}
                </p>
              </article>
            ))}
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
              Current tool processing matrix
            </h2>

            <p className="mt-3 max-w-3xl leading-7 text-gray-600 dark:text-slate-300">
              The table below reflects the current public launch. Browser memory,
              document complexity, and unsupported file features can still affect
              whether a particular file completes successfully.
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800">
                    <th className="px-3 py-3 font-bold text-gray-950 dark:text-white">
                      Tool
                    </th>
                    <th className="px-3 py-3 font-bold text-gray-950 dark:text-white">
                      Input
                    </th>
                    <th className="px-3 py-3 font-bold text-gray-950 dark:text-white">
                      Current limit
                    </th>
                    <th className="px-3 py-3 font-bold text-gray-950 dark:text-white">
                      Processing
                    </th>
                    <th className="px-3 py-3 font-bold text-gray-950 dark:text-white">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {toolRows.map((row) => (
                    <tr
                      key={row.href}
                      className="border-b border-gray-100 align-top last:border-0 dark:border-slate-800"
                    >
                      <td className="px-3 py-4">
                        <Link
                          href={row.href}
                          className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          {row.tool}
                        </Link>
                      </td>
                      <td className="px-3 py-4 text-gray-600 dark:text-slate-300">
                        {row.input}
                      </td>
                      <td className="px-3 py-4 text-gray-600 dark:text-slate-300">
                        {row.limit}
                      </td>
                      <td className="px-3 py-4 font-semibold text-emerald-700 dark:text-emerald-400">
                        In browser
                      </td>
                      <td className="px-3 py-4 leading-6 text-gray-600 dark:text-slate-300">
                        {row.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-blue-100 bg-blue-50 p-7 dark:border-blue-950 dark:bg-blue-950/20">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Verify the no-upload workflow yourself
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                You do not have to rely only on a privacy statement. Open your
                browser&apos;s Network panel, clear the request list, select a test
                document, and run a tool. The important check is whether the file
                contents are transmitted in a file-sized upload request to a
                conversion endpoint.
              </p>

              <Link
                href="/guides/private-pdf-tools"
                className="mt-5 inline-flex font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
              >
                Follow the verification guide →
              </Link>
            </article>

            <article className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Public implementation evidence
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                Kukureku&apos;s source repository is publicly viewable on GitHub.
                That provides another way for technical users to inspect the current
                browser-side implementation and follow changes over time.
              </p>

              <a
                href="https://github.com/hamsa-tech26/pdfnova"
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                View the public GitHub repository →
              </a>
            </article>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
              What local processing does not mean
            </h2>

            <div className="mt-4 space-y-3 leading-7 text-gray-600 dark:text-slate-300">
              <p>
                It does not mean the website makes zero network requests. The page,
                scripts, fonts, hosting infrastructure, and website analytics can
                make ordinary requests while the site is open.
              </p>
              <p>
                It does not mean every possible document is supported. Very large,
                damaged, encrypted, scanned, or unusually complex files can exceed
                the capabilities of the current browser-based engines.
              </p>
              <p>
                It also does not replace your own device security. Downloaded
                results remain your responsibility once they are saved to your
                computer or phone.
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 dark:border-emerald-900 dark:bg-emerald-950/20">
            <h2 className="text-2xl font-extrabold text-emerald-950 dark:text-emerald-100">
              Related transparency pages
            </h2>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/trust/verification"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 dark:bg-slate-900 dark:text-emerald-300"
              >
                Verification Report
              </Link>
              <Link
                href="/privacy"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 dark:bg-slate-900 dark:text-emerald-300"
              >
                Privacy Policy
              </Link>
              <Link
                href="/about"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 dark:bg-slate-900 dark:text-emerald-300"
              >
                About Kukureku
              </Link>
              <Link
                href="/guides/private-pdf-tools"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:-translate-y-0.5 dark:bg-slate-900 dark:text-emerald-300"
              >
                PDF Privacy Guide
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
