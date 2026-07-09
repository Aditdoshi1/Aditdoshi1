const fs = require('fs');
const path = require('path');

const PAUSE_FILE = path.join(__dirname, '..', '.paused');

function isAutomationPaused() {
  return fs.existsSync(PAUSE_FILE);
}

module.exports = {
  isAutomationPaused,
  PAUSE_FILE,
};
