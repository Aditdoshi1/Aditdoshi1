const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const { loadConfig } = require('../src/utils/config');
const { getDashboardPort, getDashboardUrls, isWSL } = require('../src/utils/dashboardUrl');

const config = loadConfig();
const port = getDashboardPort(config);
const urls = getDashboardUrls(config);
const root = path.join(__dirname, '..');

console.log('WhatsApp Spam Guard — local diagnose');
console.log('Project:', root);
console.log('Port:', port);
console.log('');

function checkProcess() {
  try {
    if (process.platform === 'win32') {
      const out = execSync('tasklist /FI "IMAGENAME eq node.exe"', { encoding: 'utf8' });
      const count = (out.match(/node\.exe/gi) || []).length;
      console.log(`Node processes (Windows): ${count}`);
      return count > 0;
    }

    const out = execSync('pgrep -af "node src/index.js" || true', { encoding: 'utf8' }).trim();
    if (out) {
      console.log('Bot process found:');
      console.log(out);
      return true;
    }

    console.log('Bot process NOT found (node src/index.js)');
    return false;
  } catch (error) {
    console.log('Could not check process:', error.message);
    return false;
  }
}

function checkPort(url, callback) {
  const req = http.get(`${url}/api/status`, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      console.log(`Dashboard HTTP status: ${res.statusCode}`);
      if (res.statusCode === 200) {
        try {
          const data = JSON.parse(body);
          console.log(`WhatsApp ready: ${data.ready}`);
          console.log(`Authenticated: ${data.authenticated}`);
        } catch {
          console.log('Dashboard responded but JSON parse failed.');
        }
      }
      callback(res.statusCode === 200);
    });
  });

  req.on('error', (error) => {
    console.log(`Dashboard NOT reachable at ${url}`);
    console.log(`Reason: ${error.message}`);
    callback(false);
  });

  req.setTimeout(3000, () => {
    req.destroy();
    console.log('Dashboard request timed out.');
    callback(false);
  });
}

checkProcess();
console.log('');
if (isWSL()) {
  console.log('WSL detected — try these URLs from Windows:');
  urls.forEach((url) => console.log('  ' + url));
  console.log('');
}

function tryUrls(index) {
  if (index >= urls.length) {
    console.log('');
    console.log('FIX: In this folder run:');
    console.log('  npm install');
    console.log('  npm start');
    console.log('');
    console.log('Keep that terminal open, then run: npm run open-dashboard');
    if (process.platform === 'win32') {
      console.log('Windows background: npm run start:win');
    } else {
      console.log('Mac/Linux background: npm run start:bg');
    }
    console.log('');
    console.log('If port 3000 is busy: set DASHBOARD_PORT=3001 && npm start');
    return;
  }

  checkPort(urls[index], (ok) => {
    if (ok) {
      console.log('');
      console.log('OK: Open ' + urls[index]);
      console.log('Or run: npm run open-dashboard');
      return;
    }

    tryUrls(index + 1);
  });
}

tryUrls(0);
