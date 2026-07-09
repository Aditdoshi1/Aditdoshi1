#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SESSION_NAME="whatsapp-spam-guard"
TMUX_CONF="/exec-daemon/tmux.portal.conf"
TMUX=(tmux -f "$TMUX_CONF")

cd "$ROOT_DIR"

if "${TMUX[@]}" has-session -t "=$SESSION_NAME" 2>/dev/null; then
  echo "Bot session already running: $SESSION_NAME"
  OPEN_DASHBOARD=1 node scripts/open-dashboard.js || true
  exit 0
fi

if pgrep -f "node src/index.js" >/dev/null 2>&1; then
  echo "Stopping existing bot process..."
  pkill -f "node src/index.js" || true
  sleep 2
fi

"${TMUX[@]}" new-session -d -s "$SESSION_NAME" -c "$ROOT_DIR" -- "${SHELL:-bash}" -l
"${TMUX[@]}" send-keys -t "$SESSION_NAME:0.0" "cd \"$ROOT_DIR\" && npm start" C-m

echo "Waiting for dashboard..."
if node scripts/wait-for-dashboard.js; then
  echo "WhatsApp Spam Guard started in background."
  OPEN_DASHBOARD=1 node scripts/open-dashboard.js || true
else
  echo "Bot is starting in background (dashboard may take a few seconds)."
  echo "Run: npm run open-dashboard"
fi

echo "Session: $SESSION_NAME"
echo "View logs: tmux -f $TMUX_CONF attach-session -t $SESSION_NAME"
