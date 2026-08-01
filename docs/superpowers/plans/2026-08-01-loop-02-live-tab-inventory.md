# Loop 02: Live Tab Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty shell with a real, refreshable inventory of tabs and groups from all normal Chrome windows.

**Architecture:** Domain records contain no `chrome.*` types. A single injected `BrowserGateway` maps Chrome objects into safe application records; a provider owns snapshot/loading/error state and UI components render window sections without calling Chrome directly.

**Tech Stack:** React, TypeScript, Chrome `windows`, `tabs`, and `tabGroups` APIs, Vitest, Testing Library.

## Global Constraints

- Depends on Loop 01 merged to `main`.
- Use numeric Chrome tab, window, and group identifiers.
- Treat missing titles, URLs, favicons, and tabs disappearing mid-operation as normal states.
- Query only normal browser windows and do not add permissions.
- Production data comes only from Chrome; fixtures remain in tests.

---

### Task 1: Define stable browser-domain contracts

**Files:**

- Create: `src/domain/browser.ts`
- Create: `src/domain/browser.test.ts`
- Create: `src/chrome/browser-gateway.ts`
- Create: `src/chrome/browser-context.tsx`

**Interfaces:**

- Produces: `TabRecord`, `TabGroupRecord`, `TabSnapshot`, `TabDescriptor`, `OperationFailure`, `BulkResult`, and the initial `BrowserGateway` methods `getSnapshot()` and `activateTab(tabId, windowId)`.

- [ ] **Step 1: Write the domain shape test**

```ts
const tab: TabRecord = {
  id: 12,
  windowId: 3,
  index: 1,
  title: 'Untitled tab',
  url: '',
  domain: '',
  pinned: false,
  muted: false,
  audible: false,
  active: true,
  discarded: false,
  groupId: null,
}
expect(tab.id).toBe(12)
```

Define `TabDescriptor` as the serialisable subset `{ url, title, pinned, group?: { title, color } }`; it is owned here so close undo and workspaces share one representation.

- [ ] **Step 2: Confirm the type/test failure**

```bash
npm test -- src/domain/browser.test.ts
```

- [ ] **Step 3: Implement the contracts and dependency context**

`BrowserGateway` begins as:

```ts
export interface BrowserGateway {
  getSnapshot(): Promise<TabSnapshot>
  activateTab(tabId: number, windowId: number): Promise<void>
}
```

`BrowserProvider` receives a gateway prop in tests and defaults to `createChromeBrowserGateway(chrome)` in the extension.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/domain/browser.test.ts
git add src/domain src/chrome/browser-context.tsx src/chrome/browser-gateway.ts
git commit -m "feat: define browser domain contracts"
```

### Task 2: Map Chrome tabs and groups safely

**Files:**

- Create: `src/chrome/tab-mapper.ts`
- Create: `src/chrome/tab-mapper.test.ts`
- Modify: `src/chrome/browser-gateway.ts`
- Create: `src/test/chrome-mocks.ts`

**Interfaces:**

- Consumes: `chrome.windows.getAll`, `chrome.windows.getCurrent`, `chrome.tabGroups.query`, `chrome.tabs.update`, and `chrome.windows.update`.
- Produces: a `TabSnapshot` with `{ tabs, groups, currentWindowId, capturedAt }`.

- [ ] **Step 1: Test absent and special-scheme values**

```ts
expect(mapChromeTab({ id: 4, windowId: 2, index: 0 })).toMatchObject({
  id: 4,
  title: 'Untitled tab',
  url: '',
  domain: '',
  groupId: null,
})
expect(
  mapChromeTab({
    id: 5,
    windowId: 2,
    index: 1,
    url: 'chrome://settings/',
  }),
).toMatchObject({ domain: 'chrome://settings' })
```

- [ ] **Step 2: Run the failing mapper test**

```bash
npm test -- src/chrome/tab-mapper.test.ts
```

- [ ] **Step 3: Implement snapshot mapping**

Call `windows.getAll({ populate: true, windowTypes: ['normal'] })`, `windows.getCurrent()`, and `tabGroups.query({})`. Ignore tabs without numeric `id` or `windowId`; never assert optional Chrome values. Map group `color` to Chrome's complete colour union and use an empty title when absent.

- [ ] **Step 4: Test activation ordering**

Mock and assert `tabs.update(tabId, { active: true })` resolves before `windows.update(windowId, { focused: true })`. Reject with the original Chrome error so the UI can report it.

- [ ] **Step 5: Run and commit**

```bash
npm test -- src/chrome
git add src/chrome src/test/chrome-mocks.ts
git commit -m "feat: read live Chrome tab snapshots"
```

### Task 3: Own refresh state in a focused provider

**Files:**

- Create: `src/features/tabs/tabs-provider.tsx`
- Create: `src/features/tabs/tabs-provider.test.tsx`
- Create: `src/features/tabs/use-tabs.ts`

**Interfaces:**

- Consumes: `BrowserGateway.getSnapshot()`.
- Produces: `useTabs()` returning `{ snapshot, status, error, refresh, activateTab }`, where status is `'loading' | 'ready' | 'error'`.

- [ ] **Step 1: Test load, manual refresh, and activation refresh**

Render the provider with a fake gateway. Resolve two different snapshots on consecutive calls, assert the first appears, invoke `refresh()`, and assert the second replaces it. Assert successful activation triggers a refresh; failed activation preserves the snapshot and exposes the failure.

- [ ] **Step 2: Confirm provider tests fail**

```bash
npm test -- src/features/tabs/tabs-provider.test.tsx
```

- [ ] **Step 3: Implement stale-request protection**

Use an incrementing request token so a slower earlier refresh cannot overwrite a newer one. Do not poll and do not add Chrome event listeners; popup opening and post-mutation refreshes are sufficient for this scope.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/tabs/tabs-provider.test.tsx
git add src/features/tabs
git commit -m "feat: manage live tab refresh state"
```

### Task 4: Render the inventory and activate rows

**Files:**

- Create: `src/features/tabs/TabsView.tsx`
- Create: `src/features/tabs/WindowSection.tsx`
- Create: `src/features/tabs/TabRow.tsx`
- Create: `src/features/tabs/TabFavicon.tsx`
- Create: `src/features/tabs/TabsView.test.tsx`
- Modify: `src/app/Header.tsx`
- Modify: `src/App.tsx`

**Interfaces:**

- Consumes: `useTabs()` and `TabRecord`/`TabGroupRecord`.
- Produces: stable row markup later loops enhance with selection/actions; each row uses `data-tab-id` and an explicit Activate button.

- [ ] **Step 1: Write the rendering test**

Provide two windows and three groups, then assert the header count, window headings, pinned/muted/audible badges, safe fallback favicon, group label, and active-tab marker. Click Activate and assert the exact tab/window IDs reach the gateway.

- [ ] **Step 2: Confirm it fails**

```bash
npm test -- src/features/tabs/TabsView.test.tsx
```

- [ ] **Step 3: Implement loading, error, empty, and ready states**

The error state includes a Retry button. Favicons use the Chrome-provided URL only; failed images fall back to the domain's first letter without fetching a replacement service. Window ordering is numeric and tab ordering is Chrome `index`.

- [ ] **Step 4: Verify the loop**

```bash
npm run check
npm test
npm run build
npm run verify:manifest
```

Load the unpacked extension with at least two normal windows. Confirm accurate counts, group names, special Chrome tabs rendering safely, activation, focus transfer, and refresh after a tab is closed outside the popup.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: render the live tab inventory"
```
