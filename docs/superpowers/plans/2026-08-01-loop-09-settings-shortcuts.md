# Loop 09: Settings and Platform-Aware Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish persisted settings and provide popup-scoped keyboard shortcuts whose displayed labels always match the detected operating system and implemented handlers.

**Architecture:** One declarative shortcut registry contains command IDs and non-platform keys. Platform mapping generates both rendered keycaps and event matching; a focused hook routes matched commands to existing feature callbacks while respecting editable controls and active dialogs.

**Tech Stack:** React, TypeScript, Chrome runtime API, Base UI dialogs/selects/toggles, Vitest, Testing Library.

## Global Constraints

- Depends on Loops 04, 05, 06, 07, and 08 merged to `main`.
- Shortcuts work only while the popup has focus; do not add `commands` or a service worker.
- macOS uses `⌘`/`metaKey` and `⌫`; Windows, Linux, and ChromeOS use `Ctrl`/`ctrlKey` and `Delete`.
- Ignore `input`, `textarea`, `select`, and contenteditable targets except for layered Escape handling.
- Labels and handlers must be generated from the same definitions.

---

### Task 1: Detect and map the Chrome platform

**Files:**

- Create: `src/platform/platform.ts`
- Create: `src/platform/platform.test.ts`
- Modify: `src/chrome/browser-gateway.ts`

**Interfaces:**

- Produces: `PlatformFamily = 'mac' | 'non-mac'`, `getPlatformFamily()`, `modifierLabel()`, `destructiveKeyLabel()`, and gateway `getPlatformInfo()`.

- [ ] **Step 1: Write platform mapping tests**

```ts
expect(toPlatformFamily({ os: 'mac', arch: 'arm' })).toBe('mac')
expect(toPlatformFamily({ os: 'win', arch: 'x86-64' })).toBe('non-mac')
expect(toPlatformFamily({ os: 'cros', arch: 'x86-64' })).toBe('non-mac')
```

Include Linux and unknown/error fallback to `non-mac` so Windows/Linux labels never accidentally show Command.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/platform/platform.test.ts
```

- [ ] **Step 3: Implement through `chrome.runtime.getPlatformInfo()`**

No manifest permission is required. Cache the resolved family for the popup lifetime and expose loading-safe labels without sniffing `navigator.userAgent`.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/platform/platform.test.ts
git add src/platform/platform.ts src/platform/platform.test.ts src/chrome/browser-gateway.ts
git commit -m "feat: detect shortcut platform labels"
```

### Task 2: Define one shortcut registry and matcher

**Files:**

- Create: `src/features/shortcuts/shortcut-definitions.ts`
- Create: `src/features/shortcuts/shortcut-definitions.test.ts`
- Create: `src/features/shortcuts/match-shortcut.ts`
- Create: `src/features/shortcuts/match-shortcut.test.ts`

**Interfaces:**

- Produces: `ShortcutCommand`, `ShortcutDefinition`, `SHORTCUTS`, `keysForPlatform()`, and `matchShortcut(event, platform)`.

- [ ] **Step 1: Encode the complete registry**

```ts
export const SHORTCUTS = [
  { command: 'focus-search', key: 'k', action: 'Focus search' },
  { command: 'select-visible', key: 'a', action: 'Select all visible tabs' },
  { command: 'copy-selected', key: 'c', action: 'Copy selected tabs' },
  { command: 'export-selected', key: 'e', action: 'Export selected tabs' },
  { command: 'close-selected', key: 'Delete', action: 'Close selected tabs' },
  { command: 'undo-close', key: 'z', action: 'Undo last close' },
  { command: 'show-tabs', key: '1', action: 'Switch to Tabs' },
  { command: 'show-workspaces', key: '2', action: 'Switch to Workspaces' },
  { command: 'escape', key: 'Escape', action: 'Close or clear the active layer', modifier: false },
] as const satisfies readonly ShortcutDefinition[]
```

- [ ] **Step 2: Test labels and event matches from every definition**

Iterate the registry and assert mac/non-mac labels and matching events. The logical destructive key maps to `KeyboardEvent.key === 'Backspace'` on macOS and `'Delete'` elsewhere, while rendering `⌫` and `Delete` respectively. Assert Ctrl shortcuts do not match on macOS, Meta shortcuts do not match elsewhere, modified Escape does not match, and unrelated Alt/Shift combinations do not match.

- [ ] **Step 3: Confirm failure**

```bash
npm test -- src/features/shortcuts
```

- [ ] **Step 4: Implement editable-target detection**

Export `isEditableTarget(target)` covering input, textarea, select, and nearest `[contenteditable="true"]`. The matcher returns no command for editable targets except Escape.

- [ ] **Step 5: Run and commit**

```bash
npm test -- src/features/shortcuts
git add src/features/shortcuts
git commit -m "feat: define platform-aware shortcuts"
```

### Task 3: Route shortcuts through existing feature actions

**Files:**

- Create: `src/features/shortcuts/use-popup-shortcuts.ts`
- Create: `src/features/shortcuts/use-popup-shortcuts.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/features/tabs/TabsToolbar.tsx`
- Modify: `src/features/export/SelectionDock.tsx`

**Interfaces:**

- Consumes: callbacks for search focus, visible selection, copy, export, close, undo, view switching, and layered Escape.
- Produces: one popup-level `keydown` listener and no global Chrome commands.

- [ ] **Step 1: Test routing and prevention**

Dispatch each matching key event and assert exactly one callback plus `preventDefault()`. Assert commands requiring selection do nothing and do not prevent the browser default when selection is empty.

- [ ] **Step 2: Test Escape priority**

Escape closes the topmost dialog/menu first, otherwise clears selection, otherwise clears search, otherwise does nothing. It must not clear selection behind an open confirmation dialog.

- [ ] **Step 3: Confirm failure**

```bash
npm test -- src/features/shortcuts/use-popup-shortcuts.test.tsx
```

- [ ] **Step 4: Implement one stable listener**

Register once with current callbacks held in refs, remove on unmount, and guard against `event.repeat` for destructive/side-effecting commands. Copy/export/close route to the same functions used by visible buttons.

- [ ] **Step 5: Run and commit**

```bash
npm test -- src/features/shortcuts/use-popup-shortcuts.test.tsx
git add src/features/shortcuts src/App.tsx src/features/tabs/TabsToolbar.tsx src/features/export/SelectionDock.tsx
git commit -m "feat: handle popup keyboard shortcuts"
```

### Task 4: Finish Settings and Shortcuts dialogs

**Files:**

- Create: `src/features/settings/SettingsDialog.tsx`
- Create: `src/features/settings/ShortcutsDialog.tsx`
- Create: `src/features/settings/SettingsDialog.test.tsx`
- Create: `src/features/settings/ShortcutsDialog.test.tsx`
- Modify: `src/app/Header.tsx`

**Interfaces:**

- Consumes: Loop 01 settings provider, platform family, copy labels, and shortcut registry.
- Produces: theme/default-scope/default-copy controls, reset defaults, and generated shortcut reference.

- [ ] **Step 1: Test persisted settings**

Change theme, default scope, and copy format; assert the repository saves validated complete settings. Reset and assert exact defaults. Reopen and assert controls reflect persisted values.

- [ ] **Step 2: Test generated shortcut labels**

Render once with mac and once with Windows. Assert every registry action appears and keycaps show `⌘`/`⌫` versus `Ctrl`/`Delete`; no hard-coded `⌘` remains in component source.

- [ ] **Step 3: Confirm failure**

```bash
npm test -- src/features/settings
```

- [ ] **Step 4: Implement the approved dialogs**

Reset affects theme, scope, copy format, filters, and current view consistently, then persists only the settings fields. “Help & documentation” opens the public repository README with `chrome.tabs.create`; About displays the manifest version from `chrome.runtime.getManifest()` without fake navigation.

- [ ] **Step 5: Verify the loop**

```bash
npm run check
npm test
npm run build
```

Manually test every shortcut on macOS and at least one Windows/Linux/ChromeOS environment or a mocked platform build. Verify editable controls, IME composition, dialogs, repeat suppression, and preference persistence.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings src/app/Header.tsx
git commit -m "feat: add settings and shortcut reference"
```
