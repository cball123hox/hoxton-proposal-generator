# Hoxton Wealth — Proposal Generator

Internal tool for Hoxton Wealth advisers to build branded client proposals. Advisers select a region, input client details, optionally run an AI-powered call transcript summary, pick relevant product modules, customise slide content, and generate a downloadable PDF.

## Tech Stack

- **Frontend:** React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4
- **Backend / Auth:** Supabase (Auth, Postgres, Edge Functions, Storage)
- **PDF Service:** Express + Puppeteer (separate Node service)
- **Icons:** Lucide React
- **Drag & Drop:** dnd-kit

## Local Development

### Prerequisites

- Node.js 20+
- A Supabase project with auth, database, storage, and edge functions configured

### 1. Clone & install

```bash
git clone <repo-url>
cd hoxton-proposal-generator
npm install
cd pdf-service && npm install && cd ..
```

### 2. Environment variables

Copy the example files and fill in your values:

```bash
cp .env.example .env.local
cp pdf-service/.env.example pdf-service/.env
```

### 3. Run the app

```bash
# Frontend (port 5173)
npm run dev

# PDF service (port 3001) — in a separate terminal
cd pdf-service && npm run dev
```

## Environment Variables

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `VITE_PDF_SERVICE_URL` | URL of the PDF generation service |

### PDF Service (`pdf-service/.env`)

| Variable | Description |
|---|---|
| `PORT` | Server port (default 3001) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `STATIC_ASSETS_BASE_URL` | Base URL for slide image assets |

## Folder Structure

```
src/
  components/
    admin/       — Admin panels (users, templates, slides)
    auth/        — ProtectedRoute
    layout/      — AppLayout, Sidebar
    proposal/    — Step components for the proposal wizard
    ui/          — Shared UI (Modal, Toast, Badge, Spinner, etc.)
  hooks/         — Custom React hooks
  lib/           — Supabase client, auth, logger, constants, utilities
  pages/         — Route-level page components
  types/         — TypeScript interfaces

pdf-service/
  src/
    index.ts         — Express server with /generate and /health
    generate-pdf.ts  — Puppeteer PDF generation
    assemble-html.ts — HTML template assembly
    templates/       — HTML/CSS templates for PDF slides
```

## Deployment

### Frontend (Vercel)

The project includes a `vercel.json` with SPA rewrites, security headers, and cache configuration. Deploy by connecting the repo to Vercel — it will auto-detect Vite.

### PDF Service

Deploy as a standalone Node.js service (e.g. Railway, Fly.io, Cloud Run). Ensure Puppeteer/Chromium is available in the runtime. Set the environment variables listed above.
