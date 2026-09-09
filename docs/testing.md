# Testing

Pulse tests deterministic frontend behavior at the narrowest useful layer. Pull-request checks
also run Chromium journeys and accessibility scans so user-visible regressions cannot be merged
on unit-test evidence alone.

## Test layers

| Layer             | Location                                           | Responsibility                                                                                                  |
| ----------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Domain/service    | `website/src/**/__tests__`                         | Pure rules, orchestration, state machines, cancellation, races, redaction, migration, and deterministic outputs |
| Component         | `website/src/**/*.test.tsx`                        | User-visible behavior, semantics, focus, validation, translations, and state integration                        |
| Architecture      | `website/scripts/check-architecture.mjs` and tests | Import direction, network/unsafe-runtime bans, storage ownership, and mock boundaries                           |
| Browser journeys  | `website/tests/browser`                            | Required critical workflows, persistence, history, organization, and responsive shells in Chromium              |
| Accessibility     | `website/tests/a11y.spec.ts`                       | Required route-level axe scans, interactive states, and keyboard smoke checks                                   |
| Responsive/manual | browser specs and review                           | Reflow, overflow, density, touch access, visual hierarchy, themes, and locales                                  |

Browser journeys are not backend E2E: Vite serves local assets and every response/event is
produced by the deterministic mock client.

## Required pull-request checks

Use Node.js `^22.13.0` or `>=24.0.0`. From `website/`:

```bash
npm ci
npm run format:check
npm run type-check
npm run lint
npm run test:run
npm run test:coverage
npm run check:architecture
npm run build
npm run check:bundle
npm audit --audit-level=high
npm run test:browser
npm run test:a11y
```

`npm run verify` runs formatting, TypeScript, lint, coverage-guarded unit/component tests,
architecture, production build, and bundle checks. The enforced baseline is 70% statements, 57%
branches, 63% functions, and 72% lines. The audit remains explicit because it uses the registry;
CI also runs dependency review to block newly introduced high-severity CVEs.

The JavaScript bundle guard allows at most 550 KiB gzip across all built JS chunks and 220
KiB gzip for the largest chunk. A change to either budget needs measured justification and
review; do not raise a budget merely to make a check green.

## Browser validation

Install the supported Chromium binary once:

```bash
npx playwright install chromium
npm run test:browser
npm run test:a11y
```

List cases without running them:

```bash
npx playwright test tests/browser --list
npx playwright test tests/a11y.spec.ts --list
```

The local server and isolated browser contexts do not reset a developer's normal browser
workspace. Playwright traces, screenshots, videos, reports, and `test-results` are generated
diagnostics and must not be committed. CI uploads those diagnostics only when a browser gate
fails.

## Determinism

Tests inject or control clocks, IDs, seeds, and fake execution clients. Do not use wall-clock
timing, arbitrary sleeps, live endpoints, or random values without a captured seed. Await a
specific state transition or accessible UI outcome instead of sleeping.

Test Lab's displayed duration may differ from its short playback duration; assertions should
target the immutable plan, events, and aggregates rather than elapsed test-runner time.

## What to cover

When changing execution or state behavior, cover:

- valid, invalid, empty, error, aborted, and retry paths;
- explicit session state transitions and rejection of invalid transitions;
- stale auth responses and concurrent single-flight refresh;
- lifecycle order and variable-scope precedence;
- redaction before persistence/export, including arbitrary marked secret values;
- storage unavailable/full/corrupt recovery;
- seeded dataset and run reproducibility; and
- no events appended after stop/cancel becomes terminal.

Component tests should assert roles, names, messages, focus, and user actions rather than CSS
selectors or internal hook calls.

## UI review matrix

For changes with visual impact, check:

- English and Vietnamese;
- light, dark, and system themes;
- compact and comfortable density where applicable;
- 375, 768, 1024, 1440, and 1920 px widths, plus a short 812 × 375 landscape viewport;
- keyboard-only use and `prefers-reduced-motion`;
- loading, success, empty, malformed/binary, error, aborted, and recovery states; and
- charts with their table or text alternative.

Record the commands and relevant case counts/results in the pull request. A passing snapshot
or narrow focused test is evidence only for the behavior it actually covers.
