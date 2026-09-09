# Security policy

## Supported versions

Pulse has no public release line yet. Security fixes are applied to the current default
branch; older snapshots and forks are not maintained.

## Report a vulnerability

Do not disclose suspected vulnerabilities in a public issue, discussion, screenshot, or
pull request. Use GitHub private vulnerability reporting:

<https://github.com/huynhanx03/Pulse/security/advisories/new>

Include the affected revision, a minimal reproduction using synthetic data, impact, browser
and operating system, and any suggested mitigation. Remove credentials, tokens, cookies,
private endpoints, and production payloads. Maintainers will acknowledge the report through
the private advisory and coordinate validation and disclosure there.

## Frontend security boundary

Pulse currently runs as a frontend-only deterministic simulation:

- it does not contact the URL entered in a request or create real HTTP/gRPC/load traffic;
- it does not execute imported cURL, JavaScript, proto, JSON, or CSV as code;
- marked secret variables and captured access/refresh tokens are memory-only and clear when
  the page context is lost;
- masking is a UI affordance, not encryption;
- persisted workspace/history/report data passes through structured redaction, including
  authorization, token, password, cookie, API-key, and marked-secret values; and
- browser extensions, injected scripts, shared profiles, screen capture, clipboard access,
  developer tools, and a compromised device remain outside the application's protection.

Use only dummy credentials. Browser storage is neither an encrypted vault nor an appropriate
place for production secrets. See the detailed [security model](docs/security-model.md).

## Scope

Examples of in-scope reports include bypasses that introduce real network execution,
persistent secret leakage, redaction failures, unsafe rendering of imported content,
arbitrary code execution, dependency compromise, or a security-control regression.

Mock responses that differ from a real service, simulated performance figures, absence of a
backend, and attacks that already require full control of the browser/device are normally
outside scope unless they reveal a distinct Pulse vulnerability.
