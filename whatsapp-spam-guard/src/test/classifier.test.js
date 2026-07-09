const assert = require('assert');
const { classifySpam } = require('../spamClassifier');

const baseRules = {
  blockAllLinks: true,
  keywords: ['crypto', 'earn money'],
  matchMode: 'any',
  wordBoundaryKeywords: false,
};

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

test('detects links in any mode', () => {
  const result = classifySpam('Check this https://spam.example', baseRules);
  assert.strictEqual(result.isSpam, true);
  assert.ok(result.reasons.includes('link'));
});

test('detects keywords in any mode', () => {
  const result = classifySpam('Join our crypto group now', baseRules);
  assert.strictEqual(result.isSpam, true);
  assert.ok(result.reasons.includes('keyword'));
});

test('ignores clean messages in any mode', () => {
  const result = classifySpam('Hello everyone, meeting at 5pm', baseRules);
  assert.strictEqual(result.isSpam, false);
});

test('requires both link and keyword in all mode', () => {
  const rules = { ...baseRules, matchMode: 'all' };

  assert.strictEqual(classifySpam('crypto only', rules).isSpam, false);
  assert.strictEqual(classifySpam('https://example.com only', rules).isSpam, false);
  assert.strictEqual(classifySpam('crypto https://example.com', rules).isSpam, true);
});

test('respects word boundaries when enabled', () => {
  const rules = {
    ...baseRules,
    keywords: ['coin'],
    wordBoundaryKeywords: true,
  };

  assert.strictEqual(classifySpam('bitcoin is rising', rules).isSpam, false);
  assert.strictEqual(classifySpam('buy coin now', rules).isSpam, true);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('All classifier tests passed.');
