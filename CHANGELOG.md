# Changelog

All notable changes to Pulse will be documented in this file. The project follows the
structure of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) but has not published a
versioned release.

## [Unreleased]

### Added

- Frontend-only internal API workbench with deterministic HTTP/HTTPS, gRPC, auth,
  lifecycle, datasets, and Test Lab simulation flows.
- Transform Aperture visual identity, VI/EN localization, light/dark/system themes, and
  responsive desktop/mobile workspaces.
- Replaceable execution boundary, local persistence with memory fallback, redaction,
  accessibility coverage, browser mock journeys, and pull-request quality gates.

### Security

- Captured tokens and marked secret values remain memory-only and are redacted from
  persisted diagnostics and exports.
