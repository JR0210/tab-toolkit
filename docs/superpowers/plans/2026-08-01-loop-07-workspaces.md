# Loop 07: Workspace Storage and CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save real current-window tab descriptors locally and manage named workspaces through the approved Workspaces view.

**Architecture:** A schema-validating repository owns the single `workspaces` key in `chrome.storage.local`. A workspace provider exposes ordered CRUD operations; UI cards consume summaries derived from saved descriptors rather than storing duplicated counts or favicon stand-ins.

**Tech Stack:** React, TypeScript, Chrome storage API, Base UI dialogs/menus, Sonner, Vitest, Testing Library.

## Global Constraints

- Depends on Loop 03 merged to `main`.
- Store workspaces only in `chrome.storage.local`.
- A workspace stores ordered URL/title/pinned descriptors plus optional saved group title/colour.
- Do not store Chrome tab/window/group IDs; they are session-specific.
- Deleting and renaming must update storage before reporting success.

---

### Task 1: Define and validate workspace persistence

**Files:**

- Create: `src/features/workspaces/workspace.ts`
- Create: `src/features/workspaces/workspace-repository.ts`
- Create: `src/features/workspaces/workspace-repository.test.ts`

**Interfaces:**

- Consumes: `TabDescriptor` from Loop 02.
- Produces: `Workspace { id, name, createdAt, updatedAt, tabs }` and `WorkspaceRepository.list/put/delete/replaceAll`.
- Storage key: `workspaces`; timestamps are ISO-8601 strings and IDs come from `crypto.randomUUID()`.

- [ ] **Step 1: Write repository validation tests**

```ts
expect(
  validateWorkspace({
    id: 'abc',
    name: ' Research ',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    tabs: [{ url: 'https://example.com', title: 'Example', pinned: false }],
  }),
).toMatchObject({ name: 'Research' })
```

Reject records with empty names, invalid timestamps, non-array tabs, or unsafe/non-web restore URLs. Preserve valid records when siblings are malformed and expose the number skipped for diagnostics.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/workspaces/workspace-repository.test.ts
```

- [ ] **Step 3: Implement immutable writes**

Read once, replace by ID for `put`, sort descending by `updatedAt`, and call `storage.set({ workspaces })`. Limit names to 80 Unicode code points after trimming; reject a workspace with zero tabs.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/workspaces/workspace-repository.test.ts
git add src/features/workspaces
git commit -m "feat: persist local workspaces"
```

### Task 2: Convert live tabs into stable descriptors

**Files:**

- Create: `src/features/workspaces/workspace-mapper.ts`
- Create: `src/features/workspaces/workspace-mapper.test.ts`

**Interfaces:**

- Consumes: current-window `TabRecord[]` and `TabGroupRecord[]`.
- Produces: `tabsToDescriptors(tabs, groups): TabDescriptor[]` in Chrome index order.

- [ ] **Step 1: Test ordering and group metadata**

Assert Chrome IDs are omitted, pin state is preserved, tabs are ordered by index, and matching groups become `{ title, color }`. Ungrouped tabs omit `group`; missing/empty URLs are excluded and returned as skipped entries.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/workspaces/workspace-mapper.test.ts
```

- [ ] **Step 3: Implement the mapper**

Allow only `http:` and `https:` URLs in saved descriptors because workspaces must be restorable. Preserve title as display metadata but never use it as a navigation target.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/workspaces/workspace-mapper.test.ts
git add src/features/workspaces/workspace-mapper.ts src/features/workspaces/workspace-mapper.test.ts
git commit -m "feat: map open tabs to workspace records"
```

### Task 3: Add workspace state and CRUD behavior

**Files:**

- Create: `src/features/workspaces/workspaces-provider.tsx`
- Create: `src/features/workspaces/workspaces-provider.test.tsx`
- Create: `src/features/workspaces/use-workspaces.ts`

**Interfaces:**

- Produces: `useWorkspaces()` returning `{ workspaces, status, error, saveCurrentWindow, renameWorkspace, deleteWorkspace, undoDelete }`.
- Consumes: repository, current snapshot/window ID, mapper, refresh-safe toast feedback.

- [ ] **Step 1: Test CRUD persistence**

Save a two-tab current window and assert a complete workspace reaches `put`. Rename and assert `updatedAt` changes while `createdAt` and tabs remain. Delete and assert storage changes before UI removal; invoke Undo and assert the exact deleted record is restored.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/workspaces/workspaces-provider.test.tsx
```

- [ ] **Step 3: Implement one-level delete undo**

Keep the deleted record in React memory only; storage remains the authority. Saving with skipped non-web tabs reports `Saved N tabs; M tabs could not be restored and were omitted.` Fail saving when no restorable tabs remain.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/workspaces/workspaces-provider.test.tsx
git add src/features/workspaces
git commit -m "feat: manage local workspace records"
```

### Task 4: Build the Workspaces view

**Files:**

- Create: `src/features/workspaces/WorkspacesView.tsx`
- Create: `src/features/workspaces/WorkspaceCard.tsx`
- Create: `src/features/workspaces/WorkspaceCard.test.tsx`
- Create: `src/features/workspaces/relative-date.ts`
- Create: `src/features/workspaces/relative-date.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/app/Header.tsx`

**Interfaces:**

- Consumes: `useWorkspaces()` and the app's primary-view state.
- Produces: workspace empty/loading/error/grid states, save-current-window, rename, delete confirmation, and reserved Open/Import callbacks completed in Loop 08.

- [ ] **Step 1: Test cards and dialogs**

Assert cards derive tab count from `workspace.tabs.length`, show up to four safe favicon/domain initials, produce deterministic relative dates from an injected clock, validate rename input, and require confirmation before delete.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/workspaces/WorkspaceCard.test.tsx src/features/workspaces/relative-date.test.ts
```

- [ ] **Step 3: Implement without fake actions**

Until Loop 08, render Open workspace and Import URLs as disabled with accessible explanatory text, rather than showing mock-success toasts. Keep the approved two-column layout within the fixed popup; do not retain the web preview's three-column breakpoint.

- [ ] **Step 4: Verify the loop**

```bash
npm run check
npm test
npm run build
```

In Chrome, save a mixed grouped/pinned window, inspect `chrome.storage.local`, rename, delete, undo, restart Chrome, and confirm persisted workspaces return with no browser IDs stored.

- [ ] **Step 5: Commit**

```bash
git add src/features/workspaces src/App.tsx src/app/Header.tsx
git commit -m "feat: add workspace management UI"
```
