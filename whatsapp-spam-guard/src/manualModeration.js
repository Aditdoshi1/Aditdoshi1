const { isGroupAdmin } = require('./utils/isAdmin');

function isSpamCommand(text, command) {
  const normalized = (text || '').trim().toLowerCase();
  const expected = (command || '!spam').trim().toLowerCase();
  return normalized === expected;
}

async function handleManualSpamCommand({ client, message, chat, config, moderator }) {
  if (!config.commands?.enabled) {
    return false;
  }

  const command = config.commands.spam || '!spam';
  const text = message.body || '';

  if (!isSpamCommand(text, command)) {
    return false;
  }

  if (!message.hasQuotedMsg) {
    await message.reply('Reply to a message with the spam command to remove it.');
    return true;
  }

  const quoted = await message.getQuotedMessage();
  const quotedChat = await quoted.getChat();

  if (quoted.fromMe) {
    await message.reply('Cannot mark your own message as spam.');
    return true;
  }

  if (await isGroupAdmin({ author: quoted.author || quoted.from, from: quoted.from }, quotedChat, client)) {
    await message.reply('Cannot remove a group admin.');
    return true;
  }

  await moderator.moderateMessage({
    client,
    message: quoted,
    chat: quotedChat,
    classification: {
      reasons: ['manual'],
      matchedKeywords: [],
      urls: [],
    },
    triggeredBy: 'admin_command',
  });

  if (config.commands.deleteCommandMessage !== false) {
    try {
      await message.delete(true);
    } catch {
      // Non-fatal if command message cannot be deleted.
    }
  }

  return true;
}

module.exports = {
  handleManualSpamCommand,
  isSpamCommand,
};
