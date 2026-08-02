# Tab Toolkit Privacy Disclosure

This document describes exactly what Tab Toolkit does with your data, for
Chrome Web Store submission and for anyone auditing the extension. Every
claim below is backed by an artifact you can verify yourself — the built
`dist/` output, `scripts/verify-build.mjs`'s automated checks, or a live
DevTools Network/Console inspection.

## Summary

Tab Toolkit runs entirely on your device. It does not have a backend, does
not use analytics or telemetry, and does not send your browsing data
anywhere. There is no account, no sign-in, and no network request the
extension initiates on its own, ever.

## What data Tab Toolkit touches, and where it lives

| Data | Where it's stored | Why | Leaves your device? |
|---|---|---|---|
| Live tab/window/tab-group info (titles, URLs, favicons, pinned/muted/group state) | Never persisted — read fresh from `chrome.tabs`/`chrome.windows`/`chrome.tabGroups` each time the popup opens, held only in the popup's in-memory React state while it's open | To render the Tabs view and act on your selection | No |
| Extension settings (theme, default scope, default copy format) | `chrome.storage.local` | So your preferences persist across popup opens | No |
| Saved workspaces (ordered list of URL/title/pinned/group-name descriptors — never Chrome's internal tab/window/group IDs, since those are session-specific and meaningless after a restart) | `chrome.storage.local` | So "Save current window" / "Open workspace" work | No |
| The single most-recently-closed set of tabs (for the Undo affordance) | `chrome.storage.session` (cleared automatically when the browser session ends) | So closing tabs can be undone, including right after reopening the popup | No |
| Search text, filters, sort order, current selection | Popup-only in-memory React state | Live query/selection UI | No — and it resets every time the popup closes, by design |

Nothing above is ever bundled together, exported, or transmitted. There is
no first-party or third-party server this extension talks to.

## Verified: zero remote requests

`scripts/verify-build.mjs` (run as part of `npm run verify:release`, and
therefore on every CI run and every release build) scans every `.js`, `.css`,
and `.html` file in `dist/` for `http://`, `https://`, and `//fonts.`-style
literals, and fails the build if any are found that aren't explicitly
allowlisted in `scripts/remote-reference-allowlist.json` with a documented
reason. As of this writing, every allowlisted literal is one of:

- an inert XML namespace URI (SVG/MathML/XLink) that React and its
  dependencies bake into DOM node creation calls — never fetched,
- a documentation link this extension's `react`/`base-ui` dependencies
  construct only *inside a thrown error's message text* when something
  already went wrong, purely for a developer reading a stack trace — never
  fetched by the extension itself,
- a plain-text framework credit inside a generated CSS comment,
- the two `example.com`/`example.org` (RFC 2606 reserved) placeholder
  strings shown in the Import dialog's textarea hint text, and
- the one genuinely user-initiated outbound link: Settings → "Help &
  documentation," which opens this project's public GitHub repository
  (`https://github.com/JR0210/tab-toolkit`) via `chrome.tabs.create` only
  when you click it.

This was also confirmed live, not just via static scanning: during manual
QA (`docs/release/manual-test-matrix.md`), DevTools' Network panel was
checked after loading the popup, after a clipboard copy, and after a file
export — empty every time.

## Why each permission is required

Tab Toolkit's manifest (`public/manifest.json`) requests exactly four
permissions, enforced by `scripts/verify-manifest.mjs`:

- **`tabs`** — to read your open tabs' titles/URLs/state and to
  activate/pin/mute/reload/discard/close/move them when you ask.
- **`tabGroups`** — to read and create Chrome tab groups (for "Group by
  domain," "Add to group," and restoring a saved group's title/color).
- **`storage`** — for the `chrome.storage.local`/`chrome.storage.session`
  uses described above. This is the same permission whether the data is
  local or session-scoped; Chrome does not split it further.
- **`clipboardWrite`** — to copy selected tabs to your clipboard in the
  format you choose.

There is no `host_permissions` entry, no content script, no background
service worker, and no `commands` manifest key — verified by
`scripts/verify-manifest.mjs`'s automated assertions on every build.

## How uninstalling removes your data

Uninstalling Tab Toolkit deletes its `chrome.storage.local` and
`chrome.storage.session` data as part of Chrome's normal extension-removal
behavior — there is no server-side copy to also delete, because none exists.

## Questions

This extension has no support inbox or account system. If something here
looks wrong, open an issue on the public repository:
<https://github.com/JR0210/tab-toolkit>.
