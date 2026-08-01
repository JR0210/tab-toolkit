# Loop 10: Release Hardening and Store Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the complete extension against its privacy, accessibility, correctness, and bundle budgets and produce a reproducible Chrome Web Store ZIP.

**Architecture:** Automated build inspectors enforce permissions, asset limits, source maps, and remote references. A written manual matrix covers browser-only behavior that unit/component tests cannot prove, and the release script packages only `dist/` contents.

**Tech Stack:** Vite+, Node.js scripts, Chrome extension developer mode, Vitest, Testing Library, GitHub Actions.

## Global Constraints

- Depends on Loop 09 and therefore every feature loop merged to `main`.
- Package only `dist/`; exclude source, tests, dependencies, local v0 references, and source maps.
- No minified JavaScript chunk may exceed 300 KB.
- Unpacked `dist/` must remain under 750 KB excluding required PNG store icons.
- The extension must initiate no remote runtime request.

---

### Task 1: Enforce release budgets in code

**Files:**

- Create: `scripts/verify-build.mjs`
- Create: `scripts/verify-build.test.mjs`
- Create: `scripts/remote-reference-allowlist.json`
- Modify: `package.json`
- Modify: `vite.config.ts`

**Interfaces:**

- Produces: `npm run verify:build` and exported pure helpers `listFiles`, `sumBudgetedBytes`, `findRemoteReferences`, and `assertBuild`.

- [ ] **Step 1: Test each failing budget**

Use temporary fixture directories to assert rejection for a 300001-byte JS file, aggregate size 750001, any `.map`, missing manifest/icons, and JS/CSS/HTML containing `http://`, `https://`, `//fonts.`, analytics imports, or remote dynamic-import URLs. Put the repository documentation URL and intentional import examples in `scripts/remote-reference-allowlist.json`; every entry includes the exact literal and the source feature that needs it.

- [ ] **Step 2: Confirm the verifier tests fail**

```bash
node --test scripts/verify-build.test.mjs
```

- [ ] **Step 3: Implement deterministic inspection**

Walk `dist/`, exclude `dist/icons/*.png` only from the aggregate budget, read text assets, and print measured total/chunk sizes on success. Configure the production build with `sourcemap: false`.

- [ ] **Step 4: Add the release verification script**

```json
{
  "scripts": {
    "verify:build": "node scripts/verify-build.mjs",
    "verify:release": "npm run check && npm test && npm run build && npm run verify:manifest && npm run verify:build"
  }
}
```

- [ ] **Step 5: Run and commit**

```bash
node --test scripts/verify-build.test.mjs
npm run verify:release
git add scripts package.json package-lock.json vite.config.ts
git commit -m "build: enforce extension release budgets"
```

### Task 2: Add integrated regression coverage

**Files:**

- Create: `src/test/tab-toolkit.integration.test.tsx`
- Create: `src/test/fixtures.ts`

**Interfaces:**

- Consumes: injected browser/storage/clipboard/download gateways and the complete app.
- Produces: a single user-level regression suite for the critical local flows.

- [ ] **Step 1: Write the integrated workflow test**

Render the app with two windows, search/select tabs, copy Markdown, export safe CSV, pin with one disappearing tab, close/undo, save a workspace, import mixed URLs, restore the workspace, and execute a platform shortcut. Assert each boundary receives exact IDs/records and every success/error message matches the gateway result.

- [ ] **Step 2: Run it and fix only genuine integration gaps**

```bash
npm test -- src/test/tab-toolkit.integration.test.tsx
```

Expected before fixes: FAIL only where separately passing feature contracts were wired inconsistently. Correct those connections without changing the approved feature behavior.

- [ ] **Step 3: Run the full automated gate**

```bash
npm run verify:release
```

- [ ] **Step 4: Commit**

```bash
git add src/test src
git commit -m "test: cover complete tab toolkit workflows"
```

### Task 3: Perform manual privacy, accessibility, and browser QA

**Files:**

- Create: `docs/release/manual-test-matrix.md`
- Create: `docs/privacy.md`
- Modify: `README.md`

**Interfaces:**

- Produces: a dated pass/fail matrix and store-ready privacy disclosure.

- [ ] **Step 1: Write the matrix before testing**

Include Chrome version/OS, light/dark/system, keyboard-only navigation, visible focus, reduced motion, screen-reader labels, 760×580 dimensions at 100% scaling, every query/copy/export/action/organise/workspace/import flow, partial failures, popup reopen after active-tab close/move, permissions warning text, and DevTools Console/Network inspection.

- [ ] **Step 2: Load a clean build**

```bash
npm run verify:release
```

Remove any earlier unpacked copy, load the new `dist/`, and run every matrix row. Record exact Chrome version, OS, result, and a short note; do not mark untested environments as passed.

- [ ] **Step 3: Verify privacy claims against artifacts**

Inspect `dist/manifest.json`, DevTools Network, built asset string scan, and `chrome.storage.local/session`. Document that browsing data remains local, what fields are stored, why each permission is required, and how uninstalling removes local data.

- [ ] **Step 4: Fix failures with regression tests**

For every reproducible defect, add a failing automated test where possible, implement the smallest correction, rerun that test, then rerun `npm run verify:release` and the affected manual rows.

- [ ] **Step 5: Commit**

```bash
git add docs README.md src
git commit -m "docs: verify release privacy and accessibility"
```

### Task 4: Create a reproducible store ZIP

**Files:**

- Create: `scripts/package-extension.ps1`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.gitignore`

**Interfaces:**

- Produces: `npm run package` and `release/tab-toolkit-<manifest-version>.zip` containing the contents of `dist/` at the ZIP root.

- [ ] **Step 1: Implement the packaging guard**

The script resolves `dist/` and `release/` beneath the repository root, runs `npm run verify:release`, reads the manifest version, removes only the exact same-version ZIP if present, and uses `Compress-Archive` on `dist/*`. It then lists the archive and fails if entries include a leading `dist/`, `.map`, source, tests, or `node_modules`.

- [ ] **Step 2: Add package and CI commands**

```json
{
  "scripts": {
    "package": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-extension.ps1"
  }
}
```

CI runs `npm run verify:release`; packaging remains an explicit release action so ordinary CI does not retain binary artifacts.

- [ ] **Step 3: Build and inspect the archive**

```bash
npm run package
```

Expected: one versioned ZIP under `release/`, with `manifest.json` and `index.html` at archive root and no unapproved files.

- [ ] **Step 4: Final verification and commit**

```bash
npm run verify:release
git status --short
git add scripts/package-extension.ps1 package.json package-lock.json .github/workflows/ci.yml .gitignore
git commit -m "build: package the Chrome Web Store release"
```
