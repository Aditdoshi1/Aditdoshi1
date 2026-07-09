const fs = require('fs');
const path = require('path');
const assert = require('assert');

const Moderator = require('../moderator');
const { LOG_FILE } = require('../utils/logger');

const config = {
  rules: { dryRun: true },
  moderation: {
    deleteMessage: true,
    removeUser: true,
    logToFile: true,
    rateLimitSeconds: 60,
  },
};

async function run() {
  const logDir = path.dirname(LOG_FILE);
  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
  }
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const moderator = new Moderator(config);

  const entry = await moderator.moderateMessage({
    client: {},
    message: {
      author: '1234567890@c.us',
      from: '1234567890@c.us',
      body: 'Check https://spam.example',
      delete: async () => {
        throw new Error('delete should not run in dry-run mode');
      },
    },
    chat: {
      id: { _serialized: '120363123456789012@g.us' },
      name: 'Test Group',
      removeParticipants: async () => {
        throw new Error('remove should not run in dry-run mode');
      },
    },
    classification: {
      reasons: ['link'],
      matchedKeywords: [],
      urls: ['https://spam.example'],
    },
  });

  assert.strictEqual(entry.action, 'dry_run');
  assert.strictEqual(entry.dryRun, true);
  assert.ok(fs.existsSync(LOG_FILE));

  const logLine = fs.readFileSync(LOG_FILE, 'utf8');
  assert.ok(logLine.includes('dry_run'));
  assert.ok(logLine.includes('Test Group'));

  console.log('PASS: dry-run moderation logs without delete/kick');
}

run().catch((error) => {
  console.error('FAIL: dry-run moderation test');
  console.error(error);
  process.exit(1);
});
