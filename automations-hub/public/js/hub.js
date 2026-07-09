const AUTOMATION_ID = 'whatsapp-spam-guard';
let lastEmbedUrl = null;
let lastControlSnapshot = null;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function statusClass(status) {
  return status || 'stopped';
}

function controlSnapshot(automation) {
  return [
    automation.status,
    automation.canStart,
    automation.canPause,
    automation.canResume,
    automation.canStop,
    automation.type,
  ].join('|');
}

function renderControls(container, automation, options = {}) {
  const { showOpenPage = false } = options;
  container.innerHTML = '';

  if (automation.type === 'placeholder') {
    const label = document.createElement('span');
    label.className = 'control-hint';
    label.textContent = 'Not available yet';
    container.appendChild(label);
    return;
  }

  const powerBtn = document.createElement('button');
  if (automation.canStart) {
    powerBtn.className = 'btn primary';
    powerBtn.innerHTML = '<span class="btn-icon">▶</span> Start';
    powerBtn.onclick = () => controlAutomation(automation.id, 'start');
  } else {
    powerBtn.className = 'btn danger';
    powerBtn.innerHTML = '<span class="btn-icon">■</span> Stop';
    powerBtn.onclick = () => controlAutomation(automation.id, 'stop');
  }
  container.appendChild(powerBtn);

  if (automation.canPause || automation.canResume) {
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'btn warning';
    if (automation.canResume) {
      pauseBtn.innerHTML = '<span class="btn-icon">⏵</span> Resume';
      pauseBtn.onclick = () => controlAutomation(automation.id, 'resume');
    } else {
      pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
      pauseBtn.onclick = () => controlAutomation(automation.id, 'pause');
    }
    container.appendChild(pauseBtn);
  }

  if (showOpenPage && automation.detailPath) {
    const openBtn = document.createElement('a');
    openBtn.className = 'btn secondary';
    openBtn.textContent = 'Open';
    openBtn.href = automation.detailPath;
    container.appendChild(openBtn);
  }
}

function renderAutomationCard(automation) {
  const card = document.createElement('article');
  card.className = 'automation-card';

  card.innerHTML = `
    <div class="automation-icon">${automation.icon || '⚙️'}</div>
    <div>
      <div class="automation-title-row">
        <strong>${escapeHtml(automation.name)}</strong>
        <span class="status-badge ${statusClass(automation.status)}">${escapeHtml(automation.statusLabel)}</span>
      </div>
      <p class="automation-description">${escapeHtml(automation.description || '')}</p>
    </div>
  `;

  const actions = document.createElement('div');
  actions.className = 'automation-actions';
  renderControls(actions, automation, { showOpenPage: true });
  card.appendChild(actions);

  return card;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function controlAutomation(id, action) {
  await fetchJson(`/api/automations/${id}/${action}`, { method: 'POST' });
  await refreshHub();
}

async function refreshHub() {
  const data = await fetchJson('/api/automations');
  return data.automations;
}

function updateSummary(automations) {
  const counts = {
    running: 0,
    paused: 0,
    stopped: 0,
    unavailable: 0,
  };

  for (const automation of automations) {
    if (automation.status === 'running' || automation.status === 'starting') {
      counts.running += 1;
    } else if (automation.status === 'paused') {
      counts.paused += 1;
    } else if (automation.status === 'unavailable') {
      counts.unavailable += 1;
    } else {
      counts.stopped += 1;
    }
  }

  document.getElementById('countRunning').textContent = counts.running;
  document.getElementById('countPaused').textContent = counts.paused;
  document.getElementById('countStopped').textContent = counts.stopped;
  document.getElementById('countUnavailable').textContent = counts.unavailable;
}

function renderDashboard(automations) {
  updateSummary(automations);

  const list = document.getElementById('automationList');
  list.innerHTML = '';

  for (const automation of automations) {
    list.appendChild(renderAutomationCard(automation));
  }
}

function setEmbedFrame(frame, url) {
  const nextUrl = url || 'about:blank';

  if (nextUrl === lastEmbedUrl) {
    return;
  }

  frame.src = nextUrl;
  lastEmbedUrl = nextUrl;
}

function renderWhatsAppGuardPage(automations) {
  const automation = automations.find((entry) => entry.id === AUTOMATION_ID);
  if (!automation) {
    return;
  }

  const badge = document.getElementById('guardStatusBadge');
  badge.className = `status-badge ${statusClass(automation.status)}`;
  badge.textContent = automation.statusLabel;

  const controls = document.getElementById('guardControls');
  const snapshot = controlSnapshot(automation);
  if (snapshot !== lastControlSnapshot) {
    renderControls(controls, automation, { showOpenPage: false });
    lastControlSnapshot = snapshot;
  }

  const frame = document.getElementById('guardFrame');
  const notice = document.getElementById('embedNotice');
  const openLink = document.getElementById('openDashboardLink');

  if (automation.dashboardUrl) {
    openLink.href = automation.dashboardUrl;
  }

  if (automation.status === 'running' && automation.dashboardUrl) {
    setEmbedFrame(frame, automation.dashboardUrl);
    notice.classList.add('hidden');
  } else if (automation.status === 'starting') {
    setEmbedFrame(frame, 'about:blank');
    notice.textContent = 'Bot is starting. The dashboard will appear in a few seconds...';
    notice.classList.remove('hidden');
  } else if (automation.status === 'paused') {
    if (automation.dashboardUrl && lastEmbedUrl !== automation.dashboardUrl) {
      setEmbedFrame(frame, automation.dashboardUrl);
    }
    notice.textContent = 'Paused — moderation is off, dashboard stays open.';
    notice.classList.remove('hidden');
  } else {
    setEmbedFrame(frame, 'about:blank');
    lastEmbedUrl = null;
    notice.textContent = 'Press Start to load the WhatsApp Spam Guard dashboard.';
    notice.classList.remove('hidden');
  }
}

function initHubPage({ mode }) {
  const refreshBtn = document.getElementById('refreshBtn');
  const guardRefreshBtn = document.getElementById('guardRefreshBtn');

  async function tick() {
    try {
      const automations = await refreshHub();

      if (mode === 'dashboard') {
        renderDashboard(automations);
      } else if (mode === 'whatsapp-guard') {
        renderWhatsAppGuardPage(automations);
      }
    } catch (error) {
      if (mode === 'dashboard') {
        document.getElementById('automationList').innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
      }
    }
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', tick);
  }

  if (guardRefreshBtn) {
    guardRefreshBtn.addEventListener('click', tick);
  }

  tick();
}

window.initHubPage = initHubPage;
window.controlAutomation = controlAutomation;
