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

        <section className="bg-slate-50 px-5 py-8 dark:bg-slate-950 sm:px-6 sm:py-12 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white shadow-2xl">
              <div className="grid items-center gap-10 p-7 sm:p-9 lg:grid-cols-[1.2fr_0.8fr] lg:p-12 xl:p-14">
                <div>
                  <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-100 backdrop-blur">
                    Free PDF & Document Tools
                  </div>

                  <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                    Free private PDF tools. No uploads. No account.
                  </h1>

                  <p className="mt-6 max-w-2xl text-lg leading-8 text-blue-100">
                    Merge, split, compress, convert, organize, watermark, and unlock PDFs directly in your browser. Current Kukureku tools keep supported files on your device.
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-6 py-3.5 font-semibold text-blue-900 transition hover:-translate-y-0.5 hover:bg-slate-200"
                    >
                      Open Kukureku PDF Tools
                    </Link>

                    <a
                      href="#tools"
                      className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      Browse All Tools
                    </a>
                  </div>

                  <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-blue-100">
                    <span>No installation</span>
                    <span>No account required</span>
                    <span>Browser-based processing</span>
                    <span>Up to 25 MB per file</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
                    <p className="font-bold">11 working tools</p>
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
