# Tab Toolkit Chrome Extension Design

**Date:** 2026-08-01

## Goal

Convert the approved v0 Tab Toolkit prototype into a local-only Chrome Manifest V3 extension that reads and manages browser tabs from its popup. Preserve the prototype's visual character while removing web-application infrastructure, mock-only behavior, remote services, and unnecessary packaged assets.

## Product scope

The extension has two primary views:

- **Tabs:** inspect tabs in the current window or all normal windows; search, filter, select, copy, export, arrange, update, discard, and close them.
- **Workspaces:** save named tab collections locally, restore them later, rename/delete them, and import newline-separated URLs.

Copy formats are URL-only, title and URL, Markdown, HTML, CSV, and JSON. File export supports CSV and JSON with selectable fields. Organising supports moving selected tabs to a new window, grouping by domain, adding tabs to a chosen group, sorting, pinning, muting, reloading, discarding, and removing exact-URL duplicates.

The extension does not inspect or modify page content. It has no content scripts, backend, database, account, cloud sync, analytics, advertising, telemetry, or remotely hosted code.

## Current export audit

The original export is preserved as `tab-toolkit.zip`; the extracted review copy is `v0-export/`.

The untouched Next.js production build contains approximately:

- 1,062 KB JavaScript
- 79 KB CSS
- 144 KB font files
- 1,286 KB total static assets

The prototype type-checks, but `next.config.mjs` disables build-time TypeScript failure. It is a UI simulation: tab data and workspaces are hard-coded, the active window is hard-coded as window `1`, and many actions only display a success toast.

Known correctness issues in the prototype include:

- Keyboard shortcut labels always use the macOS Command symbol.
- No keyboard shortcut handlers are implemented.
- A row-level “Copy title and URL” first queues a selection state update and then copies from stale state, so it can copy the wrong tabs.
- Clipboard failures are swallowed while the UI still reports success.
- Workspace records store only counts and favicon stand-ins, not restorable URLs.
- Import passes only a URL count to the store and never opens the parsed URLs.
- Duplicate detection compares only mock URLs and operates across all tabs regardless of the current selection.
- CSV values are quoted but are not protected against spreadsheet-formula injection.
- Markdown and HTML output do not fully escape titles and URL attributes.
- The popup-sized card is wrapped in a responsive web-preview canvas that can overflow an actual 760×580 extension popup.

## Architecture decision

Use a single Vite + React + TypeScript popup, not Next.js and not a service worker.

The popup can call `chrome.tabs`, `chrome.tabGroups`, `chrome.storage`, and `chrome.runtime` directly. There is no background behavior in the agreed scope, so a service worker would add lifecycle and messaging complexity without delivering user value. Global shortcuts that operate while the popup is closed are out of scope; documented shortcuts operate only while the popup has focus.

Chrome access is isolated behind small typed adapters. UI components receive application-shaped `TabRecord`, `TabGroupRecord`, `Workspace`, and operation functions instead of importing `chrome.*` directly. Pure search, filtering, formatting, validation, and workspace conversion remain independently testable without Chrome.

The implementation lives at the workspace root. `v0-export/` remains reference material during implementation and is excluded from source control and release packaging.

## Manifest and permissions

The extension uses Manifest V3 with a single `action.default_popup` entry and no host permissions.

Required permissions are:

- `tabs` to read the URL, title, and favicon fields needed by the core product.
- `tabGroups` to read, create, title, colour, and manage Chrome tab groups.
- `storage` for local workspaces/preferences and session-scoped undo data.
- `clipboardWrite` for the extension's explicit copy actions.

The minimum Chrome version is 102 because the design uses `chrome.storage.session`. No `downloads`, `history`, `bookmarks`, `scripting`, `activeTab`, host, cookie, or browsing-data permission is included.

## Data boundaries

`chrome.storage.local` stores only:

- UI preferences: theme, default scope, default copy format.
- Workspaces: id, name, created/updated timestamps, and ordered tab descriptors containing URL, title, pinned state, and optional saved group title/colour.

`chrome.storage.session` stores the most recent reversible close operation so “Undo last close” remains available if closing the active tab dismisses the popup. It is cleared when the browser session ends.

Open tabs are queried when the popup opens and refreshed after each mutation. Popup-only UI state—search, filters, selection, collapsed window sections, open menus/dialogs—stays in React memory and is not persisted.

## Chrome API behavior

Tab identifiers, window identifiers, and group identifiers use Chrome's numeric IDs. Missing titles and URLs are represented safely rather than asserted as present.

Mutations call the relevant Chrome API and then refresh the affected tab data:

- Switch: `chrome.tabs.update(tabId, { active: true })` and focus the containing window.
- Close: `chrome.tabs.remove(tabIds)` after storing restorable descriptors in session storage.
- Pin/mute: `chrome.tabs.update` per tab with partial-failure reporting.
- Reload/discard: `chrome.tabs.reload` or `chrome.tabs.discard`; active and already-discarded tabs are excluded from discard.
- Move to window: create a normal window with the first selected tab, then move the remainder while preserving order.
- Sort: partition selected tabs by window and pinned state, then call `chrome.tabs.move` in deterministic order.
- Group: partition selections by window because a Chrome tab group belongs to one window; create/update one group per window/domain as required.
- Duplicates: compare exact URLs within the current selection; keep the pinned tab, then the active tab, then the earliest tab by default, while allowing the user to override each choice.
- Restore workspace/import: create a normal window from the first valid URL, add remaining URLs in order, then restore pin/group metadata where possible.

Failures are not converted into false success messages. Every bulk mutation returns succeeded and failed items so the UI can say, for example, “Pinned 7 tabs; 1 tab was no longer available.”

## Copy, export, and URL safety

Copy and export preserve the order shown in the UI.

- Clipboard success is reported only after `navigator.clipboard.writeText` resolves.
- CSV uses CRLF row endings, quotes fields according to CSV rules, and prefixes cells beginning with `=`, `+`, `-`, or `@` to prevent formula execution when opened in spreadsheet software.
- HTML escapes both visible titles and attribute values.
- Markdown escapes link-label punctuation and wraps URLs safely.
- Imported values accept `http://` and `https://`; `localhost` input is normalised to `http://localhost`. Blank and invalid lines are reported. Non-web schemes are rejected by import, while existing Chrome tabs with special schemes may still be copied/exported.
- Import opens the valid URLs in a new window. When the user supplies a workspace name, the same ordered URLs are also saved as a local workspace.
- The file-export path uses a local Blob and download link, so the `downloads` permission is unnecessary.

## Platform-aware shortcuts

Platform detection uses `chrome.runtime.getPlatformInfo()`, which does not require an additional permission.

- macOS displays `⌘` and uses `metaKey`; its destructive key label is `⌫`.
- Windows, Linux, and ChromeOS display `Ctrl` and use `ctrlKey`; their destructive key label is `Delete`.
- Shortcut handling ignores editable controls (`input`, `textarea`, `select`, and contenteditable elements), except that Escape may close a dialog or clear selection according to the active UI layer.
- Shortcut labels and handlers are generated from the same shortcut definitions so displayed keys cannot drift from implemented behavior.

Shortcuts are scoped to the open popup. They do not register global Chrome commands.

## UI preservation and reduction

Preserve the approved header, Tabs/Workspaces navigation, filter/sort toolbar, grouped tab rows, selection dock, dialogs, theme tokens, keyboard focus states, and reduced-motion behavior.

Change the outer shell to an actual fixed popup surface: 760×580 pixels, with no web-preview padding, outer canvas, or fake card shadow. Dialogs and popovers remain inside that viewport.

Remove from the product source or build:

- Next.js, `app/`, `next.config.mjs`, Next metadata, and Next font integration.
- Vercel Analytics and every analytics call.
- `next-themes`; replace it with a small local preference hook that applies the `dark` class.
- The `shadcn` CLI/runtime package and `@import 'shadcn/tailwind.css'` after copying only the required styles locally.
- Unused generated primitives, beginning with `badge.tsx` and `scroll-area.tsx`.
- Placeholder logos, user images, generic placeholder art, and the Apple web-app icon.
- All production mock tab/workspace data; minimal fixtures live only in tests.
- All `"use client"` directives.

Keep React, React DOM, Tailwind, Base UI primitives, Lucide's tree-shaken icon imports, `clsx`, `tailwind-merge`, and class-variance-authority for the first real build. Replace Sonner or Base UI only if bundle measurement shows a meaningful saving; accessibility and reliable focus management take priority over speculative byte reduction.

Self-host only the Latin font files needed by the UI. The first Vite build keeps Spline Sans and IBM Plex Mono to preserve the approved design. If the release bundle exceeds the size budget, switching to system UI and system monospace fonts is the first optional visual trade-off.

## Size and release budgets

Only `dist/` is packaged for Chrome; source code, dependencies, tests, `v0-export/`, and the original ZIP are excluded.

Acceptance budgets for the first release build are:

- No individual minified JavaScript chunk over 300 KB.
- Total unpacked `dist/` under 750 KB, excluding required PNG store icons.
- No remote runtime requests initiated by the extension UI.
- No source maps in the store package.

These are budgets, not reasons to replace accessible primitives prematurely. Each reduction is measured against a production Vite build.

## Testing and acceptance

Automated tests cover pure formatting/escaping, URL validation, filtering/sorting, duplicate selection, platform shortcut mapping, workspace serialisation, storage repositories, and Chrome adapter behavior using a mocked `chrome` object. Component tests cover selection, shortcut suppression in editable fields, dialog confirmation, and success/error feedback.

Manual unpacked-extension verification covers:

- Light/dark/system theme persistence.
- Correct modifier labels on macOS and Windows/Linux.
- Current-window and all-window queries.
- Copy/export formats and real downloaded files.
- Pin, mute, reload, discard, move, group, sort, close, and undo operations.
- Workspace save/rename/delete/restore and URL import.
- Popup dimensions at Chrome's default and 100% display scaling.
- Manifest permission warnings and absence of host access.
- Reloading the extension after closing or moving tabs without stale-selection errors.

## Out of scope

The first release does not include webpage content access, content scripts, history/bookmark/download management, accounts, cloud sync, analytics, global shortcuts, automatic background tab monitoring, scheduled cleanup, side-panel mode, Firefox support, or Edge-specific store packaging.
