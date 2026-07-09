const assert = require('assert');
const { extractLearnableKeywords } = require('../utils/learnKeywords');

const learned = extractLearnableKeywords('Join crypto now https://spam.example/deal', []);
assert.ok(learned.includes('Join crypto now https://spam.example/deal'));
assert.ok(learned.includes('https://spam.example/deal'));
assert.ok(learned.includes('spam.example'));

const duplicate = extractLearnableKeywords('crypto', ['crypto']);
assert.strictEqual(duplicate.length, 0);

console.log('PASS: learn keywords from spam message');
