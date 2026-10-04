import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Word to PDF Without Uploading - Private DOCX Guide",
  description:
    "Learn how browser-based Word to PDF conversion works without uploading the DOCX, what formatting Kukureku supports, and what to review before sharing.",
  alternates: {
    canonical: "/guides/word-to-pdf-without-uploading",
  },
  openGraph: {
    title: "Word to PDF Without Uploading - Private DOCX Guide",
    description:
      "Learn how browser-based Word to PDF conversion works without uploading the DOCX, what formatting Kukureku supports, and what to review before sharing.",
    url: "/guides/word-to-pdf-without-uploading",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Word to PDF Without Uploading - Private DOCX Guide",
    description:
      "Learn how browser-based Word to PDF conversion works without uploading the DOCX, what formatting Kukureku supports, and what to review before sharing.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Word to PDF Without Uploading",
      url: `${SITE_URL}/guides/word-to-pdf-without-uploading`,
      description:
        "A practical guide to private browser-based DOCX to PDF conversion.",
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
          name: "PDF Guides",
          item: `${SITE_URL}/guides`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Word to PDF Without Uploading",
          item: `${SITE_URL}/guides/word-to-pdf-without-uploading`,
        },
      ],
    },
  ],
};

export default function WordToPdfGuidePage() {
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

        <article className="mx-auto max-w-4xl">
          <header className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-8 text-white shadow-2xl sm:p-10 lg:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
              Word to PDF guide
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              How to convert Word to PDF without uploading the document
            </h1>

            <p className="mt-6 text-lg leading-8 text-blue-100">
              A DOCX file can be read and rebuilt as a PDF inside the browser.
              That keeps supported document processing on your device, but a
              browser converter should also be clear about which Word features
              it can and cannot reproduce.
            </p>
          </header>

          <div className="mt-8 space-y-8">
            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                What Kukureku currently preserves
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                The current browser converter is designed for readable document
                structure rather than pixel-perfect Microsoft Word rendering.
                It supports readable text, headings, lists, and basic tables.
                That makes it useful for straightforward letters, reports,
                notes, and simple tabular documents.
              </p>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                How to convert DOCX to PDF with Kukureku
              </h2>

              <ol className="mt-5 space-y-5 text-gray-600 dark:text-slate-300">
                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    1. Choose one DOCX file
                  </p>
                  <p className="mt-1 leading-7">
                    Add the Word document you want to convert, up to 25 MB. The
                    current conversion happens locally in the browser.
                  </p>
                </li>

                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    2. Convert the supported content
                  </p>
                  <p className="mt-1 leading-7">
                    Kukureku reads the document structure and creates a PDF from
                    supported text, headings, lists, and basic tables.
                  </p>
                </li>

                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    3. Review the PDF before sharing
                  </p>
                  <p className="mt-1 leading-7">
                    Open the result and check page breaks, tables, headings, and
                    any special characters. Keep the original DOCX as the source
                    document.
                  </p>
                </li>
              </ol>

              <Link
                href="/word-to-pdf"
                className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Open Word to PDF
              </Link>
            </section>

            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900 dark:bg-amber-950/20">
              <h2 className="text-2xl font-extrabold text-amber-950 dark:text-amber-100">
                What may not be preserved exactly
              </h2>

              <div className="mt-4 space-y-3 leading-7 text-amber-900/80 dark:text-amber-200/80">
                <p>
                  Merged table cells, images, floating text boxes, headers,
                  footers, custom fonts, and advanced Word layout features may
                  not be retained exactly by the current converter.
                </p>
                <p>
                  If exact print layout is critical, compare the generated PDF
                  with the original document before sending or archiving it.
                  Image-only or scanned Word documents also need OCR rather than
                  ordinary text extraction.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                When local Word-to-PDF conversion is a good fit
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  [
                    "Letters and simple reports",
                    "Documents built mainly from paragraphs, headings, lists, and straightforward tables are the best fit.",
                  ],
                  [
                    "Private working drafts",
                    "Local processing can be useful when the DOCX contains internal or personal information you do not want to upload unnecessarily.",
                  ],
                  [
                    "Quick fixed-format copies",
                    "A PDF is useful when you want a document that is easier to share without inviting editing.",
                  ],
                  [
                    "Browser-only workflows",
                    "No desktop converter installation is required for the supported conversion.",
                  ],
                ].map(([title, text]) => (
                  <div
                    key={title}
                    className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <h3 className="font-bold text-gray-950 dark:text-white">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-7 dark:border-blue-950 dark:bg-blue-950/20">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Why keep the DOCX on your device?
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                Word files can contain names, addresses, internal notes,
                contracts, and other information that does not need to leave the
                device merely to create a PDF. Browser-local conversion reduces
                that document transfer for the supported workflow.
              </p>

              <Link
                href="/guides/private-pdf-tools"
                className="mt-5 inline-flex font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
              >
                Read the private PDF processing guide
              </Link>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
