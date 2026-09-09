# Roadmap

Pulse's present scope is a frontend-only internal workbench running deterministic local
simulations. This roadmap describes direction, not committed dates, endpoints, protocols,
or release guarantees.

## Current focus

- Keep HTTP/HTTPS, gRPC, lifecycle, auth, environment, dataset, and Test Lab mock flows
  coherent and inspectable.
- Strengthen keyboard operation, responsive reflow, localization, themes, recovery, and
  secure handling of local data.
- Maintain a small feature/domain-first architecture with one execution boundary.
- Keep public documentation, dependency updates, coverage, PR quality gates, final PR reports,
  tests, and bundle budgets healthy.

## Possible next phase: Go execution integration

A separately reviewed phase may implement a Go execution service behind the existing
`ExecutionClient` interface. Before work starts, it requires an explicit protocol, threat
model, authentication and authorization design, cancellation/streaming semantics, network
policy, deployment ownership, observability, and integration-test strategy.

The frontend will not speculate about endpoints or couple components to a concrete backend.
Any integration must preserve Simulation Mode as an explicit product state and clearly
distinguish simulated from remote results.

## Not planned in the current phase

- Real network or load generation
- Backend implementation or backend E2E
- Backend deployment, release/CD, container, or registry automation
- Multi-user accounts, shared workspaces, or collaboration
- Promises about service endpoints, hosting model, or delivery dates

Proposals should start with the user problem and fit the boundaries in
[Architecture](docs/architecture.md) and [Security model](docs/security-model.md).
