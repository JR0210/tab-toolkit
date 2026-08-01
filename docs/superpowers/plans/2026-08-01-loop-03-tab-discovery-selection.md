# Loop 03: Tab Discovery and Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users narrow, order, collapse, and select the live tab inventory without mutating browser tab order.

**Architecture:** A pure query function derives visible window sections from the latest snapshot plus UI query state. Selection and collapsed-window IDs stay in React memory and are pruned whenever live tabs disappear.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing Base UI primitives.

## Global Constraints

- Depends on Loop 02 merged to `main`.
- Search, filters, display sort, selection, and collapse are popup-only state.
- Default scope comes from local settings; all other query state resets when the popup closes.
- Duplicate filtering compares exact URL strings within the active scope.
- Display sorting must never call `chrome.tabs.move`.

---

### Task 1: Build the pure query pipeline

**Files:**

- Create: `src/features/tabs/tab-query.ts`
- Create: `src/features/tabs/tab-query.test.ts`

**Interfaces:**

- Produces: `SortKey = 'position' | 'title' | 'domain'`, `Filters`, `TabQuery`, `WindowSectionRecord`, `EMPTY_FILTERS`, `countActiveFilters()`, and `queryTabs(snapshot, query)`.

- [ ] **Step 1: Write table-driven failing tests**

Cover current/all scope, case-insensitive title/URL/domain search, window/domain/group filters, pinned/audible/muted flags, exact-URL duplicates, stable title/domain sorts, and Chrome index ordering. Include this duplicate boundary:

```ts
expect(
  queryTabs(snapshot, {
    ...defaultQuery,
    filters: { ...EMPTY_FILTERS, duplicates: true },
  }).visibleTabs.map((tab) => tab.id),
).toEqual([2, 4])
```

IDs 2 and 4 share the exact URL inside the active scope; the same URL in an excluded window does not affect the result.

- [ ] **Step 2: Run the query tests and confirm failure**

```bash
npm test -- src/features/tabs/tab-query.test.ts
```

- [ ] **Step 3: Implement one deterministic pipeline**

Apply scope, build scoped URL counts, apply search/filters, stable-sort each window, and then group by window. Return `{ sections, visibleTabs, visibleIds, activeFilterCount }` so UI components do not repeat derivation.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/tabs/tab-query.test.ts
git add src/features/tabs/tab-query.ts src/features/tabs/tab-query.test.ts
git commit -m "feat: query and sort visible tabs"
```

### Task 2: Add resilient selection and collapse state

**Files:**

- Create: `src/features/tabs/tab-interaction-provider.tsx`
- Create: `src/features/tabs/tab-interaction-provider.test.tsx`
- Create: `src/features/tabs/use-tab-interactions.ts`

**Interfaces:**

- Consumes: the current `TabSnapshot` and default settings scope.
- Produces: `useTabInteractions()` with query setters, `selectedIds`, `selectedTabs`, `toggleSelected`, `setManySelected`, `clearSelection`, `collapsedWindowIds`, and `toggleWindowCollapsed`.

- [ ] **Step 1: Test selection pruning**

Select IDs 2 and 3, rerender with ID 2 removed from the snapshot, and expect only ID 3 to remain. Then change scope and assert hidden selected tabs remain selected until the user clears them, while “select all visible” affects visible IDs only.

- [ ] **Step 2: Confirm the provider tests fail**

```bash
npm test -- src/features/tabs/tab-interaction-provider.test.tsx
```

- [ ] **Step 3: Implement functional Set updates**

Never read selection immediately after queuing a React state update. Every row action that needs one tab receives that explicit ID; bulk actions receive an already-derived ordered `selectedTabs` array.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/tabs/tab-interaction-provider.test.tsx
git add src/features/tabs/tab-interaction-provider.tsx src/features/tabs/tab-interaction-provider.test.tsx src/features/tabs/use-tab-interactions.ts
git commit -m "feat: manage tab selection state"
```

### Task 3: Implement the toolbar and filter UI

**Files:**

- Create: `src/features/tabs/TabsToolbar.tsx`
- Create: `src/features/tabs/FilterPopover.tsx`
- Create: `src/features/tabs/TabsToolbar.test.tsx`
- Modify: `src/features/tabs/TabsView.tsx`
- Modify: `src/features/tabs/WindowSection.tsx`
- Modify: `src/features/tabs/TabRow.tsx`

**Interfaces:**

- Consumes: the query and interaction contracts.
- Produces: scope tabs, search, filter popover, display-sort menu, tri-state visible selection, row checkboxes, and collapsible window sections.

- [ ] **Step 1: Test the complete interaction path**

Type a domain fragment, enable Pinned, select all visible, clear search, and assert the selection count remains correct. Test indeterminate checkbox state and the no-results actions “Clear filters” and “Search all windows”.

- [ ] **Step 2: Confirm the component test fails**

```bash
npm test -- src/features/tabs/TabsToolbar.test.tsx
```

- [ ] **Step 3: Implement the approved controls**

Port only needed v0 controls. Build filter choices from the current scoped snapshot, sort labels as `Tab order`, `Title (A–Z)`, and `Domain (A–Z)`, display the active filter count, and keep window headings visible when expanded. Escape clears search only when invoked by that field's clear button; global Escape behavior belongs to Loop 09.

- [ ] **Step 4: Add accessible state assertions**

Assert `aria-selected` on scope controls, an accessible label for every checkbox, `aria-expanded` on window toggles, and keyboard operation for the popover/menu primitives.

- [ ] **Step 5: Verify the loop**

```bash
npm run check
npm test
npm run build
```

In the unpacked popup, exercise every filter across at least two windows, confirm selected hidden tabs are reported consistently, and reload the extension to confirm popup-only state resets.

- [ ] **Step 6: Commit**

```bash
git add src/features/tabs
git commit -m "feat: add tab discovery and selection controls"
```
