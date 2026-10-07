import {
  normalizeComparableText,
  type PdfContentSignal,
} from "./contentSignals";
import type {
  WorkspaceIntelligenceNode,
} from "./types";

export type WorkspaceEvidenceCitation = {
  nodeId: string;
  documentId: string;
  fileName: string;
  version: number;
  pageNumber: number;
};

export type WorkspaceEvidencePage = {
  citation: WorkspaceEvidenceCitation;
  text: string;
  normalizedText: string;
};

export type WorkspaceEvidenceChunk = {
  id: string;
  citation: WorkspaceEvidenceCitation;
  text: string;
  normalizedText: string;
  tokenCount: number;
};

export type WorkspaceEvidenceIndex = {
  pages: WorkspaceEvidencePage[];
  chunks: WorkspaceEvidenceChunk[];
  indexedNodeIds: string[];
  skippedNodeIds: string[];
  coverage: {
    mode:
      "browser-local-selectable-text";
    maxNodes: number;
    maxPages: number;
    maxChunks: number;
    pageCount: number;
    chunkCount: number;
    truncated: boolean;
    notes: string[];
  };
};

export type WorkspaceEvidenceSearchResult = {
  score: number;
  citation: WorkspaceEvidenceCitation;
  snippet: string;
  matchedTerms: string[];
};

export const DEFAULT_WORKSPACE_EVIDENCE_LIMITS = {
  maxNodes: 10,
  maxPages: 160,
  maxChunks: 480,
};

function tokenize(
  value: string,
) {
  return normalizeComparableText(
    value,
  )
    .split(" ")
    .filter(
      (token) =>
        token.length > 1,
    );
}

function hashToken(
  value: string,
) {
  let hash = 2166136261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^=
      value.charCodeAt(
        index,
      );
    hash =
      Math.imul(
        hash,
        16777619,
      );
  }

  return hash >>> 0;
}

function vectorize(
  value: string,
  dimensions = 192,
) {
  const tokens =
    tokenize(value);
  const vector =
    new Float64Array(
      dimensions,
    );
  const features: string[] =
    [...tokens];

  for (
    let index = 0;
    index <
    tokens.length - 1;
    index += 1
  ) {
    features.push(
      tokens[index] +
        " " +
        tokens[index + 1],
    );
  }

  for (const feature of features) {
    const bucket =
      hashToken(
        feature,
      ) % dimensions;
    vector[bucket] +=
      feature.includes(" ")
        ? 1.25
        : 1;
  }

  let magnitude = 0;

  for (const value of vector) {
    magnitude +=
      value * value;
  }

  magnitude =
    Math.sqrt(magnitude);

  if (magnitude > 0) {
    for (
      let index = 0;
      index <
      vector.length;
      index += 1
    ) {
      vector[index] /=
        magnitude;
    }
  }

  return vector;
}

function cosine(
  left: Float64Array,
  right: Float64Array,
) {
  let score = 0;

  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    score +=
      left[index] *
      right[index];
  }

  return score;
}

function splitIntoChunks(
  text: string,
  maxChars = 720,
  overlapChars = 120,
) {
  const clean =
    text
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

  if (!clean) {
    return [];
  }

  if (
    clean.length <= maxChars
  ) {
    return [clean];
  }

  const chunks: string[] =
    [];
  let start = 0;

  while (
    start < clean.length
  ) {
    let end =
      Math.min(
        clean.length,
        start + maxChars,
      );

    if (
      end < clean.length
    ) {
      const boundary =
        Math.max(
          clean.lastIndexOf(
            ". ",
            end,
          ),
          clean.lastIndexOf(
            "; ",
            end,
          ),
          clean.lastIndexOf(
            " ",
            end,
          ),
        );

      if (
        boundary >
        start + maxChars * 0.6
      ) {
        end = boundary + 1;
      }
    }

    chunks.push(
      clean
        .slice(
          start,
          end,
        )
        .trim(),
    );

    if (
      end >= clean.length
    ) {
      break;
    }

    start =
      Math.max(
        start + 1,
        end - overlapChars,
      );
  }

  return chunks;
}

export function buildWorkspaceEvidenceIndex(
  inputs: Array<{
    node: WorkspaceIntelligenceNode;
    signal: PdfContentSignal;
  }>,
  limits = DEFAULT_WORKSPACE_EVIDENCE_LIMITS,
): WorkspaceEvidenceIndex {
  const pages: WorkspaceEvidencePage[] =
    [];
  const chunks: WorkspaceEvidenceChunk[] =
    [];
  const indexedNodeIds: string[] =
    [];
  const skippedNodeIds: string[] =
    [];
  let truncated = false;

  for (const input of inputs) {
    if (
      indexedNodeIds.length >=
      limits.maxNodes
    ) {
      skippedNodeIds.push(
        input.node.id,
      );
      truncated = true;
      continue;
    }

    indexedNodeIds.push(
      input.node.id,
    );

    const signalPages =
      input.signal.pages ??
      (
        input.signal.rawText
          ? [
              {
                pageNumber: 1,
                text:
                  input.signal.rawText,
                normalizedText:
                  input.signal.normalizedText,
                selectableTextChars:
                  input.signal.selectableTextChars,
              },
            ]
          : []
      );

    for (const page of signalPages) {
      if (
        pages.length >=
        limits.maxPages
      ) {
        truncated = true;
        break;
      }

      const citation: WorkspaceEvidenceCitation =
        {
          nodeId:
            input.node.id,
          documentId:
            input.node.documentId,
          fileName:
            input.node.name,
          version:
            input.node.version,
          pageNumber:
            page.pageNumber,
        };

      pages.push({
        citation,
        text: page.text,
        normalizedText:
          page.normalizedText,
      });

      for (
        const [
          chunkIndex,
          chunkText,
        ] of splitIntoChunks(
          page.text,
        ).entries()
      ) {
        if (
          chunks.length >=
          limits.maxChunks
        ) {
          truncated = true;
          break;
        }

        const normalizedText =
          normalizeComparableText(
            chunkText,
          );

        chunks.push({
          id:
            [
              input.node.id,
              page.pageNumber,
              chunkIndex,
            ].join(":"),
          citation,
          text: chunkText,
          normalizedText,
          tokenCount:
            tokenize(
              normalizedText,
            ).length,
        });
      }

      if (
        chunks.length >=
        limits.maxChunks
      ) {
        break;
      }
    }

    if (
      pages.length >=
        limits.maxPages ||
      chunks.length >=
        limits.maxChunks
    ) {
      const remaining =
        inputs
          .slice(
            inputs.indexOf(
              input,
            ) + 1,
          )
          .map(
            (item) =>
              item.node.id,
          );

      skippedNodeIds.push(
        ...remaining,
      );
      truncated = true;
      break;
    }
  }

  return {
    pages,
    chunks,
    indexedNodeIds: [
      ...new Set(
        indexedNodeIds,
      ),
    ],
    skippedNodeIds: [
      ...new Set(
        skippedNodeIds,
      ),
    ],
    coverage: {
      mode:
        "browser-local-selectable-text",
      maxNodes:
        limits.maxNodes,
      maxPages:
        limits.maxPages,
      maxChunks:
        limits.maxChunks,
      pageCount:
        pages.length,
      chunkCount:
        chunks.length,
      truncated,
      notes: [
        "Only selectable PDF text is indexed; image-only text is not OCR-expanded here.",
        "Search uses deterministic local hashed token and bigram vectors plus exact token overlap.",
        "The index is rebuilt in browser memory and is not uploaded.",
      ],
    },
  };
}

export function searchWorkspaceEvidence(
  index: WorkspaceEvidenceIndex,
  query: string,
  limit = 8,
): WorkspaceEvidenceSearchResult[] {
  const normalizedQuery =
    normalizeComparableText(
      query,
    );

  if (!normalizedQuery) {
    return [];
  }

  const queryVector =
    vectorize(
      normalizedQuery,
    );
  const queryTerms =
    [
      ...new Set(
        tokenize(
          normalizedQuery,
        ),
      ),
    ];
  const results: WorkspaceEvidenceSearchResult[] =
    [];

  for (const chunk of index.chunks) {
    const chunkVector =
      vectorize(
        chunk.normalizedText,
      );
    const vectorScore =
      cosine(
        queryVector,
        chunkVector,
      );
    const matchedTerms =
      queryTerms.filter(
        (term) =>
          chunk.normalizedText.includes(
            term,
          ),
      );
    const termScore =
      queryTerms.length > 0
        ? matchedTerms.length /
          queryTerms.length
        : 0;
    const phraseBoost =
      chunk.normalizedText.includes(
        normalizedQuery,
      )
        ? 0.35
        : 0;
    const score =
      vectorScore * 0.65 +
      termScore * 0.35 +
      phraseBoost;

    if (score <= 0) {
      continue;
    }

    results.push({
      score,
      citation:
        chunk.citation,
      snippet:
        chunk.text.length >
        420
          ? chunk.text.slice(
              0,
              417,
            ) + "…"
          : chunk.text,
      matchedTerms,
    });
  }

  return results
    .sort(
      (left, right) =>
        right.score -
        left.score,
    )
    .slice(
      0,
      Math.max(
        1,
        limit,
      ),
    );
}
