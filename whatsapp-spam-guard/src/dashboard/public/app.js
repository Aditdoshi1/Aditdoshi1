const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const statusMeta = document.getElementById('statusMeta');
const groupsList = document.getElementById('groupsList');
const groupsNotice = document.getElementById('groupsNotice');
const logsBody = document.getElementById('logsBody');
const logsEmpty = document.getElementById('logsEmpty');
const groupFilter = document.getElementById('groupFilter');

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function renderStatus(status) {
  statusDot.classList.remove('ready', 'error');

  if (status.ready) {
    statusDot.classList.add('ready');
    statusText.textContent = 'Bot connected';
  } else if (status.authenticated) {
    statusText.textContent = 'Authenticated, loading chats...';
  } else {
    statusText.textContent = 'Waiting for WhatsApp scan';
  }

  statusMeta.textContent = `Dry run: ${status.dryRun ? 'ON' : 'OFF'} · Monitoring ${status.monitoredGroups.length} group(s)`;
}

function renderGroups(groups, ready) {
  groupsList.innerHTML = '';

  if (!ready) {
    groupsNotice.classList.remove('hidden');
    groupsNotice.textContent = 'Connect WhatsApp first to load your groups. You can still view moderation logs below.';
    return;
  }

  groupsNotice.classList.add('hidden');

  if (!groups.length) {
    groupsList.innerHTML = '<div class="empty-state">No WhatsApp groups found on this account.</div>';
    return;
  }

  for (const group of groups) {
    const item = document.createElement('div');
    item.className = 'group-item';

    item.innerHTML = `
      <div class="group-meta">
        <div class="group-name">${escapeHtml(group.name)}</div>
        <div class="group-id">${escapeHtml(group.id)} · ${group.participantCount} members</div>
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

    row.innerHTML = `
      <td>${formatTime(entry.timestamp)}</td>
      <td>${escapeHtml(entry.groupName || entry.groupId || '-')}</td>
      <td>${escapeHtml(entry.senderId || '-')}</td>
      <td>${escapeHtml(reasons)}</td>
      <td class="message-snippet">${escapeHtml(entry.messageSnippet || '-')}</td>
      <td><span class="badge ${action}">${escapeHtml(action.replace('_', ' '))}</span></td>
    `;

    logsBody.appendChild(row);
  }
}

function updateGroupFilter(groups, entries) {
  const previous = groupFilter.value;
  const names = new Set();

  for (const group of groups) {
    if (group.name) {
      names.add(group.name);
    }
  }

  for (const entry of entries) {
    if (entry.groupName) {
      names.add(entry.groupName);
    }
  }

  groupFilter.innerHTML = '<option value="">All groups</option>';

  [...names].sort().forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    groupFilter.appendChild(option);
  });

  if ([...names].includes(previous)) {
    groupFilter.value = previous;
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
  return status;
}

async function loadGroups() {
  const data = await fetchJson('/api/groups');
  renderGroups(data.groups, data.ready);
  return data.groups;
}

async function loadLogs() {
  const params = new URLSearchParams({ limit: '100' });

  if (groupFilter.value) {
    params.set('groupName', groupFilter.value);
  }

  const data = await fetchJson(`/api/logs?${params.toString()}`);
  renderLogs(data.entries);
  return data.entries;
}

async function refreshAll() {
  const [status, groups, entries] = await Promise.all([
    loadStatus(),
    loadGroups(),
    loadLogs(),
  ]);

  updateGroupFilter(groups, entries);
  renderStatus(status);
}

document.getElementById('refreshGroupsBtn').addEventListener('click', loadGroups);
document.getElementById('refreshLogsBtn').addEventListener('click', loadLogs);
groupFilter.addEventListener('change', loadLogs);

refreshAll().catch((error) => {
  statusDot.classList.add('error');
  statusText.textContent = 'Dashboard error';
  statusMeta.textContent = error.message;
});

setInterval(refreshAll, 10000);
