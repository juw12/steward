# Steward Dashboard

A Next.js governance dashboard for the Steward AI proxy. Monitor audit logs,
inspect policies, and watch live traffic in real time.

## Run Instructions

### Prerequisites

- Node.js 18+
- Python 3.10+ (for the seed script)
- The Steward proxy running on port 8080 (optional — dashboard works without it, showing empty states)

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000

### Production Build

```bash
npm run build
npm start
```

### Seed Sample Data

The dashboard reads from the proxy's HTTP API. To pre-populate the audit log
with ~50 realistic sample entries (covering all 4 categories and 6 features):

```bash
python seed_data.py
```

This writes directly to `packages/proxy/data/audit.db`. The proxy must be
running for the dashboard to serve the data via its API endpoints.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_PROXY_URL` | `http://localhost:8080` | Base URL of the Steward proxy |

Set via `.env.local` or environment:

```bash
# .env.local
NEXT_PUBLIC_PROXY_URL=http://localhost:8080
```

### Proxy API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /v1/audit?limit=&offset=&category=&action=&feature=` | Paginated audit log |
| `GET /v1/audit/stats` | Aggregated stats for charts |
| `GET /v1/policies` | List policies |
| `GET /v1/policies/{name}` | Get one policy as JSON |
| `GET /health` | Health check (status pill) |

## Pages

- **`/`** Overview — KPI cards, bar chart by category, line chart over time, top features
- **`/audit`** Audit — Filterable table with category/action/feature filters + pagination
- **`/policies`** Policies — List of active policies, click to view full JSON
- **`/live`** Live — Real-time tail of recent entries (polls every 3s)

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- shadcn/ui (Radix primitives)
- Recharts (BarChart, LineChart)
- next-themes (dark/light mode)

## Design

The dashboard uses a "stewardship" palette:
- **Light mode**: warm paper white background, deep navy primary, amber accents
- **Dark mode**: deep slate background, amber primary (pops on dark), muted navy text

Colors are defined as OKLCH CSS custom properties in `app/globals.css`.
