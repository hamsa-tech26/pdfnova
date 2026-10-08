import type {
  PageLevelDiffReport,
} from "./pageDiff";
import type {
  WorkspaceFact,
  WorkspaceFactContradiction,
} from "./facts";
import {
  searchWorkspaceEvidence,
  type WorkspaceEvidenceCitation,
  type WorkspaceEvidenceIndex,
} from "./workspaceSearch";

export type WorkspaceCitedEvidence = {
  citation: WorkspaceEvidenceCitation;
  snippet: string;
};

export type WorkspaceCitedAnswer = {
  status:
    | "answered"
    | "evidence-only"
    | "not-found";
  title: string;
  answer: string;
  evidence: WorkspaceCitedEvidence[];
  basis:
    | "structured-facts"
    | "contradiction-detection"
    | "page-diff"
    | "local-retrieval";
};

function queryTerms(
  query: string,
) {
  return query
    .toLowerCase()
    .split(
      /[^a-z0-9₹]+/,
    )
    .filter(Boolean);
}

function factScore(
  fact: WorkspaceFact,
  query: string,
) {
  const terms =
    queryTerms(
      query,
    );
  const haystack =
    [
      fact.kind,
      fact.label,
      fact.value,
      fact.snippet,
    ]
      .join(" ")
      .toLowerCase();

  return terms.reduce(
    (score, term) =>
      score +
      (haystack.includes(
        term,
      )
        ? 1
        : 0),
    0,
  );
}

export function answerWorkspaceQuestion(
  query: string,
  context: {
    index: WorkspaceEvidenceIndex;
    facts: WorkspaceFact[];
    contradictions: WorkspaceFactContradiction[];
    activeDiff?: {
      otherName: string;
      report: PageLevelDiffReport;
      citations: readonly [
        WorkspaceEvidenceCitation,
        WorkspaceEvidenceCitation,
      ];
    } | null;
  },
): WorkspaceCitedAnswer {
  const normalized =
    query
      .trim()
      .toLowerCase();

  if (!normalized) {
    return {
      status:
        "not-found",
      title:
        "Ask a workspace question",
      answer:
        "Enter a question about the documents in this browser workspace.",
      evidence: [],
      basis:
        "local-retrieval",
    };
  }

  if (
    /contradict|conflict|inconsisten|different\s+(?:amount|date|number|value)/.test(
      normalized,
    ) &&
    context.contradictions
      .length > 0
  ) {
    const conflict =
      context.contradictions[0];

    return {
      status:
        "answered",
      title:
        "A cross-document conflict was found",
      answer:
        conflict.explanation +
        " Review the cited pages before deciding which value is authoritative.",
      evidence:
        conflict.facts
          .slice(0, 4)
          .map(
            (fact) => ({
              citation:
                fact.citation,
              snippet:
                fact.snippet,
            }),
          ),
      basis:
        "contradiction-detection",
    };
  }

  if (
    /what\s+changed|difference|added|removed|missing/.test(
      normalized,
    ) &&
    context.activeDiff
  ) {
    const summary =
      context.activeDiff.report
        .summary;
    const interesting =
      context.activeDiff.report.pages
        .filter(
          (page) =>
            page.status !==
            "unchanged",
        )
        .slice(0, 4);

    return {
      status:
        interesting.length > 0
          ? "answered"
          : "evidence-only",
      title:
        `Changes versus ${context.activeDiff.otherName}`,
      answer:
        `${summary.changed} page(s) changed, ${summary.added} added, ${summary.removed} removed, and ${summary.notVerifiable} could not be text-verified by page number.`,
      evidence:
        interesting.map(
          (page) => ({
            citation: {
              ...context
                .activeDiff!
                .citations[0],
              pageNumber:
                page.pageNumber,
            },
            snippet:
              [
                ...page
                  .addedFragments
                  .map(
                    (value) =>
                      "Added: " +
                      value,
                  ),
                ...page
                  .removedFragments
                  .map(
                    (value) =>
                      "Removed: " +
                      value,
                  ),
                ...page
                  .numericChanges
                  .map(
                    (value) =>
                      `Changed value: ${value.before} → ${value.after}`,
                  ),
              ]
                .slice(0, 3)
                .join(" · ") ||
              `Page ${page.pageNumber}: ${page.status}`,
          }),
        ),
      basis:
        "page-diff",
    };
  }

  const factKinds =
    /amount|cost|price|value|₹|rs\b|inr/.test(
      normalized,
    )
      ? ["amount"]
      : /date|when|deadline|due/.test(
            normalized,
          )
        ? ["date"]
        : /reference|invoice|order|file\s+no|document\s+no|number/.test(
              normalized,
            )
          ? [
              "document-number",
            ]
          : /email/.test(
              normalized,
            )
            ? ["email"]
            : /phone|mobile/.test(
                normalized,
              )
              ? ["phone"]
              : /name|person|applicant|employee|vendor/.test(
                  normalized,
                )
                ? [
                    "person-name",
                  ]
                : /company|organization|department|ministry|agency/.test(
                    normalized,
                  )
                  ? [
                      "organization",
                    ]
                  : [];

  if (
    factKinds.length > 0
  ) {
    const candidates =
      context.facts
        .filter(
          (fact) =>
            factKinds.includes(
              fact.kind,
            ),
        )
        .sort(
          (left, right) =>
            factScore(
              right,
              normalized,
            ) -
            factScore(
              left,
              normalized,
            ),
        )
        .slice(0, 5);

    if (
      candidates.length > 0
    ) {
      const best =
        candidates[0];

      return {
        status:
          "answered",
        title:
          `Best structured match: ${best.label}`,
        answer:
          `${best.value} appears in ${best.citation.fileName}, page ${best.citation.pageNumber}. Review the cited evidence before treating it as the authoritative value.`,
        evidence:
          candidates.map(
            (fact) => ({
              citation:
                fact.citation,
              snippet:
                fact.snippet,
            }),
          ),
        basis:
          "structured-facts",
      };
    }
  }

  const results =
    searchWorkspaceEvidence(
      context.index,
      query,
      5,
    );

  if (
    results.length === 0
  ) {
    return {
      status:
        "not-found",
      title:
        "No supported evidence was found",
      answer:
        "Kukureku could not find matching selectable-text evidence in the indexed workspace. Scanned or image-only text may be outside current coverage.",
      evidence: [],
      basis:
        "local-retrieval",
    };
  }

  const top =
    results[0];

  return {
    status:
      "evidence-only",
    title:
      "Best matching workspace evidence",
    answer:
      `The strongest local match is in ${top.citation.fileName}, page ${top.citation.pageNumber}. Kukureku is returning evidence rather than inventing a semantic conclusion it cannot verify.`,
    evidence:
      results.map(
        (result) => ({
          citation:
            result.citation,
          snippet:
            result.snippet,
        }),
      ),
    basis:
      "local-retrieval",
  };
}
