import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Watermark PDF Without Uploading - Private Browser Guide",
  description:
    "Learn how to add text or image watermarks to PDF files without uploading them, with practical guidance on opacity, rotation, placement, and readability.",
  alternates: {
    canonical: "/guides/watermark-pdf-without-uploading",
  },
  openGraph: {
    title: "Watermark PDF Without Uploading - Private Browser Guide",
    description:
      "Learn how to add text or image watermarks to PDF files without uploading them, with practical guidance on opacity, rotation, placement, and readability.",
    url: "/guides/watermark-pdf-without-uploading",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Watermark PDF Without Uploading - Private Browser Guide",
    description:
      "Learn how to add text or image watermarks to PDF files without uploading them, with practical guidance on opacity, rotation, placement, and readability.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Watermark PDF Without Uploading",
      url: `${SITE_URL}/guides/watermark-pdf-without-uploading`,
      description:
        "A practical guide to adding PDF watermarks privately in the browser.",
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
          name: "Watermark PDF Without Uploading",
          item: `${SITE_URL}/guides/watermark-pdf-without-uploading`,
        },
      ],
    },
  ],
};

export default function WatermarkPdfGuidePage() {
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
              PDF watermark guide
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              How to add a watermark to a PDF without uploading it
            </h1>

            <p className="mt-6 text-lg leading-8 text-blue-100">
              A watermark can mark a document as DRAFT, CONFIDENTIAL, a sample,
              or your own work. For supported PDFs, the watermark can be added
              inside the browser without sending the file to a remote processor.
            </p>
          </header>

          <div className="mt-8 space-y-8">
            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Text watermark or image watermark?
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                  <h3 className="font-bold text-gray-950 dark:text-white">
                    Text watermark
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
                    Best for labels such as DRAFT, CONFIDENTIAL, SAMPLE, a
                    project name, or a short ownership notice.
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                  <h3 className="font-bold text-gray-950 dark:text-white">
                    Image watermark
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">
                    Useful for a logo or mark. Kukureku currently supports PNG,
                    JPG, and JPEG watermark images.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                How to watermark a PDF with Kukureku
              </h2>

              <ol className="mt-5 space-y-5 text-gray-600 dark:text-slate-300">
                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    1. Choose the PDF
                  </p>
                  <p className="mt-1 leading-7">
                    Add one PDF up to 25 MB. The current watermark workflow
                    processes the selected document locally in your browser.
                  </p>
                </li>

                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    2. Choose text or an image
                  </p>
                  <p className="mt-1 leading-7">
                    Enter watermark text or choose a supported image, then adjust
                    position, size, opacity, and rotation.
                  </p>
                </li>

                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    3. Apply and review
                  </p>
                  <p className="mt-1 leading-7">
                    Kukureku applies the selected watermark to every page. Open
                    the downloaded result and check that important text,
                    signatures, and diagrams remain readable.
                  </p>
                </li>
              </ol>

              <Link
                href="/watermark-pdf"
                className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Open Watermark PDF
              </Link>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Make the watermark visible without ruining the document
              </h2>

              <div className="mt-4 space-y-4 leading-7 text-gray-600 dark:text-slate-300">
                <p>
                  A watermark should communicate status or ownership without
                  making the document hard to read. Large diagonal text with
                  moderate transparency works well for labels such as DRAFT or
                  CONFIDENTIAL because it is difficult to miss but can still
                  leave the page content visible.
                </p>

                <p>
                  A logo usually works better at a lower opacity and a quieter
                  position. Always inspect several pages because a watermark that
                  looks fine over empty space may cover important content on a
                  denser page.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900 dark:bg-amber-950/20">
              <h2 className="text-2xl font-extrabold text-amber-950 dark:text-amber-100">
                A watermark is a label, not access control
              </h2>

              <p className="mt-4 leading-7 text-amber-900/80 dark:text-amber-200/80">
                Watermarking can discourage casual reuse and make document
                status clearer, but it does not encrypt a PDF or prevent someone
                with the file from viewing it. Use appropriate access controls,
                encryption, and sharing policies when confidentiality requires
                stronger protection.
              </p>
            </section>

            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-7 dark:border-blue-950 dark:bg-blue-950/20">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Why local watermarking can matter
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                Draft agreements, internal reports, and private proofs are often
                exactly the documents users prefer not to upload unnecessarily.
                Local browser processing keeps the supported watermark operation
                on the device while ordinary website requests remain separate.
              </p>

              <Link
                href="/guides/private-pdf-tools"
                className="mt-5 inline-flex font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
              >
                Learn how no-upload PDF processing works
              </Link>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
