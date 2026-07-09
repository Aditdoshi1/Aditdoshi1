const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const { automations, getAutomation } = require('./automations');

const processes = new Map();
const paused = new Set();

function isPaused(automationId) {
  return paused.has(automationId);
}

function setPauseFile(automation, shouldPause) {
  if (!automation.pauseFile) {
    return;
  }

  if (shouldPause) {
    fs.writeFileSync(automation.pauseFile, new Date().toISOString(), 'utf8');
  } else if (fs.existsSync(automation.pauseFile)) {
    fs.unlinkSync(automation.pauseFile);
  }
}

function getProcessRecord(automationId) {
  return processes.get(automationId) || null;
}

function isProcessAlive(record) {
  if (!record?.child) {
    return false;
  }

  return record.child.exitCode === null && !record.child.killed;
}

async function probeDashboard(url) {
  if (!url) {
    return false;
  }

  return new Promise((resolve) => {
    const req = http.get(`${url}/api/status`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function getAutomationStatus(automation) {
  if (automation.type === 'placeholder') {
    return {
      id: automation.id,
      name: automation.name,
      description: automation.description,
      type: automation.type,
      icon: automation.icon,
      detailPath: automation.detailPath,
      status: 'unavailable',
      statusLabel: 'Coming soon',
      dashboardUrl: null,
      pid: null,
      startedAt: null,
      canStart: false,
      canStop: false,
      canPause: false,
      canResume: false,
    };
  }

  const record = getProcessRecord(automation.id);
  const alive = isProcessAlive(record);
  const pausedNow = isPaused(automation.id);
  const dashboardOnline = alive ? await probeDashboard(automation.dashboardUrl) : false;

  let status = 'stopped';
  let statusLabel = 'Stopped';

  if (alive && pausedNow) {
    status = 'paused';
    statusLabel = 'Paused';
  } else if (alive) {
    status = dashboardOnline ? 'running' : 'starting';
    statusLabel = dashboardOnline ? 'Running' : 'Starting...';
  }

  return {
    id: automation.id,
    name: automation.name,
    description: automation.description,
    type: automation.type,
    icon: automation.icon,
    detailPath: automation.detailPath,
    status,
    statusLabel,
    dashboardUrl: automation.dashboardUrl,
    pid: alive ? record.child.pid : null,
    startedAt: alive ? record.startedAt : null,
    canStart: !alive,
    canStop: alive,
    canPause: alive && !pausedNow,
    canResume: alive && pausedNow,
  };
}

async function listAutomationStatuses() {
  return Promise.all(automations.map((automation) => getAutomationStatus(automation)));
}

function startAutomation(automationId) {
  const automation = getAutomation(automationId);

  if (!automation || automation.type === 'placeholder') {
    throw new Error('Automation is not available yet');
  }

  const existing = getProcessRecord(automation.id);
  if (isProcessAlive(existing)) {
    paused.delete(automation.id);
    setPauseFile(automation, false);
    return { ok: true, message: 'Automation is already running' };
  }

  const child = spawn(automation.command, automation.args, {
    cwd: automation.cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });

  const logs = [];

  child.stdout.on('data', (chunk) => {
    logs.push(chunk.toString());
    if (logs.length > 200) {
      logs.shift();
    }
  });

  child.stderr.on('data', (chunk) => {
    logs.push(chunk.toString());
    if (logs.length > 200) {
      logs.shift();
    }
  });

  child.on('exit', () => {
    processes.delete(automation.id);
    paused.delete(automation.id);
    setPauseFile(automation, false);
  });

  processes.set(automation.id, {
    child,
    startedAt: new Date().toISOString(),
    logs,
  });

  paused.delete(automation.id);
  setPauseFile(automation, false);

  return { ok: true, message: 'Automation started', pid: child.pid };
}

function stopAutomation(automationId) {
  const automation = getAutomation(automationId);

  if (!automation || automation.type === 'placeholder') {
    throw new Error('Automation is not available yet');
  }

  const record = getProcessRecord(automation.id);
  if (!isProcessAlive(record)) {
    paused.delete(automation.id);
    setPauseFile(automation, false);
    return { ok: true, message: 'Automation is already stopped' };
  }

  record.child.kill('SIGTERM');

  if (process.platform === 'win32') {
    setTimeout(() => {
      if (isProcessAlive(record)) {
        record.child.kill('SIGKILL');
      }
    }, 3000);
  }

  paused.delete(automation.id);
  setPauseFile(automation, false);
  processes.delete(automation.id);

  return { ok: true, message: 'Automation stopped' };
}

function pauseAutomation(automationId) {
  const automation = getAutomation(automationId);

  if (!automation || automation.type === 'placeholder') {
    throw new Error('Automation is not available yet');
  }

  const record = getProcessRecord(automation.id);
  if (!isProcessAlive(record)) {
    throw new Error('Automation is not running');
  }

  paused.add(automation.id);
  setPauseFile(automation, true);

  return { ok: true, message: 'Automation paused (process stays online, moderation disabled)' };
}

function resumeAutomation(automationId) {
  const automation = getAutomation(automationId);

  if (!automation || automation.type === 'placeholder') {
    throw new Error('Automation is not available yet');
  }

  const record = getProcessRecord(automation.id);
  if (!isProcessAlive(record)) {
    throw new Error('Automation is not running');
  }

  paused.delete(automation.id);
  setPauseFile(automation, false);

  return { ok: true, message: 'Automation resumed' };
}

function getAutomationLogs(automationId, limit = 80) {
  const record = getProcessRecord(automationId);
  if (!record) {
    return [];
  }

  return record.logs.slice(-limit).join('');
}

module.exports = {
  listAutomationStatuses,
  startAutomation,
  stopAutomation,
  pauseAutomation,
  resumeAutomation,
  getAutomationLogs,
};
