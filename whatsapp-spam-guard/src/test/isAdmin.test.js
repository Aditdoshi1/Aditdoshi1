const assert = require('assert');
const { isBotGroupAdmin } = require('../utils/isAdmin');

async function run() {
  const client = {
    info: { wid: { _serialized: '1234567890@c.us' } },
    getContactLidAndPhone: async () => [],
  };

  const adminChat = {
    participants: [
      { id: { _serialized: '1234567890@c.us' }, isAdmin: true },
      { id: { _serialized: '9999999999@c.us' }, isAdmin: false },
    ],
  };

  const memberChat = {
    participants: [
      { id: { _serialized: '1234567890@c.us' }, isAdmin: false },
    ],
  };

  assert.strictEqual(await isBotGroupAdmin(adminChat, client), true);
  assert.strictEqual(await isBotGroupAdmin(memberChat, client), false);
  assert.strictEqual(await isBotGroupAdmin(adminChat, null), false);

  console.log('PASS: bot admin group detection');
}

run().catch((error) => {
  console.error('FAIL: bot admin group detection');
  console.error(error);
  process.exit(1);
});
