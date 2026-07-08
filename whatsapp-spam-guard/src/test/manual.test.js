const assert = require('assert');
const { isSpamCommand } = require('../manualModeration');

assert.strictEqual(isSpamCommand('!spam', '!spam'), true);
assert.strictEqual(isSpamCommand('  !SPAM  ', '!spam'), true);
assert.strictEqual(isSpamCommand('hello', '!spam'), false);
assert.strictEqual(isSpamCommand('!ban', '!spam'), false);

console.log('PASS: manual spam command detection');
