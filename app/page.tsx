import AISection from "@/components/AISection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ToolsSection from "@/components/ToolsSection";
import {
  BRAND_NAME,
  PRODUCT_DESCRIPTION,
  PRODUCT_NAME,
  SITE_URL,
} from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: PRODUCT_NAME,
      alternateName: BRAND_NAME,
      url: SITE_URL,
      description: PRODUCT_DESCRIPTION,
    },
    {
      "@type": "WebApplication",
      name: PRODUCT_NAME,
      url: SITE_URL,
      description: PRODUCT_DESCRIPTION,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      browserRequirements:
        "Requires a modern web browser with JavaScript enabled.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />

        <section className="bg-slate-50 px-4 py-4 dark:bg-slate-950 sm:px-6 sm:py-12 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white shadow-2xl">
              <div className="grid items-center gap-6 p-5 sm:p-9 lg:grid-cols-[1.2fr_0.8fr] lg:gap-10 lg:p-12 xl:p-14">
                <div>
                  <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur sm:px-4 sm:py-2 sm:text-sm">
                    Free PDF & Document Tools
                  </div>

                  <h1 className="mt-4 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:mt-6 sm:text-5xl lg:text-6xl">
                    Free private PDF tools. No uploads. No account.
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:mt-6 sm:text-lg sm:leading-8">
                    Merge, compress or turn images into PDFs in your browser. No document uploads or account required.
                  </p>

                  <nav aria-label="Popular PDF tools" className="mt-4 grid gap-2 sm:mt-6 sm:grid-cols-3">
                    {[
                      {href: "/merge-pdf", label: "Merge PDF"},
                      {href: "/compress-pdf", label: "Compress PDF"},
                      {href: "/jpg-to-pdf", label: "JPG to PDF"},
                    ].map(tool => (
                      <Link key={tool.href} href={tool.href}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-center text-sm font-semibold text-blue-900 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                        {tool.label}
                      </Link>
                    ))}
                  </nav>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 sm:mt-6">
                    <Link
                      href="/dashboard"
                      className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      Open Kukureku PDF Tools
                    </Link>

                    <a
                      href="#tools"
                      className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      Browse All Tools
                    </a>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-blue-100 sm:mt-7">
                    <span>No installation</span>
                    <span>No account required</span>
                    <span>Browser-based processing</span>
                    <span>Up to 25 MB per file</span>
                  </div>
                </div>

                <div className="hidden grid-cols-2 gap-3 sm:gap-4 lg:grid">
                  <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                    <p className="font-bold">Private</p>
                    <p className="mt-2 text-sm leading-6 text-blue-100">
                      Current tools process supported files locally.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                    <p className="font-bold">Fast</p>
                    <p className="mt-2 text-sm leading-6 text-blue-100">
                      Built for quick everyday document work.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                    <p className="font-bold">Browser-based</p>
                    <p className="mt-2 text-sm leading-6 text-blue-100">
                      No software installation required.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
                    <p className="font-bold">31 working tools</p>
                    <p className="mt-2 text-sm leading-6 text-blue-100">
                      Ready for common PDF workflows.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <ToolsSection />
        <FeaturesSection />
        <AISection />
      </main>

      <Footer />
    </>
  );
}
