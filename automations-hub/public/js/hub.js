const AUTOMATION_ID = 'whatsapp-spam-guard';
let lastEmbedUrl = null;
let lastControlSnapshot = null;
let controlBusy = false;

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

function actionLabel(action) {
  const labels = {
    start: 'Starting',
    stop: 'Stopping',
    pause: 'Pausing',
    resume: 'Resuming',
  };
  return labels[action] || action;
}

function actionDoneLabel(action) {
  const labels = {
    start: 'Started',
    stop: 'Stopped',
    pause: 'Paused',
    resume: 'Resumed',
  };
  return labels[action] || 'Done';
}

function showFeedback(message, type = 'info') {
  const el = document.getElementById('hubFeedback');
  if (!el) {
    return;
  }

  el.textContent = message;
  el.className = `hub-feedback ${type} visible`;

  clearTimeout(showFeedback.timer);
  showFeedback.timer = setTimeout(() => {
    el.classList.remove('visible');
  }, 2800);
}

function setControlsBusy(busy) {
  controlBusy = busy;
  document.querySelectorAll('[data-control-btn]').forEach((button) => {
    button.disabled = busy;
    button.classList.toggle('loading', busy);
  });
}

function createIconButton({ icon, title, className, onClick, href, dataset = {} }) {
  const element = href ? document.createElement('a') : document.createElement('button');

  element.className = `btn icon-btn ${className || ''}`.trim();
  element.innerHTML = icon;
  element.title = title;
  element.setAttribute('aria-label', title);

  if (href) {
    element.href = href;
  } else {
    element.type = 'button';
    element.addEventListener('click', onClick);
  }

  Object.entries(dataset).forEach(([key, value]) => {
    element.dataset[key] = value;
  });

  if (!href) {
    element.dataset.controlBtn = '1';
  }

  return element;
}

function renderControls(container, automation, options = {}) {
  const { showOpenPage = false } = options;
  container.innerHTML = '';

  if (automation.type === 'placeholder') {
    const label = document.createElement('span');
    label.className = 'control-hint';
    label.textContent = 'Coming soon';
    container.appendChild(label);
    return;
  }

  if (automation.canStart) {
    container.appendChild(createIconButton({
      icon: HubIcons.start,
      title: 'Start',
      className: 'primary',
      onClick: () => controlAutomation(automation.id, 'start'),
    }));
  } else {
    container.appendChild(createIconButton({
      icon: HubIcons.stop,
      title: 'Stop',
      className: 'danger',
      onClick: () => controlAutomation(automation.id, 'stop'),
    }));
  }

  if (automation.canPause || automation.canResume) {
    container.appendChild(createIconButton({
      icon: automation.canResume ? HubIcons.resume : HubIcons.pause,
      title: automation.canResume ? 'Resume' : 'Pause',
      className: 'warning',
      onClick: () => controlAutomation(
        automation.id,
        automation.canResume ? 'resume' : 'pause',
      ),
    }));
  }

  if (showOpenPage && automation.detailPath) {
    container.appendChild(createIconButton({
      icon: HubIcons.open,
      title: 'Open page',
      className: 'ghost',
      href: automation.detailPath,
    }));
  }

  if (controlBusy) {
    setControlsBusy(true);
  }
}

function renderAutomationCard(automation) {
  const card = document.createElement('article');
  card.className = 'automation-card';

  card.innerHTML = `
    <div class="automation-icon">${automation.icon || '⚙️'}</div>
    <div class="automation-body">
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

function withEmbedParam(url) {
  if (!url || url === 'about:blank') {
    return url;
  }

  const parsed = new URL(url);
  parsed.searchParams.set('embed', '1');
  return parsed.toString();
}

async function controlAutomation(id, action) {
  setControlsBusy(true);
  showFeedback(`${actionLabel(action)}…`, 'loading');

  try {
    await fetchJson(`/api/automations/${id}/${action}`, { method: 'POST' });
    lastControlSnapshot = null;
    const automations = await refreshHub();
    showFeedback(`${actionDoneLabel(action)} successfully`, 'success');

    if (document.getElementById('guardControls')) {
      const botStatus = await fetchBotStatus();
      renderWhatsAppGuardPage(automations, botStatus);
    } else {
      renderDashboard(automations);
    }
  } catch (error) {
    showFeedback(error.message, 'error');
  } finally {
    setControlsBusy(false);
  }
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
  const nextUrl = withEmbedParam(url || 'about:blank');

  if (nextUrl === lastEmbedUrl) {
    return;
  }

  frame.src = nextUrl;
  lastEmbedUrl = nextUrl;
}

function renderBotConnectionStatus(automation, botStatus) {
  const card = document.getElementById('botStatusCard');
  const dot = document.getElementById('botStatusDot');
  const text = document.getElementById('botStatusText');
  const meta = document.getElementById('botStatusMeta');

  if (!card || !dot || !text || !meta) {
    return;
  }

  dot.classList.remove('ready', 'reconnecting', 'error', 'offline');

  if (!automation || automation.status === 'stopped') {
    dot.classList.add('offline');
    text.textContent = 'Bot offline';
    meta.textContent = 'Press Start to launch';
    return;
  }

  if (automation.status === 'starting' || !botStatus?.online) {
    dot.classList.add('reconnecting');
    text.textContent = botStatus?.message || 'Dashboard starting…';
    meta.textContent = '';
    return;
  }

  const status = botStatus;

  if (status.reconnecting) {
    dot.classList.add('reconnecting');
    text.textContent = 'Reconnecting to WhatsApp…';
  } else if (status.ready) {
    dot.classList.add('ready');
    text.textContent = 'Bot connected';
  } else if (status.authenticated) {
    dot.classList.add('reconnecting');
    text.textContent = 'Authenticated, loading chats…';
  } else {
    dot.classList.add('reconnecting');
    text.textContent = 'Waiting for WhatsApp scan';
  }

  const monitoredCount = status.monitoredActiveCount ?? 0;
  const orphanedCount = status.orphanedMonitoredGroups?.length || 0;
  let metaText = `Dry run: ${status.dryRun ? 'ON' : 'OFF'} · Monitoring ${monitoredCount} group(s)`;

  if (orphanedCount > 0) {
    metaText += ` · ${orphanedCount} hidden config entr${orphanedCount === 1 ? 'y' : 'ies'}`;
  }

  meta.textContent = metaText;
}

async function fetchBotStatus() {
  try {
    return await fetchJson(`/api/automations/${AUTOMATION_ID}/bot-status`);
  } catch {
    return null;
  }
}

function renderWhatsAppGuardPage(automations, botStatus = null) {
  const automation = automations.find((entry) => entry.id === AUTOMATION_ID);
  if (!automation) {
    return;
  }

  const badge = document.getElementById('guardStatusBadge');
  badge.className = `status-badge ${statusClass(automation.status)}`;
  badge.textContent = automation.statusLabel;

  renderBotConnectionStatus(automation, botStatus);

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
    notice.textContent = 'Starting bot… dashboard loads in a few seconds.';
    notice.classList.remove('hidden');
  } else if (automation.status === 'paused') {
    if (automation.dashboardUrl && lastEmbedUrl !== withEmbedParam(automation.dashboardUrl)) {
      setEmbedFrame(frame, automation.dashboardUrl);
    }
    notice.textContent = 'Paused — moderation off, dashboard stays open.';
    notice.classList.remove('hidden');
  } else {
    setEmbedFrame(frame, 'about:blank');
    lastEmbedUrl = null;
    notice.textContent = 'Press Start to load the dashboard.';
    notice.classList.remove('hidden');
  }
}

function initHubPage({ mode }) {
  const refreshBtn = document.getElementById('refreshBtn');
  const guardRefreshBtn = document.getElementById('guardRefreshBtn');

  async function tick(options = {}) {
    const { quiet = false } = options;

    if (!quiet) {
      showFeedback('Refreshing…', 'loading');
    }

    try {
      const automations = await refreshHub();

      if (mode === 'dashboard') {
        renderDashboard(automations);
      } else if (mode === 'whatsapp-guard') {
        const botStatus = await fetchBotStatus();
        renderWhatsAppGuardPage(automations, botStatus);
      }

      if (!quiet) {
        showFeedback('Updated', 'success');
      }
    } catch (error) {
      if (mode === 'dashboard') {
        document.getElementById('automationList').innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
      }
      showFeedback(error.message, 'error');
    }
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => tick());
  }

  if (guardRefreshBtn) {
    guardRefreshBtn.addEventListener('click', () => tick());
  }

  tick({ quiet: true });
}

window.initHubPage = initHubPage;
window.controlAutomation = controlAutomation;
