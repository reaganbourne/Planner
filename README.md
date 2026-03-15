# Planner

A full-stack trip planning application with task lists, a timed itinerary calendar, an interactive pin map, and JWT-based authentication.

---

## Features

- **Board view** — Kanban-style lists for tasks and saved places
- **Calendar view** — Day and week schedule with click-to-create events, location tagging, and reservation links
- **Map view** — Interactive Leaflet map with color-coded pins (blue for itinerary events, gold for saved places); enter any address to geocode and pin it
- **Authentication** — Register / login with JWT; each user's data is fully isolated
- **Place search** — Powered by the Nominatim / OpenStreetMap API; no API key required

---

## Tech Stack

### Frontend
| Tool | Version |
|---|---|
| React | 19 |
| Vite | 8 |
| React Leaflet | 5 |
| Vitest + Testing Library | 4 / 16 |

### Backend
| Tool | Version |
|---|---|
| Java | 21 |
| Spring Boot | 4 |
| Spring Security + JWT | jjwt 0.12 |
| Spring Data JPA + Hibernate | 7 |
| Flyway | — |
| PostgreSQL | 14+ |
| Lombok | — |

---

## Project Structure

```
planner/
├── frontend/          # React + Vite SPA
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       └── *.test.jsx
│
└── backend/planner/   # Spring Boot API
    └── src/main/
        ├── java/com/reagan/planner/
        │   ├── auth/
        │   ├── config/
        │   ├── workspace/
        │   ├── plannerlist/
        │   ├── listitem/
        │   └── places/
        └── resources/
            ├── application.yml
            └── db/migration/   # Flyway SQL migrations
```

---

## Running Locally

### Prerequisites
- Java 21
- Node 20+
- PostgreSQL running locally

### 1. Database

```bash
psql -c "CREATE DATABASE planner;"
```

Flyway will apply all migrations automatically on first startup.

### 2. Backend

```bash
cd backend/planner
./mvnw spring-boot:run
```

The API starts on **http://localhost:8080**.

Set your Nominatim contact email (recommended by OSM usage policy):

```bash
NOMINATIM_EMAIL=you@example.com ./mvnw spring-boot:run
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app opens at **http://localhost:5173**.

### 4. Tests

```bash
# Frontend
cd frontend && npx vitest run

# Backend
cd backend/planner && ./mvnw test
```

---

## Environment Variables

| Variable | Where | Default | Description |
|---|---|---|---|
| `NOMINATIM_EMAIL` | Backend env | *(empty)* | Contact email sent in Nominatim User-Agent |
| `spring.datasource.url` | `application.yml` | `jdbc:postgresql://localhost:5432/planner` | PostgreSQL JDBC URL |
| `spring.datasource.username` | `application.yml` | `reaganbourne` | DB username |
| `spring.datasource.password` | `application.yml` | *(empty)* | DB password |
| `jwt.secret` | `application.yml` | *(base64 key)* | JWT signing secret — **change in production** |
| `jwt.expiration` | `application.yml` | `86400000` | Token lifetime in ms (24 h) |

---

## API Overview

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login

GET    /api/v1/workspaces
POST   /api/v1/workspaces
GET    /api/v1/workspaces/{id}
DELETE /api/v1/workspaces/{id}

POST   /api/v1/workspaces/{id}/lists
PATCH  /api/v1/lists/{listId}
DELETE /api/v1/lists/{listId}

POST   /api/v1/lists/{listId}/items
PATCH  /api/v1/items/{itemId}
DELETE /api/v1/items/{itemId}
POST   /api/v1/lists/{listId}/items/reorder

PATCH  /api/v1/items/{itemId}/itinerary-details
GET    /api/v1/places/search?query=...
GET    /health
```

All routes except `/api/v1/auth/**` and `/health` require an `Authorization: Bearer <token>` header.

---

## Database Schema

Seven Flyway migrations build the following tables:

- **users** — email + bcrypt password hash
- **workspaces** — owned by a user
- **planner_lists** — belongs to a workspace; type is `TASK`, `ITINERARY`, or `PLACES`
- **list_items** — title, notes, completion, sort order
- **itinerary_item_details** — start/end time, location name, address, lat/lng, reservation URL, place source metadata

---

## License

MIT
