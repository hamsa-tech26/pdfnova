/**
 * A sparse-text OCR heading hypothesis is not a recovered fact.
 * Only surface the first alternate line when it resembles a short heading
 * absent from the primary text; reject labels, body prose and reordering.
 */
export function suggestPdfV4OcrMissingHeading(
  primaryText: string,
  alternateText: string,
): string | null {
  const firstLine = alternateText.split(/\r?\n/, 1)[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (firstLine.length < 8 || firstLine.length > 110 ||
      !/^[A-Za-z0-9 .,/()&\-–—]+$/.test(firstLine)) return null;
  const words = firstLine.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 13) return null;
  if (/^(?:record|invoice|application|serial|reference|facility|package)\s+(?:id|code|no|number)\b/i.test(firstLine)) return null;
  if (/[.:]$/.test(firstLine)) return null;

  const letters = firstLine.replace(/[^A-Za-z]/g, "");
  if (letters.length < 7) return null;
  const uppercaseRatio = (letters.match(/[A-Z]/g)?.length ?? 0) / letters.length;
  const titledRatio = words.filter(word => /^[A-Z][a-z]/.test(word)).length / words.length;
  if (uppercaseRatio < 0.7 && titledRatio < 0.7) return null;

  const normalized = (text: string) => text.toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized(primaryText).includes(normalized(firstLine))) return null;
  return firstLine;
}
