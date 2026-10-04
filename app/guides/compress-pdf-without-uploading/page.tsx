import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Compress PDF Without Uploading - Private Browser Guide",
  description:
    "Learn how to compress PDF files without uploading them, why compression results vary, and how to balance file size and readable quality in your browser.",
  alternates: {
    canonical: "/guides/compress-pdf-without-uploading",
  },
  openGraph: {
    title: "Compress PDF Without Uploading - Private Browser Guide",
    description:
      "Learn how to compress PDF files without uploading them, why compression results vary, and how to balance file size and readable quality in your browser.",
    url: "/guides/compress-pdf-without-uploading",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Compress PDF Without Uploading - Private Browser Guide",
    description:
      "Learn how to compress PDF files without uploading them, why compression results vary, and how to balance file size and readable quality in your browser.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Compress PDF Without Uploading",
      url: `${SITE_URL}/guides/compress-pdf-without-uploading`,
      description:
        "A practical guide to private browser-based PDF compression.",
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
          name: "Compress PDF Without Uploading",
          item: `${SITE_URL}/guides/compress-pdf-without-uploading`,
        },
      ],
    },
  ],
};

export default function CompressPdfGuidePage() {
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
              PDF compression guide
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              How to compress a PDF without uploading it
            </h1>

            <p className="mt-6 text-lg leading-8 text-blue-100">
              PDF compression can run locally in a browser, so the document does
              not need to be sent to a remote conversion server. The important
              part is knowing what can actually be reduced and when a smaller
              result is realistic.
            </p>
          </header>

          <div className="mt-8 space-y-8">
            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Why PDF compression results vary
              </h2>

              <div className="mt-4 space-y-4 leading-7 text-gray-600 dark:text-slate-300">
                <p>
                  A PDF can contain text, fonts, vector graphics, photos, scanned
                  pages, metadata, and other embedded resources. Those parts do
                  not all compress in the same way.
                </p>

                <p>
                  Image-heavy PDFs often provide the biggest opportunity because
                  images may be recompressed or simplified. A document that is
                  already optimized can shrink only a little, and sometimes a
                  browser-safe rewrite produces a result that is similar in size.
                  A trustworthy compressor should not promise a fixed percentage
                  reduction for every file.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                How to compress with Kukureku
              </h2>

              <ol className="mt-5 space-y-5 text-gray-600 dark:text-slate-300">
                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    1. Choose the PDF
                  </p>
                  <p className="mt-1 leading-7">
                    Open the Kukureku Compress PDF tool and choose one PDF up to
                    25 MB. The current workflow processes the file locally in
                    your browser.
                  </p>
                </li>

                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    2. Pick an optimization level
                  </p>
                  <p className="mt-1 leading-7">
                    Medium is a sensible starting point for most files. Low
                    favors compatibility, while High attempts stronger
                    optimization when the document allows it.
                  </p>
                </li>

                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    3. Compare the result
                  </p>
                  <p className="mt-1 leading-7">
                    Check the original and compressed sizes, then open the
                    downloaded PDF and inspect text, images, and page order
                    before replacing your original.
                  </p>
                </li>
              </ol>

              <Link
                href="/compress-pdf"
                className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Open Compress PDF
              </Link>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                When compression helps most
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  [
                    "Scanned or photo-heavy PDFs",
                    "Large embedded images are often the main reason a PDF becomes difficult to email or upload.",
                  ],
                  [
                    "Portal upload limits",
                    "A smaller PDF can help when a form, job portal, or document system has a strict file-size cap.",
                  ],
                  [
                    "Mobile sharing",
                    "Reducing file size can make a document easier to send over slower mobile connections.",
                  ],
                  [
                    "Archive copies",
                    "A smaller convenience copy can be useful when the full-quality original is kept separately.",
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

            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900 dark:bg-amber-950/20">
              <h2 className="text-2xl font-extrabold text-amber-950 dark:text-amber-100">
                Keep the original when quality matters
              </h2>

              <div className="mt-4 space-y-3 leading-7 text-amber-900/80 dark:text-amber-200/80">
                <p>
                  Compression is a trade-off. A smaller document can be more
                  convenient, but aggressive image optimization may reduce
                  visual detail. Keep the original when the PDF contains
                  photographs, diagrams, scans, signatures, or anything that
                  may need high-quality printing later.
                </p>
                <p>
                  If the compressed result is not meaningfully smaller, the file
                  may already be optimized. Repeated compression rarely helps.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-7 dark:border-blue-950 dark:bg-blue-950/20">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Why process the PDF locally?
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                Local processing avoids sending the document contents to a
                server just to attempt compression. That can be useful for
                reports, contracts, statements, and other documents where
                unnecessary transfer is undesirable. Website requests and
                analytics are separate from the document-processing step.
              </p>

              <Link
                href="/guides/private-pdf-tools"
                className="mt-5 inline-flex font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
              >
                Learn how private browser processing works
              </Link>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
