function normalizeId(id) {
  if (!id) {
    return '';
  }

  if (typeof id === 'object' && id._serialized) {
    return id._serialized;
  }

  return String(id);
}

function idsMatch(idA, idB) {
  const a = normalizeId(idA);
  const b = normalizeId(idB);

  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  const phoneA = a.split('@')[0];
  const phoneB = b.split('@')[0];

  return phoneA && phoneB && phoneA === phoneB;
}

async function resolveParticipantIds(client, authorId) {
  const ids = new Set([normalizeId(authorId)]);

  if (!authorId || typeof client.getContactLidAndPhone !== 'function') {
    return [...ids];
  }

  try {
    const mappings = await client.getContactLidAndPhone([authorId]);
    for (const mapping of mappings || []) {
      if (mapping?.lid) {
        ids.add(normalizeId(mapping.lid));
      }
      if (mapping?.pn) {
        ids.add(normalizeId(mapping.pn));
      }
    }
  } catch {
    // Fall back to the raw author ID when mapping is unavailable.
  }

  return [...ids];
}

async function findParticipant(chat, authorId, client) {
  const participants = chat.participants || [];
  const candidateIds = await resolveParticipantIds(client, authorId);

  for (const participant of participants) {
    const participantId = normalizeId(participant.id);

    if (candidateIds.some((candidate) => idsMatch(candidate, participantId))) {
      return participant;
    }
  }

  return null;
}

async function isGroupAdmin(message, chat, client) {
  const authorId = message.author || message.from;
  const participant = await findParticipant(chat, authorId, client);
  return Boolean(participant?.isAdmin);
}

async function isBotGroupAdmin(chat, client) {
  if (!client?.info?.wid) {
    return false;
  }

  const botId = normalizeId(client.info.wid._serialized || client.info.wid);
  const participant = await findParticipant(chat, botId, client);
  return Boolean(participant?.isAdmin);
}

module.exports = {
  normalizeId,
  idsMatch,
  resolveParticipantIds,
  findParticipant,
  isGroupAdmin,
  isBotGroupAdmin,
};
