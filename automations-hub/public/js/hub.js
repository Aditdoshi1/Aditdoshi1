const AUTOMATION_ID = 'whatsapp-spam-guard';

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

function renderControls(container, automation) {
  container.innerHTML = '';

  const startBtn = document.createElement('button');
  startBtn.className = 'btn primary';
  startBtn.innerHTML = '<span class="btn-icon">▶</span> Start';
  startBtn.disabled = !automation.canStart;
  startBtn.onclick = () => controlAutomation(automation.id, 'start');

  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'btn warning';
  pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
  pauseBtn.disabled = !automation.canPause;
  pauseBtn.onclick = () => controlAutomation(automation.id, 'pause');

  const resumeBtn = document.createElement('button');
  resumeBtn.className = 'btn primary';
  resumeBtn.innerHTML = '<span class="btn-icon">⏵</span> Resume';
  resumeBtn.disabled = !automation.canResume;
  resumeBtn.onclick = () => controlAutomation(automation.id, 'resume');

  const stopBtn = document.createElement('button');
  stopBtn.className = 'btn danger';
  stopBtn.innerHTML = '<span class="btn-icon">■</span> Stop';
  stopBtn.disabled = !automation.canStop;
  stopBtn.onclick = () => controlAutomation(automation.id, 'stop');

  const openBtn = document.createElement('a');
  openBtn.className = 'btn secondary';
  openBtn.textContent = 'Open page';
  openBtn.href = automation.detailPath || '/';
  if (automation.type === 'placeholder') {
    openBtn.classList.add('disabled');
    openBtn.removeAttribute('href');
  }

  container.append(startBtn, pauseBtn, resumeBtn, stopBtn, openBtn);
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
  renderControls(actions, automation);
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

function renderWhatsAppGuardPage(automations) {
  const automation = automations.find((entry) => entry.id === AUTOMATION_ID);
  if (!automation) {
    return;
  }

  const badge = document.getElementById('guardStatusBadge');
  badge.className = `status-badge ${statusClass(automation.status)}`;
  badge.textContent = automation.statusLabel;

  const controls = document.getElementById('guardControls');
  renderControls(controls, automation);

  const frame = document.getElementById('guardFrame');
  const notice = document.getElementById('embedNotice');
  const openLink = document.getElementById('openDashboardLink');

  if (automation.dashboardUrl) {
    openLink.href = automation.dashboardUrl;
  }

  if (automation.status === 'running' && automation.dashboardUrl) {
    frame.src = automation.dashboardUrl;
    notice.classList.add('hidden');
  } else if (automation.status === 'starting') {
    frame.src = 'about:blank';
    notice.textContent = 'Bot is starting. The dashboard will appear in a few seconds...';
    notice.classList.remove('hidden');
  } else if (automation.status === 'paused') {
    frame.src = automation.dashboardUrl || 'about:blank';
    notice.textContent = 'Automation is paused. Moderation is disabled, but the dashboard stays available.';
    notice.classList.remove('hidden');
  } else {
    frame.src = 'about:blank';
    notice.textContent = 'Start the automation to load the WhatsApp Spam Guard dashboard here.';
    notice.classList.remove('hidden');
  }
}

function initHubPage({ mode }) {
  const refreshBtn = document.getElementById('refreshBtn');

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

  tick();
  setInterval(tick, 4000);
}

window.initHubPage = initHubPage;
window.controlAutomation = controlAutomation;
