const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statusMeta = document.getElementById('statusMeta');
const connectPanel = document.getElementById('connectPanel');
const connectNotice = document.getElementById('connectNotice');
const qrImage = document.getElementById('qrImage');
const qrPlaceholder = document.getElementById('qrPlaceholder');
const qrMeta = document.getElementById('qrMeta');
const layout = document.querySelector('.layout');
const groupsList = document.getElementById('groupsList');
const groupsNotice = document.getElementById('groupsNotice');
const logsBody = document.getElementById('logsBody');
const logsEmpty = document.getElementById('logsEmpty');
const groupFilter = document.getElementById('groupFilter');
const keywordsInput = document.getElementById('keywordsInput');
const blockAllLinksInput = document.getElementById('blockAllLinksInput');
const matchModeInput = document.getElementById('matchModeInput');
const dryRunInput = document.getElementById('dryRunInput');
const wordBoundaryInput = document.getElementById('wordBoundaryInput');
const spamCommandInput = document.getElementById('spamCommandInput');
const rulesSavedNotice = document.getElementById('rulesSavedNotice');

let cachedAdminGroups = [];

function sortGroupsForDisplay(groups) {
  return [...groups].sort((a, b) => {
    if (a.monitored !== b.monitored) {
      return a.monitored ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

async function fetchJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function renderStatus(status) {
  statusDot.classList.remove('ready', 'error', 'reconnecting');

  if (status.reconnecting) {
    statusDot.classList.add('reconnecting');
    statusText.textContent = 'Reconnecting to WhatsApp...';
    connectPanel.classList.add('hidden');
    layout.classList.add('connected');
  } else if (status.ready) {
    statusDot.classList.add('ready');
    statusText.textContent = 'Bot connected';
    connectPanel.classList.add('hidden');
    layout.classList.add('connected');
  } else if (status.authenticated) {
    statusText.textContent = 'Authenticated, loading chats...';
    connectPanel.classList.remove('hidden');
    layout.classList.remove('connected');
  } else {
    statusText.textContent = 'Waiting for WhatsApp scan';
    connectPanel.classList.remove('hidden');
    layout.classList.remove('connected');
  }

  const monitoredCount = cachedAdminGroups.length
    ? cachedAdminGroups.filter((group) => group.monitored).length
    : (status.monitoredActiveCount ?? 0);
  const orphanedCount = status.orphanedMonitoredGroups?.length || 0;

  let meta = `Dry run: ${status.dryRun ? 'ON' : 'OFF'} · Monitoring ${monitoredCount} group(s)`;
  if (orphanedCount > 0) {
    meta += ` · ${orphanedCount} hidden config entr${orphanedCount === 1 ? 'y' : 'ies'} (remove below)`;
  }
  statusMeta.textContent = meta;
}

async function loadQr(status) {
  if (status.ready) {
    qrImage.classList.add('hidden');
    qrPlaceholder.classList.add('hidden');
    qrMeta.textContent = '';
    connectNotice.classList.add('hidden');
    return;
  }

  connectNotice.classList.remove('hidden');
  connectNotice.textContent = 'If WhatsApp says "can\'t connect to this device", run the bot on your own computer instead of a cloud server. WhatsApp often blocks cloud/datacenter connections.';

  try {
    const response = await fetch('/api/qr');
    const data = await response.json();

    if (response.ok && data.dataUrl) {
      qrImage.src = data.dataUrl;
      qrImage.classList.remove('hidden');
      qrPlaceholder.classList.add('hidden');
      qrMeta.textContent = data.qrUpdatedAt
        ? `QR updated ${formatTime(data.qrUpdatedAt)} · refreshes automatically`
        : 'Scan with WhatsApp Linked Devices';
      return;
    }

    qrImage.classList.add('hidden');
    qrPlaceholder.classList.remove('hidden');
    qrPlaceholder.textContent = data.message || 'Waiting for QR code...';
    qrMeta.textContent = '';
  } catch (error) {
    qrImage.classList.add('hidden');
    qrPlaceholder.classList.remove('hidden');
    qrPlaceholder.textContent = 'Waiting for QR code...';
    qrMeta.textContent = error.message;
  }
}

function renderGroups(groups, ready, orphanedMonitoredGroups = []) {
  groupsList.innerHTML = '';

  if (!ready) {
    groupsNotice.classList.remove('hidden');
    groupsNotice.textContent = 'Connect WhatsApp first to load your groups. You can still view moderation logs below.';
    return;
  }

  groupsNotice.classList.add('hidden');

  if (orphanedMonitoredGroups.length) {
    groupsNotice.classList.remove('hidden');
    groupsNotice.textContent = `${orphanedMonitoredGroups.length} configured group(s) are not shown because you are not an admin there, or the group name no longer matches. Remove them below.`;
  }

  if (!groups.length && !orphanedMonitoredGroups.length) {
    groupsList.innerHTML = '<div class="empty-state">No admin groups found. You must be a group admin for the bot to delete spam and remove users.</div>';
    return;
  }

  for (const group of sortGroupsForDisplay(groups)) {
    appendGroupItem(group);
  }

  for (const entry of orphanedMonitoredGroups) {
    appendOrphanedGroupItem(entry);
  }
}

function appendGroupItem(group) {
  const item = document.createElement('div');
  item.className = `group-item${group.monitored ? ' monitored' : ''}`;

  item.innerHTML = `
    <div class="group-meta">
      <div class="group-name">${escapeHtml(group.name)}</div>
      <div class="group-id">${escapeHtml(group.id)}</div>
      <div class="group-count">${group.participantCount} members</div>
    </div>
    <label class="toggle" title="Monitor this group">
      <input type="checkbox" ${group.monitored ? 'checked' : ''}>
      <span class="toggle-slider"></span>
    </label>
  `;

  const checkbox = item.querySelector('input');
  checkbox.addEventListener('change', async () => {
    checkbox.disabled = true;

    try {
      await fetchJson('/api/config/groups/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: group.id,
          name: group.name,
          monitored: checkbox.checked,
        }),
      });

      await loadGroups();
      await loadStatus();
      await loadLogs();
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      alert(error.message);
    } finally {
      checkbox.disabled = false;
    }
  });

  groupsList.appendChild(item);
}

function appendOrphanedGroupItem(entry) {
  const item = document.createElement('div');
  item.className = 'group-item orphaned';

  const label = entry.name || entry.id || 'Unknown group';

  item.innerHTML = `
    <div class="group-meta">
      <div class="group-name">${escapeHtml(label)}</div>
      <div class="group-id">${entry.id ? escapeHtml(entry.id) : 'Name-only config entry'}</div>
      <div class="group-count">Configured · not visible in your admin groups</div>
    </div>
    <button type="button" class="btn secondary remove-orphan-btn">Remove</button>
  `;

  item.querySelector('.remove-orphan-btn').addEventListener('click', async () => {
    try {
      await fetchJson('/api/config/groups/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          name: entry.name,
          monitored: false,
        }),
      });

      await loadStatus();
      await loadGroups();
    } catch (error) {
      alert(error.message);
    }
  });

  groupsList.appendChild(item);
}

function renderLogs(entries) {
  logsBody.innerHTML = '';

  if (!entries.length) {
    logsEmpty.classList.remove('hidden');
    return;
  }

  logsEmpty.classList.add('hidden');

  for (const entry of entries) {
    const row = document.createElement('tr');
    const action = entry.action || (entry.skipped ? 'skipped' : 'unknown');
    const reasons = (entry.reasons || []).join(', ') || '-';
    const trigger = entry.triggeredBy ? ` · ${entry.triggeredBy}` : '';

    row.innerHTML = `
      <td>${formatTime(entry.timestamp)}</td>
      <td>${escapeHtml(entry.groupName || entry.groupId || '-')}</td>
      <td>${escapeHtml(entry.senderId || '-')}</td>
      <td>${escapeHtml(reasons + trigger)}</td>
      <td class="message-snippet">${escapeHtml(entry.messageSnippet || '-')}</td>
      <td><span class="badge ${action}">${escapeHtml(action.replace('_', ' '))}</span></td>
    `;

    logsBody.appendChild(row);
  }
}

function renderGroupFilterOptions(groupNames) {
  const previous = groupFilter.value;
  const names = [...new Set(groupNames || [])].sort((a, b) => a.localeCompare(b));

  groupFilter.innerHTML = '<option value="">All groups</option>';

  names.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    groupFilter.appendChild(option);
  });

  if (previous && names.includes(previous)) {
    groupFilter.value = previous;
  } else if (previous && !names.includes(previous)) {
    groupFilter.value = '';
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadStatus() {
  const status = await fetchJson('/api/status');
  renderStatus(status);
  await loadQr(status);
  return status;
}

async function loadGroups(forceRefresh = false) {
  try {
    const url = forceRefresh ? '/api/groups?refresh=1' : '/api/groups';
    const data = await fetchJson(url);
    cachedAdminGroups = sortGroupsForDisplay(data.groups || []);
    renderGroups(cachedAdminGroups, data.ready, data.orphanedMonitoredGroups || []);
    return cachedAdminGroups;
  } catch (error) {
    groupsNotice.classList.remove('hidden');
    groupsNotice.textContent = `${error.message} Click Refresh to try again.`;
    return [];
  }
}

async function loadAllLogEntries() {
  const data = await fetchJson('/api/logs?limit=100');
  renderGroupFilterOptions(data.groupNames || []);
  return data.entries;
}

async function loadLogs() {
  const params = new URLSearchParams({ limit: '100' });

  if (groupFilter.value) {
    params.set('groupName', groupFilter.value);
  }

  const data = await fetchJson(`/api/logs?${params.toString()}`);
  renderGroupFilterOptions(data.groupNames || []);
  renderLogs(data.entries);
  return data.entries;
}

async function loadRules() {
  const data = await fetchJson('/api/config/rules');
  const { rules, commands } = data;

  keywordsInput.value = (rules.keywords || []).join('\n');
  blockAllLinksInput.checked = Boolean(rules.blockAllLinks);
  matchModeInput.value = rules.matchMode || 'any';
  dryRunInput.checked = Boolean(rules.dryRun);
  wordBoundaryInput.checked = Boolean(rules.wordBoundaryKeywords);
  spamCommandInput.value = commands?.spam || '!spam';
}

async function saveRules() {
  const keywords = keywordsInput.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  await fetchJson('/api/config/rules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rules: {
        keywords,
        blockAllLinks: blockAllLinksInput.checked,
        matchMode: matchModeInput.value,
        dryRun: dryRunInput.checked,
        wordBoundaryKeywords: wordBoundaryInput.checked,
      },
      commands: {
        enabled: true,
        spam: spamCommandInput.value.trim() || '!spam',
        deleteCommandMessage: true,
      },
    }),
  });

  rulesSavedNotice.classList.remove('hidden');
  setTimeout(() => rulesSavedNotice.classList.add('hidden'), 2500);
  await loadStatus();
  await loadLogs();
}

async function refreshAll() {
  await loadGroups();
  const status = await loadStatus();
  await loadAllLogEntries();
  await loadLogs();
  renderStatus(status);
}

document.getElementById('refreshGroupsBtn').addEventListener('click', () => {
  loadGroups(true)
    .then(() => loadStatus())
    .catch((error) => alert(error.message));
});
document.getElementById('refreshLogsBtn').addEventListener('click', loadLogs);
document.getElementById('saveRulesBtn').addEventListener('click', () => {
  saveRules().catch((error) => alert(error.message));
});
groupFilter.addEventListener('change', () => {
  loadLogs().catch((error) => alert(error.message));
});

Promise.all([refreshAll(), loadRules()]).catch((error) => {
  statusDot.classList.add('error');
  statusText.textContent = 'Dashboard offline';
  statusMeta.textContent = error.message;
});

let pollDelayMs = 5000;
let pollTimer = null;

async function pollDashboard() {
  try {
    await refreshAll();
    pollDelayMs = 5000;
  } catch (error) {
    statusDot.classList.remove('ready', 'reconnecting');
    statusDot.classList.add('error');
    statusText.textContent = 'Dashboard offline';
    statusMeta.textContent = `${error.message} · retrying...`;
    pollDelayMs = Math.min(Math.round(pollDelayMs * 1.5), 30000);
  }

  pollTimer = setTimeout(pollDashboard, pollDelayMs);
}

pollDashboard();
