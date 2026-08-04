# Contributing to Tab Toolkit

This covers building, testing, and releasing Tab Toolkit. For what the
extension does and how to install it, see the [README](README.md).

## Stack

- React 19
- TypeScript 6
- Vite+ 0.2

Vite+ provides the Vite/Rolldown build, Vitest, Oxlint, Oxfmt, and
TypeScript checking through one project-local toolchain.

Built as a Manifest V3 extension, minimum Chrome 102, with a compact,
accessible, fixed-size (760×580) interface designed for a browser
extension popup.

## Prerequisites

CI and `.node-version` both specify Node.js 24 (as a bare major, so this
floats to the latest 24.x rather than pinning an exact patch version);
`package.json`'s `engines` field states a floor of `>=22.12.0`. Only 24 is
actually exercised in CI, so treat 24 as the version to develop against.

## Development

```bash
npm install
npm run dev
```

This extension calls `chrome.*` APIs directly and will not function
correctly in a plain browser tab — to see the real UI, build it and load
it as an unpacked extension (see the [README](README.md#installing)).

## Scripts

- `npm run dev` starts the Vite development server.
- `npm run format` formats the project with Oxfmt.
- `npm run lint` runs Oxlint.
- `npm run typecheck` runs Vite+'s TypeScript check.
- `npm run check` runs formatting, linting, and type-checking.
- `npm run check:fix` formats and applies safe lint fixes.
- `npm test` runs Vitest through Vite+.
- `npm run test:scripts` runs Node's built-in test runner against the
  release-verification scripts themselves (`scripts/*.test.mjs`).
- `npm run icons` regenerates the PNG icons (16/32/48/128) from
  `assets/extension-icon.svg`.
- `npm run build` creates a production build in `dist`.
- `npm run preview` serves the production build locally.
- `npm run verify:manifest` checks `dist/manifest.json` against the
  approved permissions/shape.
- `npm run verify:build` checks `dist/` against release budgets (no chunk
  over 300 KB, unpacked total under 750 KB excluding icons, no source maps,
  no un-allowlisted remote references).
- `npm run verify:release` runs the full gate: check, test, test:scripts,
  build, verify:manifest, verify:build.
- `npm run package` builds a versioned, verified Chrome Web Store ZIP under
  `release/` (Windows/PowerShell).

## Release process

See [`docs/release/manual-test-matrix.md`](docs/release/manual-test-matrix.md)
for the manual QA checklist run against each release build, alongside the
automated `npm run verify:release` gate.
