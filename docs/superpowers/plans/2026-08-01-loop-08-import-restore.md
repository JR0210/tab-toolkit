# Loop 08: URL Import and Workspace Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open newline-separated web URLs and saved workspaces in new normal windows while restoring order, pin state, and group metadata where Chrome permits it.

**Architecture:** A pure parser yields valid normalized URLs plus line-specific errors. A restore service creates the target window/tabs first, then applies pin and per-title/colour group metadata; import optionally persists the same descriptors as a workspace after opening them.

**Tech Stack:** TypeScript, React, Chrome windows/tabs/tabGroups APIs, Base UI dialog, Sonner, Vitest, Testing Library.

## Global Constraints

- Depends on Loops 06 and 07 merged to `main`.
- Accept only `http://` and `https://`; normalize `localhost` inputs to `http://localhost`.
- Reject blank-free invalid lines and every non-web scheme without navigating to them.
- Import always opens valid URLs in a new normal window.
- If a workspace name is supplied, also save the same ordered URLs locally.

---

### Task 1: Parse and report imported URLs

**Files:**

- Create: `src/features/import/parse-urls.ts`
- Create: `src/features/import/parse-urls.test.ts`

**Interfaces:**

- Produces: `ParsedUrl { line, input, url }`, `UrlParseIssue { line, input, reason }`, and `parseUrlLines(text): { valid, invalid }`.

- [ ] **Step 1: Write the URL safety matrix**

```ts
expect(
  parseUrlLines(`
https://example.com/a
localhost:5173/path
javascript:alert(1)
not a url
`),
).toEqual({
  valid: [
    { line: 2, input: 'https://example.com/a', url: 'https://example.com/a' },
    { line: 3, input: 'localhost:5173/path', url: 'http://localhost:5173/path' },
  ],
  invalid: [
    { line: 4, input: 'javascript:alert(1)', reason: 'Only HTTP and HTTPS URLs are supported' },
    { line: 5, input: 'not a url', reason: 'Invalid URL' },
  ],
})
```

Also cover `127.0.0.1` only when a scheme is supplied, credentials, ports, Unicode domains, fragments, whitespace, blank lines, `file:`, `chrome:`, and malformed schemes.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/import/parse-urls.test.ts
```

- [ ] **Step 3: Implement with `URL`, not a permissive regex**

Trim each non-blank line, prepend `http://` only for `localhost` with optional port/path, construct `new URL`, and then check the normalized protocol. Preserve the user's URL order.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/import/parse-urls.test.ts
git add src/features/import
git commit -m "feat: validate imported web URLs"
```

### Task 2: Restore descriptors into a new window

**Files:**

- Create: `src/features/restore/restore-window.ts`
- Create: `src/features/restore/restore-window.test.ts`
- Modify: `src/features/tabs/restore-descriptors.ts`
- Modify: `src/chrome/browser-gateway.ts`

**Interfaces:**

- Produces: `RestoreResult { windowId?: number, created: Array<{ descriptorIndex, tabId }>, failed: Array<{ descriptorIndex, message }> }` and `restoreIntoNewWindow(descriptors, gateway)`.
- Consumes: Loop 05 creation helpers and Loop 06 grouping helpers.

- [ ] **Step 1: Test the orchestration order**

Assert the first URL is passed to `windows.create({ url, type: 'normal', focused: true })`, remaining URLs are created inactive in descriptor order, pinned state is applied after creation, and groups are partitioned by the exact `{ title, color }` pair.

- [ ] **Step 2: Test partial creation**

When descriptor 2 fails, descriptors 3 and 4 are still attempted, successful records keep their original descriptor indices, pin/group commands receive only created tab IDs, and the result names the failed index.

- [ ] **Step 3: Confirm failure**

```bash
npm test -- src/features/restore/restore-window.test.ts
```

- [ ] **Step 4: Implement one shared restore primitive**

Refactor close undo to use shared low-level helpers without changing its original-window behavior. Workspace/import always call `restoreIntoNewWindow`. If the first creation fails, stop because no target window exists; otherwise continue remaining descriptors and report partial failures.

- [ ] **Step 5: Run and commit**

```bash
npm test -- src/features/restore/restore-window.test.ts src/features/tabs/restore-descriptors.test.ts
git add src/features/restore src/features/tabs/restore-descriptors.ts src/chrome/browser-gateway.ts
git commit -m "feat: restore tab descriptors into windows"
```

### Task 3: Build the import dialog and operation

**Files:**

- Create: `src/features/import/import-service.ts`
- Create: `src/features/import/import-service.test.ts`
- Create: `src/features/import/ImportDialog.tsx`
- Create: `src/features/import/ImportDialog.test.tsx`
- Modify: `src/features/workspaces/WorkspacesView.tsx`

**Interfaces:**

- Consumes: parser, `restoreIntoNewWindow`, and `WorkspaceRepository`.
- Produces: `importUrls({ text, workspaceName? }): Promise<ImportResult>`.

- [ ] **Step 1: Test open-only and open-plus-save paths**

Without a name, assert restore runs and no workspace is written. With `Reading list`, assert restore runs first and a workspace with normalized ordered URLs is then stored. If restore partially succeeds, save all valid requested URLs and report both the opened and saved counts explicitly.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/import/import-service.test.ts src/features/import/ImportDialog.test.tsx
```

- [ ] **Step 3: Implement the dialog**

Show live valid/invalid counts, the first four normalized URLs, line-level invalid details in an expandable region, and optional workspace name. Disable Import with zero valid URLs or an invalid name. Keep input on failure so the user can retry.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/import
git add src/features/import src/features/workspaces/WorkspacesView.tsx
git commit -m "feat: import URLs into a new window"
```

### Task 4: Open saved workspaces

**Files:**

- Create: `src/features/workspaces/open-workspace.ts`
- Create: `src/features/workspaces/open-workspace.test.ts`
- Modify: `src/features/workspaces/WorkspaceCard.tsx`
- Modify: `src/features/workspaces/WorkspacesView.tsx`

**Interfaces:**

- Consumes: a complete `Workspace` and `restoreIntoNewWindow`.
- Produces: enabled Open all/Open workspace actions with mixed-result feedback.

- [ ] **Step 1: Test exact descriptor forwarding**

Assert opening passes every saved descriptor in stored order without rewriting URLs/titles and that double-clicking while pending invokes restore only once.

- [ ] **Step 2: Confirm failure**

```bash
npm test -- src/features/workspaces/open-workspace.test.ts
```

- [ ] **Step 3: Implement and refresh**

Disable the card's open actions while pending. On completion refresh the live tab snapshot; report `Opened N tabs from “Name”; M could not be opened.` when partial.

- [ ] **Step 4: Verify the loop**

```bash
npm run check
npm test
npm run build
```

Manually import mixed input, test localhost normalization and rejected schemes, inspect saved workspace storage, and restore grouped/pinned tabs into a new normal window in the expected order.

- [ ] **Step 5: Commit**

```bash
git add src/features/workspaces
git commit -m "feat: restore saved workspaces"
```
