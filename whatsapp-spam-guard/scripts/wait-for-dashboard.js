const http = require('http');

const port = Number(process.env.DASHBOARD_PORT || 3000);
const maxAttempts = Number(process.env.WAIT_DASHBOARD_RETRIES || 30);
const delayMs = Number(process.env.WAIT_DASHBOARD_DELAY_MS || 1000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkPort() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
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

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await checkPort()) {
      process.stdout.write('ready\n');
      return;
    }

    await sleep(delayMs);
  }

  process.stderr.write('timeout\n');
  process.exit(1);
}

main();
