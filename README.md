# HealthScholar

HealthScholar is an AI-powered health research platform built as a monorepo with a FastAPI backend and a Next.js frontend.

## Repository structure

- `backend/` — FastAPI backend, SQLAlchemy models, scrapers, analysis engine, AI endpoints
- `frontend/` — Next.js application (not yet scaffolded)
- `docker-compose.yml` — local development stack with PostgreSQL, Elasticsearch, backend, and frontend

## Local development

1. Copy environment templates:
   - `cp backend/.env.example backend/.env`
   - Create `frontend/.env.local` with:
     ```text
     NEXT_PUBLIC_API_URL=http://localhost:8000
     ```

2. Start services:
   ```bash
   docker-compose up --build
   ```

3. Backend documentation:
   - `http://localhost:8000/docs`

## Current status

- Backend core models, auth, articles, papers, analysis, and scraper services are implemented.
- Several backend routers were not mounted; those routes are now enabled.
- Frontend scaffolding still needs to be created.
