---
name: internship-radar-ui
description: Design and refine Internship Radar's responsive frontend, job discovery, application tracking and Resume Studio while maintaining its Nightfall identity.
---

# Internship Radar frontend design

Use this skill for frontend design, copy, interactions, responsiveness, and accessibility in this repository.

## Visual identity: Nightfall

Create a calm, distinctive application workspace—not a generic AI dashboard. Use dark ink surfaces, jade highlights and quiet cool blue. Avoid purple gradients, neon-filled callouts, overwhelming metric cards, decorative glass and fake activity.

- Use the shared tokens in site/interface-refresh.css for background, surface, border, text, muted, and accent colors.
- Typography: Avenir Next-first sans stack, expressive tight headings, occasional italic Georgia / Iowan Old Style for editorial contrast. No external font requests; keep the CSP and privacy model.
- Consistent 10–18px radii, soft shadows and meaningful hairline borders. Avoid cards within cards.
- One primary action per section; secondary actions visually quieter.
- CSS motion only for purposeful affordances, one page transition, and reduced-motion support.

## User journeys

Home: genuine application goal, next useful action, then fresh leads. No duplicate stats dashboard.

Daily 10: scannable list and single focus view, transparent reasons/source/warnings, and employer link. Never count an application until user explicitly confirms submission.

Explore / Latest: search, sorting and filters; one-click reset; truthful source and discovery dates. Nationwide default, DMV ranking preference. Never call a heuristic score a hiring chance or confirm an opening without evidence.

Companies: current feed leads distinct from previously observed employers, unavailable sources and link-only company pages.

Resume Studio: user data local; suggestions are not ATS certification; export/print behavior must remain stable.

## Accessibility and navigation

- Mobile: one-tap bottom shortcuts for Home, Daily 10, Explore, Pipeline; all other destinations available in the header menu.
- Desktop: left sidebar and Find internships action.
- Skip links, visible keyboard focus, Escape to dismiss mobile menu, slash to focus search when outside input, appropriate aria-current/pressed/expanded attributes.
- All controls have real actions; use native buttons, anchors, form labels, details, and focusable headings when appropriate.
- Specific, honest loading/empty/error messages instead of vague placeholders.

## Regression checklist

1. Run existing job, application, resume, stats and navigation tests.
2. Run node scripts/test_ui_refinement.cjs, inline JS syntax checks and cache-stamp tests.
3. Exercise keyboard search, mobile navigation, browser Back, Explore reset, Daily 10 submission confirmation and Resume Studio handoff.
4. Inspect 375px, 768px, 1280px and 1440px widths when browser tooling is available.
5. Include new first-party assets in scripts/stamp_assets.py. Do not add external dependencies or remote fonts.

This design skill does not authorize fabricated source claims, false verified-opening labels, or claiming rendered browser validation when only static checks were run.
