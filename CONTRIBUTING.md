# Contributing to Pulse

Thank you for helping improve Pulse. This repository currently accepts changes to the
frontend-only simulation. Backend transports, Docker, and real load generation require a
separately approved phase and should not be introduced in a frontend pull request.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Use Node.js `^22.13.0` or `>=24.0.0`, and npm:

```bash
git clone https://github.com/huynhanx03/Pulse.git
cd Pulse/website
npm ci
npm run dev
```

Do not use real credentials or sensitive production payloads. All examples, fixtures, and
screenshots must contain synthetic data.

## Before opening a change

1. Search existing issues and pull requests.
2. Open an issue for large behavior, architecture, or dependency changes.
3. Keep one change focused and explain its user-visible outcome.
4. Add or update tests before changing domain, service, state-machine, or persistence behavior.
5. Update both English and Vietnamese catalogs for every product label.

## Code standards

- Keep domain rules framework-free and deterministic.
- Route HTTP, gRPC, auth, and Test Lab execution through the single `ExecutionClient` boundary.
- Keep mock fixtures, clocks, IDs, latency, and random generation under the mock implementation.
- Do not add `fetch`, Axios, WebSocket, EventSource, MSW, `eval`, or dynamic functions to the runtime.
- Feature UI uses public state actions/selectors and must not import concrete mocks or persistence adapters.
- Only the local-storage adapter may access `localStorage`.
- Use semantic design tokens rather than product color literals in components.
- Treat imported URL, cURL, JSON, CSV, proto, header, and response text as untrusted display data.
- Preserve secret redaction and never serialize captured tokens or marked secret values.
- Avoid speculative abstractions for a backend contract that does not exist yet.

See [Architecture](docs/architecture.md), [Design system](docs/design-system.md), and
[Security model](docs/security-model.md) for the maintained boundaries.

## Tests and quality gates

From `website/`, run the same checks required by pull-request CI:

```bash
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

`npm run verify` runs the source checks. PR CI also enforces coverage, audit, browser journeys,
and accessibility. Install Chromium locally to reproduce the browser gates:

```bash
npx playwright install chromium
npm run test:browser
npm run test:a11y
```

These are browser-level **mock journeys**, not backend E2E or real network tests. Read the full
[testing guide](docs/testing.md) before changing test boundaries or bundle budgets.

## Accessibility expectations

Changes must preserve:

- keyboard access and logical focus order for every important action;
- visible focus treatment in both themes;
- accessible names for icon-only controls and correct dialog focus return;
- readable contrast without relying on color alone;
- status announcements that never disclose secrets;
- text/table equivalents for charts; and
- usable reflow at 375, 768, 1024, 1440, and 1920 px.

Respect `prefers-reduced-motion`. Test light/dark and VI/EN when layout or copy changes.

## Pull requests

Use a concise imperative title and include:

- the problem and chosen tradeoffs;
- screenshots or recordings for visual changes;
- tests added or updated;
- verification commands and results;
- security, accessibility, localization, persistence, and bundle impact; and
- explicit confirmation that the mock/runtime boundary remains intact.

PRs that change packages also run dependency review and a high-severity npm audit. Do not weaken
these gates to merge a known CVE; remediate, replace, or document an approved exception outside
the workflow.

Keep generated `dist/`, Playwright reports, test results, local worktrees, and secrets out of
the pull request. Maintainers may ask for changes when checks pass but the behavior,
documentation, or product boundary is incomplete.
