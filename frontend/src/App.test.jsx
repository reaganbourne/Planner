import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ListColumn } from './App'

describe('ListColumn', () => {
  const baseProps = {
    isSaving: false,
    itemForm: { title: '', notes: '' },
    onItemCreate: vi.fn(),
    onItemDelete: vi.fn(),
    onItemFormChange: vi.fn(),
    onItemPatch: vi.fn(),
    onItemReorder: vi.fn(),
    onListDelete: vi.fn(),
    onListRename: vi.fn(),
  }

  it('shows an empty-state message when a list has no items', () => {
    render(
      <ListColumn
        {...baseProps}
        list={{ id: 1, name: 'Tasks', type: 'TASK', items: [] }}
      />,
    )

    expect(screen.getByText('No items yet.')).toBeInTheDocument()
  })

  it('renders task items and toggles completion', async () => {
    const user = userEvent.setup()
    const onItemPatch = vi.fn()

    render(
      <ListColumn
        {...baseProps}
        onItemPatch={onItemPatch}
        list={{
          id: 1,
          name: 'Tasks',
          type: 'TASK',
          items: [{ id: 11, title: 'Book hotel', completed: false }],
        }}
      />,
    )

    expect(screen.getByDisplayValue('Book hotel')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    expect(onItemPatch).toHaveBeenCalledWith(11, { completed: true })
  })

  it('submits a new item from the inline add form', async () => {
    const user = userEvent.setup()
    const onItemCreate = vi.fn((event) => event.preventDefault())
    const onItemFormChange = vi.fn()

    render(
      <ListColumn
        {...baseProps}
        onItemCreate={onItemCreate}
        onItemFormChange={onItemFormChange}
        itemForm={{ title: 'Pack charger', notes: '' }}
        list={{ id: 1, name: 'Tasks', type: 'TASK', items: [] }}
      />,
    )

    await user.type(screen.getByPlaceholderText('Add to Tasks…'), 'a')
    expect(onItemFormChange).toHaveBeenLastCalledWith({ title: 'Pack chargera' })

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onItemCreate).toHaveBeenCalled()
  })

  it('renames and deletes a list', () => {
    const onListRename = vi.fn()
    const onListDelete = vi.fn()

    render(
      <ListColumn
        {...baseProps}
        onListRename={onListRename}
        onListDelete={onListDelete}
        list={{ id: 2, name: 'Weekend plans', type: 'ITINERARY', items: [] }}
      />,
    )

    const listNameInput = screen.getByDisplayValue('Weekend plans')
    fireEvent.blur(listNameInput, { target: { value: 'Weekend in Portland' } })

    expect(onListRename).toHaveBeenCalledWith(2, 'Weekend in Portland')

    // The list delete button shows ✕ (the collapse button shows ▴)
    const allX = screen.getAllByRole('button', { name: '✕' })
    fireEvent.click(allX[0])
    expect(onListDelete).toHaveBeenCalledWith(2)
  })

  it('renders itinerary items and removes them', async () => {
    const user = userEvent.setup()
    const onItemDelete = vi.fn()

    render(
      <ListColumn
        {...baseProps}
        onItemDelete={onItemDelete}
        list={{
          id: 3,
          name: 'Day 1',
          type: 'ITINERARY',
          items: [
            {
              id: 31,
              title: 'Dinner reservation',
              completed: false,
              itineraryDetails: {
                startTime: '2026-06-15T18:00:00',
                endTime: '2026-06-15T19:30:00',
                locationName: 'Kann',
              },
            },
          ],
        }}
      />,
    )

    expect(screen.getByDisplayValue('Dinner reservation')).toBeInTheDocument()

    // Item delete is the ✕ after the list-level ✕
    const allX = screen.getAllByRole('button', { name: '✕' })
    await user.click(allX[allX.length - 1])
    expect(onItemDelete).toHaveBeenCalledWith(31)
  })

  it('collapses and expands a list column', async () => {
    const user = userEvent.setup()

    render(
      <ListColumn
        {...baseProps}
        list={{
          id: 5,
          name: 'Tasks',
          type: 'TASK',
          items: [{ id: 51, title: 'Pack charger', completed: false }],
        }}
      />,
    )

    // Item is visible initially
    expect(screen.getByDisplayValue('Pack charger')).toBeInTheDocument()

    // Click collapse (▴ button)
    await user.click(screen.getByTitle('Collapse'))
    expect(screen.queryByDisplayValue('Pack charger')).not.toBeInTheDocument()

    // Click expand (▾ N button)
    await user.click(screen.getByTitle('Expand'))
    expect(screen.getByDisplayValue('Pack charger')).toBeInTheDocument()
  })

  it('moves items up and down within a list', async () => {
    const user = userEvent.setup()
    const onItemReorder = vi.fn()

    render(
      <ListColumn
        {...baseProps}
        onItemReorder={onItemReorder}
        list={{
          id: 4,
          name: 'Tasks',
          type: 'TASK',
          items: [
            { id: 41, title: 'First', completed: false, sortOrder: 0 },
            { id: 42, title: 'Second', completed: false, sortOrder: 1 },
          ],
        }}
      />,
    )

    const upButtons = screen.getAllByRole('button', { name: '↑' })
    const downButtons = screen.getAllByRole('button', { name: '↓' })

    // First item can't go up, last item can't go down
    expect(upButtons[0]).toBeDisabled()
    expect(downButtons[1]).toBeDisabled()

    await user.click(downButtons[0])
    expect(onItemReorder).toHaveBeenCalledWith(4, 41, 'down')

    await user.click(upButtons[1])
    expect(onItemReorder).toHaveBeenCalledWith(4, 42, 'up')
  })
})
