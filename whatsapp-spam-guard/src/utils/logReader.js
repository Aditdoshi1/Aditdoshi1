const fs = require('fs');
const { LOG_FILE } = require('./logger');
const { isGroupMonitored } = require('./monitoredGroups');

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

function getModeratedGroupNames() {
  const names = new Set();

  for (const entry of readModerationLogs({ limit: 1000 })) {
    if (entry.groupName) {
      names.add(entry.groupName);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

function getLogFilterGroupNames(visibleGroups, monitoredGroupsConfig) {
  const names = new Set(getModeratedGroupNames());
  const configured = monitoredGroupsConfig || [];

  for (const group of visibleGroups || []) {
    if (!group.name) {
      continue;
    }

    const isMonitored = group.monitored
      || configured.some((entry) => {
        if (entry.id && group.id && entry.id === group.id) {
          return true;
        }

        if (entry.name && entry.name.trim().toLowerCase() === group.name.trim().toLowerCase()) {
          return true;
        }

        return false;
      });

    if (isMonitored) {
      names.add(group.name);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

module.exports = {
  readModerationLogs,
  getModeratedGroupNames,
  getLogFilterGroupNames,
};
