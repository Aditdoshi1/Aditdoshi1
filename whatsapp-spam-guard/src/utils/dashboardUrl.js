const os = require('os');
const { execSync } = require('child_process');

function isWSL() {
  if (process.platform !== 'linux') {
    return false;
  }

  try {
    const version = require('fs').readFileSync('/proc/version', 'utf8').toLowerCase();
    return version.includes('microsoft') || version.includes('wsl');
  } catch {
    return false;
  }
}

function getWslHostIp() {
  try {
    const out = execSync("ip route show | awk '/default/ {print $3}'", {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return out || null;
  } catch {
    return null;
  }
}

function getDashboardHost(config) {
  if (process.env.DASHBOARD_HOST) {
    return process.env.DASHBOARD_HOST;
  }

  if (config?.dashboard?.host) {
    return config.dashboard.host;
  }

  if (isWSL()) {
    return '0.0.0.0';
  }

  return '127.0.0.1';
}

function getDashboardPort(config) {
  return Number(process.env.DASHBOARD_PORT || config?.dashboard?.port || 3000);
}

function getDashboardUrls(config) {
  const port = getDashboardPort(config);
  const urls = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];

  if (isWSL()) {
    const wslIp = getWslHostIp();
    if (wslIp) {
      urls.push(`http://${wslIp}:${port}`);
    }
  }

  return [...new Set(urls)];
}

function getPrimaryDashboardUrl(config) {
  return getDashboardUrls(config)[0];
}

module.exports = {
  isWSL,
  getDashboardHost,
  getDashboardPort,
  getDashboardUrls,
  getPrimaryDashboardUrl,
};
