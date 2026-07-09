const { logModerationAction, logError } = require('./utils/logger');
const { normalizeId, resolveParticipantIds } = require('./utils/isAdmin');
const { deleteMessageForEveryone } = require('./utils/deleteMessage');

class Moderator {
  constructor(config) {
    this.config = config;
    this.recentActions = new Map();
  }

  _actionKey(groupId, userId) {
    return `${groupId}:${userId}`;
  }

  _isRateLimited(groupId, userId) {
    const key = this._actionKey(groupId, userId);
    const lastActionAt = this.recentActions.get(key);

    if (!lastActionAt) {
      return false;
    }

    const elapsedMs = Date.now() - lastActionAt;
    const limitMs = (this.config.moderation.rateLimitSeconds || 60) * 1000;
    return elapsedMs < limitMs;
  }

  _markAction(groupId, userId) {
    const key = this._actionKey(groupId, userId);
    this.recentActions.set(key, Date.now());
  }

  async _resolveKickIds(client, authorId) {
    const ids = await resolveParticipantIds(client, authorId);
    const kickIds = [...ids];

    for (const id of ids) {
      if (id.endsWith('@c.us')) {
        const lidVersion = id.replace('@c.us', '@lid');
        if (!kickIds.includes(lidVersion)) {
          kickIds.push(lidVersion);
        }
      }

      if (id.endsWith('@lid')) {
        const cusVersion = id.replace('@lid', '@c.us');
        if (!kickIds.includes(cusVersion)) {
          kickIds.push(cusVersion);
        }
      }
    }

    return [...new Set(kickIds)];
  }

  async moderateMessage({ client, message, chat, classification, triggeredBy = 'auto' }) {
    const authorId = normalizeId(message.author || message.from);
    const groupId = normalizeId(chat.id?._serialized || chat.id);
    const groupName = chat.name || groupId;
    const messageBody = message.body || '';

    const entry = {
      dryRun: Boolean(this.config.rules.dryRun),
      triggeredBy,
      groupId,
      groupName,
      senderId: authorId,
      reasons: classification.reasons,
      matchedKeywords: classification.matchedKeywords,
      urls: classification.urls,
      messageSnippet: messageBody.slice(0, 200),
    };

    if (this._isRateLimited(groupId, authorId)) {
      entry.skipped = 'rate_limited';
      logModerationAction(entry, { logToFile: this.config.moderation.logToFile });
      return entry;
    }

    if (this.config.rules.dryRun) {
      entry.action = 'dry_run';
      logModerationAction(entry, { logToFile: this.config.moderation.logToFile });
      return entry;
    }

    const results = {
      deleted: false,
      removed: false,
    };

    if (this.config.moderation.deleteMessage) {
      try {
        await deleteMessageForEveryone(client, message, chat);
        results.deleted = true;
      } catch (error) {
        logError('Failed to delete message', error);
        entry.deleteError = error.message;
      }
    }

    if (this.config.moderation.removeUser) {
      try {
        const kickIds = await this._resolveKickIds(client, authorId);
        await chat.removeParticipants(kickIds);
        results.removed = true;
      } catch (error) {
        logError('Failed to remove participant', error);
        entry.removeError = error.message;
      }
    }

    this._markAction(groupId, authorId);

    entry.action = 'moderated';
    entry.results = results;
    logModerationAction(entry, { logToFile: this.config.moderation.logToFile });

    return entry;
  }
}

module.exports = Moderator;
