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
