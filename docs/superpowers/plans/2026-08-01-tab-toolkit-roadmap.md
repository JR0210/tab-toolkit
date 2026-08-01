# Tab Toolkit Implementation Roadmap

**Source of truth:** `docs/superpowers/specs/2026-08-01-tab-toolkit-extension-design.md`

**Planning branch:** `plan/implementation-loops`

## Working model

Each loop ends with usable, testable software and a clean commit. Implement each loop on its own branch created from `main` after all listed dependencies have merged:

```bash
git switch main
git pull --ff-only
git switch -c feature/loop-NN-short-name
```

Do not start a loop merely because its document exists. Start it only when every dependency in the table is present on `main`. This avoids temporary mocks becoming production dependencies and prevents two loops from defining competing interfaces.

## Dependency graph

```text
01 Extension foundation
  └─ 02 Live tab inventory
       └─ 03 Search, filters, sorting, and selection
            ├─ 04 Copy and export
            │    └─ 05 Tab lifecycle actions
            │         └─ 06 Arrange, group, and deduplicate
            └─ 07 Workspace storage and CRUD
                  └──────────────┐
06 Arrange/group ────────────────┴─ 08 Import and workspace restore
04 Copy/export ─┐
05 Tab actions ─┼─ 09 Settings and platform-aware shortcuts
06 Organising ──┤
07 Workspaces ──┤
08 Restore ─────┘
                 └─ 10 Release hardening and store package
```

## Loop index

| Loop | Deliverable                                                                                       | Depends on             | Can run alongside                                  | Plan                                                       |
| ---- | ------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| 01   | MV3 package, test harness, local design system, popup shell, theme/settings foundation            | Current scaffold       | Nothing                                            | [Plan 01](./2026-08-01-loop-01-extension-foundation.md)    |
| 02   | Typed Chrome gateway, real tab/group snapshot, refresh, window sections, tab rows, tab activation | 01                     | Nothing                                            | [Plan 02](./2026-08-01-loop-02-live-tab-inventory.md)      |
| 03   | Current/all scope, search, filters, display sorting, selection, collapsed windows                 | 02                     | Nothing                                            | [Plan 03](./2026-08-01-loop-03-tab-discovery-selection.md) |
| 04   | Safe copy formats, clipboard feedback, CSV/JSON file export                                       | 03                     | 07                                                 | [Plan 04](./2026-08-01-loop-04-copy-export.md)             |
| 05   | Pin, mute, reload, discard, close, session-backed undo, partial-failure reporting                 | 04                     | 07                                                 | [Plan 05](./2026-08-01-loop-05-tab-lifecycle-actions.md)   |
| 06   | Move to window, physical sort, add/group by domain, exact-URL duplicate removal                   | 05                     | 07                                                 | [Plan 06](./2026-08-01-loop-06-organise-tabs.md)           |
| 07   | Local workspace repository, save/list/rename/delete UI                                            | 03                     | 04, 05, and 06 when their own dependencies are met | [Plan 07](./2026-08-01-loop-07-workspaces.md)              |
| 08   | Safe URL import, new-window creation, workspace restore with pin/group metadata                   | 06 and 07              | Nothing                                            | [Plan 08](./2026-08-01-loop-08-import-restore.md)          |
| 09   | Settings UI, persisted defaults, generated platform labels, popup keyboard handlers               | 04, 05, 06, 07, and 08 | Nothing                                            | [Plan 09](./2026-08-01-loop-09-settings-shortcuts.md)      |
| 10   | Integrated accessibility/privacy QA, bundle budgets, release ZIP and store documentation          | 09                     | Nothing                                            | [Plan 10](./2026-08-01-loop-10-release-hardening.md)       |

## Stable interface ownership

| Interface                                                     | First defined in | Later consumers |
| ------------------------------------------------------------- | ---------------- | --------------- |
| `TabRecord`, `TabGroupRecord`, `TabSnapshot`, `TabDescriptor` | 02               | 03–08           |
| `BrowserGateway` query/activation contract                    | 02               | 03, 05, 06, 08  |
| `Scope`, `CopyFormat`, `Settings`, `SettingsRepository`       | 01               | 03, 04, 09      |
| `TabQuery`, `Filters`, `SortKey`, `useTabInteractions()`      | 03               | 04–06, 09       |
| `ExportField`, format serializers, `ClipboardGateway`         | 04               | 09              |
| `BulkResult`, close snapshot, `restoreDescriptors()`          | 05               | 06, 08, 09      |
| Arrangement planners and group commands                       | 06               | 08, 09          |
| `Workspace`, `WorkspaceRepository`                            | 07               | 08, 09          |
| `restoreIntoNewWindow()`                                      | 08               | 09              |
| `ShortcutDefinition`, `PlatformFamily`                        | 09               | 10              |

Later loops extend an owning interface only where their plan says so. They must not introduce a second tab model, storage wrapper, toast abstraction, or Chrome API access path.

## Gate applied to every loop

Before merging a loop:

```bash
npm run check
npm test
npm run build
```

The reviewer also loads `dist/` as an unpacked extension for the loop's manual checks. A passing web preview is not evidence that Chrome permissions or APIs work.

## Final acceptance

The completed graph must satisfy all of the following:

- Manifest V3, minimum Chrome 102, and only `tabs`, `tabGroups`, `storage`, and `clipboardWrite` permissions.
- No content scripts, host permissions, backend, telemetry, analytics, remote code, or remote runtime requests.
- Fixed 760×580 popup with light, dark, and system themes.
- No individual minified JavaScript chunk over 300 KB; unpacked `dist/` under 750 KB excluding required PNG store icons.
- Copy/export order matches the visible UI and downloaded CSV is formula-safe with CRLF rows.
- Every bulk mutation reports successes and failures honestly and refreshes browser state.
- Workspaces/preferences remain local; close undo remains session-only.
- Shortcut labels and handlers come from the same platform-aware definitions.
