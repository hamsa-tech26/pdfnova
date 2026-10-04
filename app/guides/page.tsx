import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PDF Guides - Private Browser-Based Workflows",
  description:
    "Practical Kukureku PDF guides for private browser-based document work, including compression, conversion, watermarking, and no-upload processing.",
  alternates: {
    canonical: "/guides",
  },
  openGraph: {
    title: "PDF Guides - Private Browser-Based Workflows",
    description:
      "Practical Kukureku PDF guides for private browser-based document work, including compression, conversion, watermarking, and no-upload processing.",
    url: "/guides",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF Guides - Private Browser-Based Workflows",
    description:
      "Practical Kukureku PDF guides for private browser-based document work, including compression, conversion, watermarking, and no-upload processing.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      name: "Kukureku PDF Guides",
      url: `${SITE_URL}/guides`,
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
      ],
    },
  ],
};

const guides = [
  {
    title: "How private PDF tools can work without uploads",
    description:
      "Understand browser-local processing, how to verify it yourself, and the trade-offs compared with server-based conversion.",
    href: "/guides/private-pdf-tools",
  },
  {
    title: "How to compress a PDF without uploading it",
    description:
      "Learn what PDF compression can reduce, why results vary, and how to choose a sensible optimization level.",
    href: "/guides/compress-pdf-without-uploading",
  },
  {
    title: "How to add a watermark to a PDF without uploading it",
    description:
      "Use text or image watermarks for drafts, ownership, and document status while keeping the PDF on your device.",
    href: "/guides/watermark-pdf-without-uploading",
  },
  {
    title: "How to convert Word to PDF without uploading the document",
    description:
      "See what browser-based DOCX conversion preserves, where layouts can differ, and how to review the result before sharing.",
    href: "/guides/word-to-pdf-without-uploading",
  },
];

export default function GuidesPage() {
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

        <div className="mx-auto max-w-6xl">
          <section className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-8 text-white shadow-2xl sm:p-10 lg:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
              Kukureku PDF Guides
            </p>

            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
              Practical guides for private PDF work
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-blue-100">
              Learn how common PDF tasks work in the browser, what to expect from
              the result, and where local processing has real limitations.
            </p>
          </section>

          <section className="mt-8 grid gap-5 md:grid-cols-2">
            {guides.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="rounded-3xl border border-gray-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <h2 className="text-2xl font-extrabold text-gray-950 dark:text-white">
                  {guide.title}
                </h2>

                <p className="mt-4 leading-7 text-gray-600 dark:text-slate-300">
                  {guide.description}
                </p>

                <span className="mt-5 inline-flex font-semibold text-blue-600 dark:text-blue-400">
                  Read guide →
                </span>
              </Link>
            ))}
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}
