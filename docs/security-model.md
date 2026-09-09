# Security model

Pulse is a frontend-only deterministic simulation. Its primary security goals are to prevent
unexpected execution, keep marked secrets out of persistent artifacts, render imported data
safely, and describe browser limitations honestly.

For private disclosure instructions, read [SECURITY.md](../SECURITY.md).

## Trust boundaries

```text
untrusted user/imported text
          │ validate + parse as data
          ▼
application state ──► deterministic ExecutionClient
          │                     │
          │                     └── no remote transport
          ▼
redaction boundary ──► persisted workspace/history/export
```

URLs, headers, request/response bodies, cURL, JSON, CSV, proto text, environment values, and
dataset cells are untrusted input. The mock client is trusted to produce deterministic local
events, not to enforce a remote security policy. Browser storage is an untrusted persistence
medium and not a vault.

## Protected data

Pulse recognizes marked secret variables and common credential fields such as access and
refresh tokens, authorization headers, passwords, cookies, client secrets, and API keys.

| Data                                   | Lifetime                           | Protection                                                     |
| -------------------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| Captured access/refresh tokens         | Memory only                        | Masked by default; not serialized; cleared on reload/tab close |
| Marked secret initial/current values   | Memory only                        | Masked by default; values removed from persisted workspace     |
| Request auth credential fields         | Memory only                        | Credential content removed during persistence                  |
| Non-secret workspace/preferences       | Browser storage when available     | Schema validation, migration, and recovery fallback            |
| History, diagnostics, reports, exports | Browser storage or downloaded file | Structured key/value redaction plus known-secret replacement   |

Masking protects against casual observation; it is not encryption. A reveal control, browser
extension, injected script, developer tools, clipboard, screen capture, shared profile, or
compromised device may expose in-memory content. Users must use synthetic credentials only.

## Runtime guarantees

The frontend phase enforces these guarantees in source and tests:

- no `fetch`, Axios, XMLHttpRequest, WebSocket, EventSource, MSW, or hidden remote mode;
- no `eval`, `new Function`, arbitrary lifecycle JavaScript, imported-command execution, or
  protobuf compilation;
- HTTP, gRPC, auth, and Test Lab execution crosses the injected `ExecutionClient`;
- every operation supports bounded state transitions and cancellation;
- secret redaction occurs before a diagnostic, history item, report, or export is committed;
- untrusted content is rendered as text or a constrained representation, never raw HTML; and
- a storage failure falls back to memory with an explicit warning instead of silently losing
  protection or claiming persistence.

The architecture checker examines executable syntax. Example cURL or JavaScript snippets may
exist as inert strings, but must never be evaluated or launched.

## Authentication threats

Token capture only accepts configured, limited JSON paths. Expiry must be declared as relative
`expires_in` seconds, ISO-8601, Unix seconds, or Unix milliseconds; Pulse never guesses a
format from numeric magnitude. A failed capture or refresh cannot replace the last valid token
set. Refresh is single-flight per profile/environment. The profile's monotonic
`tokenVersion` increments after every successful capture or refresh, and a response whose
starting version is stale cannot commit. Automatic 401 recovery retries once and then stops.

These controls model safe client behavior; they do not authenticate a real user or prove an
OAuth/OIDC implementation.

## Imported-content threats

- cURL import is parsed into a preview; shell expansion and commands are rejected and never
  executed.
- JSON and CSV imports are size/row bounded and parsed as data.
- Proto import recognizes a limited display catalog; it does not compile code or use server
  reflection.
- URLs do not navigate or create requests merely because they are entered.
- Response preview uses escaped or constrained output and must not inject arbitrary HTML.
- Error messages avoid reproducing raw secrets and production payloads.

Import limits are availability controls, not proof that a file is safe outside Pulse.

## Persistence and availability

Persisted data is schema-versioned and validated before use. Corrupt payloads are quarantined
or reset through a visible recovery flow. Storage quota, private browsing, browser policy, or
another tab may make persistence unavailable; Pulse continues in memory and warns that a
reload can lose work.

The application does not promise durability, cross-device synchronization, encryption at
rest, multi-user isolation, or backup recovery.

## Out of scope for the frontend phase

- Server authentication, authorization, tenancy, or audit logs
- CORS, CSRF, SSRF, DNS rebinding, private-network access, TLS verification, and proxy policy
- Remote API correctness, service availability, throughput, or race-condition proof
- Go service hardening, deployment, secrets management, or supply-chain controls outside the
  npm frontend
- Security of the browser, extensions, operating system, device, or user-provided downloads

A future Go integration needs a new threat model before transport code is added. It must
cover origin/network policy, authentication/authorization, credential storage, request
allow-listing, TLS, SSRF, quotas, streaming backpressure, cancellation, logging, deployment,
and incident response.

## Security review checklist

For every security-sensitive change, verify:

1. Does it introduce a network, code-execution, navigation, HTML-rendering, or persistence path?
2. Can untrusted input cross that path without validation and bounds?
3. Are raw and derived secrets removed before every persistent or exported copy?
4. Do failure, retry, stale response, cancellation, and multi-tab cases retain safe state?
5. Are UI messages honest about Simulation Mode and browser limitations?
6. Do focused tests and the full architecture/security checks cover the changed boundary?
