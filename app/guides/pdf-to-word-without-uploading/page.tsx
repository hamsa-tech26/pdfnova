import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

const guidePath = "/guides/pdf-to-word-without-uploading";
const pageTitle = "Convert PDF to Word Without Uploading - Text PDF Guide";
const pageDescription =
  "Learn how to convert a selectable-text PDF to an editable Word DOCX in your browser, why scans need OCR, and which layouts may need correction.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: guidePath },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: guidePath,
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "How to convert a PDF to Word without uploading it",
      url: `${SITE_URL}${guidePath}`,
      description: pageDescription,
      isPartOf: { "@type": "WebSite", name: PRODUCT_NAME, url: SITE_URL },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: PRODUCT_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "PDF Guides", item: `${SITE_URL}/guides` },
        { "@type": "ListItem", position: 3, name: "PDF to Word Without Uploading", item: `${SITE_URL}${guidePath}` },
      ],
    },
  ],
};

const steps = [
  {
    title: "Check whether you can select the text",
    description:
      "Open the PDF and try selecting and copying a sentence. If you can select real words, the document is a better candidate for this text-based converter.",
  },
  {
    title: "Choose the PDF in Kukureku",
    description:
      "Open PDF to Word and select one supported PDF, up to 25 MB. The current workflow extracts text and creates the DOCX inside your browser.",
  },
  {
    title: "Download and edit the DOCX",
    description:
      "Open the downloaded file in Word or a compatible editor. Check paragraphs, line breaks, headings, page order, special characters, and any missing visual content.",
  },
];

export default function PdfToWordGuidePage() {
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
              PDF to Word guide
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              How to convert a PDF to Word without uploading it
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Need to edit text from a PDF? The type of PDF you start with matters more than the converter. Use these checks before creating an editable Word file.
            </p>
          </header>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
              Three steps for a text-based PDF
            </h2>
            <ol className="mt-5 space-y-5">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-950 dark:text-white">{step.title}</h3>
                    <p className="mt-1 leading-7 text-slate-600 dark:text-slate-300">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/pdf-to-word"
              className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Open PDF to Word
            </Link>
          </section>

          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900 dark:bg-amber-950/20">
            <h2 className="text-2xl font-bold text-amber-950 dark:text-amber-100">
              A scanned PDF is different
            </h2>
            <p className="mt-4 leading-7 text-amber-900 dark:text-amber-200">
              A scan or photographed page usually contains an image of the words, not selectable text. This PDF to Word tool does not recognize words in those images. OCR (optical character recognition) is a separate step; recognized text still needs proofreading, especially for tables, handwriting, and low-quality scans.
            </p>
            <Link
              href="/ocr-pdf"
              className="mt-5 inline-flex min-h-11 items-center font-semibold text-amber-950 underline underline-offset-4 dark:text-amber-100"
            >
              Learn about the OCR PDF tool
            </Link>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
              What the Word file may not preserve
            </h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
              Kukureku focuses on extracting editable text from supported PDFs, not reconstructing every part of the original page. It may not preserve photographs, diagrams, complex tables, columns, fonts, precise positioning, or form fields. Do not assume the DOCX is visually identical to the source.
            </p>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
              If your goal is to share a document while preserving how it looks, keep the original PDF. If you edit the text in Word and need a PDF again, use the Word to PDF tool, then compare the output with your expectations.
            </p>
            <Link
              href="/word-to-pdf"
              className="mt-5 inline-flex min-h-11 items-center font-semibold text-blue-800 underline underline-offset-4 dark:text-blue-300"
            >
              Open Word to PDF
            </Link>
          </section>

          <section className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-7 dark:border-blue-950 dark:bg-blue-950/20">
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
              Does the conversion upload my document?
            </h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
              This Kukureku PDF to Word workflow processes the selected PDF locally in the browser; it does not require sending the file contents to a conversion server. Normal website connections and analytics are separate from document processing. Check the downloaded Word document before sharing sensitive or official information.
            </p>
            <div className="mt-5 flex flex-wrap gap-5">
              <Link href="/guides/private-pdf-tools" className="font-semibold text-blue-800 underline underline-offset-4 dark:text-blue-300">
                How private PDF tools work
              </Link>
              <Link href="/guides/choose-pdf-tool" className="font-semibold text-blue-800 underline underline-offset-4 dark:text-blue-300">
                Choose the right PDF tool
              </Link>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
