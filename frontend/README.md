# Planner Frontend

This is the React frontend for the planner app. It is designed to work with the Spring Boot backend in `backend/planner`.

## What it does

- Registers and logs in users against `/api/v1/auth`
- Loads workspaces from `/api/v1/workspaces`
- Uses the richer workspace details endpoint to render:
  - list board
  - itinerary calendar view
  - map-style pin view for itinerary places
- Lets you create:
  - workspaces
  - lists
  - items
- Lets you edit itinerary stop details, including:
  - start/end time
  - address
  - latitude/longitude
  - provider-linked place metadata
- Lets you search free OpenStreetMap place data through the backend proxy
- Shows workspace suggestions based on missing lists, unscheduled stops, missing pins, and incomplete tasks

## Run it

1. Start the backend on `http://localhost:8080`
2. Install frontend dependencies:

```bash
npm install
```

3. Start the React dev server:

```bash
npm run dev
```

4. Open the URL Vite prints, usually `http://localhost:5173`

The Vite dev server proxies `/api` requests to `http://localhost:8080`, so local development works without extra CORS setup.

## Optional environment variable

If your backend is not running on `http://localhost:8080`, create a `.env.local` file in `frontend/`:

```bash
VITE_API_BASE=http://your-host:your-port
```

## Free place search setup

The backend now uses OpenStreetMap Nominatim for free place search. No API key is required.

Optional:

```bash
export NOMINATIM_EMAIL=you@example.com
```

That lets the backend include a contact email when calling the public Nominatim service.

Place search is available through:

```text
GET /api/v1/places/search?query=coffee&location=Lisbon
```

## Checks

```bash
npm run lint
npm run build
```

## Notes

- The public Nominatim service is best for low-volume, user-triggered lookups.
- This UI uses a manual search button, not background autocomplete, to stay friendly to the free service.
