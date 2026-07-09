const assert = require('assert');
const { getMessageId } = require('../utils/deleteMessage');

assert.strictEqual(getMessageId({ id: { _serialized: 'abc@g.us_123_456' } }), 'abc@g.us_123_456');
assert.strictEqual(getMessageId({ id: 'plain-id' }), 'plain-id');
assert.strictEqual(getMessageId({}), null);

console.log('PASS: message id helper');
