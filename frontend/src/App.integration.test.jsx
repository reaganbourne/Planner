import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mock-map">{children}</div>,
  Marker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  useMap: () => ({
    fitBounds: vi.fn(),
    setView: vi.fn(),
    flyTo: vi.fn(),
    getZoom: vi.fn(() => 12),
  }),
  useMapEvents: () => ({}),
}))

import App from './App'

describe('App workspace flow', () => {
  let workspaceDetails
  let storage

  beforeEach(() => {
    workspaceDetails = {
      id: 1,
      name: 'Portland Weekend',
      lists: [
        {
          id: 10,
          workspaceId: 1,
          name: 'Tasks',
          type: 'TASK',
          description: null,
          items: [],
        },
      ],
    }

    storage = createStorageMock()
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    })
    window.localStorage.setItem('planner-token', 'test-token')

    globalThis.fetch = vi.fn(async (input, options = {}) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = options.method ?? 'GET'

      if (url.endsWith('/api/v1/workspaces') && method === 'GET') {
        return jsonResponse([{ id: 1, name: 'Portland Weekend' }])
      }

      if (url.endsWith('/api/v1/workspaces/1') && method === 'GET') {
        return jsonResponse(workspaceDetails)
      }

      if (url.endsWith('/api/v1/lists/10/items') && method === 'POST') {
        const body = JSON.parse(options.body)
        const createdItem = {
          id: 101,
          listId: 10,
          title: body.title,
          notes: body.notes,
          completed: false,
          sortOrder: workspaceDetails.lists[0].items.length,
          itineraryDetails: null,
        }

        workspaceDetails = {
          ...workspaceDetails,
          lists: workspaceDetails.lists.map((list) =>
            list.id === 10 ? { ...list, items: [...list.items, createdItem] } : list,
          ),
        }

        return jsonResponse(createdItem, 201)
      }

      if (url.endsWith('/api/v1/lists/10/items/reorder') && method === 'POST') {
        const body = JSON.parse(options.body)
        const orderMap = new Map(body.itemIds.map((id, index) => [id, index]))

        workspaceDetails = {
          ...workspaceDetails,
          lists: workspaceDetails.lists.map((list) => ({
            ...list,
            items: [...list.items]
              .map((item) => ({ ...item, sortOrder: orderMap.get(item.id) ?? item.sortOrder }))
              .sort((left, right) => left.sortOrder - right.sortOrder),
          })),
        }

        return jsonResponse(workspaceDetails.lists[0].items)
      }

      if (url.endsWith('/api/v1/items/101') && method === 'PATCH') {
        const patch = JSON.parse(options.body)
        workspaceDetails = {
          ...workspaceDetails,
          lists: workspaceDetails.lists.map((list) => ({
            ...list,
            items: list.items.map((item) =>
              item.id === 101 ? { ...item, ...patch } : item,
            ),
          })),
        }

        return jsonResponse(workspaceDetails.lists[0].items[0])
      }

      if (url.endsWith('/api/v1/items/101') && method === 'DELETE') {
        workspaceDetails = {
          ...workspaceDetails,
          lists: workspaceDetails.lists.map((list) => ({
            ...list,
            items: list.items.filter((item) => item.id !== 101),
          })),
        }

        return new Response(null, { status: 204 })
      }

      if (url.includes('/api/v1/places/search') && method === 'GET') {
        return jsonResponse({
          businesses: [
            {
              id: 'osm-1',
              name: 'Case Study Coffee',
              address: '802 SW 10th Ave, Portland, OR',
              latitude: 45.518212,
              longitude: -122.68154,
              provider: 'OpenStreetMap',
              categories: ['Cafe'],
            },
          ],
        })
      }

      if (url.endsWith('/api/v1/items/201/itinerary-details') && method === 'PATCH') {
        const patch = JSON.parse(options.body)
        workspaceDetails = {
          ...workspaceDetails,
          lists: workspaceDetails.lists.map((list) => ({
            ...list,
            items: list.items.map((item) =>
              item.id === 201
                ? {
                    ...item,
                    itineraryDetails: {
                      ...item.itineraryDetails,
                      ...patch,
                    },
                  }
                : item,
            ),
          })),
        }

        return jsonResponse(workspaceDetails.lists[0].items[0].itineraryDetails)
      }

      throw new Error(`Unhandled request: ${method} ${url}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('adds, shows, toggles, and deletes a task item from fetched workspace data', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(await screen.findByText('Portland Weekend')).toBeInTheDocument()
    expect(await screen.findByPlaceholderText('Add to Tasks…')).toBeInTheDocument()
    expect(screen.getByText('No items yet.')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Add to Tasks…'), 'Book hotel')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByDisplayValue('Book hotel')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      expect(workspaceDetails.lists[0].items[0].completed).toBe(true)
    })

    // List header has one ✕ (list delete); item row has another ✕ (item delete)
    const xButtons = screen.getAllByRole('button', { name: '✕' })
    await user.click(xButtons[xButtons.length - 1])

    expect(await screen.findByText('No items yet.')).toBeInTheDocument()
  })

  it('reorders visible task items from the workspace view', async () => {
    const user = userEvent.setup()

    workspaceDetails = {
      ...workspaceDetails,
      lists: [
        {
          ...workspaceDetails.lists[0],
          items: [
            { id: 101, listId: 10, title: 'Book hotel', completed: false, sortOrder: 0, itineraryDetails: null },
            { id: 102, listId: 10, title: 'Reserve dinner', completed: false, sortOrder: 1, itineraryDetails: null },
          ],
        },
      ],
    }

    render(<App />)

    expect(await screen.findByDisplayValue('Book hotel')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Reserve dinner')).toBeInTheDocument()

    // Click the first item's ↓ button (first "move down" button in the list)
    await user.click(screen.getAllByRole('button', { name: '↓' })[0])

    await waitFor(() => {
      expect(workspaceDetails.lists[0].items[0].title).toBe('Reserve dinner')
      expect(workspaceDetails.lists[0].items[1].title).toBe('Book hotel')
    })
  })

  it('searches for a place while editing a calendar event and applies the result', async () => {
    const user = userEvent.setup()

    // Use today's actual date so the calendar shows the event by default
    const today = new Date().toISOString().slice(0, 10)

    workspaceDetails = {
      id: 1,
      name: 'Portland Weekend',
      lists: [
        {
          id: 20,
          workspaceId: 1,
          name: 'Day 1',
          type: 'ITINERARY',
          description: null,
          items: [
            {
              id: 201,
              listId: 20,
              title: 'Morning coffee',
              completed: false,
              sortOrder: 0,
              itineraryDetails: {
                startTime: `${today}T09:00:00`,
                endTime: `${today}T10:00:00`,
                locationName: '',
                address: '',
                latitude: null,
                longitude: null,
              },
            },
          ],
        },
      ],
    }

    render(<App />)

    // Switch to Calendar view
    await user.click(await screen.findByRole('button', { name: 'Calendar' }))

    // The event block should be visible in the day view
    const eventBlock = await screen.findByRole('button', { name: /Morning coffee/i })
    await user.click(eventBlock)

    // Editor panel should open
    expect(await screen.findByText('Editing event')).toBeInTheDocument()

    // Type an address into the address search field
    const searchInput = screen.getByPlaceholderText('1234 Main St, City State')
    await user.clear(searchInput)
    await user.type(searchInput, '802 SW 10th Ave, Portland, OR')

    await user.click(screen.getByRole('button', { name: 'Pin address' }))

    // Search result appears in the place-results list (as an h5)
    const resultHeading = await screen.findByRole('heading', { name: 'Case Study Coffee', level: 5 })
    expect(resultHeading).toBeInTheDocument()

    // Click the result button to apply it
    await user.click(resultHeading.closest('button'))

    // Address should appear in the location summary (may also appear in result row / map popup)
    expect((await screen.findAllByText('802 SW 10th Ave, Portland, OR')).length).toBeGreaterThan(0)
  })
})

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function createStorageMock() {
  const values = new Map()

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}
