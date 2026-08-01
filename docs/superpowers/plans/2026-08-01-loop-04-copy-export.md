# Loop 04: Copy and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy selected tabs in six safe formats and export chosen fields to real local CSV or JSON files.

**Architecture:** Pure serializers accept ordered application records and never touch the browser. Thin injected clipboard and file-download gateways perform side effects; the selection dock and export dialog report success only after those effects resolve.

**Tech Stack:** TypeScript, React, Clipboard API, Blob/Object URL APIs, Sonner, Vitest, Testing Library.

## Global Constraints

- Depends on Loop 03 merged to `main`.
- Preserve the order shown in the UI.
- Copy formats: URL-only, title and URL, Markdown, HTML, CSV, and JSON.
- CSV uses CRLF rows, correct quoting, and formula-injection protection for cells beginning with `=`, `+`, `-`, or `@`.
- File export uses Blob and an in-popup anchor; do not add the `downloads` permission.

---

### Task 1: Implement safe serializers

**Files:**

- Create: `src/features/export/copy-format.ts`
- Create: `src/features/export/copy-format.test.ts`
- Create: `src/features/export/export-format.ts`
- Create: `src/features/export/export-format.test.ts`

**Interfaces:**

- Consumes: ordered `TabRecord[]` and `TabGroupRecord[]`.
- Consumes: `CopyFormat` from the Loop 01 settings contract.
- Produces: `ExportField`, `formatTabsForClipboard()`, `buildExportRows()`, `serializeCsv()`, and `serializeJson()`.

- [ ] **Step 1: Write escaping and injection tests**

```ts
expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"')
expect(serializeCsv([{ title: 'A\nB', url: 'https://x.test' }], ['title', 'url'])).toBe(
  'title,url\r\n"A\nB",https://x.test',
)
expect(formatTabsForClipboard([dangerousTab], 'html')).toBe(
  '<a href="https://example.test/?x=&quot;y&quot;">A &amp; B &lt;C&gt;</a>',
)
```

Also test Markdown label escaping, URLs containing parentheses, missing titles/URLs, booleans, group names, and JSON field order.

- [ ] **Step 2: Confirm the serializer tests fail**

```bash
npm test -- src/features/export/copy-format.test.ts src/features/export/export-format.test.ts
```

- [ ] **Step 3: Implement explicit escaping functions**

Neutralise formula prefixes before CSV quoting. Escape HTML text and attributes separately. Markdown output must escape `\\`, `[`, and `]` in labels and use an angle-bracket destination when needed. Do not sanitize or reject existing special-scheme tabs; they may be copied/exported.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/export
git add src/features/export
git commit -m "feat: serialize tabs for safe export"
```

### Task 2: Add clipboard and file gateways

**Files:**

- Create: `src/platform/clipboard-gateway.ts`
- Create: `src/platform/download-gateway.ts`
- Create: `src/platform/download-gateway.test.ts`

**Interfaces:**

- Produces: `ClipboardGateway.writeText(text): Promise<void>` and `DownloadGateway.download({ filename, mimeType, contents }): void`.

- [ ] **Step 1: Test URL lifecycle and filename safety**

Assert the download gateway creates one Blob, clicks an anchor with a `tab-toolkit-YYYY-MM-DD.csv` or `.json` filename, removes it, and calls `URL.revokeObjectURL()` in a `finally` block.

- [ ] **Step 2: Confirm the gateway test fails**

```bash
npm test -- src/platform/download-gateway.test.ts
```

- [ ] **Step 3: Implement the thin gateways**

The clipboard gateway returns `navigator.clipboard.writeText(text)` without swallowing rejection. The download gateway is synchronous from the UI's perspective but guarantees DOM/Object URL cleanup.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/platform/download-gateway.test.ts
git add src/platform
git commit -m "feat: add local clipboard and download gateways"
```

### Task 3: Build the selection dock copy flow

**Files:**

- Create: `src/features/export/SelectionDock.tsx`
- Create: `src/features/export/SelectionDock.test.tsx`
- Modify: `src/features/tabs/TabsView.tsx`

**Interfaces:**

- Consumes: ordered `selectedTabs`, `useSettings().copyFormat`, serializer, and `ClipboardGateway`.
- Produces: primary Copy action, copy-format split menu, clear-selection action, and slots for later Export/Manage/Close actions.

- [ ] **Step 1: Test success and rejection**

Click Copy with two selected tabs and assert the exact string passed to the gateway. Keep its promise pending and assert no success toast; resolve and assert success. Reject and assert an error toast whose message does not claim content was copied.

- [ ] **Step 2: Test the stale-selection regression**

Invoke a row-level “Copy title and URL” callback with explicit tab ID 8 while IDs 2 and 3 are selected; assert only tab 8 is copied.

- [ ] **Step 3: Implement the dock**

Keep the approved visual hierarchy. Choosing a format updates the saved default and copies in the same call using that chosen format value, not state read after `setCopyFormat()`.

- [ ] **Step 4: Run and commit**

```bash
npm test -- src/features/export/SelectionDock.test.tsx
git add src/features/export src/features/tabs/TabsView.tsx
git commit -m "feat: copy selected tabs"
```

### Task 4: Build CSV/JSON file export

**Files:**

- Create: `src/features/export/ExportDialog.tsx`
- Create: `src/features/export/ExportDialog.test.tsx`
- Modify: `src/features/export/SelectionDock.tsx`

**Interfaces:**

- Consumes: selected tabs, groups, serializers, and `DownloadGateway`.
- Produces: format choice and selectable fields `title`, `url`, `domain`, `window`, `group`, `position`, and `pinned`.

- [ ] **Step 1: Test field selection and download**

Open the dialog, deselect Domain, select CSV, export, and assert filename, MIME type `text/csv;charset=utf-8`, header order, CRLF rows, and selected-tab order. Assert export is disabled when no fields remain.

- [ ] **Step 2: Confirm the dialog test fails**

```bash
npm test -- src/features/export/ExportDialog.test.tsx
```

- [ ] **Step 3: Implement the dialog and feedback**

Default fields are title, URL, domain, window, group, position, and pinned. JSON uses `application/json;charset=utf-8`. Close only after the gateway returns; retain the dialog and show an error toast if Blob/DOM creation throws.

- [ ] **Step 4: Verify the loop**

```bash
npm run check
npm test
npm run build
```

Manually copy every format, paste into plain text, open the CSV in spreadsheet software, inspect the JSON, and confirm failed clipboard permission does not produce a success toast.

- [ ] **Step 5: Commit**

```bash
git add src/features/export
git commit -m "feat: export selected tabs to files"
```
