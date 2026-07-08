const fs = require('fs');
const path = require('path');

const authDir = path.join(__dirname, '..', '.wwebjs_auth');
const cacheDir = path.join(__dirname, '..', '.wwebjs_cache');

for (const dir of [authDir, cacheDir]) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Removed ${dir}`);
  }
}

console.log('Auth session cleared. Restart the bot to get a fresh QR code.');
