# Design system

Pulse's interface is technical, calm, precise, and information-dense without becoming
cramped. This document defines stable visual and interaction rules; the source of truth for
implemented values is `website/src/app/styles/globals.css`.

## Transform Aperture

The Pulse mark shows structured input passing through an execution aperture and becoming
observable output. It is not a lettermark. The master is a background-free, solid,
two-path SVG that inherits `currentColor`:

```svg
<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M5 5H11L14 10L11 14V18L14 22L11 27H5Z" />
  <path d="M27 8a3 3 0 0 0-3-3H21L18 10L21 14V18L18 22L21 27H24a3 3 0 0 0 3-3Z" />
</svg>
```

Use the maintained assets under `website/public/brand/` and the React variants under
`website/src/components/brand/`. The locked brand pairing is cobalt `#285AE6` and electric
cyan `#6FE7FF`, anchored by deep navy `#091426`.

### Logo rules

- Keep the mark recognizable at 16 px; use the compact symbol where a wordmark cannot fit.
- On light application surfaces, use cobalt. On dark application surfaces, use periwinkle.
- Preserve the `32 × 32` view box and clear space equal to one quarter of the symbol width on
  every side.
- Use the provided favicon's deep-navy squircle only as a container, not as part of the master.
- Do not add gradients, internal strokes, glow, shadows, rotations, animation, or a letter P.
- Give a lockup an accessible name once; decorative child SVGs stay hidden.

## Token model

Tokens flow in three layers:

```text
primitive palette/scale → semantic purpose → component usage
```

Components consume semantic Tailwind utilities such as canvas, surface, border, ink,
accent, success, warning, danger, info, and method colors. They do not use raw brand values
or theme-specific color classes. Semantic CSS variables switch with `data-theme` and must
keep identical meaning in light and dark modes.

Status is never color-only: pair it with text, an icon, position, or pattern. Changing a
token requires checking normal/hover/pressed/disabled, focus, selection, charts, editors,
and both themes.

## Typography

Inter Variable is bundled locally with Latin and Vietnamese subsets for the application UI;
code, URLs, JSON, headers, IDs, and numeric telemetry use a high-legibility system monospace
stack. The standalone SVG wordmark declares Inter first with system fallbacks and does not
embed or fetch font data at runtime.

Use a restrained hierarchy: one clear page heading, strong panel titles, compact field
labels, and tabular/monospace numbers where comparison matters. Avoid all-caps body copy and
do not reduce essential labels below readable compact sizes.

## Spacing, density, and shape

- Base layout follows an 8 px rhythm, with 4 px only for tight internal alignment.
- Compact density optimizes expert scanning; comfortable density increases interactive row
  height without changing information architecture.
- Keep touch targets usable on narrow screens even when desktop density is compact.
- Use crisp borders, restrained radii, shallow elevation, and strong panel hierarchy.
- Avoid nested decorative cards when a divider or section heading provides enough structure.

## Interaction states

Every interactive component implements visible default, hover, active, focus-visible,
disabled, loading, success, warning, and error states where relevant. Destructive actions
require clear language and confirmation proportional to data loss. Draft state and running
state remain visible near the primary action.

Motion lasts roughly 120–180 ms and must explain cause and effect. Disable nonessential
motion under `prefers-reduced-motion`; do not use perpetual decorative animation.

## Layout and reflow

Desktop presents the top bar, activity rail, resizable explorer, request tabs, composer, and
result panels as one workbench. Narrow screens reflow panels vertically, move the explorer
to a sheet, and expose primary navigation at the bottom. Responsive checks cover 375, 768,
1024, 1440, and 1920 px without horizontal page overflow.

Do not hide essential actions at smaller widths. Large tables may scroll within a labelled
region, while page-wide overflow is a defect.

## Localization

All product copy lives in both `website/src/messages/en.ts` and
`website/src/messages/vi.ts`. Protocol identifiers, user data, imported content, and code are
not translated. Layouts must tolerate longer Vietnamese/English strings without truncating
meaning. Use locale-aware formatters for dates, numbers, durations, and percentages.

## Accessibility baseline

- Use semantic landmarks, headings, form labels, and native controls where possible.
- Give icon-only controls accessible names and expose validation summaries near their source.
- Preserve logical keyboard order, arrow-key tab behavior, escape/close behavior, and focus
  return after dialogs or sheets.
- Use a clearly visible focus ring in both themes.
- Meet WCAG AA contrast for text, controls, focus, editor syntax, charts, and disabled states.
- Announce request/run/stream transitions without announcing secret values.
- Give every chart an equivalent text summary or data table.

Accessibility is continuously tested and reviewed; it is a design target, not a claim of
formal certification.
