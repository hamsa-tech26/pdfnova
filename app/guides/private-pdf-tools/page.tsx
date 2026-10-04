import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Private PDF Tools - How No-Upload Browser Processing Works",
  description:
    "Learn how browser-based private PDF tools can process documents without uploading file contents, how to verify it, and the practical trade-offs of local processing.",
  alternates: {
    canonical: "/guides/private-pdf-tools",
  },
  openGraph: {
    title: "Private PDF Tools - How No-Upload Browser Processing Works",
    description:
      "Learn how browser-based private PDF tools can process documents without uploading file contents, how to verify it, and the practical trade-offs of local processing.",
    url: "/guides/private-pdf-tools",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Private PDF Tools - How No-Upload Browser Processing Works",
    description:
      "Learn how browser-based private PDF tools can process documents without uploading file contents, how to verify it, and the practical trade-offs of local processing.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      name: "Private PDF Tools - How No-Upload Browser Processing Works",
      url: `${SITE_URL}/guides/private-pdf-tools`,
      description:
        "A practical guide to browser-based private PDF processing and its trade-offs.",
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
          name: "Private PDF Tools Guide",
          item: `${SITE_URL}/guides/private-pdf-tools`,
        },
      ],
    },
  ],
};

const toolLinks = [
  { href: "/merge-pdf", label: "Merge PDF" },
  { href: "/split-pdf", label: "Split PDF" },
  { href: "/compress-pdf", label: "Compress PDF" },
  { href: "/pdf-to-word", label: "PDF to Word" },
  { href: "/word-to-pdf", label: "Word to PDF" },
  { href: "/jpg-to-pdf", label: "JPG to PDF" },
  { href: "/pdf-to-jpg", label: "PDF to JPG" },
  { href: "/organize-pdf", label: "Organize PDF" },
  { href: "/watermark-pdf", label: "Watermark PDF" },
  { href: "/unlock-pdf", label: "Unlock PDF" },
];

export default function PrivatePdfToolsGuide() {
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
          <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-8 text-white shadow-2xl sm:p-10 lg:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
              PDF privacy guide
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
              How private PDF tools can work without uploading your files
            </h1>

            <p className="mt-6 text-lg leading-8 text-blue-100">
              A PDF tool can run entirely inside your browser instead of sending
              the document to a remote conversion server. This guide explains
              what that means, how to check it yourself, and where local
              processing has practical limits.
            </p>
          </header>

          <div className="mt-8 space-y-8">
            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Local processing versus server processing
              </h2>

              <div className="mt-4 space-y-4 leading-7 text-gray-600 dark:text-slate-300">
                <p>
                  With server processing, your browser first sends the document
                  across the network, a remote system performs the task, and the
                  result is sent back. That model can support very large files
                  and heavy conversions, but it requires the document contents
                  to leave your device.
                </p>

                <p>
                  With local browser processing, JavaScript or WebAssembly code
                  performs the operation on your computer or phone. The file can
                  be read, transformed, and downloaded without intentionally
                  sending its contents to the site&apos;s processing servers.
                  Kukureku&apos;s current PDF tools use this local approach for
                  supported workflows.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                How to verify a no-upload workflow yourself
              </h2>

              <ol className="mt-5 space-y-5 text-gray-600 dark:text-slate-300">
                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    1. Open your browser&apos;s developer tools
                  </p>
                  <p className="mt-1 leading-7">
                    In Chrome or Edge, open Developer Tools and select the
                    Network panel before choosing a document.
                  </p>
                </li>

                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    2. Clear the request list, then run the PDF task
                  </p>
                  <p className="mt-1 leading-7">
                    Choose the file and perform the operation. Normal requests
                    for page assets or website analytics can still occur, so the
                    useful question is whether the document itself is sent in a
                    large upload request.
                  </p>
                </li>

                <li>
                  <p className="font-bold text-gray-950 dark:text-white">
                    3. Look for a file-sized upload
                  </p>
                  <p className="mt-1 leading-7">
                    A server converter normally needs to transmit the document
                    contents. In a local workflow, the processing step should not
                    require a request carrying the PDF, DOCX, or image data to a
                    conversion endpoint.
                  </p>
                </li>
              </ol>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Why local PDF processing can be useful
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  [
                    "Less document exposure",
                    "The file content does not need to be transferred to a remote conversion service for supported tasks.",
                  ],
                  [
                    "No upload wait",
                    "Processing can begin as soon as the browser reads the file instead of waiting for a large upload to finish.",
                  ],
                  [
                    "Simple one-off work",
                    "You can complete common document tasks without creating an account or installing desktop software.",
                  ],
                  [
                    "Clearer data boundary",
                    "The document workflow stays separate from ordinary website requests such as loading pages, fonts, and analytics.",
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
                The trade-offs are real
              </h2>

              <div className="mt-4 space-y-3 leading-7 text-amber-900/80 dark:text-amber-200/80">
                <p>
                  Local processing uses your own device&apos;s memory and CPU.
                  That means browser tools can be less suitable for extremely
                  large documents or tasks that require heavy cloud computing.
                </p>
                <p>
                  Kukureku currently uses a 25 MB file limit. PDF-to-Word works
                  best with selectable text rather than scanned page images, and
                  Word-to-PDF focuses on readable document structure instead of
                  reproducing every advanced Microsoft Word feature.
                </p>
                <p>
                  A private processing model also does not remove your own
                  responsibility to protect the device, browser profile, and
                  downloaded output.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Try a private browser-based PDF workflow
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                Kukureku currently provides ten focused tools. Each tool page
                explains its supported format, practical limits, and local
                processing behavior.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {toolLinks.map((tool) => (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {tool.label}
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-7 dark:border-blue-950 dark:bg-blue-950/20">
              <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                Privacy is more than the document processor
              </h2>

              <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                Any website still makes ordinary network requests to load the
                page, and hosting or analytics systems can receive normal visit
                information. That is different from uploading the contents of a
                document for conversion. Kukureku describes that distinction in
                its privacy policy.
              </p>

              <Link
                href="/privacy"
                className="mt-5 inline-flex font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
              >
                Read Kukureku&apos;s Privacy Policy
              </Link>
            </section>
          </div>
        </article>
      </main>

      <Footer />
    </>
  );
}
