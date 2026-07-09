const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadConfig, saveConfig, updateMonitoredGroups } = require('../utils/config');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spam-guard-config-'));
const tempConfigPath = path.join(tempDir, 'config.yaml');

fs.writeFileSync(tempConfigPath, `monitoredGroups:
  - name: "Group A"
rules:
  dryRun: true
dashboard:
  port: 4000
`);

const loaded = loadConfig(tempConfigPath);
assert.strictEqual(loaded.monitoredGroups.length, 1);
assert.strictEqual(loaded.dashboard.port, 4000);

const updated = updateMonitoredGroups([
  { id: '120363123456789012@g.us', name: 'Group B' },
], tempConfigPath);

assert.strictEqual(updated.monitoredGroups.length, 1);
assert.strictEqual(updated.monitoredGroups[0].name, 'Group B');

const reloaded = loadConfig(tempConfigPath);
assert.strictEqual(reloaded.monitoredGroups[0].id, '120363123456789012@g.us');

saveConfig({
  ...reloaded,
  rules: { ...reloaded.rules, dryRun: false },
}, tempConfigPath);

assert.strictEqual(loadConfig(tempConfigPath).rules.dryRun, false);

fs.rmSync(tempDir, { recursive: true, force: true });
console.log('PASS: config save and reload');
