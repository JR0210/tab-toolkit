import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

it('dismisses a dialog with Escape and restores focus to its trigger', async () => {
  // Catches a dialog composition that loses keyboard dismissal or strands
  // focus in the removed portal after closing.
  const user = userEvent.setup()
  render(<DialogFixture />)
  const trigger = screen.getByRole('button', { name: 'Open dialog' })

  await user.click(trigger)
  expect(await screen.findByRole('dialog', { name: 'Delete workspace' })).toBeVisible()

  await user.keyboard('{Escape}')

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Delete workspace' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

it('dismisses a dialog from its backdrop', async () => {
  // Catches a visual backdrop that is disconnected from the primitive's
  // outside-press behavior.
  const user = userEvent.setup()
  render(<DialogFixture />)
  const trigger = screen.getByRole('button', { name: 'Open dialog' })

  await user.click(trigger)
  expect(await screen.findByRole('dialog', { name: 'Delete workspace' })).toBeVisible()
  const backdrop = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')
  expect(backdrop).not.toBeNull()

  await user.click(backdrop!)

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Delete workspace' })).not.toBeInTheDocument()
  })
})

it('opens a menu from the keyboard, moves focus, and restores it on Escape', async () => {
  // Catches a menu wrapper that breaks trigger keyboard handling, roving item
  // focus, Escape dismissal, or focus restoration.
  const user = userEvent.setup()
  render(<MenuFixture />)
  const trigger = screen.getByRole('button', { name: 'Open actions' })
  trigger.focus()

  await user.keyboard('{ArrowDown}')

  const firstItem = await screen.findByRole('menuitem', { name: 'Rename' })
  expect(firstItem).toHaveFocus()

  await user.keyboard('{ArrowDown}')
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus()

  await user.keyboard('{Escape}')

  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  expect(trigger).toHaveFocus()
})

function DialogFixture() {
  return (
    <Dialog>
      <DialogTrigger>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete workspace</DialogTitle>
        <DialogDescription>This action cannot be undone.</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

function MenuFixture() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open actions</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuItem>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
