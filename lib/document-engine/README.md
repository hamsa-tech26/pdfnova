# Kukureku Document Intelligence Foundation V1

This module is the shared, local-first foundation for future document intelligence. It is intentionally small and does not add a public UI.

## Data flow

```text
DocumentArtifact
  -> InspectionReport / DocumentFacts
  -> DocumentFindings
  -> Operation Registry / Operation Effects
  -> VerificationReport
```

Facts are objective observations. Findings are user-facing interpretations of those facts. Recommendations and automatic planning are deliberately outside V1.

## Current scope

V1 provides:

- Blob-backed `DocumentArtifact` objects with parent lineage for derived outputs.
- deterministic PDF inspection for page geometry, common document-information metadata, AcroForm fields, and XFA presence.
- findings derived from inspected facts without claiming unsupported sanitization.
- an operation registry for representative existing Kukureku tools.
- explicit effect profiles describing known preserves, modifications, destructive effects, risks, and verifiable outcomes.
- shared verification statuses: `PASS`, `PASS_WITH_WARNING`, `FAILED`, and `NOT_VERIFIED`.
- serialized-PDF tests using the existing reliability fixture.

## Trust rules

The engine must not convert uncertainty into a successful verification result.

For example:

- common metadata inspection does not imply XMP or forensic hidden-object inspection.
- `encryption-applied` is declared as an intended verification outcome for Protect PDF, but V1 returns `NOT_VERIFIED` until a shared password-aware QPDF verifier exists.
- rasterization is modeled as destructive to selectable text and interactive/non-page structures.
- conditional operations such as compression use multiple effect profiles instead of one misleading universal effect list.

## Progressive adoption

Existing tools do not need to be rewritten.

A current tool can join the shared engine in stages:

1. register an operation descriptor and accurate effect profile;
2. expose deterministic pre-operation facts when useful;
3. create a derived `DocumentArtifact` after execution;
4. run only the verification checks that the shared verifier can genuinely prove.

Tool-specific engines remain the source of execution behavior until a later milestone explicitly changes that architecture.

## Not in V1

Do not add these to this foundation merely for completeness:

- Unified Inspector UI
- Magic Drop
- SafeShare
- persistent Workspace
- workflow recipes or automatic planning
- version-graph storage
- IndexedDB/OPFS persistence
- cloud AI
- organization policy packs

Those features should consume this foundation rather than create parallel document models.

## Extension rule

When adding a new inspection or verification capability:

- prefer deterministic local checks;
- define the fact separately from its finding/recommendation;
- describe unsupported coverage explicitly;
- add serialized PDF regression coverage;
- avoid claiming preservation for structures the operation has not been shown to preserve.

The long-term architecture may evolve toward:

```text
Current document state
  -> desired state
  -> compatible operations
  -> least-destructive valid plan
  -> verified result
```

V1 only establishes the contracts needed to make that future possible without implementing the planner now.

## Workspace Intelligence V2 extension

The first V2 workspace-intelligence layer consumes the browser-local document graph without reading PDF content. It:

- reports known compositions, branches, version chains, shared ancestry, and branch divergence;
- flags broken parent references as attention findings;
- can mark two independent document heads as possible duplicates only when filename, MIME type, size, and browser modification timestamp all match;
- keeps duplicate signals non-authoritative because it does not compare bytes or compute a content hash.

The report exposes explicit coverage metadata so UI surfaces can distinguish proven graph relationships from heuristic metadata signals. Content-aware similarity, cryptographic duplicate confirmation, and cross-document semantic reasoning remain future work.

## Smart Relationship Actions V1

Workspace Intelligence findings can now expose safe, deterministic actions without automatically modifying a PDF.

Current action types are intentionally non-destructive:

- review a known parent document by making that stored node current;
- switch an older document state to the newest saved version;
- inspect a related document with shared ancestry;
- inspect a possible duplicate before making any deletion or merge decision;
- inspect known parents of a composition;
- inspect a sibling or child branch when the graph has diverged.

Actions are generated only when their target node is actually present in the browser-local workspace. Missing-parent findings deliberately do not invent a recovery action.

Automatic merging, deletion, semantic comparison, and other document-changing actions remain outside this milestone.

## Smart Action Orchestration V2

Workspace Intelligence can now prepare safe multi-document actions from deterministic findings.

The orchestration layer supports:

- local comparison of a branch with its parent;
- comparison of older and latest saved versions;
- exact-duplicate confirmation through Compare Documents;
- comparison of related documents with shared ancestry;
- comparison of sibling branches;
- preparation of a branch merge with both browser-local files preloaded;
- comparison of composition parents.

Multi-document actions carry exact workspace node IDs through the `workspaceFiles` handoff parameter. They prepare context only. Merge PDF still requires the user to review file order and explicitly confirm the operation.

## Local Exact Duplicate Detection V1

Compare Documents computes SHA-256 locally in the browser. Matching SHA-256 values are treated as byte-identical exact duplicates.

This is distinct from the metadata-only possible-duplicate signal in Workspace Intelligence.

## Version Recognition V1

Compare Documents also extracts selectable text locally and computes deterministic text-shingle overlap.

Current interpretation:

- exact SHA-256 match → exact duplicate;
- strong selectable-text overlap → probable revision;
- moderate overlap → related;
- low overlap → distinct;
- insufficient selectable text → text relationship not verified.

This is not semantic AI. Scanned PDFs without selectable text remain unverified for revision similarity unless another supported OCR workflow is used first.

## Compare Documents V1

The internal Workspace comparison view shows:

- exact-byte status;
- full local SHA-256 hashes;
- page counts and page-count delta;
- selectable-text character counts;
- deterministic text similarity;
- shared and unique normalized line counts;
- relationship classification;
- links to inspect either source;
- optional safe handoff to Merge PDF when the files are not exact duplicates.

No document content is uploaded by this workflow.

## Visual Document Graph V1

The Dashboard now renders browser-local document states as generation-based graph nodes. Each node shows its relationship type, version, parent count, and known parent names. Selecting a node makes that exact stored state current.

Graph placement is driven only by stored lineage metadata. It does not imply semantic document similarity.

## Workspace Findings Center

The Findings Center consolidates Workspace Intelligence findings, Smart Relationship Actions, and Cross-Document Verification V1 in one browser-local review surface.

## Cross-Document Verification V1

Relationship verification deterministically checks:

- whether every stored parent reference resolves;
- whether revision parents belong to the same stable document identity and precede the child version;
- whether branch nodes retain stored parent provenance;
- whether composition nodes retain at least two stored parents.

This verifies graph consistency, not the semantic correctness of PDF content.

## Sensitive Information Detection Foundation

Safe Share uses pattern-based selectable-text scanning for:

- email addresses;
- Indian phone-number patterns;
- Aadhaar-like 12-digit patterns;
- PAN-like identifiers;
- labeled date-of-birth patterns;
- broad long numeric identifiers.

Matched values are not returned in the report. Pattern matching can produce false positives and false negatives. Image-only text is not OCR-scanned by this check, and semantic postal-address detection is not claimed.

## Safe Share Preparation V1

Safe Share combines:

- common document-information metadata inspection;
- interactive form/XFA inspection;
- selectable-text sensitive-pattern detection;
- explicit Inspector coverage limits.

It can recommend existing Remove Metadata, Flatten, or Redact workflows, but never executes them automatically. A clean result is described only as no current findings in the checks that ran; Kukureku never guarantees that a PDF is safe to share.

## Workspace Copilot V1

Workspace Copilot V1 is an evidence-backed local guidance layer. It does not send PDF content to a cloud model.

It answers four bounded workspace questions:

- Which version should I use?
- What changed?
- What needs attention before sharing?
- What should I do next?

The answer engine combines:

- stable document identity and saved-version ordering;
- Workspace Intelligence findings;
- deterministic relationship verification;
- local SHA-256 and selectable-text comparison against the most relevant stored document;
- Safe Share status and coverage limits.

The comparison target is selected deterministically in this order when available:

1. a stored parent;
2. another saved version of the same document;
3. a sibling branch;
4. a shared-ancestry document;
5. a possible duplicate candidate.

Every answer includes evidence and can return only safe preparation actions such as switching the current version, opening Compare Documents, opening Safe Share, opening Findings Center, or inspecting a document. It does not automatically merge, delete, redact, share, or rewrite a file.

Copilot V1 is intentionally not semantic AI. It does not infer legal meaning, hidden intent, or scanned/image-only text beyond existing declared coverage. A later opt-in semantic layer can consume this evidence contract without weakening the privacy or verification model.
