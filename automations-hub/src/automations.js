const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const WHATSAPP_GUARD_DIR = path.join(ROOT, 'whatsapp-spam-guard');
const DEAL_SCOUT_DIR = path.join(ROOT, 'automation-2');

const automations = [
  {
    id: 'whatsapp-spam-guard',
    name: 'WhatsApp Spam Guard',
    description: 'Monitors WhatsApp groups for spam links and keywords. Deletes messages and removes senders.',
    type: 'process',
    cwd: WHATSAPP_GUARD_DIR,
    command: process.platform === 'win32' ? 'node.exe' : 'node',
    args: ['src/index.js'],
    pauseFile: path.join(WHATSAPP_GUARD_DIR, '.paused'),
    dashboardUrl: 'http://127.0.0.1:3000',
    detailPath: '/whatsapp-guard.html',
    icon: '💬',
  },
  {
    id: 'deal-scout',
    name: 'Deal Scout',
    description: 'Finds deals and price drops from Slickdeals RSS and optional free-tier product APIs.',
    type: 'process',
    cwd: DEAL_SCOUT_DIR,
    command: process.platform === 'win32' ? 'node.exe' : 'node',
    args: ['src/index.js'],
    pauseFile: path.join(DEAL_SCOUT_DIR, '.paused'),
    dashboardUrl: 'http://127.0.0.1:3001',
    detailPath: '/deal-scout.html',
    icon: '🏷️',
  },
];

function getAutomation(id) {
  return automations.find((automation) => automation.id === id) || null;
}

module.exports = {
  automations,
  getAutomation,
};
