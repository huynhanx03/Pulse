<p align="center">
  <img src="website/public/brand/pulse-mark.svg" width="72" alt="Pulse" />
</p>

<h1 align="center">Pulse API Workbench</h1>

<p align="center">
  A frontend-only internal API workbench for inspecting HTTP, gRPC, authentication, lifecycle,
  dataset, and concurrency workflows in one deterministic simulation.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-2563eb?style=flat-square" alt="Apache-2.0 license" /></a>
  <img src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white&style=flat-square" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript 6" />
</p>

<p align="center">
  Build, simulate, and inspect API workflows from one local workspace.
</p>

<p align="center">
  <img src="docs/assets/pulse-workbench.png" width="1200" alt="Pulse dark-mode workbench showing an HTTP request composer, workspace explorer, and response inspector" />
</p>

## Quick start

Requires Node.js `^22.13.0` or `>=24.0.0` and npm.

```bash
cd website
npm ci
npm run dev
```

No backend, Docker service, or external account is required.

## Quality

```bash
cd website
npm run verify
npm run test:browser # install once: npx playwright install chromium
npm run test:a11y
npm audit --audit-level=high
```

Every pull request runs format, strict types, lint, tests, browser and accessibility checks,
architecture and bundle budgets, dependency review, and a final PR report.

## Project

Pulse ships with a deterministic local `ExecutionClient`; it has no API proxy, real transport,
load generator, or backend E2E. Persisted diagnostics and history are redacted; tokens and secret
values remain memory-only.

[Architecture](docs/architecture.md) · [Testing](docs/testing.md) · [Security model](docs/security-model.md) · [Roadmap](ROADMAP.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report security
concerns via [SECURITY.md](SECURITY.md), not public issues.

## License

[Apache License 2.0](LICENSE).
