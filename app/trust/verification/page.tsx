import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kukureku PDF Verification Report - 10 Tool Launch Tests",
  description:
    "Review Kukureku PDF's controlled launch verification for merge, split, compress, convert, organize, watermark, and unlock workflows, plus the limits of those tests.",
  alternates: {
    canonical: "/trust/verification",
  },
  openGraph: {
    title: "Kukureku PDF Verification Report - 10 Tool Launch Tests",
    description:
      "Review Kukureku PDF's controlled launch verification for merge, split, compress, convert, organize, watermark, and unlock workflows, plus the limits of those tests.",
    url: "/trust/verification",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kukureku PDF Verification Report - 10 Tool Launch Tests",
    description:
      "Review Kukureku PDF's controlled launch verification for merge, split, compress, convert, organize, watermark, and unlock workflows, plus the limits of those tests.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Kukureku PDF Verification Report",
      url: `${SITE_URL}/trust/verification`,
      description:
        "Controlled launch verification results for ten original Kukureku PDF launch workflows.",
      isPartOf: {
        "@type": "WebSite",
        name: PRODUCT_NAME,
        url: SITE_URL,
      },
      dateModified: "2026-10-07",
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
        {
          "@type": "ListItem",
          position: 3,
          name: "Verification Report",
          item: `${SITE_URL}/trust/verification`,
        },
      ],
    },
  ],
};

const verificationRows = [
  {
    tool: "Word to PDF",
    href: "/word-to-pdf",
    test:
      "A controlled DOCX containing headings, normal paragraphs, lists, a four-column table, and a long-cell table.",
    result:
      "Converted into a three-page PDF with the expected readable content, table structure, and final marker present.",
  },
  {
    tool: "Merge PDF",
    href: "/merge-pdf",
    test:
      "Two controlled two-page PDFs marked A1/A2 and B1/B2.",
    result:
      "Produced one four-page PDF in the expected A1 → A2 → B1 → B2 order.",
  },
  {
    tool: "Split PDF",
    href: "/split-pdf",
    test:
      "Pages 2 and 3 extracted from the controlled four-page merged PDF.",
    result:
      "Produced a two-page PDF containing A2 → B1 in the requested order.",
  },
  {
    tool: "Compress PDF",
    href: "/compress-pdf",
    test:
      "A two-page, image-heavy PDF of about 11.06 MB using the Medium compression option.",
    result:
      "The controlled output was about 192.63 KB, roughly a 98% reduction, while retaining two readable pages.",
  },
  {
    tool: "PDF to Word",
    href: "/pdf-to-word",
    test:
      "A controlled PDF containing a title, paragraphs, a table, post-table text, a second page, and final marker.",
    result:
      "The DOCX preserved the expected title, paragraphs, table, text after the table, page-two content, and final marker.",
  },
  {
    tool: "JPG to PDF",
    href: "/jpg-to-pdf",
    test:
      "Two controlled images with different orientation: one landscape and one portrait.",
    result:
      "Created a two-page PDF in the selected order with the expected image orientation and no meaningful crop.",
  },
  {
    tool: "PDF to JPG",
    href: "/pdf-to-jpg",
    test:
      "The controlled two-page image PDF was converted to JPG output.",
    result:
      "The page-one landscape image and page-two portrait image were exported in the expected order.",
  },
  {
    tool: "Organize PDF",
    href: "/organize-pdf",
    test:
      "Starting from A1 → A2 → B1 → B2, A2 was deleted, B1 moved, and B1 rotated 90 degrees.",
    result:
      "The saved PDF contained B1 → A1 → B2, with the intended B1 rotation retained.",
  },
  {
    tool: "Watermark PDF",
    href: "/watermark-pdf",
    test:
      "Text watermark applied to a three-page controlled PDF at 42 pt, 25% opacity, 45-degree rotation, centered.",
    result:
      "The watermark text appeared on all three pages, including the rotated page.",
  },
  {
    tool: "Unlock PDF",
    href: "/unlock-pdf",
    test:
      "A genuinely AES-128 encrypted, two-page PDF was processed using its known password.",
    result:
      "The resulting PDF was no longer encrypted and both pages remained readable with the expected markers.",
  },
];

export default function VerificationPage() {
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

        <article className="mx-auto max-w-6xl space-y-8">
          <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-8 text-white shadow-2xl sm:p-10 lg:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
              Trust Center · Verification
            </p>

            <h1 className="mt-4 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Controlled launch tests for Kukureku&apos;s original 10-tool set
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-blue-100">
              Before Kukureku expanded beyond its original launch set, each of
              those ten workflows was exercised with a controlled browser test
              designed to make page order, text preservation, rotation,
              watermarking, encryption, or output size easy to verify. These
              results document that historical test scope, not every tool that
              has since been implemented.
            </p>
          </header>

          <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                  Verification scope
                </p>
                <h2 className="mt-2 text-2xl font-extrabold text-gray-950 dark:text-white">
                  Pre-launch browser verification completed in October 2026
                </h2>
              </div>

              <Link
                href="/trust"
                className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Back to Trust Center →
              </Link>
            </div>

            <p className="mt-4 max-w-4xl leading-7 text-gray-600 dark:text-slate-300">
              The tests below used intentionally simple markers and controlled
              fixtures so the expected output could be checked directly. They
              complement automated linting, unit tests, production builds, and
              deployment checks, but they do not guarantee that every possible
              PDF or Office file will behave identically.
            </p>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
              Tool-by-tool verification results
            </h2>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800">
                    <th className="px-3 py-3 font-bold text-gray-950 dark:text-white">
                      Tool
                    </th>
                    <th className="px-3 py-3 font-bold text-gray-950 dark:text-white">
                      Controlled test
                    </th>
                    <th className="px-3 py-3 font-bold text-gray-950 dark:text-white">
                      Observed result
                    </th>
                    <th className="px-3 py-3 font-bold text-gray-950 dark:text-white">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {verificationRows.map((row) => (
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
                      <td className="px-3 py-4 leading-6 text-gray-600 dark:text-slate-300">
                        {row.test}
                      </td>
                      <td className="px-3 py-4 leading-6 text-gray-600 dark:text-slate-300">
                        {row.result}
                      </td>
                      <td className="px-3 py-4 font-bold text-emerald-700 dark:text-emerald-400">
                        Pass
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900 dark:bg-amber-950/20">
              <h2 className="text-2xl font-extrabold text-amber-950 dark:text-amber-100">
                What these tests do not prove
              </h2>

              <div className="mt-4 space-y-3 leading-7 text-amber-900/80 dark:text-amber-200/80">
                <p>
                  A passing controlled fixture is not a promise that every
                  real-world document will convert perfectly.
                </p>
                <p>
                  PDFs can contain damaged objects, unusual fonts, unsupported
                  encryption, huge images, complex forms, scans, or layout
                  constructs that stress a browser differently.
                </p>
                <p>
                  Compression results vary dramatically by source file. The
                  98% figure above belongs only to the stated image-heavy test
                  fixture and should not be treated as a typical guarantee.
                </p>
              </div>
            </article>

            <article className="rounded-3xl border border-blue-100 bg-blue-50 p-7 dark:border-blue-950 dark:bg-blue-950/20">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                How to verify Kukureku yourself
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                For privacy behavior, use a harmless test document and watch the
                browser Network panel while running a tool. For output behavior,
                add obvious page labels or final markers so you can inspect the
                downloaded result yourself.
              </p>

              <Link
                href="/guides/private-pdf-tools"
                className="mt-5 inline-flex font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
              >
                Read the private-processing verification guide →
              </Link>
            </article>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
              Ongoing verification
            </h2>

            <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
              Kukureku&apos;s repository uses automated validation for code quality,
              unit tests, and production builds. Browser-level checks remain
              important for workflows that depend on downloads, rendered pages,
              document ordering, or device-side processing.
            </p>

            <a
              href="https://github.com/hamsa-tech26/pdfnova"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              View the public source repository →
            </a>
          </section>
        </article>
      </main>

      <Footer />
    </>
  );
}
