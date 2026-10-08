import {
  normalizeComparableText,
} from "./contentSignals";
import type {
  WorkspaceFact,
  WorkspaceFactContradiction,
  WorkspaceFactKind,
} from "./facts";

export type WorkspaceFactConcept =
  | "amount"
  | "date"
  | "document-id"
  | "person"
  | "organization"
  | "contact"
  | "identity";

export type NormalizedWorkspaceFact =
  WorkspaceFact & {
    concept:
      WorkspaceFactConcept;
    canonicalField:
      string;
    canonicalValue:
      string;
  };

const FIELD_ALIASES: Array<{
  canonical: string;
  terms: string[];
}> = [
  {
    canonical:
      "contract-amount",
    terms: [
      "total amount",
      "final amount",
      "net amount",
      "contract value",
      "award value",
      "awarded amount",
      "tender value",
      "estimated cost",
      "amount",
    ],
  },
  {
    canonical:
      "completion-date",
    terms: [
      "due date",
      "completion date",
      "delivery date",
      "deadline",
      "target date",
    ],
  },
  {
    canonical:
      "document-date",
    terms: [
      "effective date",
      "issue date",
      "document date",
    ],
  },
  {
    canonical:
      "document-number",
    terms: [
      "invoice no",
      "invoice number",
      "order no",
      "order number",
      "reference no",
      "reference number",
      "ref no",
      "ref number",
      "file no",
      "file number",
      "document no",
      "document number",
      "agreement no",
      "agreement number",
      "contract no",
      "contract number",
    ],
  },
];

function conceptForKind(
  kind: WorkspaceFactKind,
): WorkspaceFactConcept {
  if (kind === "amount") {
    return "amount";
  }

  if (kind === "date") {
    return "date";
  }

  if (
    kind ===
    "document-number"
  ) {
    return "document-id";
  }

  if (
    kind ===
    "person-name"
  ) {
    return "person";
  }

  if (
    kind ===
    "organization"
  ) {
    return "organization";
  }

  if (
    kind ===
      "email" ||
    kind ===
      "phone"
  ) {
    return "contact";
  }

  return "identity";
}

function canonicalFieldFor(
  fact: WorkspaceFact,
) {
  const normalized =
    normalizeComparableText(
      fact.fieldKey ??
        fact.label,
    );

  for (
    const alias of
      FIELD_ALIASES
  ) {
    if (
      alias.terms.some(
        (term) =>
          normalized ===
            normalizeComparableText(
              term,
            ) ||
          normalized.includes(
            normalizeComparableText(
              term,
            ),
          ),
      )
    ) {
      return alias.canonical;
    }
  }

  return (
    normalized ||
    fact.kind
  );
}

function normalizeAmount(
  value: string,
) {
  const numeric =
    value
      .replace(
        /[^0-9.]/g,
        "",
      )
      .trim();

  const parsed =
    Number(numeric);

  return Number.isFinite(
    parsed,
  )
    ? parsed.toFixed(2)
    : normalizeComparableText(
        value,
      );
}

function normalizeDate(
  value: string,
) {
  const parts =
    value
      .replace(
        /[^0-9]/g,
        " ",
      )
      .trim()
      .split(/\s+/)
      .map(Number);

  if (
    parts.length !== 3
  ) {
    return normalizeComparableText(
      value,
    );
  }

  let year: number;
  let month: number;
  let day: number;

  if (
    String(parts[0])
      .length === 4
  ) {
    [
      year,
      month,
      day,
    ] = parts;
  } else {
    [
      day,
      month,
      year,
    ] = parts;

    if (year < 100) {
      year +=
        year >= 70
          ? 1900
          : 2000;
    }
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return normalizeComparableText(
      value,
    );
  }

  return [
    String(year).padStart(
      4,
      "0",
    ),
    String(month).padStart(
      2,
      "0",
    ),
    String(day).padStart(
      2,
      "0",
    ),
  ].join("-");
}

export function normalizeWorkspaceFactsV2(
  facts: WorkspaceFact[],
): NormalizedWorkspaceFact[] {
  return facts.map(
    (fact) => ({
      ...fact,
      concept:
        conceptForKind(
          fact.kind,
        ),
      canonicalField:
        canonicalFieldFor(
          fact,
        ),
      canonicalValue:
        fact.kind ===
        "amount"
          ? normalizeAmount(
              fact.value,
            )
          : fact.kind ===
              "date"
            ? normalizeDate(
                fact.value,
              )
            : normalizeComparableText(
                fact.value,
              ),
    }),
  );
}

export function detectWorkspaceConceptContradictionsV2(
  facts: WorkspaceFact[],
): WorkspaceFactContradiction[] {
  const normalized =
    normalizeWorkspaceFactsV2(
      facts,
    );
  const groups =
    new Map<
      string,
      NormalizedWorkspaceFact[]
    >();

  for (const fact of normalized) {
    if (
      ![
        "amount",
        "date",
        "document-id",
      ].includes(
        fact.concept,
      )
    ) {
      continue;
    }

    const key =
      fact.concept +
      ":" +
      fact.canonicalField;
    const current =
      groups.get(key) ??
      [];

    current.push(fact);
    groups.set(
      key,
      current,
    );
  }

  const results:
    WorkspaceFactContradiction[] =
    [];

  for (
    const [
      key,
      group,
    ] of groups
  ) {
    const documents =
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
            fact.canonicalValue,
        ),
      );

    if (
      documents.size < 2 ||
      values.size < 2
    ) {
      continue;
    }

    results.push({
      id:
        "concept-conflict:" +
        key,
      kind:
        group[0].kind,
      label:
        group[0]
          .canonicalField
          .replace(
            /-/g,
            " ",
          ),
      confidence:
        group.every(
          (fact) =>
            fact.confidence ===
            "strong-pattern",
        )
          ? "strong"
          : "possible",
      explanation:
        `Different normalized values were detected for the related concept “${group[0].canonicalField.replace(/-/g, " ")}” across multiple workspace documents.`,
      facts:
        group.slice(
          0,
          8,
        ),
    });
  }

  return results;
}
