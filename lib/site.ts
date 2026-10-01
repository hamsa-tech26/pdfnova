export const BRAND_NAME = "Peakatee";
export const PRODUCT_NAME = "Peakatee PDF";
export const PRODUCT_DESCRIPTION =
  "Free, fast, private browser-based PDF tools for merging, splitting, compressing, converting, organizing, watermarking, and unlocking documents.";

const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://pdfnova-sable.vercel.app";

export const SITE_URL = configuredSiteUrl.replace(/\/+$/, "");
