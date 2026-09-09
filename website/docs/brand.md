# Pulse · Transform Aperture

Transform Aperture is Pulse's custom vector identity. Structured input narrows through an execution aperture and resolves into observable output: request → execution → response. The symbol is not a lettermark and is never substituted with a generic activity or network icon.

## Master and assets

- Component master: `src/components/brand/PulseLogo.tsx`. `PulseMark` is the background-free, two-path `currentColor` symbol; `PulseLogo` is the accessible horizontal lockup.
- Brand-color mark: `public/brand/pulse-mark.svg`, cobalt for light documentation surfaces.
- Light-surface monochrome mark: `public/brand/pulse-mark-mono.svg`, deep navy on transparent.
- Horizontal lockup: `public/brand/pulse-wordmark.svg`, for light documentation surfaces.
- Favicon/app icon: `public/favicon.svg`, electric cyan inside the only approved deep-navy squircle container.

The locked brand pairing is cobalt `#285AE6` and electric cyan `#6FE7FF`, anchored by deep navy `#091426`. In the application, the semantic `brand-mark` token resolves to cobalt in light mode and periwinkle in dark mode. Green is reserved for successful execution states. Inter Variable is bundled locally with Latin and Vietnamese subsets for the application UI. The standalone SVG wordmark declares Inter first with system fallbacks and does not embed or fetch font data at runtime.

## Usage

- Keep clear space equal to one quarter of the symbol width on every side.
- The symbol is designed to remain identifiable at 16 px. Prefer 24 px or larger in product navigation and 32 px or larger for standalone display.
- Give the horizontal lockup one accessible name (`Pulse`). Treat a mark next to an existing visible Pulse label as decorative.
- Use the background-free symbol in headers, compact rails, empty states, and documentation. The deep-navy squircle belongs only to favicon/app-icon contexts and the recovery emblem.
- Preserve both paths and their geometry. Do not stretch, rotate, crop, outline, animate, recolor outside the approved palette, or add gradients, glow, glass, shadows, or thin internal strokes.
- Status colors remain semantic and always appear with a text label; color alone never communicates protocol or execution state.
