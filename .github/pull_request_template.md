## Summary

<!-- What user/developer problem does this solve, and why is this approach appropriate? -->

## Changes

-

## Evidence

<!-- Include commands and results. Attach before/after screenshots for visual changes. -->

- [ ] `npm run verify`
- [ ] `npm run test:coverage`
- [ ] `npm audit --audit-level=high`
- [ ] `npm run test:browser`
- [ ] `npm run test:a11y`

## Review checklist

- [ ] The change remains frontend-only and does not introduce real network/load execution.
- [ ] New behavior crosses the single `ExecutionClient` boundary where applicable.
- [ ] Tests cover success, failure, empty, aborted, stale, and recovery paths as relevant.
- [ ] Secrets are memory-only and redacted before persistence, diagnostics, or export.
- [ ] Product copy is present in both English and Vietnamese.
- [ ] Light/dark/system themes, keyboard access, focus, reduced motion, and responsive reflow were considered.
- [ ] Documentation and the changelog were updated when behavior or boundaries changed.
- [ ] No generated build, Playwright, test-result, credential, or production-data artifact is included.

## Risk and rollback

<!-- Note security, accessibility, persistence, localization, bundle, or migration risk. -->
