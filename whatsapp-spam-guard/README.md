# WhatsApp Spam Guard

Automatically moderates WhatsApp groups by detecting spam links and keywords, deleting offending messages, and removing the sender.

## What it does

- Monitors configured WhatsApp groups where your account is an admin
- Detects **links** and **custom keywords** in incoming messages
- Deletes spam messages for everyone
- Removes the sender from the group
- Skips group admins (never auto-kicks admins)
- Supports **dry-run mode** for safe testing

## Important warnings

- Uses the unofficial [`whatsapp-web.js`](https://github.com/pedroslopez/whatsapp-web.js) library (WhatsApp Web automation)
- This may violate WhatsApp Terms of Service and carries a small account-ban risk
- The bot must stay online 24/7 to work (local PC or VPS)
- Your logged-in WhatsApp account must be a **group admin** in every monitored group

## Quick start

### 1. Install dependencies

```bash
cd whatsapp-spam-guard
npm install
```

### 2. Configure groups and keywords

Edit [`config.yaml`](config.yaml):

```yaml
monitoredGroups:
  - name: "My Public Group 1"
  # - id: "120363123456789012@g.us"

rules:
  blockAllLinks: true
  keywords:
    - "crypto"
    - "earn money"
  matchMode: "any"   # "any" = link OR keyword; "all" = both required
  dryRun: true       # start with true for testing

moderation:
  deleteMessage: true
  removeUser: true
  logToFile: true
  rateLimitSeconds: 60
```

### 3. Start the bot

```bash
npm start
```

Scan the QR code with WhatsApp on your phone:

**WhatsApp → Linked Devices → Link a Device**

You can also open **http://localhost:3000** — the dashboard shows a scannable QR image.

**Important:** WhatsApp often blocks linking from cloud servers (AWS, DigitalOcean, etc.). If you see *"can't connect to this device"*, run the bot on **your own computer** instead:

```bash
git clone https://github.com/Aditdoshi1/Aditdoshi1.git
cd Aditdoshi1/whatsapp-spam-guard
npm install
npm start
```

Then open http://localhost:3000 and scan from there.

### 4. Open the dashboard

While the bot runs, open:

**http://localhost:3000**

The dashboard lets you:

- See deleted/spam messages by group
- Toggle which WhatsApp groups the bot monitors
- Check bot connection status and dry-run mode

### 5. Test safely

1. Keep `dryRun: true` initially
2. Enable your groups in the dashboard
3. Send a test spam message from a non-admin account
4. Check the dashboard log or `logs/moderation.log`
5. Set `dryRun: false` when ready for live moderation

## Finding your group ID

When the bot is running, group IDs appear in moderation logs after the first message in that group. You can also temporarily add debug logging, or use WhatsApp Web group info.

Group IDs look like: `120363123456789012@g.us`

Using the group ID in config is more reliable than matching by name.

## Limit groups

Open **http://localhost:3000** → **Monitored Groups**.

- Only groups where **you are an admin** are listed
- **Toggle ON** = bot scans that group for spam
- **Toggle OFF** = bot ignores that group completely
- Changes save instantly

## Manage spam rules

Use the **Spam Rules** panel on the dashboard:

| Setting | What it does |
|---------|--------------|
| Keywords | One per line. Messages containing these words are flagged |
| Block all links | Delete/remove any message with a URL |
| Match mode | `any` = link OR keyword; `all` = both required |
| Dry run | Log only, no delete/kick (good for testing) |
| Word boundaries | Avoid partial matches like "coin" in "bitcoin" |

Click **Save Rules** after editing.

## Mark spam directly in WhatsApp

As a group admin, **reply to any message** with:

```
!spam
```

The bot will:
1. Delete the replied-to message for everyone
2. Remove the sender from the group
3. Log it in the dashboard as `manual`

This works even if the message didn't match your keyword rules. You can change the command in the dashboard (default: `!spam`).

**Note:** Turn off **Dry run** in the dashboard when you want live delete/kick actions.

## Spam detection rules

| Setting | Description |
|---------|-------------|
| `blockAllLinks` | Trigger on URLs, short links, and common domain patterns |
| `keywords` | Case-insensitive keyword list you maintain |
| `matchMode: any` | Trigger if link **or** keyword matches (default, strictest) |
| `matchMode: all` | Trigger only if **both** link and keyword match |
| `wordBoundaryKeywords` | Avoid partial matches (e.g. "coin" won't match "bitcoin") |

## Dashboard

| URL | Purpose |
|-----|---------|
| `http://localhost:3000` | Web dashboard UI |
| `GET /api/status` | Bot connection status |
| `GET /api/logs` | Moderation history |
| `GET /api/groups` | WhatsApp groups on your account |
| `PUT /api/config/groups` | Replace monitored group list |
| `POST /api/config/groups/toggle` | Enable/disable one group |

Change the dashboard port in `config.yaml`:

```yaml
dashboard:
  port: 3000
```

Or set `DASHBOARD_PORT=3000`.

## Run classifier tests

```bash
npm run test:classifier
```

## Docker deployment (VPS)

```bash
docker build -t whatsapp-spam-guard .
docker run -it --name spam-guard \
  -v "$(pwd)/config.yaml:/app/config.yaml" \
  -v "$(pwd)/logs:/app/logs" \
  -v "$(pwd)/.wwebjs_auth:/app/.wwebjs_auth" \
  whatsapp-spam-guard
```

On first run, scan the QR code shown in the container logs.

## Recommended WhatsApp settings (manual)

While the bot runs, also tighten group permissions:

1. **Approve new members: ON**
2. **Add members: Only admins**
3. Post clear group rules about links and spam

## Project structure

```
whatsapp-spam-guard/
├── config.yaml           # Groups, keywords, rules
├── src/
│   ├── index.js          # Entry point
│   ├── spamClassifier.js # Link + keyword detection
│   ├── moderator.js      # Delete + kick actions
│   └── utils/
│       ├── config.js
│       ├── isAdmin.js
│       ├── logger.js
│       └── urlDetector.js
└── logs/moderation.log   # Action log (created at runtime)
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| QR keeps failing / "can't connect to this device" | Run on your local PC, not a cloud server. Clear session with `npm run reset-auth` |
| QR code keeps appearing | Delete `.wwebjs_auth/` or run `npm run reset-auth`, then restart |
| Bot can't delete/kick | Confirm your account is a group admin |
| False positives | Switch to `matchMode: all` or enable `wordBoundaryKeywords` |
| Admin kicked by mistake | Admins are exempt; verify `@lid` ID resolution in logs |
