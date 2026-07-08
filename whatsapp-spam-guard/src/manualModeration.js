const { isGroupAdmin } = require('./utils/isAdmin');
const { addKeywords } = require('./utils/config');
const { extractLearnableKeywords } = require('./utils/learnKeywords');
const { emitConfigChange } = require('./botState');
const { logInfo } = require('./utils/logger');

function isSpamCommand(text, command) {
  const normalized = (text || '').trim().toLowerCase();
  const expected = (command || '!spam').trim().toLowerCase();
  return normalized === expected;
}

async function learnFromSpamMessage(config, messageText) {
  if (config.commands?.learnKeywords === false) {
    return [];
  }

  const learned = extractLearnableKeywords(messageText, config.rules?.keywords || []);
  if (!learned.length) {
    return [];
  }

  const updatedConfig = addKeywords(learned);
  emitConfigChange(updatedConfig);
  logInfo('Learned spam keywords from manual command', { learned });

  return learned;
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

  logInfo('Manual spam command received', {
    group: chat.name,
    hasQuotedMsg: message.hasQuotedMsg,
    dryRun: Boolean(config.rules?.dryRun),
  });

  if (!message.hasQuotedMsg) {
    await message.reply(
      'Reply to a spam message with !spam. I will remove it, kick the sender, and add it to your spam rules.',
    );
    return true;
  }

  const quoted = await message.getQuotedMessage();
  const quotedChat = await quoted.getChat();
  const quotedText = quoted.body || '';

  if (quoted.fromMe) {
    const learnedKeywords = await learnFromSpamMessage(config, quotedText);
    const learnedText = learnedKeywords.length
      ? `Added to spam rules: ${learnedKeywords.map((k) => `"${k}"`).join(', ')}`
      : 'Could not extract a new keyword from that message.';

    await message.reply(
      `Test message noted. ${learnedText} (Skipped remove — you cannot kick your own account.)`,
    );
    return true;
  }

  if (await isGroupAdmin({ author: quoted.author || quoted.from, from: quoted.from }, quotedChat, client)) {
    await message.reply('Cannot remove a group admin.');
    return true;
  }

  const learnedKeywords = await learnFromSpamMessage(config, quotedText);

  const result = await moderator.moderateMessage({
    client,
    message: quoted,
    chat: quotedChat,
    classification: {
      reasons: learnedKeywords.length ? ['manual', 'keyword'] : ['manual'],
      matchedKeywords: learnedKeywords,
      urls: [],
    },
    triggeredBy: 'admin_command',
  });

  const dryRun = Boolean(config.rules?.dryRun);
  const learnedText = learnedKeywords.length
    ? `Added to spam rules: ${learnedKeywords.map((k) => `"${k}"`).join(', ')}`
    : 'Could not extract a new keyword from that message.';

  if (dryRun) {
    await message.reply(`Spam rule updated. ${learnedText} (Dry run is ON — message was not deleted.)`);
  } else if (result?.results?.deleted || result?.results?.removed) {
    await message.reply(`Spam removed. ${learnedText}`);
  } else {
    await message.reply(`Processed. ${learnedText}`);
  }

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
  learnFromSpamMessage,
};
