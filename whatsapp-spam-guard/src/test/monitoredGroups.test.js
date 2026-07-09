const assert = require('assert');
const {
  sortGroupsMonitoredFirst,
  getOrphanedMonitoredGroups,
  countActiveMonitoredGroups,
  countEffectiveMonitoredGroups,
} = require('../utils/monitoredGroups');

const groups = [
  { id: '1@g.us', name: 'Alpha', monitored: false },
  { id: '2@g.us', name: 'Beta', monitored: true },
  { id: '3@g.us', name: 'Gamma', monitored: false },
];

const sorted = sortGroupsMonitoredFirst(groups);
assert.strictEqual(sorted[0].name, 'Beta');
assert.strictEqual(sorted[1].name, 'Alpha');

assert.strictEqual(countActiveMonitoredGroups(groups), 1);

const configuredCount = countEffectiveMonitoredGroups([
  { name: 'Beta' },
  { name: 'My Public Group 1' },
], groups);
assert.strictEqual(configuredCount, 1);

const orphaned = getOrphanedMonitoredGroups([
  { name: 'Beta' },
  { name: 'My Public Group 1' },
], groups);

assert.strictEqual(orphaned.length, 1);
assert.strictEqual(orphaned[0].name, 'My Public Group 1');

console.log('PASS: monitored group helpers');
