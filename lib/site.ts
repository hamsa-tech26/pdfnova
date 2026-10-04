export const BRAND_NAME = "Kukureku";
export const PRODUCT_NAME = "Kukureku PDF";
export const PRODUCT_DESCRIPTION =
  "Free private PDF tools that run in your browser. Merge, split, compress, convert, organize, watermark, and unlock PDFs without uploading your files.";

const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://kukureku.com";

export const SITE_URL = configuredSiteUrl.replace(/\/+$/, "");
