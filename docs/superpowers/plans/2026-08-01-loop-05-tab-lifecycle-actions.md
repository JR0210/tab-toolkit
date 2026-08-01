# Loop 05: Tab Lifecycle Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply common tab-state changes, close tabs safely, and restore the most recent close from session storage with honest partial-failure feedback.

**Architecture:** The Chrome gateway exposes small mutation methods that return a shared `BulkResult`. A lifecycle service records serialisable close descriptors before removal, orchestrates undo, and refreshes the live snapshot after every mutation.

**Tech Stack:** TypeScript, React, Chrome tabs/windows/storage APIs, Sonner, Vitest, Testing Library.

## Global Constraints

- Depends on Loop 04 merged to `main`; its selection dock is extended by this loop.
- All mutations operate on explicit ordered tab records, never stale selected IDs.
- Refresh after each mutation, including partial failure.
- Exclude active and already-discarded tabs from discard.
- Store only the latest close under `chrome.storage.session`; it expires with the browser session.

---

### Task 1: Extend the gateway with honest bulk operations

**Files:**

- Modify: `src/chrome/browser-gateway.ts`
- Create: `src/chrome/browser-mutations.test.ts`
- Create: `src/features/tabs/bulk-result.ts`
- Create: `src/features/tabs/bulk-result.test.ts`

**Interfaces:**

- Extends `BrowserGateway` with `setPinned`, `setMuted`, `reloadTabs`, `discardTabs`, and `removeTabs`.
- Produces: `runBulk(ids, operation): Promise<BulkResult>` and `summarizeBulk(result, verb)`.

- [ ] **Step 1: Test mixed success**

```ts
const result = await runBulk([1, 2, 3], async (id) => {
  if (id === 2) throw new Error('No tab with id: 2')
})
expect(result).toEqual({
  succeeded: [1, 3],
  failed: [{ id: 2, message: 'No tab with id: 2' }],
})
```

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/tabs/bulk-result.test.ts src/chrome/browser-mutations.test.ts
```

- [ ] **Step 3: Implement per-tab operations**

Use `chrome.tabs.update(id, { pinned })`, `chrome.tabs.update(id, { muted })`, `chrome.tabs.reload(id)`, and `chrome.tabs.discard(id)`. Use one `chrome.tabs.remove(ids)` call only when close is requested; if it rejects, retry per tab to produce accurate failures.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/tabs/bulk-result.test.ts src/chrome/browser-mutations.test.ts
git add src/chrome/browser-gateway.ts src/chrome/browser-mutations.test.ts src/features/tabs/bulk-result.ts src/features/tabs/bulk-result.test.ts
git commit -m "feat: add typed tab lifecycle mutations"
```

### Task 2: Implement session-backed close and undo

**Files:**

- Create: `src/features/tabs/close-repository.ts`
- Create: `src/features/tabs/close-repository.test.ts`
- Create: `src/features/tabs/restore-descriptors.ts`
- Create: `src/features/tabs/restore-descriptors.test.ts`
- Create: `src/features/tabs/tab-lifecycle-service.ts`
- Create: `src/features/tabs/tab-lifecycle-service.test.ts`

**Interfaces:**

- Produces: `CloseSnapshot { closedAt, tabs: Array<TabDescriptor & { windowId, index }> }`, `CloseRepository.load/save/clear`, and `restoreDescriptors(snapshot, gateway)`.
- Extends `BrowserGateway` with `windowExists`, `createWindow`, `createTab`, and `groupCreatedTabs` needed by undo and later workspace restore.

- [ ] **Step 1: Test write-before-remove ordering**

Resolve the repository save, then remove. Assert removal is never called if session storage fails; this preserves the promise that a close advertised as undoable actually has recovery data.

- [ ] **Step 2: Test restoration rules**

Restore into the original normal window when it still exists, at saved indices in ascending order. If it no longer exists, create one normal window with the first safe URL and create remaining tabs in order. Restore pinned state after creation and group metadata after all tabs exist.

- [ ] **Step 3: Confirm service tests fail**

```bash
npm test -- src/features/tabs/close-repository.test.ts src/features/tabs/restore-descriptors.test.ts src/features/tabs/tab-lifecycle-service.test.ts
```

- [ ] **Step 4: Implement storage validation and orchestration**

Use session key `lastClosedTabs`. Validate every loaded descriptor and reject empty/non-web URLs for recreation while reporting them as failures. Clear the snapshot only after all possible restores have been attempted; return a `BulkResult` so partial restore is visible.

- [ ] **Step 5: Run and commit**

```bash
npm test -- src/features/tabs/close-repository.test.ts src/features/tabs/restore-descriptors.test.ts src/features/tabs/tab-lifecycle-service.test.ts
git add src/features/tabs src/chrome/browser-gateway.ts
git commit -m "feat: close and restore tabs safely"
```

### Task 3: Connect lifecycle actions to the popup

**Files:**

- Create: `src/features/tabs/TabActionsMenu.tsx`
- Create: `src/features/tabs/TabActionsMenu.test.tsx`
- Create: `src/features/tabs/ManageTabsMenu.tsx`
- Create: `src/features/tabs/ManageTabsMenu.test.tsx`
- Modify: `src/features/tabs/TabRow.tsx`
- Modify: `src/features/export/SelectionDock.tsx`
- Modify: `src/features/tabs/tabs-provider.tsx`

**Interfaces:**

- Consumes: lifecycle service, ordered selection, refresh, and Sonner.
- Produces: row and bulk actions for pin/unpin, mute/unmute, reload, discard, close, and Undo.

- [ ] **Step 1: Test exclusion and feedback**

Select an active tab, a discarded tab, and a normal tab. Trigger Discard and assert only the normal tab reaches the gateway. Return one success and one failure from Pin and assert the UI says `Pinned 1 tab; 1 tab was no longer available.`

- [ ] **Step 2: Test close/undo UI**

Assert close records and removes, clears only successfully removed selections, refreshes, and renders a toast Undo action. Click Undo and assert restore runs once, refreshes, and the action becomes unavailable.

- [ ] **Step 3: Confirm component tests fail**

```bash
npm test -- src/features/tabs/TabActionsMenu.test.tsx src/features/tabs/ManageTabsMenu.test.tsx
```

- [ ] **Step 4: Implement actions with an in-flight guard**

Disable the invoked action while pending. Keep menus/dialogs usable after failure. Show success only for `succeeded.length`; show an error or mixed-result toast when failures exist. Never optimistically edit tab records.

- [ ] **Step 5: Verify the loop**

```bash
npm run check
npm test
npm run build
```

In Chrome, test each action against active, pinned, audible, discarded, and rapidly closed tabs. Close the active popup tab, reopen the popup, and confirm Undo is still offered from session storage.

- [ ] **Step 6: Commit**

```bash
git add src/features src/chrome
git commit -m "feat: manage tab lifecycle actions"
```
