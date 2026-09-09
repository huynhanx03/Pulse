# Architecture

Pulse is a frontend-only Vite SPA organized around product domains and a single replaceable
execution boundary. The architecture aims to keep complex workflows understandable without
building a server-shaped framework before a backend contract exists.

## System context

```text
React features
      │ public selectors/actions
      ▼
Zustand slices ─────────────────────────► ExecutionClient
      │                                      │
      │                                      └── MockExecutionClient (current)
      ▼
local repository ───────────────────────► browser storage
```

Components never choose an execution implementation. The application composition root
injects `MockExecutionClient` and browser storage. A future Go-backed client can replace the
mock only after its protocol and security model are approved.

## Repository layout

```text
Pulse/
  .github/              # Pull-request automation and contribution templates
  docs/                 # Maintained product and engineering documentation
  website/
    src/
      app/              # Composition root, routing, providers, shell, global styles
      components/       # Domain-neutral UI, editor, and brand primitives
      domain/           # Framework-free types, invariants, and state machines
      features/         # User-facing workbench flows
      services/
        execution-client.ts # Single replaceable boundary and session errors
      state/            # Public store, selectors, actions, and cohesive slices
      mocks/            # Deterministic client, simulators, fixtures, clocks/randomness
      lib/              # i18n, persistence, security, and small shared utilities
      messages/         # Type-checked English and Vietnamese catalogs
      test/             # Unit/component test setup and helpers
    tests/browser/      # Optional local Chromium mock journeys
    scripts/            # Architecture and bundle-budget guards
```

The exact folders may evolve when a smaller cohesive module is clearer. The responsibility
and dependency rules below are stable.

## Dependency rules

### Domain-first modules

Domain modules contain protocol-independent data, transitions, validation, and pure rules.
They do not import React, features, state, persistence, mocks, or browser APIs.

### Single execution seam

`services/execution-client.ts` defines the one backend-replaceable `ExecutionClient`
contract and its typed session/transition errors. It is a boundary module, not a general
services layer or a ports/adapters hierarchy. Ordered application workflows remain visible
in the owning state slice and compose pure domain/library helpers.

### State

One public Zustand store keeps cross-cutting flows visible. `create-pulse-store.ts` only composes
initial state and four focused slices: workspace/drafts, execution/auth, Test Lab, and
UI/preferences. Async controllers stay private to their owning slice; slices coordinate through
typed public actions instead of importing each other's internals.

### Workspace and environment ownership

A workspace is the complete boundary for user-authored API testing material: collections,
requests, gRPC definitions, environments, datasets, auth-profile definitions, request history,
and Test Lab run history. Browser persistence is keyed per workspace, so switching workspaces
loads a separate payload instead of relabeling a shared one.

An environment belongs to exactly one workspace and owns its variable values plus the runtime
state of each auth profile (capture time, expiry, refresh count, and token version). There is no
editable global-variable scope: data-driven iteration values temporarily override the active
environment only for that execution. This keeps Dev/Staging selection explicit and prevents
credentials or test data from leaking between workspaces.

Mock scenario selection is transient `mockProfiles` state keyed by request ID. It is never a
field on the backend-neutral saved request model. An execution records the chosen scenario, and
opening that history item recreates the transient option so the draft remains reproducible.

### Features and components

Features own screens and user-facing flows. They may use shared components, domain types,
the `ExecutionClient` boundary, and public state APIs, but not concrete mock engines,
fixtures, or persistence implementations. `components/ui` stays domain-neutral;
cross-feature composites live with their closest product owner.

### UI composition rules

Pulse has one UI system, not a collection of feature-local widgets. Before writing markup,
authors must first reuse the closest primitive in `components/ui` (`Button`, `IconButton`,
`Field`, `Checkbox`, `Switch`, `Badge`, `Panel`, and dialog/menu primitives). If a pattern is
needed by more than one feature or has reusable interaction/accessibility behaviour, it belongs
in `components/ui` with a narrow typed API and semantic design tokens.

Accessible interaction primitives use the existing Radix packages; feature code must not add
raw interactive controls when an equivalent shared primitive exists. New third-party UI kits
are not introduced alongside this system. Dependencies are added only where they reduce
maintenance materially and remain compatible with the existing React, Radix, Tailwind, and
token architecture.

### Mocks and infrastructure

All response fixtures, latency/error scenarios, stream events, run samples, clocks, IDs, and
deterministic randomness live in `mocks`. Persistence is injected through the repository
contract; only its browser implementation may access `localStorage`.

`scripts/check-architecture.mjs` enforces critical rules in executable syntax, including the
absence of runtime network clients and unsafe evaluation.

## Execution boundary

All simulated HTTP, gRPC, and Test Lab work crosses one interface:

```ts
interface ExecutionOptions {
  seed?: number;
}

interface ExecutionClient {
  executeHttp(
    input: HttpExecutionInput,
    options: ExecutionOptions,
    signal: AbortSignal,
  ): Promise<HttpExecutionResult>;
  openGrpc(
    input: GrpcExecutionInput,
    options: ExecutionOptions,
    signal: AbortSignal,
  ): Promise<GrpcExecutionSession>;
  startRun(
    plan: TestRunPlan,
    options: ExecutionOptions,
    signal: AbortSignal,
  ): Promise<TestRunSession>;
}
```

Long-lived work returns typed sessions with event streams and explicit state-machine
controls. Unary gRPC is a session that completes after one response. Cancellation uses
`AbortSignal` and resolves through a typed terminal event or `ExecutionAbortedError` rather
than an ambiguous generic failure.

Invalid session transitions are rejected. No component reaches into a concrete client or
stores promises, controllers, DOM objects, or iterators in persisted state.

## Request and auth flow

```text
validate configuration
  → coordinate single-flight refresh
  → resolve variables/dataset and inject auth
  → call ExecutionClient with cancellation
  → normalize result/events
  → redact diagnostics
  → append result evidence and update state/history
  → persist recoverable non-secret state
```

Token capture is response-driven. A candidate token set is validated before an atomic
environment update. Its declared expiry format must be relative `expires_in` seconds,
ISO-8601, Unix seconds, or Unix milliseconds; numeric magnitude is never guessed. Concurrent
protected requests share a refresh operation. The profile's monotonic `tokenVersion`
increments after each successful capture or refresh, and a response may commit only when its
starting version is still current. A protected request may refresh and retry once after a
401; loops are not allowed.

## Variable resolution and script sources

Variable resolution uses one deterministic precedence order, highest first:

```text
iteration/data row > active environment current > workspace > global
```

A workspace value therefore shadows a global value with the same key, and the resolution
inspector reports the winning scope. Pre-request and post-response script sources are saved
with the request but never evaluated in the browser; the future Go execution service is the
only intended sandbox for that code. Execution evidence joins history only after secret
redaction.

## Test Lab flow

A mutable editor produces an immutable `TestRunPlan`. The client emits events; a reducer
creates incremental aggregates, tables, charts, and the final immutable report. Pause,
resume, stop, completion, and failure are explicit states. No event may append after a stop
or cancellation becomes terminal.

## Persistence and recovery

Recoverable workspace data and preferences use a versioned repository. Loaded data is
validated and migrated before entering state. Corrupt data is rejected with a recovery path.
When browser storage is unavailable or full, the repository continues in memory and the UI
shows a persistent warning.

Marked secret values and captured access/refresh tokens are never serialized. Persisted
history and reports contain redacted copies rather than references to raw execution data.

## Integration constraints

The current phase has no real network, backend, server-state client, proxy, OAuth grant,
protobuf compiler, or load generator. Introducing a Go-backed client requires a separate design
covering transport, authentication/authorization, origin and network policy, cancellation,
stream backpressure, error taxonomy, observability, deployment, and integration tests. It
must not leak transport concerns into features or domain modules.
