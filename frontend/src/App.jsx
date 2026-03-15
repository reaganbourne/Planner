import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import './App.css'

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
const DEFAULT_CENTER = [40.7128, -74.006]
const HOUR_PX = 64
const FIRST_HOUR = 7
const LAST_HOUR = 23

const TYPE_NAMES = { TASK: 'Task', ITINERARY: 'Itinerary', PLACES: 'Places', PACKING: 'Packing' }

const emptyCredentials = { email: '', password: '' }
const emptyWorkspaceForm = { name: '' }
const emptyListForm = { name: '' }
const emptyItemForm = { title: '', notes: '' }
const emptyPlaceSearch = { query: '', location: '', loading: false, error: '', results: [] }

// ── SVG Teardrop pin icons ────────────────────────────────────────────────────

function createPinIcon(type) {
  const colors = { itinerary: '#4A7FA5', places: '#BE9A60', draft: '#8090a0' }
  const color = colors[type] || colors.itinerary
  const isDraft = type === 'draft'
  return L.divIcon({
    className: '',
    html: `<svg width="22" height="30" viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="${isDraft ? 'opacity:0.6' : ''}">
      <path d="M11 0C4.925 0 0 4.925 0 11C0 19.25 11 30 11 30S22 19.25 22 11C22 4.925 17.075 0 11 0Z" fill="${color}"/>
      <circle cx="11" cy="11" r="5" fill="white" fill-opacity="0.9"/>
    </svg>`,
    iconSize: [22, 30],
    iconAnchor: [11, 30],
    popupAnchor: [0, -32],
  })
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [authMode, setAuthMode] = useState('login')
  const [credentials, setCredentials] = useState(emptyCredentials)
  const [token, setToken] = useState(() => window.localStorage.getItem('planner-token') ?? '')
  const [requestState, setRequestState] = useState({ loading: false, error: '', success: '' })
  const [workspaces, setWorkspaces] = useState([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(null)
  const [workspaceDetails, setWorkspaceDetails] = useState(null)
  const [workspaceForm, setWorkspaceForm] = useState(emptyWorkspaceForm)
  const [listForm, setListForm] = useState(emptyListForm)
  const [itemForms, setItemForms] = useState({})
  const [activeView, setActiveView] = useState('board')
  const [calendarDate, setCalendarDate] = useState(() => todayString())
  const [calendarView, setCalendarView] = useState('day')
  const [editingEventId, setEditingEventId] = useState(null)
  const [newEventDraft, setNewEventDraft] = useState(null) // { startTime, title }
  const [selectedMapItemId, setSelectedMapItemId] = useState(null)
  const [selectedSearchResultId, setSelectedSearchResultId] = useState(null)
  const [placeSearch, setPlaceSearch] = useState(emptyPlaceSearch)
  const [savingListId, setSavingListId] = useState(null)
  const [itineraryDraft, setItineraryDraft] = useState(null)

  // ── Auth fetch helper ─────────────────────────────────────────────────────

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers ?? {})
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
      const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
      if (!response.ok) {
        const errorText = await response.text()
        let message = errorText
        try {
          const parsed = JSON.parse(errorText)
          message = parsed.message || parsed.detail || parsed.error || errorText
        } catch {}
        throw new Error(message || `Request failed with status ${response.status}`)
      }
      if (response.status === 204) return null
      return response.json()
    },
    [token],
  )

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadWorkspaces = useCallback(async () => {
    const response = await apiFetch('/api/v1/workspaces')
    setWorkspaces(response)
    setSelectedWorkspaceId((cur) => cur ?? response[0]?.id ?? null)
  }, [apiFetch])

  const loadWorkspaceDetails = useCallback(
    async (workspaceId) => {
      const response = await apiFetch(`/api/v1/workspaces/${workspaceId}`)
      setWorkspaceDetails(response)
    },
    [apiFetch],
  )

  useEffect(() => {
    if (!token) {
      setWorkspaces([])
      setWorkspaceDetails(null)
      setSelectedWorkspaceId(null)
      return
    }
    loadWorkspaces().catch((e) => setRequestState({ loading: false, error: formatError(e), success: '' }))
  }, [loadWorkspaces, token])

  useEffect(() => {
    if (!token || !selectedWorkspaceId) {
      setWorkspaceDetails(null)
      return
    }
    loadWorkspaceDetails(selectedWorkspaceId).catch((e) =>
      setRequestState({ loading: false, error: formatError(e), success: '' }),
    )
  }, [loadWorkspaceDetails, selectedWorkspaceId, token])

  async function refreshWorkspace() {
    if (!selectedWorkspaceId) return
    await loadWorkspaceDetails(selectedWorkspaceId)
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const taskLists = useMemo(() => workspaceDetails?.lists.filter((l) => l.type === 'TASK') ?? [], [workspaceDetails])
  const placesLists = useMemo(() => workspaceDetails?.lists.filter((l) => l.type === 'PLACES') ?? [], [workspaceDetails])
  const itineraryLists = useMemo(
    () => workspaceDetails?.lists.filter((l) => l.type === 'ITINERARY') ?? [],
    [workspaceDetails],
  )

  const itineraryItems = useMemo(
    () => itineraryLists.flatMap((l) => l.items.map((item) => ({ ...item, listId: l.id, listName: l.name }))),
    [itineraryLists],
  )

  const placesItems = useMemo(
    () => placesLists.flatMap((l) => l.items.map((item) => ({ ...item, listId: l.id, listName: l.name }))),
    [placesLists],
  )

  const calendarDayEvents = useMemo(() => {
    return itineraryItems
      .filter((item) => item.itineraryDetails?.startTime?.slice(0, 10) === calendarDate)
      .sort((a, b) => new Date(a.itineraryDetails.startTime) - new Date(b.itineraryDetails.startTime))
  }, [itineraryItems, calendarDate])

  const weekDates = useMemo(() => {
    const d = new Date(calendarDate + 'T12:00:00')
    const startOfWeek = new Date(d)
    startOfWeek.setDate(d.getDate() - d.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })
  }, [calendarDate])

  const weekEvents = useMemo(() => {
    return itineraryItems
      .filter((item) => item.itineraryDetails?.startTime && weekDates.includes(item.itineraryDetails.startTime.slice(0, 10)))
      .sort((a, b) => new Date(a.itineraryDetails.startTime) - new Date(b.itineraryDetails.startTime))
  }, [itineraryItems, weekDates])

  const editingEvent = useMemo(
    () => itineraryItems.find((item) => item.id === editingEventId) ?? null,
    [itineraryItems, editingEventId],
  )

  const mapMarkers = useMemo(() => {
    const itinMarkers = itineraryItems
      .filter((i) => i.itineraryDetails?.latitude != null)
      .map((i) => ({
        id: i.id,
        title: i.title,
        listName: i.listName,
        markerType: 'itinerary',
        locationName: i.itineraryDetails.locationName,
        address: i.itineraryDetails.address,
        latitude: Number(i.itineraryDetails.latitude),
        longitude: Number(i.itineraryDetails.longitude),
        startTime: i.itineraryDetails.startTime,
      }))
    const placesMarkers = placesItems
      .filter((i) => i.itineraryDetails?.latitude != null)
      .map((i) => ({
        id: i.id,
        title: i.title,
        listName: i.listName,
        markerType: 'places',
        locationName: i.itineraryDetails.locationName,
        address: i.itineraryDetails.address,
        latitude: Number(i.itineraryDetails.latitude),
        longitude: Number(i.itineraryDetails.longitude),
        startTime: i.itineraryDetails.startTime,
      }))
    return [...itinMarkers, ...placesMarkers]
  }, [itineraryItems, placesItems])

  const selectedMapMarker = useMemo(() => mapMarkers.find((m) => m.id === selectedMapItemId) ?? null, [mapMarkers, selectedMapItemId])

  // Draft preview marker while editing
  const draftPreviewMarker = useMemo(() => {
    if (!editingEvent || itineraryDraft?.latitude == null) return null
    return {
      id: `draft-${editingEvent.id}`,
      title: editingEvent.title,
      listName: 'Editing',
      markerType: 'draft',
      locationName: itineraryDraft.locationName || editingEvent.title,
      address: itineraryDraft.address,
      latitude: Number(itineraryDraft.latitude),
      longitude: Number(itineraryDraft.longitude),
      startTime: itineraryDraft.startTime || null,
      isDraft: true,
    }
  }, [itineraryDraft, editingEvent])

  const displayMapMarkers = useMemo(() => {
    if (!draftPreviewMarker || !editingEvent) return mapMarkers
    return [...mapMarkers.filter((m) => m.id !== editingEvent.id), draftPreviewMarker]
  }, [draftPreviewMarker, mapMarkers, editingEvent])

  // Clear search state on view switch to avoid cross-view leakage
  useEffect(() => {
    setPlaceSearch(emptyPlaceSearch)
    setSelectedSearchResultId(null)
  }, [activeView])

  // Sync draft when editing event changes
  useEffect(() => {
    if (!editingEvent) {
      setItineraryDraft(null)
      setPlaceSearch(emptyPlaceSearch)
      return
    }
    setItineraryDraft({
      startTime: toDateTimeInputValue(editingEvent.itineraryDetails?.startTime),
      endTime: toDateTimeInputValue(editingEvent.itineraryDetails?.endTime),
      locationName: editingEvent.itineraryDetails?.locationName ?? '',
      address: editingEvent.itineraryDetails?.address ?? '',
      latitude: editingEvent.itineraryDetails?.latitude ?? null,
      longitude: editingEvent.itineraryDetails?.longitude ?? null,
      sourceProvider: editingEvent.itineraryDetails?.sourceProvider ?? '',
      sourcePlaceId: editingEvent.itineraryDetails?.sourcePlaceId ?? '',
      sourceUrl: editingEvent.itineraryDetails?.sourceUrl ?? '',
      reservationUrl: editingEvent.itineraryDetails?.reservationUrl ?? '',
    })
    setPlaceSearch((cur) => ({
      ...emptyPlaceSearch,
      query: editingEvent.itineraryDetails?.locationName || editingEvent.title,
      location: workspaceDetails?.name || '',
    }))
  }, [editingEventId, editingEvent, workspaceDetails?.name])

  const selectedSearchResult = useMemo(
    () => placeSearch.results.find((r) => r.id === selectedSearchResultId) ?? null,
    [placeSearch.results, selectedSearchResultId],
  )

  useEffect(() => {
    setSelectedSearchResultId((cur) => (placeSearch.results.some((r) => r.id === cur) ? cur : (placeSearch.results[0]?.id ?? null)))
  }, [placeSearch.results])

  // ── Workspace/List mutations ───────────────────────────────────────────────

  async function getOrCreateItineraryList() {
    if (itineraryLists.length) return itineraryLists[0].id
    const created = await apiFetch(`/api/v1/workspaces/${selectedWorkspaceId}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Itinerary', type: 'ITINERARY', description: null }),
    })
    await refreshWorkspace()
    return created.id
  }

  async function getOrCreatePlacesList() {
    if (placesLists.length) return placesLists[0].id
    const created = await apiFetch(`/api/v1/workspaces/${selectedWorkspaceId}/lists`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Saved Places', type: 'PLACES', description: null }),
    })
    await refreshWorkspace()
    return created.id
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setRequestState({ loading: true, error: '', success: '' })
    try {
      const response = await apiFetch(`/api/v1/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
      window.localStorage.setItem('planner-token', response.token)
      setToken(response.token)
      setCredentials(emptyCredentials)
      setRequestState({ loading: false, error: '', success: '' })
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  async function handleWorkspaceCreate(event) {
    event.preventDefault()
    setRequestState({ loading: true, error: '', success: '' })
    try {
      const workspace = await apiFetch('/api/v1/workspaces', {
        method: 'POST',
        body: JSON.stringify(workspaceForm),
      })
      setWorkspaceForm(emptyWorkspaceForm)
      setWorkspaces((cur) => [...cur, workspace])
      setSelectedWorkspaceId(workspace.id)
      setRequestState({ loading: false, error: '', success: '' })
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  async function handleWorkspaceDelete() {
    if (!selectedWorkspaceId) return
    try {
      await apiFetch(`/api/v1/workspaces/${selectedWorkspaceId}`, { method: 'DELETE' })
      const next = workspaces.filter((w) => w.id !== selectedWorkspaceId)
      setWorkspaces(next)
      setSelectedWorkspaceId(next[0]?.id ?? null)
      setWorkspaceDetails(null)
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  async function handleListCreate(event) {
    event.preventDefault()
    if (!selectedWorkspaceId) return
    setRequestState({ loading: true, error: '', success: '' })
    try {
      await apiFetch(`/api/v1/workspaces/${selectedWorkspaceId}/lists`, {
        method: 'POST',
        body: JSON.stringify({ name: listForm.name, type: 'TASK', description: null }),
      })
      setListForm(emptyListForm)
      await refreshWorkspace()
      setRequestState({ loading: false, error: '', success: '' })
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  async function handleListRename(listId, name) {
    const trimmed = name.trim()
    if (!trimmed) return
    setSavingListId(listId)
    try {
      await apiFetch(`/api/v1/lists/${listId}`, { method: 'PATCH', body: JSON.stringify({ name: trimmed }) })
      await refreshWorkspace()
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    } finally {
      setSavingListId(null)
    }
  }

  async function handleListDelete(listId) {
    try {
      await apiFetch(`/api/v1/lists/${listId}`, { method: 'DELETE' })
      await refreshWorkspace()
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  async function handleItemCreate(event, listId) {
    event.preventDefault()
    const form = itemForms[listId] ?? emptyItemForm
    if (!form.title.trim()) return
    try {
      await apiFetch(`/api/v1/lists/${listId}/items`, {
        method: 'POST',
        body: JSON.stringify({ title: form.title.trim(), notes: form.notes.trim() || null }),
      })
      setItemForms((cur) => ({ ...cur, [listId]: emptyItemForm }))
      await refreshWorkspace()
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  async function handleItemPatch(itemId, patch) {
    try {
      await apiFetch(`/api/v1/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(patch) })
      await refreshWorkspace()
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  async function handleItemDelete(itemId) {
    try {
      await apiFetch(`/api/v1/items/${itemId}`, { method: 'DELETE' })
      if (editingEventId === itemId) setEditingEventId(null)
      if (selectedMapItemId === itemId) setSelectedMapItemId(null)
      await refreshWorkspace()
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  async function handleItemReorder(listId, itemId, direction) {
    const list = workspaceDetails?.lists.find((l) => l.id === listId)
    if (!list) return
    const index = list.items.findIndex((i) => i.id === itemId)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= list.items.length) return
    const reordered = list.items.map((i) => i.id)
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    try {
      await apiFetch(`/api/v1/lists/${listId}/items/reorder`, {
        method: 'POST',
        body: JSON.stringify({ itemIds: reordered }),
      })
      await refreshWorkspace()
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  // ── Calendar event creation (click on time slot) ───────────────────────────

  async function handleTimeSlotClick(hourDecimal) {
    if (!selectedWorkspaceId) return
    const h = Math.floor(hourDecimal)
    const m = Math.round((hourDecimal - h) * 60 / 15) * 15
    const timeStr = `${calendarDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
    setNewEventDraft({ startTime: timeStr, title: '' })
  }

  async function handleNewEventSubmit(event) {
    event.preventDefault()
    if (!newEventDraft?.title.trim()) return
    setRequestState({ loading: true, error: '', success: '' })
    try {
      const listId = await getOrCreateItineraryList()
      const created = await apiFetch(`/api/v1/lists/${listId}/items`, {
        method: 'POST',
        body: JSON.stringify({ title: newEventDraft.title.trim(), notes: null }),
      })
      // Set the start time immediately
      const endHour = parseFloat(newEventDraft.startTime.slice(11, 13)) + 1
      const endStr = newEventDraft.startTime.slice(0, 11) + String(Math.min(endHour, 23)).padStart(2, '0') + newEventDraft.startTime.slice(13)
      await apiFetch(`/api/v1/items/${created.id}/itinerary-details`, {
        method: 'PATCH',
        body: JSON.stringify({
          startTime: newEventDraft.startTime,
          endTime: endStr,
          locationName: null, address: null, latitude: null, longitude: null,
          sourceProvider: null, sourcePlaceId: null, sourceUrl: null, reservationUrl: null,
        }),
      })
      await refreshWorkspace()
      setNewEventDraft(null)
      setEditingEventId(created.id)
      setRequestState({ loading: false, error: '', success: '' })
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  // ── Itinerary details save ─────────────────────────────────────────────────

  async function handleItinerarySave() {
    if (!editingEvent || !itineraryDraft) return
    try {
      await apiFetch(`/api/v1/items/${editingEvent.id}/itinerary-details`, {
        method: 'PATCH',
        body: JSON.stringify({
          startTime: itineraryDraft.startTime || null,
          endTime: itineraryDraft.endTime || null,
          locationName: itineraryDraft.locationName || null,
          address: itineraryDraft.address || null,
          latitude: itineraryDraft.latitude ?? null,
          longitude: itineraryDraft.longitude ?? null,
          sourceProvider: itineraryDraft.sourceProvider || null,
          sourcePlaceId: itineraryDraft.sourcePlaceId || null,
          sourceUrl: itineraryDraft.sourceUrl || null,
          reservationUrl: itineraryDraft.reservationUrl || null,
        }),
      })
      await refreshWorkspace()
      setRequestState({ loading: false, error: '', success: 'Saved!' })
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  // ── Place search ───────────────────────────────────────────────────────────

  async function handlePlaceSearch() {
    if (!placeSearch.query.trim()) return
    const hasLocation = placeSearch.location.trim()
    const hasLatLng = itineraryDraft?.latitude != null

    if (!hasLocation && !hasLatLng) {
      setPlaceSearch((cur) => ({ ...cur, error: 'Enter a city or area in the "Near" field.' }))
      return
    }

    setPlaceSearch((cur) => ({ ...cur, loading: true, error: '', results: [] }))
    try {
      const params = new URLSearchParams({ query: placeSearch.query.trim() })
      if (hasLocation) params.set('location', placeSearch.location.trim())
      else if (hasLatLng) {
        params.set('latitude', itineraryDraft.latitude)
        params.set('longitude', itineraryDraft.longitude)
      }
      const response = await apiFetch(`/api/v1/places/search?${params}`)
      setPlaceSearch((cur) => ({ ...cur, loading: false, results: response.businesses ?? [] }))
    } catch (e) {
      setPlaceSearch((cur) => ({ ...cur, loading: false, error: formatError(e) }))
    }
  }

  async function handleAddressGeocode() {
    if (!placeSearch.query.trim()) return
    setPlaceSearch((cur) => ({ ...cur, loading: true, error: '', results: [] }))
    try {
      const params = new URLSearchParams({ query: placeSearch.query.trim() })
      const response = await apiFetch(`/api/v1/places/search?${params}`)
      setPlaceSearch((cur) => ({ ...cur, loading: false, results: response.businesses ?? [] }))
    } catch (e) {
      setPlaceSearch((cur) => ({ ...cur, loading: false, error: formatError(e) }))
    }
  }

  function applyPlaceResult(result) {
    setSelectedSearchResultId(result.id)
    setSelectedMapItemId(null)
    setItineraryDraft((cur) => ({
      ...cur,
      locationName: result.name ?? cur.locationName,
      address: result.address ?? cur.address,
      latitude: result.latitude ? Number(result.latitude) : cur.latitude,
      longitude: result.longitude ? Number(result.longitude) : cur.longitude,
      sourceProvider: result.provider ?? cur.sourceProvider,
      sourcePlaceId: result.id ?? cur.sourcePlaceId,
      sourceUrl: result.url ?? cur.sourceUrl,
    }))
  }

  async function handleCreatePinFromSearch(result) {
    setRequestState({ loading: true, error: '', success: '' })
    try {
      const listId = await getOrCreatePlacesList()
      const created = await apiFetch(`/api/v1/lists/${listId}/items`, {
        method: 'POST',
        body: JSON.stringify({ title: result.name, notes: result.address ?? null }),
      })
      await apiFetch(`/api/v1/items/${created.id}/itinerary-details`, {
        method: 'PATCH',
        body: JSON.stringify({
          locationName: result.name ?? null,
          address: result.address ?? null,
          latitude: result.latitude ? Number(result.latitude) : null,
          longitude: result.longitude ? Number(result.longitude) : null,
          sourceProvider: result.provider ?? null,
          sourcePlaceId: result.id ?? null,
          sourceUrl: result.url ?? null,
        }),
      })
      await refreshWorkspace()
      setRequestState({ loading: false, error: '', success: 'Pin saved!' })
      setSelectedMapItemId(created.id)
      setPlaceSearch(emptyPlaceSearch)
    } catch (e) {
      setRequestState({ loading: false, error: formatError(e), success: '' })
    }
  }

  function handleLogout() {
    window.localStorage.removeItem('planner-token')
    setToken('')
    setWorkspaceDetails(null)
  }

  // ── Calendar day navigation ────────────────────────────────────────────────

  function shiftDay(delta) {
    const d = new Date(calendarDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setCalendarDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  function shiftWeek(delta) {
    const d = new Date(calendarDate + 'T12:00:00')
    d.setDate(d.getDate() + delta * 7)
    setCalendarDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  async function handlePinDelete(markerId) {
    try {
      await apiFetch(`/api/v1/items/${markerId}/itinerary-details`, {
        method: 'PATCH',
        body: JSON.stringify({ latitude: null, longitude: null, address: null, locationName: null }),
      })
      await refreshWorkspace()
      if (selectedMapItemId === markerId) setSelectedMapItemId(null)
    } catch (e) {
      // ignore
    }
  }

  // ── Auth screen ───────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="eyebrow">Planner</p>
          <h1>Build trips with lists, itinerary, calendar, and map in one place.</h1>
          <p className="hero-copy">Plan trips with editable task lists, timed itinerary stops, and searchable place pins on a real map.</p>

          <div className="toggle-row">
            <button className={authMode === 'login' ? 'toggle-button active' : 'toggle-button'} type="button" onClick={() => setAuthMode('login')}>
              Login
            </button>
            <button className={authMode === 'register' ? 'toggle-button active' : 'toggle-button'} type="button" onClick={() => setAuthMode('register')}>
              Register
            </button>
          </div>

          <form className="stack" onSubmit={handleAuthSubmit}>
            <label>
              Email
              <input required type="email" value={credentials.email} onChange={(e) => setCredentials((c) => ({ ...c, email: e.target.value }))} />
            </label>
            <label>
              Password
              <input required minLength={8} type="password" value={credentials.password} onChange={(e) => setCredentials((c) => ({ ...c, password: e.target.value }))} />
            </label>
            <button className="primary-button" disabled={requestState.loading} type="submit">
              {requestState.loading ? 'Loading…' : authMode === 'login' ? 'Enter workspace' : 'Create account'}
            </button>
          </form>

          {requestState.error ? <p className="message message--error">{requestState.error}</p> : null}
        </div>
      </div>
    )
  }

  // ── Main app ──────────────────────────────────────────────────────────────

  return (
    <div className="workspace-shell">
      <aside className="sidebar panel">
        <div className="sidebar__top">
          <div>
            <p className="eyebrow">Planner</p>
            <h2>{workspaceDetails?.name ?? 'Choose a workspace'}</h2>
          </div>
          <button className="ghost-button small-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>

        <label>
          Workspace
          <select value={selectedWorkspaceId ?? ''} onChange={(e) => setSelectedWorkspaceId(Number(e.target.value))}>
            {!workspaces.length ? <option value="">No workspaces yet</option> : null}
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>

        <form className="stack compact" onSubmit={handleWorkspaceCreate}>
          <label>
            New workspace
            <input required placeholder="Weekend in Portland" value={workspaceForm.name} onChange={(e) => setWorkspaceForm({ name: e.target.value })} />
          </label>
          <button className="secondary-button" type="submit">Create workspace</button>
          <button className="ghost-button danger-button" disabled={!selectedWorkspaceId} type="button" onClick={handleWorkspaceDelete}>
            Delete workspace
          </button>
        </form>

        {selectedWorkspaceId ? (
          <form className="stack compact" onSubmit={handleListCreate}>
            <label>
              New list
              <input required placeholder="Food spots" value={listForm.name} onChange={(e) => setListForm((c) => ({ ...c, name: e.target.value }))} />
            </label>
            <button className="secondary-button" type="submit">Add list</button>
          </form>
        ) : null}

        {requestState.error ? <p className="message message--error">{requestState.error}</p> : null}
      </aside>

      <main className="workspace-main">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Planning surface</p>
            <h1>{workspaceDetails?.name ?? 'Your workspace'}</h1>
          </div>
          <div className="toggle-row">
            {['board', 'calendar', 'map'].map((view) => (
              <button
                key={view}
                className={activeView === view ? 'toggle-button active' : 'toggle-button'}
                type="button"
                onClick={() => setActiveView(view)}
              >
                {view === 'board' ? 'Lists' : view === 'calendar' ? 'Calendar' : 'Map'}
              </button>
            ))}
          </div>
        </header>

        {!workspaceDetails ? (
          <section className="panel empty-panel">
            <h3>Create or choose a workspace to begin.</h3>
          </section>
        ) : null}

        {/* ── Board view ─────────────────────────────────────────────── */}
        {workspaceDetails && activeView === 'board' ? (
          <section className="board-grid">
            {(workspaceDetails?.lists ?? []).length === 0 ? (
              <div className="panel empty-panel">
                <h3>No lists yet.</h3>
                <p className="empty-copy">Create a list from the sidebar to get started.</p>
              </div>
            ) : null}
            {(workspaceDetails?.lists ?? []).map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                isSaving={savingListId === list.id}
                itemForm={itemForms[list.id] ?? emptyItemForm}
                onListRename={handleListRename}
                onItemFormChange={(patch) =>
                  setItemForms((cur) => ({ ...cur, [list.id]: { ...(cur[list.id] ?? emptyItemForm), ...patch } }))
                }
                onItemCreate={handleItemCreate}
                onItemPatch={handleItemPatch}
                onItemDelete={handleItemDelete}
                onItemReorder={handleItemReorder}
                onListDelete={handleListDelete}
              />
            ))}
          </section>
        ) : null}

        {/* ── Calendar view ──────────────────────────────────────────── */}
        {workspaceDetails && activeView === 'calendar' ? (
          <section className={`calendar-layout${calendarView === 'week' && !editingEventId ? ' calendar-layout--full' : ''}`}>
            {/* Day view */}
            <div className="calendar-panel panel">
              <div className="cal-header">
                <button className="ghost-button small-button" type="button" onClick={() => calendarView === 'week' ? shiftWeek(-1) : shiftDay(-1)}>‹</button>
                <div className="cal-header__title">
                  {calendarView === 'day' ? (
                    <>
                      <p className="eyebrow">{calendarDayEvents.length} event{calendarDayEvents.length !== 1 ? 's' : ''}</p>
                      <h3>{formatDayLabel(calendarDate)}</h3>
                    </>
                  ) : (
                    <>
                      <p className="eyebrow">{weekEvents.length} event{weekEvents.length !== 1 ? 's' : ''}</p>
                      <h3>{formatWeekRangeLabel(weekDates)}</h3>
                    </>
                  )}
                </div>
                <button className="ghost-button small-button" type="button" onClick={() => calendarView === 'week' ? shiftWeek(1) : shiftDay(1)}>›</button>
              </div>

              <div className="cal-view-toggle">
                <button className={`cal-view-btn${calendarView === 'day' ? ' active' : ''}`} type="button" onClick={() => setCalendarView('day')}>Day</button>
                <button className={`cal-view-btn${calendarView === 'week' ? ' active' : ''}`} type="button" onClick={() => setCalendarView('week')}>Week</button>
              </div>

              {calendarView === 'day' ? (
              <div className="day-view-wrap">
                <div className="day-view" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
                  {/* Hour lines */}
                  {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => {
                    const hour = FIRST_HOUR + i
                    return (
                      <div
                        key={hour}
                        className="hour-row"
                        style={{ top: i * HOUR_PX, height: HOUR_PX }}
                        onClick={(e) => {
                          if (e.target !== e.currentTarget) return
                          handleTimeSlotClick(hour)
                        }}
                      >
                        <span className="hour-label">{formatHour(hour)}</span>
                      </div>
                    )
                  })}

                  {/* New event ghost on hover */}
                  {/* Event blocks */}
                  {calendarDayEvents.map((event) => {
                    const start = new Date(event.itineraryDetails.startTime)
                    const end = event.itineraryDetails.endTime ? new Date(event.itineraryDetails.endTime) : null
                    const topHour = start.getHours() + start.getMinutes() / 60
                    const durationHours = end ? (end - start) / 3600000 : 1
                    const top = (topHour - FIRST_HOUR) * HOUR_PX
                    const height = Math.max(durationHours * HOUR_PX, 28)
                    const laneColor = getLaneColor(start.getHours())

                    return (
                      <button
                        key={event.id}
                        className={`event-block${editingEventId === event.id ? ' event-block--active' : ''}`}
                        style={{ top, height, '--event-color': laneColor }}
                        type="button"
                        onClick={() => setEditingEventId(event.id === editingEventId ? null : event.id)}
                      >
                        <span className="event-block__title">{event.title}</span>
                        {event.itineraryDetails?.locationName ? (
                          <span className="event-block__loc">{event.itineraryDetails.locationName}</span>
                        ) : null}
                        <span className="event-block__time">
                          {formatTimeOnly(event.itineraryDetails.startTime)}
                          {end ? ` – ${formatTimeOnly(event.itineraryDetails.endTime)}` : ''}
                        </span>
                      </button>
                    )
                  })}

                  {/* New event draft overlay */}
                  {newEventDraft ? (
                    <div
                      className="new-event-overlay"
                      style={{
                        top: (parseFloat(newEventDraft.startTime.slice(11, 13)) + parseFloat(newEventDraft.startTime.slice(14, 16)) / 60 - FIRST_HOUR) * HOUR_PX,
                      }}
                    >
                      <form className="new-event-form" onSubmit={handleNewEventSubmit}>
                        <input
                          autoFocus
                          className="new-event-input"
                          placeholder="Event name…"
                          value={newEventDraft.title}
                          onChange={(e) => setNewEventDraft((d) => ({ ...d, title: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Escape' && setNewEventDraft(null)}
                        />
                        <div className="new-event-actions">
                          <span className="new-event-time">{formatTimeOnly(newEventDraft.startTime)}</span>
                          <button className="primary-button small-button" type="submit">Add</button>
                          <button className="ghost-button small-button" type="button" onClick={() => setNewEventDraft(null)}>Cancel</button>
                        </div>
                      </form>
                    </div>
                  ) : null}
                </div>
              </div>
              ) : (
              <div className="week-view-wrap">
                {/* Day headers */}
                <div className="week-header-row">
                  <div className="week-time-spacer" />
                  {weekDates.map((date) => (
                    <div key={date} className={`week-day-header${date === todayString() ? ' week-day-header--today' : ''}`}>
                      <p className="eyebrow">{formatWeekDayShort(date)}</p>
                      <span className={`week-day-num${date === todayString() ? ' week-day-num--today' : ''}`}>{parseInt(date.slice(8))}</span>
                    </div>
                  ))}
                </div>
                {/* Scrollable time grid */}
                <div className="week-scroll">
                  <div className="week-grid" style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX }}>
                    {/* Time labels */}
                    <div className="week-time-col">
                      {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
                        <div key={i} className="week-time-label" style={{ top: i * HOUR_PX, height: HOUR_PX }}>
                          <span>{formatHour(FIRST_HOUR + i)}</span>
                        </div>
                      ))}
                    </div>
                    {/* Day columns */}
                    {weekDates.map((date) => {
                      const dayEvents = weekEvents.filter((e) => e.itineraryDetails.startTime.slice(0, 10) === date)
                      return (
                        <div key={date} className="week-day-col">
                          {Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => (
                            <div
                              key={i}
                              className="week-hour-row"
                              style={{ top: i * HOUR_PX, height: HOUR_PX }}
                              onClick={() => setNewEventDraft({ startTime: `${date}T${String(FIRST_HOUR + i).padStart(2, '0')}:00`, title: '' })}
                            />
                          ))}
                          {dayEvents.map((event) => {
                            const start = new Date(event.itineraryDetails.startTime)
                            const end = event.itineraryDetails.endTime ? new Date(event.itineraryDetails.endTime) : null
                            const topHour = start.getHours() + start.getMinutes() / 60
                            const durationHours = end ? (end - start) / 3600000 : 1
                            const top = (topHour - FIRST_HOUR) * HOUR_PX
                            const height = Math.max(durationHours * HOUR_PX, 28)
                            const laneColor = getLaneColor(start.getHours())
                            return (
                              <button
                                key={event.id}
                                className={`event-block${editingEventId === event.id ? ' event-block--active' : ''}`}
                                style={{ top, height, '--event-color': laneColor }}
                                type="button"
                                onClick={() => setEditingEventId(event.id === editingEventId ? null : event.id)}
                              >
                                <span className="event-block__title">{event.title}</span>
                                {event.itineraryDetails?.locationName ? (
                                  <span className="event-block__loc">{event.itineraryDetails.locationName}</span>
                                ) : null}
                                <span className="event-block__time">
                                  {formatTimeOnly(event.itineraryDetails.startTime)}
                                  {end ? ` – ${formatTimeOnly(event.itineraryDetails.endTime)}` : ''}
                                </span>
                              </button>
                            )
                          })}
                          {newEventDraft && newEventDraft.startTime.slice(0, 10) === date ? (
                            <div
                              className="new-event-overlay"
                              style={{ top: (parseFloat(newEventDraft.startTime.slice(11, 13)) + parseFloat(newEventDraft.startTime.slice(14, 16)) / 60 - FIRST_HOUR) * HOUR_PX }}
                            >
                              <form className="new-event-form" onSubmit={handleNewEventSubmit}>
                                <input
                                  autoFocus
                                  className="new-event-input"
                                  placeholder="Event name…"
                                  value={newEventDraft.title}
                                  onChange={(e) => setNewEventDraft((d) => ({ ...d, title: e.target.value }))}
                                  onKeyDown={(e) => e.key === 'Escape' && setNewEventDraft(null)}
                                />
                                <div className="new-event-actions">
                                  <span className="new-event-time">{formatTimeOnly(newEventDraft.startTime)}</span>
                                  <button className="primary-button small-button" type="submit">Add</button>
                                  <button className="ghost-button small-button" type="button" onClick={() => setNewEventDraft(null)}>Cancel</button>
                                </div>
                              </form>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              )}

              {/* Hint */}
              <p className="cal-hint">Click any time slot to add an event</p>
            </div>

            {/* Event editor panel — hidden in week view until an event is opened */}
            {(calendarView === 'day' || editingEventId) ? <section className="editor-panel panel">
              {editingEvent && itineraryDraft ? (
                <>
                  <div className="editor-panel__header">
                    <div>
                      <p className="eyebrow">Editing event</p>
                      <h3>{editingEvent.title}</h3>
                    </div>
                    <button className="ghost-button danger-button small-button" type="button" onClick={() => handleItemDelete(editingEvent.id)}>
                      Delete
                    </button>
                  </div>

                  <div className="editor-stack">
                    <div className="time-grid">
                      <label>
                        Start
                        <input type="datetime-local" value={itineraryDraft.startTime} onChange={(e) => setItineraryDraft((c) => ({ ...c, startTime: e.target.value }))} />
                      </label>
                      <label>
                        End
                        <input type="datetime-local" value={itineraryDraft.endTime} onChange={(e) => setItineraryDraft((c) => ({ ...c, endTime: e.target.value }))} />
                      </label>
                    </div>

                    <div className="field-with-na">
                      <div className="field-with-na__header">
                        <span>Place name</span>
                        <label className="na-toggle">
                          <input
                            type="checkbox"
                            checked={itineraryDraft.locationName === 'N/A'}
                            onChange={(e) => setItineraryDraft((c) => ({ ...c, locationName: e.target.checked ? 'N/A' : '' }))}
                          />
                          N/A
                        </label>
                      </div>
                      <input
                        disabled={itineraryDraft.locationName === 'N/A'}
                        value={itineraryDraft.locationName === 'N/A' ? '' : itineraryDraft.locationName}
                        placeholder={itineraryDraft.locationName === 'N/A' ? 'N/A' : ''}
                        onChange={(e) => setItineraryDraft((c) => ({ ...c, locationName: e.target.value }))}
                      />
                    </div>

                    <div className="field-with-na">
                      <div className="field-with-na__header">
                        <span>Reservation link</span>
                        <label className="na-toggle">
                          <input
                            type="checkbox"
                            checked={itineraryDraft.reservationUrl === 'N/A'}
                            onChange={(e) => setItineraryDraft((c) => ({ ...c, reservationUrl: e.target.checked ? 'N/A' : '' }))}
                          />
                          N/A
                        </label>
                      </div>
                      <input
                        disabled={itineraryDraft.reservationUrl === 'N/A'}
                        value={itineraryDraft.reservationUrl === 'N/A' ? '' : itineraryDraft.reservationUrl}
                        placeholder={itineraryDraft.reservationUrl === 'N/A' ? 'N/A' : ''}
                        onChange={(e) => setItineraryDraft((c) => ({ ...c, reservationUrl: e.target.value }))}
                      />
                    </div>

                    <div className="place-search-card">
                      <div>
                        <p className="eyebrow">Location search</p>
                        <h4>Enter an address to pin the location</h4>
                      </div>
                      <div className="place-search-controls">
                        <label>
                          Address
                          <input
                            placeholder="1234 Main St, City State"
                            value={placeSearch.query}
                            onChange={(e) => setPlaceSearch((c) => ({ ...c, query: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddressGeocode()}
                          />
                        </label>
                        <button className="secondary-button" type="button" onClick={handleAddressGeocode}>
                          {placeSearch.loading ? 'Searching…' : 'Pin address'}
                        </button>
                      </div>

                      <div className="picker-layout">
                        <div className="picker-map">
                          <LocationPickerMap
                            selectedLocation={itineraryDraft}
                            searchResults={placeSearch.results}
                            selectedSearchResultId={selectedSearchResultId}
                            onMapPick={(pos) => setItineraryDraft((c) => ({ ...c, latitude: pos.lat, longitude: pos.lng, sourceProvider: c.sourceProvider || 'Map selection' }))}
                            onResultPick={applyPlaceResult}
                          />
                        </div>

                        <div className="place-results">
                          {placeSearch.error ? <p className="message message--error">{placeSearch.error}</p> : null}
                          {placeSearch.results.map((result) => (
                            <button
                              className={result.id === selectedSearchResultId ? 'place-result place-result--active' : 'place-result'}
                              key={result.id}
                              type="button"
                              onClick={() => applyPlaceResult(result)}
                            >
                              <div>
                                <h5>{result.name}</h5>
                                <p>{result.address || 'No address'}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {itineraryDraft.address ? (
                        <div className="location-summary">
                          <span>{itineraryDraft.address}</span>
                          {itineraryDraft.latitude ? (
                            <span>{Number(itineraryDraft.latitude).toFixed(4)}, {Number(itineraryDraft.longitude).toFixed(4)}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="editor-actions">
                      {requestState.success ? <p className="message message--success">{requestState.success}</p> : <span />}
                      <button className="primary-button" type="button" onClick={handleItinerarySave}>
                        Save event
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-panel inner">
                  <h3>Select an event or click a time slot to add one.</h3>
                  <p className="empty-copy">Events you add will show here for editing.</p>
                </div>
              )}
            </section> : null}
          </section>
        ) : null}

        {/* ── Map view ───────────────────────────────────────────────── */}
        {workspaceDetails && activeView === 'map' ? (
          <section className="panel map-panel">
            <div className="map-panel__header">
              <div>
                <p className="eyebrow">Places</p>
                <h3>Map & saved pins</h3>
              </div>
              <div className="stat-row">
                <span className="stat-pill map-legend-pill map-legend-pill--itinerary">{mapMarkers.filter((m) => m.markerType === 'itinerary').length} itinerary</span>
                <span className="stat-pill map-legend-pill map-legend-pill--places">{mapMarkers.filter((m) => m.markerType === 'places').length} saved</span>
              </div>
            </div>

            <div className="address-search-bar">
              <label>
                Address
                <input
                  value={placeSearch.query}
                  placeholder="1234 Main St, City State"
                  onChange={(e) => setPlaceSearch((cur) => ({ ...cur, query: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddressGeocode()}
                />
              </label>
              <button className="primary-button small-button" type="button" onClick={handleAddressGeocode}>
                {placeSearch.loading ? 'Searching…' : 'Pin address'}
              </button>
            </div>
            {placeSearch.error ? (
              <p className="message message--error" style={{ margin: '0 1rem' }}>{placeSearch.error}</p>
            ) : null}

            <div className="map-surface">
              <div className="map-stage-shell">
                <div className="map-stage-header">
                  <div>
                    <p className="eyebrow">Live map</p>
                    <h4>{selectedMapMarker ? selectedMapMarker.locationName || selectedMapMarker.title : 'Your saved places'}</h4>
                  </div>
                  {selectedMapMarker ? <span className="map-selection-pill">{selectedMapMarker.listName}</span> : null}
                </div>
                <div className="map-stage-real">
                  <WorkspaceMap
                    markers={displayMapMarkers}
                    selectedMapItemId={selectedMapItemId}
                    onMarkerSelect={(id) => {
                      if (typeof id === 'string') return
                      setSelectedMapItemId(id)
                    }}
                  />
                </div>
              </div>

              <div className="map-results-panel">
                {/* Selected pin or search preview */}
                {selectedMapMarker ? (
                  <div className="selected-pin-card">
                    <p className="eyebrow">Selected pin</p>
                    <h4>{selectedMapMarker.locationName || selectedMapMarker.title}</h4>
                    <p>{selectedMapMarker.address || 'No address saved.'}</p>
                    {selectedMapMarker.startTime ? <span className="stat-pill">{formatDateTime(selectedMapMarker.startTime)}</span> : null}
                    <button
                      className="ghost-button danger-button small-button"
                      type="button"
                      onClick={() => handlePinDelete(selectedMapMarker.id)}
                    >
                      Remove pin
                    </button>
                  </div>
                ) : (
                  <div className="selected-pin-card selected-pin-card--empty">
                    <p className="eyebrow">Select a pin</p>
                    <h4>Click a pin on the map or a result below</h4>
                  </div>
                )}

                {placeSearch.error ? <p className="message message--error">{placeSearch.error}</p> : null}

                {/* Saved pins */}
                {mapMarkers.length > 0 ? (
                  <div className="saved-pins-section">
                    <div className="saved-pins-section__header">
                      <p className="eyebrow">All pins</p>
                      <span className="calendar-day-count">{mapMarkers.length}</span>
                    </div>
                    <div className="saved-pin-list">
                      {mapMarkers.map((marker) => (
                        <button
                          key={marker.id}
                          className={marker.id === selectedMapItemId ? 'saved-pin-card active' : 'saved-pin-card'}
                          type="button"
                          onClick={() => setSelectedMapItemId(marker.id)}
                        >
                          <div className="saved-pin-card__row">
                            <span className={`pin-type-dot pin-type-dot--${marker.markerType}`} />
                            <strong>{marker.locationName || marker.title}</strong>
                          </div>
                          <span>{marker.address || 'No address saved.'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Search results */}
                {placeSearch.results.length > 0 ? (
                  <div className="saved-pins-section">
                    <div className="saved-pins-section__header">
                      <p className="eyebrow">Search results</p>
                      <span className="calendar-day-count">{placeSearch.results.length}</span>
                    </div>
                    <div className="saved-pin-list">
                      {placeSearch.results.map((result) => (
                        <div className="place-result place-result--card" key={result.id}>
                          <div>
                            <h5>{result.name}</h5>
                            <p>{result.address || 'No address'}</p>
                          </div>
                          <button className="primary-button small-button" type="button" onClick={() => handleCreatePinFromSearch(result)}>
                            Save pin
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {requestState.success ? <p className="message message--success">{requestState.success}</p> : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

// ── ListColumn ────────────────────────────────────────────────────────────────

export function ListColumn({ list, itemForm, isSaving, onListRename, onListDelete, onItemFormChange, onItemCreate, onItemPatch, onItemDelete, onItemReorder }) {
  const [collapsed, setCollapsed] = useState(false)
  const completedCount = list.items.filter((i) => i.completed).length

  return (
    <article className="panel list-column">
      <div className="list-column__header">
        <div className="list-column__title-group">
          <input
            className="list-title-input"
            defaultValue={list.name}
            key={`${list.id}-${list.name}`}
            onBlur={(e) => onListRename(list.id, e.target.value)}
          />
          <span className={`type-pill type-pill--${list.type.toLowerCase()}`}>
            {isSaving ? 'Saving…' : TYPE_NAMES[list.type] || list.type}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            className="ghost-button small-button"
            type="button"
            title={collapsed ? 'Expand' : 'Collapse'}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? `▾ ${list.items.length}` : '▴'}
          </button>
          <button className="ghost-button danger-button small-button" type="button" onClick={() => onListDelete(list.id)}>
            ✕
          </button>
        </div>
      </div>

      {!collapsed ? (
        <>
          <div className="list-item-stack">
            {!list.items.length ? <p className="empty-copy">No items yet.</p> : null}
            {list.type === 'TASK' && list.items.length > 0 ? (
              <p className="list-progress">{completedCount}/{list.items.length} done</p>
            ) : null}
            {list.items.map((item, index) => (
              <div className={`list-item-card${item.completed ? ' list-item-card--done' : ''}`} key={item.id}>
                <div className="list-item-row">
                  {list.type === 'TASK' ? (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={(e) => onItemPatch(item.id, { completed: e.target.checked })}
                      />
                      <span className="checkbox-box" />
                    </label>
                  ) : null}

                  <input
                    className={`list-item-title${item.completed ? ' list-item-title--done' : ''}`}
                    defaultValue={item.title}
                    key={`${item.id}-${item.title}`}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next && next !== item.title) onItemPatch(item.id, { title: next })
                    }}
                  />

                  <div className="item-action-btns">
                    <button className="ghost-button tiny-button" disabled={index === 0} type="button" onClick={() => onItemReorder(list.id, item.id, 'up')}>↑</button>
                    <button className="ghost-button tiny-button" disabled={index === list.items.length - 1} type="button" onClick={() => onItemReorder(list.id, item.id, 'down')}>↓</button>
                    <button className="ghost-button danger-button tiny-button" type="button" onClick={() => onItemDelete(item.id)}>✕</button>
                  </div>
                </div>

              </div>
            ))}
          </div>

          <form className="inline-form" onSubmit={(e) => onItemCreate(e, list.id)}>
            <input
              required
              placeholder={`Add to ${list.name}…`}
              value={itemForm.title}
              onChange={(e) => onItemFormChange({ title: e.target.value })}
            />
            <button className="secondary-button" type="submit">Add</button>
          </form>
        </>
      ) : null}
    </article>
  )
}

// ── Map components ────────────────────────────────────────────────────────────

function WorkspaceMap({ markers, onMarkerSelect, selectedMapItemId }) {
  const center = markers[0] ? [markers[0].latitude, markers[0].longitude] : DEFAULT_CENTER
  return (
    <MapContainer center={center} zoom={markers[0] ? 12 : 4} scrollWheelZoom className="leaflet-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds markers={markers} />
      <FlyToMarker markers={markers} selectedId={selectedMapItemId} />
      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.latitude, marker.longitude]} icon={createPinIcon(marker.isDraft ? 'draft' : marker.markerType)}>
          <Popup>
            <div className="popup-stack">
              <strong>{marker.locationName || marker.title}</strong>
              <span>{marker.address || 'No address yet'}</span>
              {!marker.isDraft ? (
                <button className="ghost-button small-button" type="button" onClick={() => onMarkerSelect(marker.id)}>Select</button>
              ) : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

function LocationPickerMap({ selectedLocation, searchResults, selectedSearchResultId, onMapPick, onResultPick }) {
  const center =
    selectedLocation?.latitude && selectedLocation?.longitude
      ? [Number(selectedLocation.latitude), Number(selectedLocation.longitude)]
      : searchResults[0]?.latitude && searchResults[0]?.longitude
        ? [Number(searchResults[0].latitude), Number(searchResults[0].longitude)]
        : DEFAULT_CENTER

  return (
    <MapContainer center={center} zoom={selectedLocation?.latitude ? 13 : 4} scrollWheelZoom className="leaflet-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <RecenterOnSelection center={center} />
      <MapClickCapture onMapPick={onMapPick} />
      {selectedLocation?.latitude && selectedLocation?.longitude ? (
        <Marker position={[Number(selectedLocation.latitude), Number(selectedLocation.longitude)]} icon={createPinIcon('itinerary')}>
          <Popup>Selected location</Popup>
        </Marker>
      ) : null}
      {searchResults.map((result) =>
        result.latitude && result.longitude ? (
          <Marker key={result.id} position={[Number(result.latitude), Number(result.longitude)]} icon={createPinIcon('places')}>
            <Popup>
              <div className="popup-stack">
                <strong>{result.name}</strong>
                <span>{result.address}</span>
                <button className="ghost-button small-button" type="button" onClick={() => onResultPick(result)}>Use this place</button>
              </div>
            </Popup>
          </Marker>
        ) : null,
      )}
    </MapContainer>
  )
}

function MapClickCapture({ onMapPick }) {
  useMapEvents({ click: (e) => onMapPick(e.latlng) })
  return null
}

function RecenterOnSelection({ center }) {
  const map = useMap()
  const prevCenter = useRef(null)
  useEffect(() => {
    const prev = prevCenter.current
    const changed = prev == null || Math.abs(prev[0] - center[0]) > 0.0001 || Math.abs(prev[1] - center[1]) > 0.0001
    if (changed) {
      prevCenter.current = center
      map.setView(center)
    }
  }, [center, map])
  return null
}

function FitBounds({ markers }) {
  const map = useMap()
  useEffect(() => {
    if (markers.length < 2) return
    map.fitBounds(markers.map((m) => [m.latitude, m.longitude]), { padding: [32, 32] })
  }, [map, markers])
  return null
}

function FlyToMarker({ markers, selectedId }) {
  const map = useMap()
  const prevId = useRef(null)
  useEffect(() => {
    if (selectedId === prevId.current) return
    prevId.current = selectedId
    const marker = markers.find((m) => m.id === selectedId)
    if (marker) map.flyTo([marker.latitude, marker.longitude], Math.max(map.getZoom(), 13), { duration: 0.7 })
  }, [selectedId, markers, map])
  return null
}

// ── Utility functions ─────────────────────────────────────────────────────────

function formatError(e) {
  return e instanceof Error ? e.message : 'Something went wrong.'
}

function todayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toDateTimeInputValue(value) {
  if (!value) return ''
  return value.slice(0, 16)
}

function formatDateTime(value) {
  if (!value) return 'Unscheduled'
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function formatTimeOnly(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function formatHour(hour) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(2000, 0, 1, hour))
}

function formatDayLabel(value) {
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(dateStr))
}

function formatWeekDayShort(dateStr) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(dateStr + 'T12:00:00'))
}

function formatWeekRangeLabel(weekDates) {
  if (!weekDates?.length) return ''
  const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  return `${fmt.format(new Date(weekDates[0] + 'T12:00:00'))} – ${fmt.format(new Date(weekDates[6] + 'T12:00:00'))}`
}

function getLaneColor(hour) {
  if (hour < 12) return '#9a6e10'
  if (hour < 17) return '#c25b18'
  return '#4a3f7a'
}

export default App
