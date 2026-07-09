const { logInfo } = require('./logger');

function getMessageId(message) {
  if (!message?.id) {
    return null;
  }

  if (typeof message.id === 'string') {
    return message.id;
  }

  return message.id._serialized || null;
}

async function refreshMessage(client, message, chat) {
  const messageId = getMessageId(message);

  if (messageId && typeof client.getMessageById === 'function') {
    try {
      const refreshed = await client.getMessageById(messageId);
      if (refreshed) {
        return refreshed;
      }
    } catch {
      // Fall back to searching recent chat messages.
    }
  }

  try {
    const recent = await chat.fetchMessages({ limit: 40 });
    const authorId = message.author || message.from;
    const body = message.body || '';
    const timestamp = message.timestamp;

    const match = recent.find((candidate) => {
      const candidateId = getMessageId(candidate);
      if (messageId && candidateId === messageId) {
        return true;
      }

      if (timestamp && candidate.timestamp !== timestamp) {
        return false;
      }

      const sameAuthor = (candidate.author || candidate.from) === authorId;
      const sameBody = (candidate.body || '') === body;
      return sameAuthor && sameBody;
    });

    return match || message;
  } catch {
    return message;
  }
}

async function deleteMessageForEveryone(client, message, chat) {
  let target = message;
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (attempt > 1) {
        target = await refreshMessage(client, message, chat);
      }

      const messageId = getMessageId(target);
      if (!messageId) {
        throw new Error('Message id is missing');
      }

      await target.delete(true);
      return { deleted: true, messageId };
    } catch (error) {
      lastError = error;

      if (attempt < 3) {
        logInfo('Retrying message delete after refresh', {
          attempt,
          messageId: getMessageId(message),
        });
      }
    }
  }

  throw lastError || new Error('Failed to delete message');
}

module.exports = {
  deleteMessageForEveryone,
  refreshMessage,
  getMessageId,
};
