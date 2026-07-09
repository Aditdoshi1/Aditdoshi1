# Automation Hub

Central web dashboard to monitor and control your local automations.

## Pages

| URL | Purpose |
|-----|---------|
| http://127.0.0.1:8080/ | Main monitoring dashboard |
| http://127.0.0.1:8080/whatsapp-guard.html | WhatsApp Spam Guard controls + embedded dashboard |
| http://127.0.0.1:8080/placeholder.html | Placeholder for a second automation |

## Quick start

```bash
cd automations-hub
npm install
npm start
```

Open **http://127.0.0.1:8080**

## Automations

### WhatsApp Spam Guard
- **Start** — launches the bot process
- **Pause** — keeps the bot online but disables moderation actions
- **Resume** — turns moderation back on
- **Stop** — shuts down the bot process

The spam guard dashboard runs at http://127.0.0.1:3000 and is embedded on the WhatsApp Guard page.

### Automation 2
Placeholder slot for a future automation.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/automations` | List automations and status |
| POST | `/api/automations/:id/start` | Start automation |
| POST | `/api/automations/:id/stop` | Stop automation |
| POST | `/api/automations/:id/pause` | Pause automation |
| POST | `/api/automations/:id/resume` | Resume automation |
| GET | `/api/automations/:id/logs` | Recent process logs |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `HUB_PORT` | `8080` | Hub web server port |

## Windows

```cmd
cd automations-hub
npm install
npm start
```

Then open http://127.0.0.1:8080
