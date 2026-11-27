# Kukureku Motion System V1 — iPhone Acceptance Plan

## Current access constraint

The project owner currently has an iPhone only; no laptop is available for a local development server. A hosted Vercel preview is therefore required for hands-on testing.

A preview deployment was attempted for the feature branch and Vercel rejected resource creation with HTTP 402 `resource_creation_blocked` because the team has an overdue balance. No preview deployment was created. Production was not changed.

Do not ask the project owner to install developer tools or run terminal commands on the phone. Do not enable automatic Vercel deployments or change billing settings as a workaround.

## Device acceptance matrix

Run this checklist on the hosted preview using iPhone Safari after preview access is restored.

| Area | Test | Expected result |
|---|---|---|
| Initial load | Open /motion-lab on a narrow portrait viewport | No horizontal overflow; hero and sample workspace fit the screen |
| Touch controls | Tap Recent files and Version graph | Selected tab changes immediately; correct sample view appears |
| Sample selection | Tap each sample document | Active selection is clear and stable |
| Tap feedback | Tap primary and secondary actions | Immediate visual feedback; no hover-only dependency |
| Scroll reveal | Scroll through the page | Sections reveal once, without hiding content permanently |
| Orientation | Rotate portrait to landscape and back | Layout reflows without clipped controls |
| Text zoom | Increase Safari text size / use page zoom | Text and controls remain readable and usable |
| Reduced motion | Enable iOS Settings > Accessibility > Motion > Reduce Motion, then reload | Content appears immediately; no essential state depends on animation |
| Privacy | Use all demo actions | Clear sample-only messaging; no real file upload, processing, or download |
| Navigation | Use Back to Kukureku and browser back | Navigation works and focus/scroll state remains sensible |

## Release criteria

- Hosted preview corresponds to the exact reviewed feature commit.
- iPhone Safari acceptance matrix passes.
- Browser Reliability Smoke and Validate workflows pass on the final commit.
- Complete dependency audit is clean; Next.js and eslint-config-next remain exactly version-aligned and pinned.
- No production merge or deployment until the independent release hold is lifted.

## Current engineering blockers

1. Vercel preview creation: HTTP 402 overdue-balance restriction.
2. Full dependency audit: installed Next.js 16.4.2 is flagged by npm audit. The audit reports a safe upgrade target of 16.4.6; update Next.js, eslint-config-next and the lockfile together, then run the full validation suite. Do not use `npm audit fix --force` blindly.
3. The mobile browser automation suite has passed in GitHub Actions, but it is not a substitute for hands-on iPhone Safari visual acceptance.

## Cost-conscious approach

- Keep motion CSS-first; do not add an animation library for simple transitions.
- Use the existing GitHub Actions workflows for regression checks.
- Use a single preview deployment for the iPhone acceptance pass once Vercel permits it.
- Keep production unchanged until all release criteria pass.
