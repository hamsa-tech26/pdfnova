import ThemeProvider from "@/components/providers/ThemeProvider";
import { PRODUCT_DESCRIPTION, PRODUCT_NAME, SITE_URL } from "@/lib/site";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: "Peakatee PDF - Free Private PDF Tools Online",
    template: "%s | Peakatee PDF",
  },

  description: PRODUCT_DESCRIPTION,
  applicationName: PRODUCT_NAME,
  category: "productivity",

  openGraph: {
    type: "website",
    siteName: PRODUCT_NAME,
    title: "Peakatee PDF - Free Private PDF Tools Online",
    description: PRODUCT_DESCRIPTION,
  },

  twitter: {
    card: "summary_large_image",
    title: "Peakatee PDF - Free Private PDF Tools Online",
    description: PRODUCT_DESCRIPTION,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-gray-900 dark:bg-slate-950 dark:text-white">
        <ThemeProvider>
          {children}

          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={3000}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
