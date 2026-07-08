const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_FILE = path.join(LOG_DIR, 'moderation.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function logModerationAction(entry, options = {}) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry,
  });

  console.log(`[moderation] ${line}`);

  if (options.logToFile === false) {
    return;
  }

  ensureLogDir();
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

function logInfo(message, meta = {}) {
  const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[info] ${message}${suffix}`);
}

function logError(message, error) {
  console.error(`[error] ${message}`, error?.message || error);
}

module.exports = {
  logModerationAction,
  logInfo,
  logError,
  LOG_FILE,
};
