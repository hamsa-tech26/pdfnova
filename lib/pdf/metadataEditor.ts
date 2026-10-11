import { PDFDocument } from "pdf-lib";

export type PdfMetadataValues = {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
};

export function readPdfMetadata(pdf: PDFDocument): PdfMetadataValues {
  return {
    title: pdf.getTitle() ?? "",
    author: pdf.getAuthor() ?? "",
    subject: pdf.getSubject() ?? "",
    keywords: pdf.getKeywords() ?? "",
    creator: pdf.getCreator() ?? "",
    producer: pdf.getProducer() ?? "",
  };
}

export function parseMetadataKeywords(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!/[;,\n]/.test(trimmed)) return [trimmed];
  return trimmed
    .split(/[;,\n]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

export function applyPdfMetadata(pdf: PDFDocument, values: PdfMetadataValues) {
  pdf.setTitle(values.title.trim());
  pdf.setAuthor(values.author.trim());
  pdf.setSubject(values.subject.trim());
  // pdf-lib joins keyword array entries with spaces. Store a single
  // comma-delimited string to preserve visible keyword boundaries on
  // subsequent PDF reads; maintain normalized token parsing on input.
  pdf.setKeywords([parseMetadataKeywords(values.keywords).join(", ")]);
  pdf.setCreator(values.creator.trim());
  pdf.setProducer(values.producer.trim());
}
