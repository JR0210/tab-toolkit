import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BrowserProvider } from '../../chrome/browser-context'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import { SHORTCUTS } from '../shortcuts/shortcut-definitions'
import { ShortcutsDialog } from './ShortcutsDialog'
// Vite's `?raw` import inlines the file's source text as a string, so this
// check for a hard-coded glyph reads the component's actual source without
// needing Node's fs module (this project's tsconfig deliberately excludes
// Node's ambient types, since it's browser/extension code).
import shortcutsDialogSource from './ShortcutsDialog.tsx?raw'

describe('ShortcutsDialog', () => {
  it('shows every registry action and the mac command/backspace glyphs', async () => {
    renderDialog('mac')

    for (const definition of SHORTCUTS) {
      expect(screen.getByText(definition.action)).toBeVisible()
    }

    expect((await screen.findAllByText(/⌘/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/⌫/).length).toBeGreaterThan(0)
  })

  it('shows every registry action and the Ctrl/Delete labels on non-mac', () => {
    renderDialog('non-mac')

    for (const definition of SHORTCUTS) {
      expect(screen.getByText(definition.action)).toBeVisible()
    }

    expect(screen.getAllByText(/Ctrl/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Delete/).length).toBeGreaterThan(0)
  })

  it('never hard-codes the command glyph in its own source', () => {
    expect(shortcutsDialogSource).not.toContain('⌘')
  })
})

function renderDialog(platform: 'mac' | 'non-mac') {
  const gateway = createStubBrowserGateway({
    getPlatformInfo: vi.fn().mockResolvedValue(platform),
  })

  return render(
    <BrowserProvider gateway={gateway}>
      <ShortcutsDialog open onOpenChange={() => {}} />
    </BrowserProvider>,
  )
}
