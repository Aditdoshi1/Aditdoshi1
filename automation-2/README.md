# Deal Scout (Automation 2)

Find deals and price drops from **free data sources** — primarily Slickdeals RSS — with an optional Amazon watchlist via Canopy's free tier.

WhatsApp Spam Guard is **not modified** by this project.

## Services

| Service | Folder | Port | Hub page |
|---------|--------|------|----------|
| Automation Hub | `automations-hub/` | 8080 | — |
| WhatsApp Guard | `whatsapp-spam-guard/` | 3000 | `/whatsapp-guard.html` |
| **Deal Scout** | `automation-2/` | **3001** | `/deal-scout.html` |

## Quick start

```bash
cd automation-2
npm install
npm start
```

Open **http://127.0.0.1:3001** for the dashboard.

Optional: copy `config.example.yaml` to `config.yaml` to customize feeds, thresholds, and scheduler interval.

## Data sources (v1)

| Source | API key | Notes |
|--------|---------|-------|
| **Slickdeals RSS** | None | Primary — popdeals + frontpage feeds |
| **Keyword RSS** | None | Add keywords in UI or `config.yaml` |
| **Canopy Amazon** | `CANOPY_API_KEY` in `.env` | Optional watchlist (100 free req/mo) |
| **Reddit r/deals** | `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Optional phase-2 source |

Amazon PA-API and Walmart Affiliate are deferred (see `src/sources/affiliateApis.js`).

## Configuration

`config.example.yaml`:

- `scheduler.intervalMinutes` — default 120 (RSS-friendly)
- `deals.minDropPct` — flag price drops at or above this % (default 10)
- `deals.minAbsoluteDrop` — minimum dollar drop (default $5)
- `sources.slickdeals.feeds` — `popdeals`, `frontpage`
- `sources.canopy.enabled` — set `true` after Canopy signup

Secrets in `.env` (gitignored):

```
CANOPY_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=DealScout/1.0
```

## Project layout

```
automation-2/
├── config.example.yaml
├── data/                 # SQLite (gitignored)
├── src/
│   ├── index.js
│   ├── config.js
│   ├── db/
│   ├── engine/
│   ├── sources/
│   ├── utils/
│   └── dashboard/
└── README.md
```

## API endpoints

- `GET /api/status` — scheduler state, stats, sources
- `GET /api/deals?retailer=&minDrop=&keyword=` — filtered deals
- `POST /api/scan` — run scan now
- `GET/POST/DELETE /api/watchlist` — Amazon watchlist
- `GET/POST/DELETE /api/keywords` — Slickdeals keyword feeds
- `POST /api/pause` / `POST /api/resume` — pause scheduler (`.paused` file)

## Hub integration

Deal Scout is registered in `automations-hub/src/automations.js` and embedded at `/deal-scout.html`. Start/stop/pause from the hub without affecting WhatsApp Guard.

## Branch

Develop on `cursor/automation-2-bb4a`.
