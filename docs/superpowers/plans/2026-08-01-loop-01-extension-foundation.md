# Loop 01: Extension Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a loadable Manifest V3 popup with the approved local design system, accessible primitives, test harness, and persisted theme/settings foundation.

**Architecture:** Vite+ builds a single React popup from `index.html`; static extension metadata and icons live in `public/` and are copied to `dist/`. Shared UI primitives wrap Base UI, while settings are read through a typed `chrome.storage.local` repository that can be replaced in tests.

**Tech Stack:** React 19.2, TypeScript 6, Vite+ 0.2, Tailwind CSS 4, Base UI, Sonner, Lucide React, Vitest, Testing Library, Chrome MV3.

## Global Constraints

- Use Manifest V3 with `minimum_chrome_version` set to `102`.
- Request only `tabs`, `tabGroups`, `storage`, and `clipboardWrite`; add no host permissions.
- The popup surface is exactly 760×580 CSS pixels.
- No remote code, runtime network request, analytics, service worker, content script, database, or source map in the store build.
- Keep production source free of mock tab and workspace records.

---

### Task 1: Install the UI and test foundation

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`

**Interfaces:**

- Consumes: the existing `vp` scripts.
- Produces: a `jsdom` Vitest environment, `@testing-library/jest-dom` matchers, and Tailwind's Vite plugin.

- [ ] **Step 1: Add the dependencies used by the approved UI**

```bash
npm install @base-ui/react@^1.5.0 class-variance-authority@^0.7.1 clsx@^2.1.1 lucide-react@^1.16.0 sonner@^2.0.7 tailwind-merge@^3.3.1 tw-animate-css@^1.4.0
npm install --save-dev @tailwindcss/vite@^4.3.3 tailwindcss@^4.3.3 @types/chrome @testing-library/jest-dom @testing-library/react @testing-library/user-event jsdom
```

- [ ] **Step 2: Write the failing smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

it('renders the extension identity and primary navigation', () => {
  render(<App />)
  expect(screen.getByText('Tab Toolkit')).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Primary views' })).toBeVisible()
})
```

- [ ] **Step 3: Run the smoke test and confirm the missing setup/UI failure**

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because the jest-dom setup and final navigation shell do not exist.

- [ ] **Step 4: Configure the test and CSS plugins**

Add `tailwindcss()` to the lazy Vite plugins, set `test.environment` to `jsdom`, and set `test.setupFiles` to `['./src/test/setup.ts']`. In the setup file import `@testing-library/jest-dom/vitest`.

- [ ] **Step 5: Commit the toolchain slice**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/App.test.tsx
git commit -m "build: add extension UI test foundation"
```

### Task 2: Package a minimal MV3 extension

**Files:**

- Create: `public/manifest.json`
- Create: `public/icons/icon-16.png`
- Create: `public/icons/icon-32.png`
- Create: `public/icons/icon-48.png`
- Create: `public/icons/icon-128.png`
- Create: `assets/extension-icon.svg`
- Create: `scripts/generate-icons.mjs`
- Modify: `index.html`
- Modify: `.gitignore`
- Create: `scripts/verify-manifest.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: Vite's `public/` copy behavior.
- Produces: `dist/manifest.json`, the four extension icons, and `npm run verify:manifest`.

- [ ] **Step 1: Write the manifest verifier first**

The verifier reads `dist/manifest.json`, asserts `manifest_version === 3`, `minimum_chrome_version === '102'`, `action.default_popup === 'index.html'`, the exact sorted permission set, and absence of `host_permissions`, `background`, and `content_scripts`. Exit non-zero with a specific assertion message on failure.

- [ ] **Step 2: Run it before the manifest exists**

```bash
npm run build
node scripts/verify-manifest.mjs
```

Expected: FAIL because `dist/manifest.json` is absent.

- [ ] **Step 3: Add the exact manifest and reproducible icon source**

```json
{
  "manifest_version": 3,
  "name": "Tab Toolkit",
  "version": "0.1.0",
  "description": "Copy, export, organise, and restore browser tabs locally.",
  "minimum_chrome_version": "102",
  "permissions": ["tabs", "tabGroups", "storage", "clipboardWrite"],
  "action": {
    "default_title": "Tab Toolkit",
    "default_popup": "index.html"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Copy the approved mark paths into `assets/extension-icon.svg`, but replace its media-query colours with fixed opaque brand colours. Install `sharp` as a development dependency and make `scripts/generate-icons.mjs` render 16, 32, 48, and 128 pixel PNGs into `public/icons/`:

```bash
npm install --save-dev sharp
node scripts/generate-icons.mjs
```

The script iterates `[16, 32, 48, 128]` and calls `sharp('assets/extension-icon.svg').resize(size, size).png().toFile(...)`. Change the page title to `Tab Toolkit`. Add `"icons": "node scripts/generate-icons.mjs"` and `"verify:manifest": "node scripts/verify-manifest.mjs"` to package scripts, and exclude `*.zip` release packages from Git.

- [ ] **Step 4: Prove the packaged manifest**

```bash
npm run build
npm run verify:manifest
```

Expected: PASS and all four icon paths exist under `dist/icons/`.

- [ ] **Step 5: Commit the extension package**

```bash
git add assets public index.html .gitignore scripts/generate-icons.mjs scripts/verify-manifest.mjs package.json package-lock.json
git commit -m "feat: package the Manifest V3 popup"
```

### Task 3: Add settings storage and theme behavior

**Files:**

- Create: `src/shared/settings/settings.ts`
- Create: `src/shared/settings/settings-repository.ts`
- Create: `src/shared/settings/settings-repository.test.ts`
- Create: `src/shared/settings/settings-provider.tsx`
- Create: `src/shared/settings/theme.test.tsx`

**Interfaces:**

- Produces: `Theme = 'light' | 'dark' | 'system'`, `Scope = 'current' | 'all'`, `CopyFormat = 'urls' | 'title-url' | 'markdown' | 'html' | 'csv' | 'json'`, `Settings`, `SettingsRepository.load/save/reset`, and `useSettings()`.
- Storage key: `settings`; defaults are `{ theme: 'system', scope: 'current', copyFormat: 'markdown' }`.

- [ ] **Step 1: Test storage defaults and validation**

```ts
it('falls back per field when stored settings are malformed', async () => {
  storage.get.mockResolvedValue({ settings: { theme: 'neon', scope: 'all' } })
  await expect(repository.load()).resolves.toEqual({
    theme: 'system',
    scope: 'all',
    copyFormat: 'markdown',
  })
})
```

- [ ] **Step 2: Confirm the repository test fails**

```bash
npm test -- src/shared/settings/settings-repository.test.ts
```

Expected: FAIL because the repository is not defined.

- [ ] **Step 3: Implement the repository and provider**

Inject the `chrome.storage.local` area into `createSettingsRepository(storage)`. Validate each union value rather than casting stored data. `SettingsProvider` loads once, persists explicit changes, listens for system colour changes only when theme is `system`, and toggles `.dark` on `document.documentElement`.

- [ ] **Step 4: Test the applied theme**

Verify `dark` adds the class, `light` removes it, and `system` follows `matchMedia('(prefers-color-scheme: dark)')` without overwriting the saved value.

- [ ] **Step 5: Run and commit**

```bash
npm test -- src/shared/settings
git add src/shared/settings
git commit -m "feat: persist local popup settings"
```

### Task 4: Migrate the approved popup shell and only required primitives

**Files:**

- Create: `src/shared/lib/cn.ts`
- Create: `src/shared/ui/button.tsx`
- Create: `src/shared/ui/dialog.tsx`
- Create: `src/shared/ui/dropdown-menu.tsx`
- Create: `src/shared/ui/input.tsx`
- Create: `src/shared/ui/tooltip.tsx`
- Create: `src/shared/ui/separator.tsx`
- Create: `src/shared/ui/toaster.tsx`
- Create: `src/app/AppShell.tsx`
- Create: `src/app/Header.tsx`
- Create: `src/app/PrimaryNav.tsx`
- Modify: `src/App.tsx`
- Replace: `src/index.css`
- Delete: `src/App.css`

**Interfaces:**

- Consumes: `SettingsProvider` and the approved v0 visual reference.
- Produces: a 760×580 `AppShell`, `Header`, `PrimaryNav`, local CSS tokens, and shared accessible primitives used by every later loop.

- [ ] **Step 1: Extend the smoke test**

Assert `document.body` contains a 760×580 popup root, Tabs is the current page, Workspaces is available, and icon buttons have accessible names.

- [ ] **Step 2: Confirm the shell assertions fail**

```bash
npm test -- src/App.test.tsx
```

- [ ] **Step 3: Implement the shell**

Port the approved header/nav structure without `"use client"`, Next imports, analytics, responsive preview canvas, or mock counts. The shell root must use `width: 760px; height: 580px; overflow: hidden`. Keep semantic navigation, visible focus rings, reduced-motion rules, group colour tokens, and Sonner's single top-level toaster.

- [ ] **Step 4: Run focused accessibility smoke tests**

```bash
npm test -- src/App.test.tsx src/shared/settings/theme.test.tsx
```

Expected: PASS with no React `act()` warnings.

- [ ] **Step 5: Verify the loop**

```bash
npm run check
npm test
npm run build
npm run verify:manifest
```

Load `dist/` in `chrome://extensions`, open the popup, and confirm the fixed dimensions, theme behavior, focus rings, and absence of console/network errors.

- [ ] **Step 6: Commit**

```bash
git add src index.html
git commit -m "feat: add the extension popup shell"
```
