# Loop 06: Arrange, Group, and Deduplicate Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Physically reorganise selected browser tabs by window, order, group, and exact-URL duplicate policy.

**Architecture:** Pure planners convert an ordered selection into per-window Chrome commands. The gateway executes those commands sequentially where Chrome index changes matter, reports partial failures, and the existing Manage menu opens focused confirmation/choice dialogs.

**Tech Stack:** TypeScript, React, Chrome tabs/windows/tabGroups APIs, Base UI dialogs/menus, Vitest, Testing Library.

## Global Constraints

- Depends on Loop 05 merged to `main`.
- Preserve relative selection order when moving tabs.
- A Chrome tab group belongs to one window; partition every group command by window.
- Physical sort partitions by window and pinned state before calculating move indices.
- Duplicate detection uses exact URLs within the current selection only.

---

### Task 1: Move selected tabs into a new window

**Files:**

- Create: `src/features/organise/move-to-window.ts`
- Create: `src/features/organise/move-to-window.test.ts`
- Modify: `src/chrome/browser-gateway.ts`

**Interfaces:**

- Extends `BrowserGateway` with `createWindowWithTab(tabId)` and `moveTabs(tabIds, windowId, index)`.
- Produces: `moveSelectionToNewWindow(tabs, gateway): Promise<BulkResult>`.

- [ ] **Step 1: Test command order**

Given selected IDs `[8, 3, 11]`, assert the gateway creates a normal window with ID 8, then moves `[3, 11]` to index `-1` in that exact order. Assert a single selection creates the window but does not issue an empty move.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/organise/move-to-window.test.ts
```

- [ ] **Step 3: Implement and expose through Manage**

Use `chrome.windows.create({ tabId: first.id, type: 'normal', focused: true })`; require a numeric returned window ID before moving the remainder. Refresh after completion and preserve mixed-result feedback.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/organise/move-to-window.test.ts
git add src/features/organise src/chrome/browser-gateway.ts src/features/tabs/ManageTabsMenu.tsx
git commit -m "feat: move selected tabs to a window"
```

### Task 2: Physically sort selected tabs

**Files:**

- Create: `src/features/organise/sort-tabs.ts`
- Create: `src/features/organise/sort-tabs.test.ts`
- Modify: `src/chrome/browser-gateway.ts`
- Modify: `src/features/tabs/ManageTabsMenu.tsx`

**Interfaces:**

- Produces: `ArrangeSort = 'title' | 'domain'`, `planTabMoves(tabs, sort)`, and gateway `moveTab(tabId, windowId, index)`.

- [ ] **Step 1: Test pinned/window partitions**

Build a fixture containing pinned and unpinned selections in two windows. Assert the plan never crosses a window or pinned boundary, uses locale-aware case-insensitive title/domain comparison with original index as tie-breaker, and calculates target indices against the full window rather than the selection length.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/organise/sort-tabs.test.ts
```

- [ ] **Step 3: Implement sequential moves**

Execute moves in ascending target index per partition because each call changes later indices. Re-read the snapshot after a partition fails before continuing to the next partition.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/organise/sort-tabs.test.ts
git add src/features/organise src/chrome/browser-gateway.ts src/features/tabs/ManageTabsMenu.tsx
git commit -m "feat: arrange tabs by title or domain"
```

### Task 3: Add existing-group and group-by-domain operations

**Files:**

- Create: `src/features/organise/group-tabs.ts`
- Create: `src/features/organise/group-tabs.test.ts`
- Create: `src/features/organise/AddToGroupDialog.tsx`
- Create: `src/features/organise/AddToGroupDialog.test.tsx`
- Modify: `src/chrome/browser-gateway.ts`
- Modify: `src/features/tabs/ManageTabsMenu.tsx`

**Interfaces:**

- Extends `BrowserGateway` with `groupTabs(tabIds, groupId?)`, `updateGroup(groupId, { title, color })`, and `ungroupTabs(tabIds)`.
- Produces: `groupByDomain(tabs, gateway)` and `addToChosenGroup(tabs, target, gateway)`.

- [ ] **Step 1: Test per-window/domain grouping**

For two domains across two windows, assert four independent group calls. Use the display domain as the title, truncate it to Chrome's safe 80-character UI limit, and choose colours deterministically from `['blue', 'cyan', 'green', 'yellow', 'orange', 'red', 'pink', 'purple']` using the domain hash.

- [ ] **Step 2: Test existing-group constraints**

The dialog lists only groups from the selected tabs' windows. If selection spans windows, require one target per window or create a new same-named group per window; never pass tabs from another window to an existing group ID.

- [ ] **Step 3: Confirm failure**

```bash
npm test -- src/features/organise/group-tabs.test.ts src/features/organise/AddToGroupDialog.test.tsx
```

- [ ] **Step 4: Implement group commands and dialog**

Do not create a group for fewer than two tabs when grouping by domain; report it as skipped, not failed. After grouping, call `tabGroups.update()` with title and colour and refresh.

- [ ] **Step 5: Run and commit**

```bash
npm test -- src/features/organise/group-tabs.test.ts src/features/organise/AddToGroupDialog.test.tsx
git add src/features/organise src/chrome/browser-gateway.ts src/features/tabs/ManageTabsMenu.tsx
git commit -m "feat: organise tabs into Chrome groups"
```

### Task 4: Find and remove exact-URL duplicates

**Files:**

- Create: `src/features/organise/duplicate-plan.ts`
- Create: `src/features/organise/duplicate-plan.test.ts`
- Create: `src/features/organise/DuplicatesDialog.tsx`
- Create: `src/features/organise/DuplicatesDialog.test.tsx`
- Modify: `src/features/tabs/ManageTabsMenu.tsx`

**Interfaces:**

- Produces: `DuplicateSet { url, candidates, keepId }`, `findDuplicateSets(selectedTabs)`, and `chooseDefaultKeeper(candidates)`.
- Consumes: Loop 05 close service so removal remains undoable.

- [ ] **Step 1: Test keeper precedence**

```ts
expect(
  chooseDefaultKeeper([
    tab({ id: 1, pinned: false, active: true, index: 4 }),
    tab({ id: 2, pinned: true, active: false, index: 7 }),
    tab({ id: 3, pinned: false, active: false, index: 0 }),
  ]),
).toBe(2)
```

Then test active beats earliest when none is pinned, earliest index breaks the final tie, and two visually similar but non-identical URLs are not duplicates.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/organise/duplicate-plan.test.ts src/features/organise/DuplicatesDialog.test.tsx
```

- [ ] **Step 3: Implement overrideable confirmation**

Show one duplicate set at a time or a compact list within the popup, with a radio choice for which tab to keep. The confirmation states the exact number to close. Pass only non-keeper records to the close service and keep the dialog open on storage/removal failure.

- [ ] **Step 4: Verify the loop**

```bash
npm run check
npm test
npm run build
```

Manually verify cross-window moves, pinned/unpinned sorting, per-window groups, adding to existing groups, duplicate overrides, Undo, and behavior when a selected tab disappears during confirmation.

- [ ] **Step 5: Commit**

```bash
git add src/features/organise src/features/tabs/ManageTabsMenu.tsx
git commit -m "feat: remove selected duplicate tabs"
```
