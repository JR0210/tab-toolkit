# Tab Toolkit

A local-first Chrome extension for searching, copying, exporting, organising,
and managing browser tabs — plus saving and restoring named workspaces of
tabs. No accounts, no backend, no analytics.

## Features

- **Discover:** search/filter/sort open tabs across one or all windows,
  select individually or in bulk.
- **Copy & export:** copy selected tabs as URLs, title+URL, Markdown, HTML,
  CSV, or JSON; export to a local CSV/JSON file with your choice of fields.
- **Manage:** pin, mute, reload, discard, and close tabs — individually or
  in bulk — with a one-level Undo for closes, backed by session storage.
- **Organise:** move a selection to a new window, sort by title/domain,
  group by domain or into an existing Chrome tab group, find and remove
  exact-URL duplicates.
- **Workspaces:** save the current window's tabs as a named workspace,
  reopen it into a new window later, rename/delete with Undo.
- **Import:** paste a list of URLs to open them together (optionally saving
  them as a workspace too).
- **Settings & shortcuts:** theme, default scope, and default copy format,
  plus a full set of platform-aware keyboard shortcuts (⌘ on macOS, Ctrl
  elsewhere) with a built-in reference dialog.

## Principles

- Local-only operation with no accounts, database, analytics, or data
  collection — see [`docs/privacy.md`](docs/privacy.md) for the full,
  verifiable disclosure.
- Minimal Chrome permissions (`tabs`, `tabGroups`, `storage`,
  `clipboardWrite` only) and no page-content modification — no content
  scripts, no host permissions, no background service worker.
- A compact, accessible, fixed-size (760×580) interface designed for a
  browser extension popup.
- Manifest V3 and modern Chrome APIs, minimum Chrome 102.

## Stack

- React 19
- TypeScript 6
- Vite+ 0.2

Vite+ provides the Vite/Rolldown build, Vitest, Oxlint, Oxfmt, and
TypeScript checking through one project-local toolchain.

## Development

Node.js 22.12 or newer is required.

```bash
npm install
npm run dev
```

Note: this extension calls `chrome.*` APIs directly and will not function
correctly in a plain browser tab — to see the real UI, build it and load it
as an unpacked extension (below).

## Loading the extension locally

```bash
npm run build
```

Then in Chrome: go to `chrome://extensions`, enable **Developer mode**,
click **Load unpacked**, and select the `dist/` folder. Click the extension
icon to open the popup.

## Scripts

- `npm run dev` starts the Vite development server.
- `npm run format` formats the project with Oxfmt.
- `npm run lint` runs Oxlint.
- `npm run typecheck` runs Vite+'s TypeScript check.
- `npm run check` runs formatting, linting, and type-checking.
- `npm run check:fix` formats and applies safe lint fixes.
- `npm test` runs Vitest through Vite+.
- `npm run build` creates a production build in `dist`.
- `npm run preview` serves the production build locally.
- `npm run verify:manifest` checks `dist/manifest.json` against the
  approved permissions/shape.
- `npm run verify:build` checks `dist/` against release budgets (no chunk
  over 300 KB, unpacked total under 750 KB excluding icons, no source maps,
  no un-allowlisted remote references).
- `npm run verify:release` runs the full gate: check, test, build,
  verify:manifest, verify:build.
- `npm run package` builds a versioned, verified Chrome Web Store ZIP under
  `release/` (Windows/PowerShell).

## Privacy

Tab Toolkit works entirely on your device. It does not collect, sell, or
transmit browsing data, and initiates no remote network requests of its
own. See [`docs/privacy.md`](docs/privacy.md) for exactly what's stored,
where, and why each permission is required.

## Release process

See [`docs/release/manual-test-matrix.md`](docs/release/manual-test-matrix.md)
for the manual QA checklist run against each release build, alongside the
automated `npm run verify:release` gate.

## License

GPL-3.0-or-later — see [`LICENSE`](LICENSE). Copyright © 2026 Jacob Robinson.

Tab Toolkit is copyleft: you're free to use, study, modify, and redistribute
it (including forks), but any distributed modified version must remain
licensed under the GPL and ship its source. This keeps the project and its
derivatives open — a closed-source or paid fork isn't permitted.
