import {
  normalizeComparableText,
  textSimilarity,
  type PdfContentSignal,
  type PdfPageContentSignal,
} from "./contentSignals";
import type {
  WorkspaceEvidenceIndex,
} from "./workspaceSearch";

export type PrivateWorkspaceOcrMode =
  | "auto"
  | "off";

export type PrivateWorkspaceIntelligenceSettings = {
  ocrMode: PrivateWorkspaceOcrMode;
  maxOcrPagesPerDocument: number;
  maxWorkspaceNodes: number;
  maxWorkspacePages: number;
  maxWorkspaceChunks: number;
};

export const DEFAULT_PRIVATE_WORKSPACE_INTELLIGENCE_SETTINGS: PrivateWorkspaceIntelligenceSettings =
  {
    ocrMode: "auto",
    maxOcrPagesPerDocument: 8,
    maxWorkspaceNodes: 30,
    maxWorkspacePages: 400,
    maxWorkspaceChunks: 1200,
  };

export type PrivateWorkspaceAnalysisProgress = {
  phase:
    | "native-text"
    | "ocr"
    | "index"
    | "complete";
  completed: number;
  total: number;
  message: string;
};

export type PrivateWorkspaceOcrCoverage = {
  attemptedPages: number[];
  recognizedPages: number[];
  failedPages: number[];
  averageConfidence: number | null;
};

function throwIfAborted(
  signal?: AbortSignal,
) {
  if (signal?.aborted) {
    throw new DOMException(
      "Workspace intelligence analysis was cancelled.",
      "AbortError",
    );
  }
}

export async function enrichPdfContentSignalWithLocalOcr(
  file: File,
  signal: PdfContentSignal,
  options: {
    mode?: PrivateWorkspaceOcrMode;
    maxPages?: number;
    abortSignal?: AbortSignal;
    onProgress?: (
      progress: PrivateWorkspaceAnalysisProgress,
    ) => void;
  } = {},
): Promise<{
  signal: PdfContentSignal;
  coverage: PrivateWorkspaceOcrCoverage;
}> {
  const mode =
    options.mode ?? "auto";
  const maxPages =
    Math.max(
      0,
      options.maxPages ?? 8,
    );
  const pages =
    signal.pages ?? [];
  const coverage: PrivateWorkspaceOcrCoverage =
    {
      attemptedPages: [],
      recognizedPages: [],
      failedPages: [],
      averageConfidence: null,
    };

  if (
    mode === "off" ||
    maxPages === 0 ||
    pages.length === 0
  ) {
    return {
      signal,
      coverage,
    };
  }

  const sparsePages =
    pages
      .filter(
        (page) =>
          page.selectableTextChars <
          40,
      )
      .map(
        (page) =>
          page.pageNumber,
      )
      .slice(0, maxPages);

  if (
    sparsePages.length === 0
  ) {
    return {
      signal,
      coverage,
    };
  }

  throwIfAborted(
    options.abortSignal,
  );
  coverage.attemptedPages = [
    ...sparsePages,
  ];

  options.onProgress?.({
    phase: "ocr",
    completed: 0,
    total:
      sparsePages.length,
    message:
      "Running browser-local OCR on scanned or text-sparse pages.",
  });

  try {
    const {
      recognizePdfV4OcrFilePages,
    } = await import(
      "@/lib/pdf-engine-v4/ocr/ocrRecognizer"
    );

    const results =
      await recognizePdfV4OcrFilePages(
        file,
        sparsePages,
        {},
        (
          completed,
          total,
        ) => {
          throwIfAborted(
            options.abortSignal,
          );
          options.onProgress?.({
            phase: "ocr",
            completed,
            total,
            message:
              "Recognizing scanned pages locally.",
          });
        },
      );

    const byPage =
      new Map(
        results.map(
          (result) => [
            result.pageNumber,
            result,
          ],
        ),
      );
    const confidences: number[] =
      [];

    const nextPages:
      PdfPageContentSignal[] =
      pages.map(
        (page) => {
          const result =
            byPage.get(
              page.pageNumber,
            );

          if (
            !result ||
            !result.text.trim()
          ) {
            if (
              sparsePages.includes(
                page.pageNumber,
              )
            ) {
              coverage.failedPages.push(
                page.pageNumber,
              );
            }

            return page;
          }

          coverage.recognizedPages.push(
            page.pageNumber,
          );
          confidences.push(
            result.confidence,
          );
          const normalizedText =
            normalizeComparableText(
              result.text,
            );

          return {
            ...page,
            text:
              result.text,
            normalizedText,
            selectableTextChars:
              normalizedText.length,
            source:
              "ocr-tesseract" as const,
            confidence:
              result.confidence,
          };
        },
      );

    coverage.averageConfidence =
      confidences.length > 0
        ? confidences.reduce(
            (sum, value) =>
              sum + value,
            0,
          ) /
          confidences.length
        : null;

    const rawText =
      nextPages
        .map(
          (page) =>
            page.text,
        )
        .join("\n");
    const normalizedText =
      normalizeComparableText(
        rawText,
      );

    return {
      signal: {
        ...signal,
        rawText,
        pages:
          nextPages,
        normalizedText,
        selectableTextChars:
          normalizedText.length,
        normalizedLines: [
          ...new Set(
            nextPages
              .flatMap(
                (page) =>
                  page.text.split(
                    /\n+/,
                  ),
              )
              .map(
                (line) =>
                  normalizeComparableText(
                    line,
                  ),
              )
              .filter(Boolean),
          ),
        ],
      },
      coverage,
    };
  } catch (
    error
  ) {
    if (
      error instanceof
        DOMException &&
      error.name ===
        "AbortError"
    ) {
      throw error;
    }

    coverage.failedPages = [
      ...sparsePages,
    ];

    return {
      signal,
      coverage,
    };
  }
}

export type PageAlignmentPair = {
  leftPageNumber:
    | number
    | null;
  rightPageNumber:
    | number
    | null;
  status:
    | "same-position"
    | "moved"
    | "changed"
    | "added"
    | "removed"
    | "not-verifiable";
  similarity: number | null;
};

export type SmartPageAlignmentReport = {
  pairs: PageAlignmentPair[];
  summary: {
    samePosition: number;
    moved: number;
    changed: number;
    added: number;
    removed: number;
    notVerifiable: number;
  };
};

export function alignPdfPages(
  left: PdfContentSignal,
  right: PdfContentSignal,
): SmartPageAlignmentReport {
  const leftPages =
    left.pages ?? [];
  const rightPages =
    right.pages ?? [];
  const candidates: Array<{
    leftIndex: number;
    rightIndex: number;
    similarity: number;
  }> = [];

  for (
    let leftIndex = 0;
    leftIndex <
    leftPages.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex = 0;
      rightIndex <
      rightPages.length;
      rightIndex += 1
    ) {
      const similarity =
        textSimilarity(
          leftPages[leftIndex]
            .normalizedText,
          rightPages[rightIndex]
            .normalizedText,
        );

      if (
        similarity !== null &&
        similarity >= 0.45
      ) {
        candidates.push({
          leftIndex,
          rightIndex,
          similarity,
        });
      }
    }
  }

  candidates.sort(
    (a, b) =>
      b.similarity -
      a.similarity,
  );

  const usedLeft =
    new Set<number>();
  const usedRight =
    new Set<number>();
  const pairs:
    PageAlignmentPair[] =
    [];

  for (const candidate of candidates) {
    if (
      usedLeft.has(
        candidate.leftIndex,
      ) ||
      usedRight.has(
        candidate.rightIndex,
      )
    ) {
      continue;
    }

    usedLeft.add(
      candidate.leftIndex,
    );
    usedRight.add(
      candidate.rightIndex,
    );

    const leftPage =
      leftPages[
        candidate.leftIndex
      ];
    const rightPage =
      rightPages[
        candidate.rightIndex
      ];
    const samePosition =
      leftPage.pageNumber ===
      rightPage.pageNumber;

    pairs.push({
      leftPageNumber:
        leftPage.pageNumber,
      rightPageNumber:
        rightPage.pageNumber,
      status:
        candidate.similarity >=
        0.985
          ? samePosition
            ? "same-position"
            : "moved"
          : samePosition
            ? "changed"
            : "moved",
      similarity:
        candidate.similarity,
    });
  }

  for (
    let index = 0;
    index <
    leftPages.length;
    index += 1
  ) {
    if (
      !usedLeft.has(index)
    ) {
      pairs.push({
        leftPageNumber:
          leftPages[index]
            .pageNumber,
        rightPageNumber:
          null,
        status:
          leftPages[index]
            .normalizedText
            ? "removed"
            : "not-verifiable",
        similarity: null,
      });
    }
  }

  for (
    let index = 0;
    index <
    rightPages.length;
    index += 1
  ) {
    if (
      !usedRight.has(index)
    ) {
      pairs.push({
        leftPageNumber:
          null,
        rightPageNumber:
          rightPages[index]
            .pageNumber,
        status:
          rightPages[index]
            .normalizedText
            ? "added"
            : "not-verifiable",
        similarity: null,
      });
    }
  }

  pairs.sort(
    (a, b) =>
      (a.rightPageNumber ??
        Number.MAX_SAFE_INTEGER) -
        (b.rightPageNumber ??
          Number.MAX_SAFE_INTEGER) ||
      (a.leftPageNumber ??
        Number.MAX_SAFE_INTEGER) -
        (b.leftPageNumber ??
          Number.MAX_SAFE_INTEGER),
  );

  const count = (
    status: PageAlignmentPair["status"],
  ) =>
    pairs.filter(
      (pair) =>
        pair.status ===
        status,
    ).length;

  return {
    pairs,
    summary: {
      samePosition:
        count(
          "same-position",
        ),
      moved:
        count("moved"),
      changed:
        count("changed"),
      added:
        count("added"),
      removed:
        count("removed"),
      notVerifiable:
        count(
          "not-verifiable",
        ),
    },
  };
}

export type WorkspaceSection = {
  title: string;
  normalizedTitle: string;
  pageNumber: number;
  text: string;
};

const SECTION_LABELS = [
  "scope of work",
  "payment terms",
  "terms and conditions",
  "warranty",
  "completion date",
  "eligibility",
  "technical specification",
  "technical specifications",
  "financial terms",
  "deliverables",
  "schedule",
  "introduction",
  "summary",
  "conclusion",
];

export function extractWorkspaceSections(
  signal: PdfContentSignal,
): WorkspaceSection[] {
  const sections:
    WorkspaceSection[] =
    [];

  for (
    const page of
      signal.pages ?? []
  ) {
    const text =
      page.text.replace(
        /\r/g,
        "",
      );
    const lines =
      text
        .split(/\n+/)
        .map(
          (line) =>
            line.trim(),
        )
        .filter(Boolean);
    const candidates =
      lines.length > 1
        ? lines
        : text.split(
            /(?<=[.!?])\s+/,
          );

    for (
      let index = 0;
      index <
      candidates.length;
      index += 1
    ) {
      const candidate =
        candidates[index]
          .trim();
      const normalized =
        normalizeComparableText(
          candidate.replace(
            /[:\-]+$/,
            "",
          ),
        );
      const labeled =
        SECTION_LABELS.some(
          (label) =>
            normalized ===
              label ||
            normalized.startsWith(
              label + " ",
            ),
        );
      const looksHeading =
        candidate.length <=
          90 &&
        (
          /^[A-Z][A-Z0-9 &()/-]{4,}$/.test(
            candidate,
          ) ||
          /^\d+(?:\.\d+)*[.)]?\s+[A-Z]/.test(
            candidate,
          ) ||
          labeled
        );

      if (!looksHeading) {
        continue;
      }

      sections.push({
        title:
          candidate.slice(
            0,
            100,
          ),
        normalizedTitle:
          normalized,
        pageNumber:
          page.pageNumber,
        text:
          candidates
            .slice(
              index,
              index + 3,
            )
            .join(" ")
            .slice(0, 900),
      });
    }
  }

  const seen =
    new Set<string>();

  return sections.filter(
    (section) => {
      const key =
        section.normalizedTitle +
        ":" +
        section.pageNumber;

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

export type SectionComparisonFinding = {
  title: string;
  status:
    | "added"
    | "removed"
    | "changed"
    | "unchanged";
  leftPageNumber:
    | number
    | null;
  rightPageNumber:
    | number
    | null;
  similarity: number | null;
};

export function compareWorkspaceSections(
  left: WorkspaceSection[],
  right: WorkspaceSection[],
): SectionComparisonFinding[] {
  const titles =
    new Set([
      ...left.map(
        (section) =>
          section.normalizedTitle,
      ),
      ...right.map(
        (section) =>
          section.normalizedTitle,
      ),
    ]);
  const findings:
    SectionComparisonFinding[] =
    [];

  for (const title of titles) {
    const leftSection =
      left.find(
        (section) =>
          section.normalizedTitle ===
          title,
      );
    const rightSection =
      right.find(
        (section) =>
          section.normalizedTitle ===
          title,
      );

    if (
      !leftSection &&
      rightSection
    ) {
      findings.push({
        title:
          rightSection.title,
        status: "added",
        leftPageNumber:
          null,
        rightPageNumber:
          rightSection.pageNumber,
        similarity: null,
      });
      continue;
    }

    if (
      leftSection &&
      !rightSection
    ) {
      findings.push({
        title:
          leftSection.title,
        status: "removed",
        leftPageNumber:
          leftSection.pageNumber,
        rightPageNumber:
          null,
        similarity: null,
      });
      continue;
    }

    if (
      !leftSection ||
      !rightSection
    ) {
      continue;
    }

    const similarity =
      textSimilarity(
        leftSection.text,
        rightSection.text,
      );

    findings.push({
      title:
        rightSection.title,
      status:
        similarity !== null &&
        similarity >= 0.94
          ? "unchanged"
          : "changed",
      leftPageNumber:
        leftSection.pageNumber,
      rightPageNumber:
        rightSection.pageNumber,
      similarity,
    });
  }

  return findings;
}

export type WorkspaceTableSignal = {
  pageNumber: number;
  rows: string[][];
  confidence:
    | "strong"
    | "possible";
};

export function extractWorkspaceTableSignals(
  signal: PdfContentSignal,
): WorkspaceTableSignal[] {
  const tables:
    WorkspaceTableSignal[] =
    [];

  for (
    const page of
      signal.pages ?? []
  ) {
    const lines =
      page.text
        .split(/\n+/)
        .map(
          (line) =>
            line.trim(),
        )
        .filter(Boolean);
    const rows: string[][] =
      [];

    for (const line of lines) {
      const cells =
        line
          .split(
            /\s{2,}|\s*\|\s*|\t+/,
          )
          .map(
            (cell) =>
              cell.trim(),
          )
          .filter(Boolean);

      if (
        cells.length >= 2
      ) {
        rows.push(cells);
      }
    }

    if (
      rows.length >= 3
    ) {
      const commonWidth =
        Math.max(
          ...rows.map(
            (row) =>
              row.length,
          ),
        );
      const stableRows =
        rows.filter(
          (row) =>
            Math.abs(
              row.length -
                commonWidth,
            ) <= 1,
        ).length;

      tables.push({
        pageNumber:
          page.pageNumber,
        rows:
          rows.slice(
            0,
            30,
          ),
        confidence:
          stableRows /
            rows.length >=
          0.7
            ? "strong"
            : "possible",
      });
    }
  }

  return tables;
}

export type DocumentCompletenessScore = {
  score: number;
  textPageCoverage: number;
  sectionCount: number;
  tableCount: number;
  ocrPageCount: number;
  explanation: string;
};

export function scoreDocumentCompleteness(
  signal: PdfContentSignal,
) {
  const pages =
    signal.pages ?? [];
  const textPages =
    pages.filter(
      (page) =>
        page.selectableTextChars >
        40,
    ).length;
  const ocrPageCount =
    pages.filter(
      (page) =>
        page.source ===
        "ocr-tesseract",
    ).length;
  const sections =
    extractWorkspaceSections(
      signal,
    );
  const tables =
    extractWorkspaceTableSignals(
      signal,
    );
  const textPageCoverage =
    pages.length > 0
      ? textPages /
        pages.length
      : 0;
  const score =
    Math.min(
      100,
      Math.round(
        textPageCoverage *
          65 +
          Math.min(
            sections.length,
            8,
          ) *
            3 +
          Math.min(
            tables.length,
            4,
          ) *
            2.75,
      ),
    );

  return {
    score,
    textPageCoverage,
    sectionCount:
      sections.length,
    tableCount:
      tables.length,
    ocrPageCount,
    explanation:
      "Completeness is a heuristic based on readable-page coverage and detected structure. It does not prove factual or legal completeness.",
  } satisfies DocumentCompletenessScore;
}

export type MissingInformationFinding = {
  kind:
    | "section"
    | "page-content";
  title: string;
  detail: string;
  sourcePageNumber:
    number | null;
};

export function detectMissingInformation(
  previous: PdfContentSignal,
  current: PdfContentSignal,
): MissingInformationFinding[] {
  const previousSections =
    extractWorkspaceSections(
      previous,
    );
  const currentSections =
    extractWorkspaceSections(
      current,
    );
  const currentTitles =
    new Set(
      currentSections.map(
        (section) =>
          section.normalizedTitle,
      ),
    );
  const findings =
    previousSections
      .filter(
        (section) =>
          !currentTitles.has(
            section.normalizedTitle,
          ),
      )
      .map(
        (section) => ({
          kind:
            "section" as const,
          title:
            section.title,
          detail:
            "This detected section exists in the comparison document but was not detected in the current document.",
          sourcePageNumber:
            section.pageNumber,
        }),
      );

  return findings.slice(
    0,
    12,
  );
}

export type LocalSemanticConcept =
  | "payment"
  | "amount"
  | "deadline"
  | "scope"
  | "warranty"
  | "eligibility"
  | "identity"
  | "contact";

const CONCEPT_TERMS: Record<
  LocalSemanticConcept,
  string[]
> = {
  payment: [
    "payment",
    "mobilization",
    "advance",
    "invoice",
    "payable",
    "remittance",
    "billing",
  ],
  amount: [
    "amount",
    "value",
    "price",
    "cost",
    "total",
    "award",
    "contract value",
  ],
  deadline: [
    "deadline",
    "due date",
    "completion date",
    "schedule",
    "timeline",
    "delivery date",
  ],
  scope: [
    "scope",
    "work",
    "deliverables",
    "services",
    "requirements",
  ],
  warranty: [
    "warranty",
    "guarantee",
    "defect liability",
    "maintenance period",
  ],
  eligibility: [
    "eligibility",
    "qualification",
    "experience",
    "registration",
    "certificate",
  ],
  identity: [
    "name",
    "organization",
    "company",
    "department",
    "contractor",
    "vendor",
  ],
  contact: [
    "email",
    "phone",
    "mobile",
    "contact",
    "address",
  ],
};

export function expandLocalSemanticQuery(
  query: string,
) {
  const normalized =
    normalizeComparableText(
      query,
    );
  const matched =
    (
      Object.entries(
        CONCEPT_TERMS,
      ) as Array<
        [
          LocalSemanticConcept,
          string[],
        ]
      >
    )
      .filter(
        ([, terms]) =>
          terms.some(
            (term) =>
              normalized.includes(
                normalizeComparableText(
                  term,
                ),
              ),
          ),
      )
      .flatMap(
        ([, terms]) =>
          terms,
      );

  return [
    query,
    ...matched,
  ].join(" ");
}

export function mergeEvidenceIndexes(
  indexes: WorkspaceEvidenceIndex[],
  limits: {
    maxNodes: number;
    maxPages: number;
    maxChunks: number;
  },
): WorkspaceEvidenceIndex {
  const pages =
    indexes
      .flatMap(
        (index) =>
          index.pages,
      )
      .slice(
        0,
        limits.maxPages,
      );
  const chunks =
    indexes
      .flatMap(
        (index) =>
          index.chunks,
      )
      .slice(
        0,
        limits.maxChunks,
      );
  const indexedNodeIds =
    [
      ...new Set(
        indexes
          .flatMap(
            (index) =>
              index.indexedNodeIds,
          )
          .slice(
            0,
            limits.maxNodes,
          ),
      ),
    ];
  const allNodeIds =
    indexes.flatMap(
      (index) =>
        index.indexedNodeIds,
    );
  const skippedNodeIds =
    [
      ...new Set([
        ...indexes.flatMap(
          (index) =>
            index.skippedNodeIds,
        ),
        ...allNodeIds.filter(
          (id) =>
            !indexedNodeIds.includes(
              id,
            ),
        ),
      ]),
    ];

  return {
    pages,
    chunks,
    indexedNodeIds,
    skippedNodeIds,
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
      truncated:
        skippedNodeIds.length >
          0 ||
        indexes.some(
          (index) =>
            index.coverage
              .truncated,
        ) ||
        pages.length >=
          limits.maxPages ||
        chunks.length >=
          limits.maxChunks,
      notes: [
        "Evidence records are composed from browser-local persistent per-document intelligence records.",
        "OCR-derived text is labeled on its source page and stays on-device.",
        "Local semantic query expansion uses deterministic document concepts rather than a cloud embedding service.",
      ],
    },
  };
}


export type WorkspaceTableComparisonFinding = {
  pageNumber: number;
  status:
    | "added"
    | "removed"
    | "changed"
    | "unchanged";
  beforeRows: number;
  afterRows: number;
};

export function compareWorkspaceTableSignals(
  left: WorkspaceTableSignal[],
  right: WorkspaceTableSignal[],
): WorkspaceTableComparisonFinding[] {
  const pages =
    new Set([
      ...left.map(
        (table) =>
          table.pageNumber,
      ),
      ...right.map(
        (table) =>
          table.pageNumber,
      ),
    ]);
  const findings:
    WorkspaceTableComparisonFinding[] =
    [];

  for (const pageNumber of pages) {
    const before =
      left.find(
        (table) =>
          table.pageNumber ===
          pageNumber,
      );
    const after =
      right.find(
        (table) =>
          table.pageNumber ===
          pageNumber,
      );

    if (!before && after) {
      findings.push({
        pageNumber,
        status: "added",
        beforeRows: 0,
        afterRows:
          after.rows.length,
      });
      continue;
    }

    if (before && !after) {
      findings.push({
        pageNumber,
        status: "removed",
        beforeRows:
          before.rows.length,
        afterRows: 0,
      });
      continue;
    }

    if (
      !before ||
      !after
    ) {
      continue;
    }

    const beforeText =
      normalizeComparableText(
        before.rows
          .flat()
          .join(" "),
      );
    const afterText =
      normalizeComparableText(
        after.rows
          .flat()
          .join(" "),
      );
    const similarity =
      textSimilarity(
        beforeText,
        afterText,
      );

    findings.push({
      pageNumber,
      status:
        similarity !== null &&
        similarity >= 0.97
          ? "unchanged"
          : "changed",
      beforeRows:
        before.rows.length,
      afterRows:
        after.rows.length,
    });
  }

  return findings;
}
