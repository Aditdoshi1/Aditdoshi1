const fs = require('fs');
const { LOG_FILE } = require('./logger');

function readModerationLogs({ limit = 100, groupId, groupName } = {}) {
  if (!fs.existsSync(LOG_FILE)) {
    return [];
  }

  const lines = fs.readFileSync(LOG_FILE, 'utf8')
    .split('\n')
    .filter(Boolean);

  let entries = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (groupId) {
    entries = entries.filter((entry) => entry.groupId === groupId);
  }

  if (groupName) {
    const normalized = groupName.trim().toLowerCase();
    entries = entries.filter(
      (entry) => (entry.groupName || '').trim().toLowerCase() === normalized,
    );
  }

  return entries.reverse().slice(0, limit);
}

module.exports = {
  readModerationLogs,
};
