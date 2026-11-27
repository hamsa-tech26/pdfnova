# Kukureku Premium Motion & Interaction System V1
## Phase 0 — Read-only product and repository audit

**Audit date:** 2026-11-27  
**Repository:** `hamsa-tech26/pdfnova`  
**Audited baseline:** `main` at `4d41cdf36c2319f59ec8b5c35d4a999799010802`  
**Production domain:** https://kukureku.com

## 1. Repository and release state

- Repository metadata confirms the default branch is `main`; the repository is public and the connected account has admin/push access.
- Main baseline is the November 15, 2026 commit above.
- The latest in-progress engineering work observed during this audit is PR #243 (Task 287), a draft stacked on PR #242. It explicitly says **DRAFT / NO MERGE / NO DEPLOY**.
- The project release notes and draft PRs consistently preserve the automatic deployment hold, Release 216 pause and Engine V4 Stable certification at 0/20.
- The production Vercel status check on the audited main commit is successful. No production deployment was initiated by this audit.
- Existing Vercel configuration contains numerous branch deployment exclusions. This initiative adds its own explicit exclusion before feature work.

## 2. Application architecture observed

- Next.js App Router, React 19 and TypeScript.
- Tailwind CSS v4 is imported from `app/globals.css`.
- Main global layout is `app/layout.tsx`; public homepage is `app/page.tsx`.
- Public homepage composition: `Navbar`, a static hero, `TaskStartSection`, `ToolsSection`, `FeaturesSection`, and `Footer`.
- Workspace route group is `app/(workspace)`, with a shared workspace layout, sidebar and dashboard.
- The dashboard already has quick actions, recent local files and a large tool catalog.
- Existing workspace components include `ActiveWorkspaceFileCard`, `WorkspaceFileHandoff`, `WorkspaceIntelligencePanel`, `WorkspaceMergeSources` and `WorkspaceGraphOverview`.
- `WorkspaceGraphOverview` already renders document generations, revisions, branches and compositions from actual workspace summaries. Motion must preserve this data-backed model and must not invent graph relationships.

## 3. Existing visual and motion baseline

- The current visual language uses slate/blue gradients, rounded cards, borders, shadows, Lucide icons and Tailwind transition/hover classes.
- The homepage hero is primarily static. Its feature cards are not an animated product demonstration.
- Workspace dashboard has some hover transitions, but no shared motion system was found in the inspected core components.
- `package.json` does not list Framer Motion, Motion for React, GSAP, Lottie or Three.js.
- `app/globals.css` already includes a global `prefers-reduced-motion: reduce` rule that minimizes animations and transitions. New motion primitives must respect and complement it.
- Existing theme support uses `next-themes` and Tailwind's `dark:` variants.

## 4. Constraints and risks

1. No change to PDF parsing, conversion, OCR, document storage, workspace persistence, upload/network behaviour, privacy policy, security headers or tool registry as part of the motion foundation.
2. Do not add an animation dependency until a concrete requirement cannot be met with CSS and small React primitives.
3. Avoid scroll hijacking, autoplay video, large continuous animations, layout shifts and excessive blur/backdrop filters.
4. Keep interactive controls keyboard-operable, focus-visible and semantically correct.
5. All new effects must have reduced-motion and low-motion fallbacks.
6. Do not merge to `main`, alter Vercel project settings, enable branch deployments or deploy production in this initiative.

## 5. Recommended implementation order

- Phase 1: design tokens, motion guidelines, reusable reveal/transition primitives and tests.
- Phase 2: isolated showcase prototype using synthetic UI data only.
- Phase 3: homepage hero and section enhancement.
- Phase 4: workspace, Magic Drop and data-backed Document Graph motion.
- Phase 5: tool-specific progress and completion feedback, with no changes to PDF processing logic.
- Phase 6: accessibility, responsive, performance and regression qualification.

## 6. Audit outcome

**Phase 0 audit complete.** The existing application has enough reusable React/Tailwind structure to implement a premium motion layer without adding a large animation framework. The first release should be CSS-first and progressively enhanced. The existing release/deployment hold remains in force.
