# Sales Intelligence Automator — Frontend

A single-page Next.js (App Router) UI for the
[Sales Intelligence Automator](../SalesIntelligenceAutomator) backend — paste or upload a list
of leads, run the research pipeline, and view the generated sales briefs.

Function over form, but not bare: a lead input with drag-and-drop upload, a results table with
filtering and sorting, a popup detail view, and a light/dark theme toggle.

---

## 1. What it does

1. **Input** — paste leads (one per line: company names, "Name – City ST", or URLs), drag a
   `.txt`/`.csv` onto the textarea, or use the upload button. A **Load sample leads** button
   fills in the assignment's sample set on demand (the box starts empty).
2. **Run** — submits to `POST /api/leads` on the backend, which returns immediately with
   `pending` lead records and starts processing them in the background.
3. **Poll** — polls `GET /api/leads` every 2 seconds and updates the table until every lead
   reaches `done` or `failed`.
4. **Results table** — company, resolved URL (`N/A` if none could be found), status badge,
   B2B Yes/No, confidence. Filter by status / B2B / confidence, and sort by recency or
   confidence (ascending or descending).
5. **Detail view** — click a row for a popup modal with the full brief: company overview, core
   product/service, target customer, B2B qualification + reasoning + the evidence signals
   behind it, the three sales questions, confidence, and an evidence note. `failed` leads show
   their error message. Close with the ✕, a click outside, or Escape.
6. **Download Excel** — downloads all current results as an `.xlsx` workbook via
   `GET /api/leads/export`.
7. **Clear History** — clears all stored lead records via `DELETE /api/leads` (with a
   confirmation prompt) and resets the table.
8. **Theme** — light/dark toggle, persisted in `localStorage`.

---

## 2. Project structure

```
SalesIntelligenceAutomatorFrontend/
├── app/
│   ├── layout.tsx       # root layout
│   ├── page.tsx         # the entire UI: input, run, polling, filters, sort, table, modal
│   ├── types.ts         # shared TypeScript types matching the backend's Pydantic schemas
│   └── globals.css       # styling + light/dark theme variables
├── package.json
├── tsconfig.json
├── next.config.js
└── .env.example
```

---

## 3. Setup & run

### Requirements
- Node.js 20+
- The backend running (see
  [SalesIntelligenceAutomator](../SalesIntelligenceAutomator)) — by default at
  `http://localhost:8000`

### Install

```powershell
npm install
```

### Configure

```powershell
copy .env.example .env.local
```

`.env.example` is a blank template (safe to commit). Edit `.env.local` (gitignored) and set:

| Variable | Purpose | Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API | `http://localhost:8000` |

### Run

```powershell
npm run dev
```

Open the printed URL (default http://localhost:3000 — Next.js will pick the next free port,
e.g. 3001, if 3000 is in use).

> **Backend CORS:** make sure the backend's `CORS_ORIGINS` setting includes whatever origin
> this app actually runs on (check the terminal output for the port).

### Production build

```powershell
npm run build
npm run start
```

---

## 4. Design notes

Kept deliberately minimal: a single client component (`app/page.tsx`) owns all state (leads
text/file, results, selected lead, polling). No state management library, no component
library — plain `fetch` + `useState`/`useEffect` + a small CSS file. Polling (rather than
WebSockets/SSE) matches the backend's `BackgroundTasks`-based processing and is simple enough
for the MVP; if the backend moves to a queue-based worker, this would be the first place to
swap in a push-based update mechanism (SSE or WebSocket) instead of 2-second polling.
