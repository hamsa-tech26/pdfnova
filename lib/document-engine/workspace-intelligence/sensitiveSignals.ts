export type SensitiveSignalKind =
  | "email"
  | "phone"
  | "aadhaar-like"
  | "pan-like"
  | "date-of-birth-like"
  | "long-numeric-identifier";

export type SensitiveSignal = {
  kind: SensitiveSignalKind;
  label: string;
  count: number;
  confidence:
    | "strong-pattern"
    | "broad-pattern";
};

export type SensitiveTextReport = {
  signals: SensitiveSignal[];
  totalMatches: number;
  coverage: {
    mode:
      "selectable-text-patterns";
    semanticAddressDetection: false;
    ocrIncluded: false;
    notes: string[];
  };
};

type PatternDefinition = {
  kind: SensitiveSignalKind;
  label: string;
  expression: RegExp;
  confidence:
    | "strong-pattern"
    | "broad-pattern";
};

const patterns: PatternDefinition[] = [
  {
    kind: "email",
    label:
      "Email address pattern",
    expression:
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    confidence:
      "strong-pattern",
  },
  {
    kind: "phone",
    label:
      "Indian phone number pattern",
    expression:
      /(?:\+?91[-\s]?)?\b[6-9]\d{9}\b/g,
    confidence:
      "strong-pattern",
  },
  {
    kind: "aadhaar-like",
    label:
      "Aadhaar-like 12-digit pattern",
    expression:
      /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
    confidence:
      "broad-pattern",
  },
  {
    kind: "pan-like",
    label:
      "PAN-like identifier pattern",
    expression:
      /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    confidence:
      "strong-pattern",
  },
  {
    kind:
      "date-of-birth-like",
    label:
      "Date-of-birth labeled date pattern",
    expression:
      /\b(?:dob|date\s+of\s+birth|birth\s+date)\s*[:\-]?\s*(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})\b/gi,
    confidence:
      "strong-pattern",
  },
  {
    kind:
      "long-numeric-identifier",
    label:
      "Long numeric identifier pattern",
    expression:
      /\b\d{9,18}\b/g,
    confidence:
      "broad-pattern",
  },
];

export function scanSensitiveText(
  text: string,
): SensitiveTextReport {
  const signals: SensitiveSignal[] =
    [];

  for (const pattern of patterns) {
    const matches =
      text.match(
        new RegExp(
          pattern.expression.source,
          pattern.expression.flags,
        ),
      ) ?? [];

    if (matches.length === 0) {
      continue;
    }

    signals.push({
      kind: pattern.kind,
      label: pattern.label,
      count:
        matches.length,
      confidence:
        pattern.confidence,
    });
  }

  return {
    signals,
    totalMatches:
      signals.reduce(
        (total, signal) =>
          total +
          signal.count,
        0,
      ),
    coverage: {
      mode:
        "selectable-text-patterns",
      semanticAddressDetection:
        false,
      ocrIncluded: false,
      notes: [
        "Patterns can produce false positives and false negatives.",
        "Only selectable PDF text is scanned; image-only text is not OCR-scanned here.",
        "Kukureku does not currently claim semantic postal-address detection in this check.",
      ],
    },
  };
}
