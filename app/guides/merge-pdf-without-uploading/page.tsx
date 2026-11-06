import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

const pageTitle = "Merge PDF Without Uploading - Private Browser Guide";
const pageDescription =
  "Learn how to combine PDF files in your browser without uploading their contents, arrange page order, understand file limits, and check the downloaded result.";
const guidePath = "/guides/merge-pdf-without-uploading";

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
      name: "How to merge PDFs without uploading them",
      url: `${SITE_URL}${guidePath}`,
      description: pageDescription,
      isPartOf: { "@type": "WebSite", name: PRODUCT_NAME, url: SITE_URL },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: PRODUCT_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "PDF Guides", item: `${SITE_URL}/guides` },
        { "@type": "ListItem", position: 3, name: "Merge PDF Without Uploading", item: `${SITE_URL}${guidePath}` },
      ],
    },
  ],
};

const steps = [
  {
    title: "Choose the PDF files",
    description: "Open Merge PDF and select at least two PDFs. This tool currently allows up to 20 files, each no larger than 25 MB, with a 100 MB combined limit.",
  },
  {
    title: "Put them in the right order",
    description: "Use Move Up and Move Down to arrange the files before merging. The final document follows that order.",
  },
  {
    title: "Merge and download",
    description: "Start the merge, wait for it to finish, and save the new PDF to your device. Keep your original files until you have reviewed the result.",
  },
  {
    title: "Check the downloaded copy",
    description: "Open the result and check every page, including orientation, page order, attachments, signatures, and links that matter to you.",
  },
];

export default function MergePdfWithoutUploadingGuide() {
  return (
    <>
      <Navbar />
      <main className="bg-slate-50 px-5 py-10 dark:bg-slate-950 sm:px-6 lg:py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }} />

        <article className="mx-auto max-w-4xl">
          <header className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-8 text-white shadow-2xl sm:p-10 lg:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Merge PDF guide</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">How to merge PDFs without uploading them</h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              Combine PDF documents in the browser, choose their order, and save one file. Here are the actual limits and checks to know before sharing the result.
            </p>
          </header>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Four steps to combine PDFs</h2>
            <ol className="mt-5 space-y-5">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{index + 1}</span>
                  <div>
                    <h3 className="font-bold text-slate-950 dark:text-white">{step.title}</h3>
                    <p className="mt-1 leading-7 text-slate-600 dark:text-slate-300">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/merge-pdf" className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 py-3 font-bold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Open Merge PDF</Link>
          </section>

          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900 dark:bg-amber-950/20">
            <h2 className="text-2xl font-bold text-amber-950 dark:text-amber-100">Important limitations</h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 leading-7 text-amber-900 dark:text-amber-200">
              <li>Damaged or password-protected PDFs may not merge. Use the original password with an authorized unlock workflow first if needed.</li>
              <li>Combining files does not certify that digital signatures remain valid. Recheck any signatures and interactive content in the downloaded copy.</li>
              <li>For legal, financial, or official submissions, visually review every page and follow the destination service’s file requirements.</li>
            </ul>
          </section>

          <section className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-7 dark:border-blue-950 dark:bg-blue-950/20">
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Does a browser-based merge upload my PDFs?</h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
              In Kukureku, the selected PDF contents are processed locally in the browser for this tool; a conversion-server upload is not required. Ordinary website requests and analytics are separate from PDF processing. You can review the privacy explanation before working with sensitive material.
            </p>
            <div className="mt-5 flex flex-wrap gap-5">
              <Link href="/guides/private-pdf-tools" className="font-semibold text-blue-800 underline underline-offset-4 dark:text-blue-300">How private PDF processing works</Link>
              <Link href="/guides/choose-pdf-tool" className="font-semibold text-blue-800 underline underline-offset-4 dark:text-blue-300">Choose a different PDF tool</Link>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </>
  );
}
