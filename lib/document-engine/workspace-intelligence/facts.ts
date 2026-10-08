import type {
  WorkspaceEvidenceCitation,
  WorkspaceEvidenceIndex,
} from "./workspaceSearch";

export type WorkspaceFactKind =
  | "amount"
  | "date"
  | "email"
  | "phone"
  | "pan-like"
  | "aadhaar-like"
  | "document-number"
  | "person-name"
  | "organization";

export type WorkspaceFact = {
  id: string;
  kind: WorkspaceFactKind;
  label: string;
  fieldKey: string | null;
  value: string;
  normalizedValue: string;
  confidence:
    | "strong-pattern"
    | "broad-pattern";
  citation: WorkspaceEvidenceCitation;
  snippet: string;
};

export type WorkspaceFactContradiction = {
  id: string;
  kind: WorkspaceFactKind;
  label: string;
  confidence:
    | "strong"
    | "possible";
  explanation: string;
  facts: WorkspaceFact[];
};

function snippetAround(
  text: string,
  index: number,
  length: number,
) {
  const start =
    Math.max(
      0,
      index - 90,
    );
  const end =
    Math.min(
      text.length,
      index +
        length +
        110,
    );

  return text
    .slice(
      start,
      end,
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function normalizeValue(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[\s,]+/g,
      "",
    )
    .replace(
      /rs\.?|inr|₹/g,
      "₹",
    )
    .trim();
}

function fieldFromPrefix(
  prefix: string,
) {
  const match =
    prefix.match(
      /\b(total\s+amount|final\s+amount|net\s+amount|contract\s+value|estimated\s+cost|tender\s+value|amount|due\s+date|effective\s+date|issue\s+date|document\s+date|invoice\s+(?:no|number)|order\s+(?:no|number)|reference\s+(?:no|number)|ref\s+(?:no|number)|file\s+(?:no|number)|document\s+(?:no|number)|agreement\s+(?:no|number)|contract\s+(?:no|number))\s*[:\-]?\s*$/i,
    );

  return match
    ? match[1]
        .toLowerCase()
        .replace(
          /\s+/g,
          " ",
        )
    : null;
}

function addMatches(
  facts: WorkspaceFact[],
  pageText: string,
  citation: WorkspaceEvidenceCitation,
  definition: {
    kind: WorkspaceFactKind;
    label: string;
    expression: RegExp;
    confidence:
      | "strong-pattern"
      | "broad-pattern";
    valueGroup?: number;
  },
) {
  const expression =
    new RegExp(
      definition.expression.source,
      definition.expression.flags.includes(
        "g",
      )
        ? definition.expression.flags
        : definition.expression.flags +
            "g",
    );
  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      expression.exec(
        pageText,
      )) !== null
  ) {
    const value =
      match[
        definition.valueGroup ??
          0
      ] ?? match[0];
    const prefix =
      pageText.slice(
        Math.max(
          0,
          match.index - 70,
        ),
        match.index,
      );
    const fieldKey =
      fieldFromPrefix(
        prefix,
      );

    facts.push({
      id:
        [
          citation.nodeId,
          citation.pageNumber,
          definition.kind,
          match.index,
        ].join(":"),
      kind:
        definition.kind,
      label:
        fieldKey ??
        definition.label,
      fieldKey,
      value:
        value.trim(),
      normalizedValue:
        normalizeValue(
          value,
        ),
      confidence:
        definition.confidence,
      citation,
      snippet:
        snippetAround(
          pageText,
          match.index,
          match[0].length,
        ),
    });

    if (
      match[0].length === 0
    ) {
      expression.lastIndex +=
        1;
    }
  }
}

export function extractWorkspaceFacts(
  index: WorkspaceEvidenceIndex,
) {
  const facts: WorkspaceFact[] =
    [];

  for (const page of index.pages) {
    const text = page.text;

    addMatches(
      facts,
      text,
      page.citation,
      {
        kind: "amount",
        label: "Amount",
        expression:
          /(?:₹|\bRs\.?|\bINR|\$)\s*[0-9][0-9,]*(?:\.\d{1,2})?/gi,
        confidence:
          "strong-pattern",
      },
    );
    addMatches(
      facts,
      text,
      page.citation,
      {
        kind: "date",
        label: "Date",
        expression:
          /\b(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})\b/g,
        confidence:
          "broad-pattern",
      },
    );
    addMatches(
      facts,
      text,
      page.citation,
      {
        kind: "email",
        label: "Email",
        expression:
          /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        confidence:
          "strong-pattern",
      },
    );
    addMatches(
      facts,
      text,
      page.citation,
      {
        kind: "phone",
        label: "Phone",
        expression:
          /(?:\+?91[-\s]?)?\b[6-9]\d{9}\b/g,
        confidence:
          "strong-pattern",
      },
    );
    addMatches(
      facts,
      text,
      page.citation,
      {
        kind: "pan-like",
        label:
          "PAN-like identifier",
        expression:
          /\b[A-Z]{5}\d{4}[A-Z]\b/g,
        confidence:
          "strong-pattern",
      },
    );
    addMatches(
      facts,
      text,
      page.citation,
      {
        kind: "aadhaar-like",
        label:
          "Aadhaar-like identifier",
        expression:
          /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
        confidence:
          "broad-pattern",
      },
    );
    addMatches(
      facts,
      text,
      page.citation,
      {
        kind:
          "document-number",
        label:
          "Document number",
        expression:
          /\b(?:invoice|order|reference|ref|file|document|agreement|contract)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/.]{2,})/gi,
        confidence:
          "strong-pattern",
        valueGroup: 1,
      },
    );
    addMatches(
      facts,
      text,
      page.citation,
      {
        kind:
          "person-name",
        label:
          "Labeled person name",
        expression:
          /\b(?:applicant|employee|customer|vendor|contractor|signatory|name)\s*[:\-]\s*([A-Z][A-Za-z.' -]{2,60})/g,
        confidence:
          "broad-pattern",
        valueGroup: 1,
      },
    );
    addMatches(
      facts,
      text,
      page.citation,
      {
        kind:
          "organization",
        label:
          "Labeled organization",
        expression:
          /\b(?:organization|company|department|ministry|agency|office)\s*[:\-]\s*([A-Z][A-Za-z0-9&.,'() -]{2,80})/g,
        confidence:
          "broad-pattern",
        valueGroup: 1,
      },
    );
  }

  const seen =
    new Set<string>();

  return facts.filter(
    (fact) => {
      const key =
        [
          fact.kind,
          fact.normalizedValue,
          fact.citation.nodeId,
          fact.citation.pageNumber,
        ].join(":");

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);
      return true;
    },
  );
}

export function detectWorkspaceFactContradictions(
  facts: WorkspaceFact[],
): WorkspaceFactContradiction[] {
  const groups =
    new Map<
      string,
      WorkspaceFact[]
    >();

  for (const fact of facts) {
    if (
      !fact.fieldKey ||
      ![
        "amount",
        "date",
        "document-number",
      ].includes(
        fact.kind,
      )
    ) {
      continue;
    }

    const key =
      fact.kind +
      ":" +
      fact.fieldKey;
    const current =
      groups.get(key) ??
      [];

    current.push(fact);
    groups.set(
      key,
      current,
    );
  }

  const contradictions: WorkspaceFactContradiction[] =
    [];

  for (
    const [
      key,
      group,
    ] of groups
  ) {
    const byDocument =
      new Set(
        group.map(
          (fact) =>
            fact.citation
              .documentId,
        ),
      );
    const values =
      new Set(
        group.map(
          (fact) =>
            fact.normalizedValue,
        ),
      );

    if (
      byDocument.size < 2 ||
      values.size < 2
    ) {
      continue;
    }

    contradictions.push({
      id:
        "conflict:" + key,
      kind:
        group[0].kind,
      label:
        group[0].label,
      confidence:
        group.every(
          (fact) =>
            fact.confidence ===
            "strong-pattern",
        )
          ? "strong"
          : "possible",
      explanation:
        `Different values were found for the same labeled ${group[0].label.toLowerCase()} across multiple workspace documents.`,
      facts:
        group.slice(0, 8),
    });
  }

  return contradictions;
}
