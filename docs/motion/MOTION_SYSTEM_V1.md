# Motion System V1 — Design and Engineering Specification

## Product intent

Create a coherent, premium and restrained interaction language for Kukureku PDF. Motion should clarify hierarchy, state changes and document workflows—not decorate every element.

## Design principles

- **Purposeful:** animate only to explain state, continuity, focus or action.
- **Fast:** prefer transform and opacity; avoid animating layout-heavy properties.
- **Progressive:** server-rendered content remains visible and useful without JavaScript.
- **Accessible:** support keyboard focus, reduced motion and sufficient contrast.
- **Responsive:** avoid hover-only affordances; keep touch interactions immediate.
- **Private:** all demonstrations use synthetic interface data; no PDF content is transmitted or logged.
- **Consistent:** use a small set of durations, easing curves and distance values.

## Motion tokens

| Token | Value | Intended use |
|---|---:|---|
| `--motion-duration-instant` | 100ms | Press feedback |
| `--motion-duration-fast` | 160ms | Hover/focus feedback |
| `--motion-duration-standard` | 240ms | Cards, menus and small panels |
| `--motion-duration-emphasis` | 360ms | Section reveal and hero transitions |
| `--motion-ease-standard` | cubic-bezier(0.2, 0, 0, 1) | General transitions |
| `--motion-ease-emphasized` | cubic-bezier(0.2, 0.8, 0.2, 1) | Entrances |
| `--motion-distance-small` | 8px | Small entrance offset |
| `--motion-distance-medium` | 16px | Larger section entrance |

Durations are maximum targets, not mandatory delays. Avoid cascading delays that slow access to content.

## Approved interaction patterns

1. **Press feedback:** subtle scale/opacity response on buttons; never alter hit target geometry.
2. **Card hover:** border/shadow/color change; optional 1–2px lift on pointer-capable devices only.
3. **Reveal:** opacity plus a small vertical transform; content is visible by default and never hidden when JS is unavailable.
4. **Disclosure:** animate opacity/transform while preserving correct ARIA expanded state and focus behaviour.
5. **Progress:** show real operation state only. Never simulate a percentage or imply that a PDF operation is progressing when it is not.
6. **Success/error:** animate icon or status transition; preserve text status for screen readers.
7. **Document Graph:** animate only actual nodes/edges from the stored graph model; preserve generation, parent and branch provenance.

## Reduced motion

- Honour `prefers-reduced-motion: reduce`.
- Do not require movement to understand status.
- Replace large transforms, parallax and stagger with immediate visibility.
- Keep progress state and completion announcements available without animation.
- The existing global reduced-motion stylesheet remains authoritative; component-level code must also avoid starting expensive observers/loops when reduction is requested.

## Performance guardrails

- Animate `transform` and `opacity` wherever possible.
- Avoid perpetual animation, particle effects, canvas/WebGL and large blurred layers in V1.
- Use IntersectionObserver only for content reveal; disconnect observers after reveal and on unmount.
- Do not add GSAP, Motion, Lottie or Three.js without measured justification.
- No animation may block PDF processing, file reading, downloads or user input.
- Keep server components as server components; isolate client-side motion to small leaf components.

## Visual identity

- Retain Kukureku's slate/blue foundation, typography and existing light/dark themes.
- Use restrained blue/cyan accents and clear status colours.
- Prefer crisp surfaces, subtle depth and readable document previews.
- Avoid copying Code & Chill layouts or branded assets; build Kukureku-native components.

## Acceptance criteria

- No animation dependency added for simple transitions.
- No initial content hidden if JavaScript or IntersectionObserver is unavailable.
- Reduced-motion preference produces immediate, understandable state changes.
- Keyboard focus and semantic states remain intact.
- Mobile does not rely on hover.
- No PDF/document data is used in demo animations.
- No changes to PDF engine or privacy/network behaviour.
- Unit/browser tests and production build must pass before any release proposal.
