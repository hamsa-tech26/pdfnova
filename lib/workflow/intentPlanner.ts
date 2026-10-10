/**
 * A deterministic, browser-local intent guide. This is NOT an autonomous
 * AI agent, a document interpreter, or an executable workflow.
 */
export type PlannedPdfStep = {
  id: string;
  title: string;
  href: string;
  note: string;
  requiresReview: boolean;
  matched: string;
};
export type IntentPlan = {
  steps: PlannedPdfStep[];
  warnings: string[];
};

const patterns = [
  { id: "merge", title: "Merge PDF", href: "/merge-pdf", note: "Choose and order every source PDF. Merging form-bearing PDFs requires flattening first.", requiresReview: true, patterns: [/\b(?:merge|combine|join)\b(?:\s+(?:my|the|pdf|files|documents)){0,4}/gi] },
  { id: "split", title: "Split PDF", href: "/split-pdf", note: "Review the page ranges before extracting pages.", requiresReview: true, patterns: [/\b(?:split|extract\s+pages?)\b/gi] },
  { id: "compress", title: "Compress PDF", href: "/compress-pdf", note: "Inspect the resulting file and check important images, text and page count.", requiresReview: false, patterns: [/\b(?:compress|reduce\s+(?:the\s+)?(?:pdf\s+)?(?:file\s+)?size|shrink)\b/gi] },
  { id: "number", title: "Add Page Numbers", href: "/add-page-numbers", note: "Choose position and numbering options before applying.", requiresReview: false, patterns: [/\b(?:add\s+page\s+numbers?|number\s+(?:the\s+)?pages?)\b/gi] },
  { id: "watermark", title: "Watermark PDF", href: "/watermark-pdf", note: "Check placement and legibility before sharing.", requiresReview: false, patterns: [/\b(?:watermark|add\s+(?:a\s+)?logo)\b/gi] },
  { id: "redact", title: "Redact PDF", href: "/redact-pdf", note: "Redaction can be irreversible. Review every page and verify the final output.", requiresReview: true, patterns: [/\b(?:redact|black\s+out|remove\s+sensitive\s+(?:data|information))\b/gi] },
  { id: "protect", title: "Protect PDF", href: "/protect-pdf", note: "Set a password yourself, then verify the protected PDF opens with that password. Keep it in a safe place.", requiresReview: true, patterns: [/\b(?:protect|encrypt|password[\s-]?protect|add\s+(?:a\s+)?password)\b/gi] },
  { id: "unlock", title: "Unlock PDF", href: "/unlock-pdf", note: "You must know the existing password and have permission to unlock the document.", requiresReview: true, patterns: [/\b(?:unlock|decrypt|remove\s+(?:the\s+)?password)\b/gi] },
  { id: "metadata", title: "Remove Metadata", href: "/remove-pdf-metadata", note: "Removing metadata is not equivalent to removing visible sensitive content.", requiresReview: true, patterns: [/\b(?:(?:remove|strip|clear)\s+(?:the\s+)?(?:pdf\s+)?metadata)\b/gi] },
  { id: "ocr", title: "OCR PDF", href: "/ocr-pdf", note: "Review recognition quality, especially for scans and languages that need manual verification.", requiresReview: false, patterns: [/\b(?:ocr|recognize\s+(?:the\s+)?text|scan\s+to\s+text)\b/gi] },
] as const;

const negated = /\b(?:do\s+not|don['’]t|never|without|not)\s*$/i;

export function buildIntentPlan(raw: string): IntentPlan {
  const text = raw.slice(0, 1200);
  const matches: Array<{ step: PlannedPdfStep; at: number }> = [];
  for (const definition of patterns) {
    const found: Array<{ at: number; matched: string }> = [];
    for (const pattern of definition.patterns) {
      pattern.lastIndex = 0;
      for (const m of text.matchAll(pattern)) {
        const before = text.slice(Math.max(0, (m.index ?? 0) - 18), m.index ?? 0);
        if (negated.test(before)) continue;
        found.push({ at: m.index ?? 0, matched: m[0] });
      }
    }
    found.sort((a, b) => a.at - b.at);
    if (found[0]) {
      const { at, matched } = found[0];
      matches.push({ at, step: { id: definition.id, title: definition.title, href: definition.href, note: definition.note, requiresReview: definition.requiresReview, matched } });
    }
  }
  matches.sort((a, b) => a.at - b.at);
  const steps = matches.map(m => m.step);
  const warnings: string[] = [];
  if (!steps.length) warnings.push("No supported operation was identified. Choose a specific task, such as merge, compress, add page numbers, or protect.");
  if (steps.some(s => s.id === "protect") && steps.some(s => s.id === "unlock")) warnings.push("Protect and unlock both appear in your request. Confirm the intended order and passwords.");
  if (/\b(?:translate|summari[sz]e|email|send|publish|upload\s+to\s+cloud)\b/i.test(text)) warnings.push("Some requested actions are outside this local tool planner. They will not run automatically.");
  if (steps.length > 1) warnings.push("These are manual tool links. Outputs are not passed automatically between every tool; review the saved workspace version or reselect the correct result.");
  return { steps, warnings };
}


/** Load an exported manual plan without trusting caller-controlled routes, notes or text. */
export function importManualIntentPlan(rawJson: string): IntentPlan {
  if (rawJson.length > 64 * 1024) {
    throw new Error("The saved plan is too large (64 KB maximum).");
  }
  let input: unknown;
  try {
    input = JSON.parse(rawJson);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("The selected file is not a Kukureku manual workflow.");
  }
  const manifest = input as Record<string, unknown>;
  if (manifest.schema !== "kukureku-manual-workflow-v1" ||
      !Array.isArray(manifest.operations) || !manifest.operations.length ||
      manifest.operations.length > patterns.length) {
    throw new Error("The saved workflow has an unsupported schema or step count.");
  }
  const used = new Set<string>();
  const steps: PlannedPdfStep[] = [];
  for (const rawStep of manifest.operations) {
    if (!rawStep || typeof rawStep !== "object" || Array.isArray(rawStep)) {
      throw new Error("A saved workflow step is invalid.");
    }
    const step = rawStep as Record<string, unknown>;
    const definition = patterns.find(candidate => candidate.id === step.id);
    if (!definition || used.has(definition.id) ||
        ("href" in step && step.href !== definition.href)) {
      throw new Error("A saved workflow step has an unknown, duplicate or unsafe tool route.");
    }
    used.add(definition.id);
    // Reconstitute every field from our internal allowlist: ignore imported
    // titles, free text, operation notes, and any other attacker data.
    steps.push({
      id: definition.id,
      title: definition.title,
      href: definition.href,
      note: definition.note,
      requiresReview: definition.requiresReview,
      matched: "",
    });
  }
  const warnings = [
    "Imported manual reference plan. Verify each step and choose the correct document version yourself; nothing runs automatically.",
  ];
  if (steps.some(s => s.id === "protect") && steps.some(s => s.id === "unlock")) {
    warnings.push("Protect and unlock both appear in this plan. Confirm the intended order and passwords.");
  }
  if (steps.length > 1) {
    warnings.push("Files are not passed between tools automatically. Review each exported PDF and reselect the correct version.");
  }
  return { steps, warnings };
}
