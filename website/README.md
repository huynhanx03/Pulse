# Pulse · API Workbench

A frontend-only internal API workbench. Built with Vite, React, and TypeScript; API responses, tokens, streams, and run metrics are deterministic browser-local simulations. No Go backend or API proxy is needed to try it.

## Run

Use Node.js 22.13+ (22.x) or 24+, and npm. From `Pulse/website`:

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. `/` opens the active request; a fresh workspace starts with the synthetic Login request.

For a production-style local preview:

```bash
npm run build
npm run preview
```

`dist/` is a static SPA build artifact. Deployment is intentionally out of scope for this
frontend-only phase; PR CI reports the final quality-gate result instead.

## What you can try

| Area         | Working prototype behavior                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Workbench    | Collections, search, tabs, new HTTP/gRPC requests, rename, duplicate, pin, save, close-with-draft protection, confirmed deletion and command palette                           |
| HTTP/HTTPS   | Method/URL/query/headers/body/auth/settings editors, send/cancel, validation, timeout, TLS verification, redirects, 401/422/500, malformed and oversized-body scenarios        |
| Response     | Pretty/raw/preview/hex, assertions, headers, cookies, waterfall, console and TLS details                                                                                       |
| Lifecycle    | Ordered pre-request/post-response actions with a redacted passed/failed/skipped trace: set values, delay, log, assert and extract                                              |
| Environments | Staging/Local, initial/current values, enable/disable, secret masking, deterministic scope precedence and resolution inspector                                                 |
| Data Studio  | Fixed, sequence, random email/UUID/integer, pick-list, reproducible seeds, add/remove columns, CSV/JSON import and preview                                                     |
| Auth         | Configurable login/refresh requests, explicit expiry formats, monotonic token versions, pre-expiry refresh and one 401 retry; failures never replace tokens                    |
| gRPC         | Unary, server/client/bidirectional stream scenarios, messages, metadata, deadline errors, pause/resume view, send message, half-close, trailers/tests/timeline                 |
| Test Lab     | Functional, data-driven, race, staged virtual users and arrival-rate simulations; preflight, pause/resume/stop, checks, collisions, percentiles, chart + table and JSON export |
| History      | HTTP/gRPC summaries, protocol/method/status/scenario/collection/date filters, execution comparison, reproducible drafts and Test Lab comparison                                |
| Preferences  | VI/EN, light/dark/system, compact/comfortable density, editor font size and local demo reset                                                                                   |

Variable resolution is deterministic, highest scope first:
`iteration/data row > request lifecycle values > active environment > workspace > global`.

### Quick demo journeys

1. Send **Login**, inspect its JSON, then open **Variables**. Sample post-response extractors store `access_token` and `refresh_token`. Edit these rules in **Post-response**.
2. Open **Auth**, advance the mock clock, then send **Get profile** to observe refresh. Invalid JSON paths or failing refresh requests produce an error without replacing tokens.
3. In **Data Studio**, edit generators or import JSON objects. **Use in Test Lab** selects data-driven mode. Export the completed report to inspect each resolved row.
4. Run **Race condition** with 64 workers and inspect the single winner/conflicts. Switch to **Arrival rate** to see dropped iterations separated from target failures.
5. In **gRPC**, choose a method and invoke it. Try a 5 ms deadline, metadata, stream controls and error scenarios.
6. Open **More actions** for cURL import and Go/JavaScript/Python/cURL snippets. Import is previewed and unsupported syntax is rejected; commands are never executed.

Use only dummy credentials. Browser storage is not an encrypted vault. Marked secret values and captured tokens remain memory-only; structured credential fields are redacted from diagnostics, persisted history, and reports. Non-secret drafts and environment values remain editable local data. If browser storage is unavailable or full, edits remain in memory and the status bar warns that reloading can lose them.

## Deliberate mock boundaries

- **No API traffic.** Vite serves frontend assets; request tools never contact the URL you type. CORS, private-network routing, TLS handshakes and OAuth grants are not performed.
- **No real load testing.** Race uses a single-winner shared-resource fixture; charts are generated samples, not server measurements or proof of a real race condition. Playback uses a short local clock, separate from simulated duration.
- **gRPC definition demo.** Reflection is a local catalog. `.proto` import checks for service/rpc declarations and changes the displayed source; it does not compile protobuf or discover real services. Streaming is local playback.
- **Visual lifecycle rules, not arbitrary JavaScript.** A typed declarative engine handles actions; there is no `eval`, dynamic function execution or Postman sandbox compatibility.
- **Bounded data.** CSV/JSON imports accept up to 1 MiB and 1,000 rows. History retains up to 200 request executions and 100 Test Lab runs.
- **Mock workspace directory.** The switcher exposes a few browser-local contexts and updates the active workspace route. They intentionally share the deterministic demo payload until a future backend supplies independent workspace data. Product account sign-in, collaboration and backend authorization remain outside this FE phase.

These boundaries let you review the frontend without a Go execution service.

## Code structure

```text
src/
  app/              # Composition, routing, providers, shell and global styles
  components/       # Shared UI primitives, editor and branding
  features/         # HTTP, gRPC, auth, data, variables, Test Lab, history, settings
  domain/           # Framework-free models and state machines
  services/         # Single ExecutionClient boundary; no service hierarchy
  state/            # Store, selectors, actions and cohesive slices
  mocks/            # Mock ExecutionClient, fixtures and deterministic simulators
  lib/              # Persistence, security, i18n and utilities
  messages/         # Type-checked VI/EN catalogs
tests/
  browser/          # Optional Chromium mock journeys and responsive matrix
  a11y.spec.ts      # Optional route-level axe and keyboard checks
```

Views read state and invoke application actions. Four cohesive state slices coordinate lifecycle, auth, workspace and Test Lab flows with pure helpers. All HTTP, gRPC, and Test Lab execution crosses one injected `ExecutionClient`. The current implementation is deterministic and local. A future Go-backed client can replace it at the composition root while retaining editors and result components; no speculative transport contract is embedded in the UI.

Stack: Vite 8, React 19, TypeScript 6, Router 7, Tailwind 4, Radix primitives, Zustand, CodeMirror 6, i18next and Recharts. Forms use controlled React inputs and focused typed validation. Dependencies are pinned; no Next.js, SSR or server-state client.

## Design

Inter Variable is bundled locally with Latin and Vietnamese subsets for the application UI; code uses native monospace. The standalone SVG wordmark declares Inter first with system fallbacks and does not embed or fetch font data at runtime. Cobalt, electric cyan and deep navy define the interface; green is reserved for successful execution. Component colors use semantic CSS tokens in both themes.

Desktop uses a resizable explorer and split workbench. Narrow screens reflow vertically with an explorer sheet and bottom navigation. Visible focus, arrow-key tab navigation, reduced motion and readable syntax colors are included. WCAG 2.2 AA is a design target, not certification.

The custom **Transform Aperture** mark depicts structured input becoming observable output through a narrow execution boundary. See the root [design-system guide](../docs/design-system.md), `src/components/brand/PulseLogo.tsx`, and `public/brand/`.

## Verification

```bash
npm run verify
npx playwright install chromium
npm run test:browser
npm run test:a11y
```

`verify` checks formatting, strict TypeScript, lint, unit/component tests, architecture, the production build, and gzip budgets. Browser tests start a local server and use separate test contexts; they do not reset your normal browser workspace. They are mock browser journeys, not backend E2E.

```bash
npm run format       # Format source and docs
npm run test         # Watch unit tests
```

The architecture guard inspects executable syntax to reject network clients/unsafe evaluation while allowing snippets as plain strings. Browser coverage includes eight routes, VI/EN, light/dark, keyboard journeys, organization/history flows, interaction states, reflow at 375/768/1024/1440/1920 px, and the short-landscape tablet shell.

Pull-request CI runs only the deterministic non-browser gates. Read the maintained root [testing guide](../docs/testing.md), [architecture](../docs/architecture.md), and [security model](../docs/security-model.md) for contribution boundaries.

## Design references

- [Postman scripts](https://learning.postman.com/v11/docs/tests-and-scripts/write-scripts/intro-to-scripts) informed pre-request/post-response separation.
- [k6 open and closed models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/) informed virtual-user versus arrival-rate modes.
- [gRPC core concepts](https://grpc.io/docs/what-is-grpc/core-concepts/) informed the four RPC interaction types.
- [WAI keyboard guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) informed focus and keyboard behavior.
