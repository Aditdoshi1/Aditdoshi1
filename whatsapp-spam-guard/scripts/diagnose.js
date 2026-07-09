const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const port = Number(process.env.DASHBOARD_PORT || 3000);
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

function checkPort(callback) {
  const req = http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
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
    console.log(`Dashboard NOT reachable at http://127.0.0.1:${port}`);
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
checkPort((ok) => {
  console.log('');
  if (ok) {
    console.log('OK: Open http://127.0.0.1:' + port);
  } else {
    console.log('FIX: In this folder run:');
    console.log('  npm install');
    console.log('  npm start');
    console.log('');
    console.log('Keep that terminal open. Then open http://127.0.0.1:' + port);
    if (process.platform === 'win32') {
      console.log('Windows background: npm run start:win');
    } else {
      console.log('Mac/Linux background: npm run start:bg');
    }
  }
});
