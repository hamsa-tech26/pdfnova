export const BRAND_NAME = "Kukureku";
export const PRODUCT_NAME = "Kukureku PDF";
export const PRODUCT_DESCRIPTION =
  "Kukureku PDF offers fast, private browser-based tools to merge, split, compress, convert, organize, watermark, and unlock PDF documents.";

const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://pdfnova-sable.vercel.app";

export const SITE_URL = configuredSiteUrl.replace(/\/+$/, "");
