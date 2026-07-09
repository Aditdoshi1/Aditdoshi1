# Automation 2 (side development)

Build the second automation here **without touching WhatsApp Spam Guard**.

## Parallel setup

| Service | Folder | Port | Hub page |
|---------|--------|------|----------|
| Automation Hub | `automations-hub/` | 8080 | — |
| WhatsApp Guard | `whatsapp-spam-guard/` | 3000 | `/whatsapp-guard.html` |
| **Automation 2 (dev)** | `automation-2/` | **3001** | `/placeholder.html` (until merged) |

Keep WhatsApp Guard running as usual. This project uses a **different port** so nothing conflicts.

## Run Automation 2 dev server

```bash
cd automation-2
npm install
npm start
```

Open **http://127.0.0.1:3001** for the dev dashboard.

WhatsApp Guard and the hub are **not** modified by this folder.

## Project layout

```
automation-2/
├── config.example.yaml   # copy to config.yaml when needed
├── src/
│   ├── index.js          # entry point — add your automation here
│   ├── config.js
│   └── dashboard/        # dev UI (port 3001)
└── README.md
```

## When ready to merge into the hub

1. Finish automation logic and dashboard under `automation-2/`
2. In `automations-hub/src/automations.js`, replace the placeholder entry with a real `process` automation (same pattern as WhatsApp Guard)
3. Replace `automations-hub/public/placeholder.html` with a real hub page (or rename to match)
4. Test Start / Stop / Pause from the hub without breaking WhatsApp Guard

Do **not** change `whatsapp-spam-guard/` when merging — only hub registry + new hub page.

## Branch

Develop on `cursor/automation-2-bb4a`. WhatsApp work stays on `cursor/automations-hub-bb4a` / `cursor/whatsapp-spam-guard-bb4a`.
