const { normalizeId } = require('./isAdmin');

function isMonitoredGroupId(groupId, monitoredGroups) {
  const normalizedId = normalizeId(groupId);

  return (monitoredGroups || []).some((group) => {
    if (group.id && normalizeId(group.id) === normalizedId) {
      return true;
    }

    return false;
  });
}

function isMonitoredGroupName(groupName, monitoredGroups) {
  const normalizedName = (groupName || '').trim().toLowerCase();

  return (monitoredGroups || []).some((group) => {
    if (group.name && group.name.trim().toLowerCase() === normalizedName) {
      return true;
    }

    return false;
  });
}

function isGroupMonitored(group, monitoredGroups) {
  return isMonitoredGroupId(group.id, monitoredGroups)
    || isMonitoredGroupName(group.name, monitoredGroups);
}

function sortGroupsMonitoredFirst(groups) {
  return [...groups].sort((a, b) => {
    if (a.monitored !== b.monitored) {
      return a.monitored ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

function getOrphanedMonitoredGroups(monitoredGroups, visibleGroups) {
  const visible = visibleGroups || [];

  return (monitoredGroups || []).filter((entry) => {
    if (entry.id && visible.some((group) => normalizeId(group.id) === normalizeId(entry.id))) {
      return false;
    }

    if (entry.name && visible.some((group) => (
      group.name.trim().toLowerCase() === entry.name.trim().toLowerCase()
    ))) {
      return false;
    }

    return true;
  });
}

function countActiveMonitoredGroups(visibleGroups) {
  return (visibleGroups || []).filter((group) => group.monitored).length;
}

module.exports = {
  isMonitoredGroupId,
  isMonitoredGroupName,
  isGroupMonitored,
  sortGroupsMonitoredFirst,
  getOrphanedMonitoredGroups,
  countActiveMonitoredGroups,
};
