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

## Installing

Tab Toolkit isn't on the Chrome Web Store yet. For now, build it yourself
and load it as an unpacked extension — this needs [Node.js](https://nodejs.org)
24 (or newer; see [`CONTRIBUTING.md`](CONTRIBUTING.md#prerequisites) for the
exact version policy):

```bash
git clone https://github.com/JR0210/tab-toolkit.git
cd tab-toolkit
npm install
npm run build
```

Then in Chrome: go to `chrome://extensions`, enable **Developer mode**,
click **Load unpacked**, and select the `dist/` folder. Click the extension
icon to open the popup.

## Privacy

Tab Toolkit works entirely on your device — no accounts, no backend, no
analytics, and no remote network requests of its own. It requests exactly
four Chrome permissions (`tabs`, `tabGroups`, `storage`, `clipboardWrite`)
and nothing else — no host permissions, no content scripts, no background
service worker. See [`docs/privacy.md`](docs/privacy.md) for the full,
verifiable disclosure of exactly what's stored, where, and why.

## License

GPL-3.0-or-later — see [`LICENSE`](LICENSE). Copyright © 2026 Jacob Robinson.

Tab Toolkit is copyleft: you're free to use, study, modify, and redistribute
it (including forks), but any distributed modified version must remain
licensed under the GPL and ship its source. This keeps the project and its
derivatives open — a closed-source or paid fork isn't permitted.

## Contributing

Want to develop, test, or package a release build? See
[`CONTRIBUTING.md`](CONTRIBUTING.md).
