import { useState } from 'react'
import type { ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BrowserProvider } from '../../chrome/browser-context'
import { Dialog, DialogContent, DialogTitle } from '../../shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '../../shared/ui/dropdown-menu'
import { createStubBrowserGateway } from '../../test/browser-gateway-mock'
import type { ShortcutCommand } from './shortcut-definitions'
import { ShortcutHandlersProvider, useRegisterShortcut } from './use-popup-shortcuts'

function Registrar({
  command,
  handler,
}: {
  command: ShortcutCommand
  handler: (() => void) | null
}) {
  useRegisterShortcut(command, handler)
  return null
}

// The stub gateway's getPlatformInfo already resolves 'non-mac', matching
// usePlatformFamily's initial default -- so these routing tests never need
// to wait out the async platform resolution to get a deterministic result.
function renderWithProvider(children: ReactNode) {
  return render(
    <BrowserProvider gateway={createStubBrowserGateway()}>
      <ShortcutHandlersProvider>{children}</ShortcutHandlersProvider>
    </BrowserProvider>,
  )
}

function dispatchKeydown(overrides: {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  repeat?: boolean
}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: overrides.key,
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
    altKey: overrides.altKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    repeat: overrides.repeat ?? false,
    cancelable: true,
    bubbles: true,
  })

  act(() => {
    document.dispatchEvent(event)
  })

  return event
}

describe('ShortcutHandlersProvider routing', () => {
  it('calls the registered handler and prevents default when a shortcut matches', () => {
    const handler = vi.fn()
    renderWithProvider(<Registrar command="focus-search" handler={handler} />)

    const event = dispatchKeydown({ key: 'k', ctrlKey: true })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('does nothing and does not prevent default when the matched command has no registered handler', () => {
    // Simulates e.g. copy-selected firing while SelectionDock never
    // registered anything because the selection is empty.
    renderWithProvider(<Registrar command="focus-search" handler={null} />)

    const event = dispatchKeydown({ key: 'c', ctrlKey: true })

    expect(event.defaultPrevented).toBe(false)
  })

  it('does not call the handler for an unrelated key', () => {
    const handler = vi.fn()
    renderWithProvider(<Registrar command="focus-search" handler={handler} />)

    dispatchKeydown({ key: 'q', ctrlKey: true })

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not match with the wrong modifier for the resolved platform', () => {
    const handler = vi.fn()
    renderWithProvider(<Registrar command="focus-search" handler={handler} />)

    dispatchKeydown({ key: 'k', metaKey: true })

    expect(handler).not.toHaveBeenCalled()
  })

  it('unregisters a handler once the registering component passes null', () => {
    const handler = vi.fn()

    function Wrapper() {
      const [enabled, setEnabled] = useState(true)
      return (
        <>
          <Registrar command="focus-search" handler={enabled ? handler : null} />
          <button onClick={() => setEnabled(false)}>disable</button>
        </>
      )
    }

    renderWithProvider(<Wrapper />)

    dispatchKeydown({ key: 'k', ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)

    act(() => {
      screen.getByText('disable').click()
    })

    dispatchKeydown({ key: 'k', ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('ignores a repeated keydown for a matched command', () => {
    const handler = vi.fn()
    renderWithProvider(<Registrar command="close-selected" handler={handler} />)

    dispatchKeydown({ key: 'Delete', ctrlKey: true, repeat: true })

    expect(handler).not.toHaveBeenCalled()
  })

  it('still fires on the first (non-repeated) keydown for a matched command', () => {
    const handler = vi.fn()
    renderWithProvider(<Registrar command="close-selected" handler={handler} />)

    dispatchKeydown({ key: 'Delete', ctrlKey: true, repeat: false })

    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('Escape priority', () => {
  it('invokes the registered escape handler when nothing else is open', () => {
    const handler = vi.fn()
    renderWithProvider(<Registrar command="escape" handler={handler} />)

    dispatchKeydown({ key: 'Escape' })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not invoke the escape handler while a dialog is open', async () => {
    const handler = vi.fn()
    renderWithProvider(
      <>
        <Registrar command="escape" handler={handler} />
        <Dialog open onOpenChange={() => {}}>
          <DialogContent>
            <DialogTitle>Delete tabs?</DialogTitle>
          </DialogContent>
        </Dialog>
      </>,
    )
    await screen.findByRole('dialog')

    dispatchKeydown({ key: 'Escape' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not invoke the escape handler while a dropdown menu is open', async () => {
    const handler = vi.fn()
    renderWithProvider(
      <>
        <Registrar command="escape" handler={handler} />
        <DropdownMenu open onOpenChange={() => {}}>
          <DropdownMenuContent>
            <DropdownMenuItem>Pin</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>,
    )
    await screen.findByRole('menu')

    dispatchKeydown({ key: 'Escape' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('does not match a modified escape', () => {
    const handler = vi.fn()
    renderWithProvider(<Registrar command="escape" handler={handler} />)

    dispatchKeydown({ key: 'Escape', ctrlKey: true })

    expect(handler).not.toHaveBeenCalled()
  })
})
