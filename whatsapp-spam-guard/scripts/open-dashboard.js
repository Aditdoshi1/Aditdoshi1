const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const { loadConfig } = require('../src/utils/config');
const { getDashboardPort, getDashboardUrls, getPrimaryDashboardUrl, isWSL } = require('../src/utils/dashboardUrl');

const config = loadConfig();
const port = getDashboardPort(config);
const urls = getDashboardUrls(config);
const primaryUrl = getPrimaryDashboardUrl(config);
const maxAttempts = Number(process.env.OPEN_DASHBOARD_RETRIES || 30);
const delayMs = Number(process.env.OPEN_DASHBOARD_DELAY_MS || 1000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkUrl(url) {
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

async function waitForDashboard() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const url of urls) {
      if (await checkUrl(url)) {
        return url;
      }
    }

    process.stdout.write(`Waiting for dashboard (${attempt}/${maxAttempts})...\r`);
    await sleep(delayMs);
  }

  return null;
}

function openInBrowser(url) {
  if (process.env.OPEN_DASHBOARD === '0') {
    console.log(`Dashboard ready at ${url} (browser auto-open disabled)`);
    return;
  }

  const platform = process.platform;

  try {
    if (platform === 'win32') {
      execSync(`start "" "${url}"`, { stdio: 'ignore', shell: true });
    } else if (platform === 'darwin') {
      execSync(`open "${url}"`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
    }

    console.log(`Opened dashboard in browser: ${url}`);
  } catch (error) {
    console.log(`Could not auto-open browser: ${error.message}`);
    console.log(`Open this URL manually: ${url}`);
  }
}

async function main() {
  console.log('WhatsApp Spam Guard — opening dashboard');
  console.log('Project:', path.join(__dirname, '..'));
  console.log('Trying:', primaryUrl);

  if (isWSL()) {
    console.log('WSL detected: if localhost fails in Windows, try:', urls.join(' or '));
  }

  const readyUrl = await waitForDashboard();

  console.log('');

  if (!readyUrl) {
    console.log('Dashboard is not responding yet.');
    console.log('');
    console.log('Start the bot first:');
    if (process.platform === 'win32') {
      console.log('  npm run start:win');
    } else {
      console.log('  npm run start:bg');
    }
    console.log('  npm start');
    console.log('');
    console.log('Then run: npm run open-dashboard');
    process.exit(1);
  }

  openInBrowser(readyUrl);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
