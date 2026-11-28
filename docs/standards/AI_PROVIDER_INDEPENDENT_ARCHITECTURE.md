# AI Provider-Independent Website Architecture

Status: Proposed shared engineering standard  
Default budget: ₹0 recurring infrastructure spend  
Applies to: Kukureku/PDFNova and future websites and web applications

## 1. Objective

Build high-quality products while retaining ownership and portability. Hosting, AI models, databases, authentication, storage, and integrations must be replaceable without rewriting the entire product.

Zero-cost is the default operating constraint, not a promise of unlimited free capacity. A project must document quotas, inactivity rules, overage behavior, commercial-use restrictions, and exit paths before adopting a service.

## 2. Reference architecture

```text
Owner / Product requirements
          |
Project control: decisions, budget, risks, release approvals
          |
Git repository (source of truth) ---- CI: lint, typecheck, tests, build
          |
Application layers
  - UI / presentation
  - domain logic and use cases
  - ports / interfaces
  - provider adapters
          |
  +-------+-----------+------------+-------------+
  |                   |            |             |
Hosting adapter   AI adapter   Data adapter   Integration adapter
Cloudflare/etc.   OpenAI/etc.   PostgreSQL     MCP / REST / webhooks
  |                   |            |             |
Static assets / server / APIs / database / external services
```

The application domain must not depend directly on a vendor SDK. Vendor-specific code belongs behind adapters.

## 3. Default technology selection

| Concern | Default direction | Selection rule |
|---|---|---|
| Source control | GitHub | Keep full source and history exportable |
| Framework | Next.js + TypeScript where suitable | Prefer static output for static products; use server runtime only when required |
| Hosting | Cloudflare candidate | Prove framework compatibility, limits, and rollback before migration |
| Database | PostgreSQL when persistence is needed | Use portable SQL and documented migrations |
| Authentication | Standards-based OIDC / established provider | Avoid custom password systems |
| File storage | S3-compatible interface where practical | Maintain export and backup plan |
| AI | Provider-neutral adapter | Model choice must be configurable |
| Tool connections | MCP where supported; REST APIs otherwise | Use least privilege and explicit scopes |
| CI | GitHub Actions | Test before merge and release |
| Browser tests | Playwright | Cover critical user journeys |
| Unit tests | Vitest or framework-native equivalent | Test domain logic without network dependencies |
| Documentation | Markdown in repository | Record architecture decisions and operating limits |

These are defaults, not mandatory dependencies. Choose a simpler stack for a simple static site.

## 4. AI provider adapter

All application features must call an internal interface rather than a vendor SDK directly.

Example TypeScript contract:

```ts
export type AiTask =
  | "text-generation"
  | "structured-extraction"
  | "classification"
  | "summarization";

export interface AiRequest {
  task: AiTask;
  input: string;
  system?: string;
  maxOutputTokens?: number;
  responseFormat?: "text" | "json";
}

export interface AiResponse {
  text: string;
  provider: string;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AiProvider {
  readonly id: string;
  generate(request: AiRequest): Promise<AiResponse>;
}
```

Implementation requirements:
- Select provider and model through server-side configuration.
- Never expose provider API keys in browser bundles, source control, logs, or client-visible errors.
- Do not silently switch providers if the fallback changes data handling, privacy, cost, or output guarantees.
- Add explicit budgets, rate limits, timeouts, retries with limits, and usage logging.
- Redact sensitive data before sending it to third-party models where appropriate.
- Provide a non-AI fallback for critical workflows whenever feasible.
- API usage is separately billed from consumer chat subscriptions; never assume a chat subscription includes API credits.

## 5. MCP and external tool integration

Use MCP for compatible assistant-to-tool workflows and REST APIs/webhooks for ordinary application integrations. MCP is not a replacement for application authorization.

Every tool must declare:
- purpose and owner;
- read/write capability;
- required scopes;
- data accessed and retained;
- rate and cost limits;
- confirmation requirement for consequential actions;
- revocation and audit-log behavior.

Start with read-only scopes. Require explicit approval for deployments, DNS changes, billing, payments, destructive data operations, and production configuration changes.

## 6. Hosting and data portability

- Keep deploy configuration separate from application business logic.
- Avoid proprietary runtime features unless their benefit is documented and an exit plan exists.
- Use environment variables and secret stores; commit only example variable names, never values.
- Keep database schema migrations in source control.
- Schedule and test backups before storing irreplaceable customer data.
- Test restoring a backup and exporting records.
- Document provider quotas, commercial terms, inactivity pauses, build limits, bandwidth, file limits, and overage behavior.
- Do not create billable resources or upgrade plans without explicit approval.

## 7. Security and quality gates

Before production release:
1. Dependency and secret scan.
2. Lint and TypeScript checks.
3. Unit and integration tests.
4. Production build.
5. Browser tests for critical journeys and mobile layouts.
6. Accessibility and performance checks.
7. Authentication, authorization, input validation, and security-header review.
8. Backup/restore and rollback plan for stateful changes.
9. Review of third-party data flows and AI provider disclosures.

A green build alone is not production approval.

## 8. Environments and release policy

Use separate development, preview, and production environments. Production secrets and customer data must not be copied into development environments.

Keep the last known-good production release identifiable. Deploy only after checks pass. DNS changes, production hosting migration, database migrations with destructive effects, billing changes, and merges/releases that affect production require separate explicit approval.

## 9. Zero-budget decision rule

For every proposed service, record:
- usable free allowance and whether it resets daily/monthly;
- hard-stop versus overage billing;
- commercial-use restrictions;
- inactivity/suspension policy;
- data export and deletion options;
- migration effort;
- minimum paid threshold.

If the free tier cannot reliably support the intended use, choose a simpler architecture or defer the feature rather than assuming the service will remain free.

## 10. Project onboarding checklist

- [ ] Define product, audience, data classification, and critical user journeys.
- [ ] Choose the simplest suitable framework and hosting mode.
- [ ] Create repository, branch protection, CI, and project README.
- [ ] Add environment-variable template and secret-handling policy.
- [ ] Document hosting/database/AI quotas and commercial terms.
- [ ] Add provider adapters only when a real feature needs them.
- [ ] Add tests and mobile/browser checks.
- [ ] Configure backup, monitoring, and rollback.
- [ ] Record architecture decisions and owner-approved spending limits.

## 11. Decision record

This standard establishes a provider-independent, zero-fixed-cost-first approach. It does not authorize a hosting migration, subscription, paid API usage, DNS change, production deployment, or production data migration.
