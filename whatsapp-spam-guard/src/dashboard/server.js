const express = require('express');
const path = require('path');
const QRCode = require('qrcode');

const { botState, emitConfigChange } = require('../botState');
const { loadConfig, updateMonitoredGroups, updateSettings } = require('../utils/config');
const { readModerationLogs } = require('../utils/logReader');
const { normalizeId, isBotGroupAdmin } = require('../utils/isAdmin');
const { logInfo, logError } = require('../utils/logger');
const { runClientTask } = require('../utils/clientQueue');
const { getCachedGroups, setCachedGroups, clearGroupCache, CACHE_TTL_MS } = require('../utils/groupCache');

function isMonitoredGroupId(groupId, monitoredGroups) {
  const normalizedId = normalizeId(groupId);

  return (monitoredGroups || []).some((group) => {
    if (group.id && normalizeId(group.id) === normalizedId) {
      return true;
    }

    return false;
  });
}

function isMonitoredGroupName(groupName, monitoredGroups) {
  const normalizedName = (groupName || '').trim().toLowerCase();

  return (monitoredGroups || []).some((group) => {
    if (group.name && group.name.trim().toLowerCase() === normalizedName) {
      return true;
    }

    return false;
  });
}

async function loadGroupChat(client, chat) {
  try {
    if (chat.participants?.length) {
      return chat;
    }

    const chatId = normalizeId(chat.id?._serialized || chat.id);
    return await client.getChatById(chatId);
  } catch {
    return chat;
  }
}

async function fetchWhatsAppGroups(forceRefresh = false) {
  const { client, ready } = botState;

  if (!client || !ready) {
    return [];
  }

  const cached = getCachedGroups();
  if (!forceRefresh && cached && !cached.stale && cached.groups.length) {
    return cached.groups;
  }

  return runClientTask(async () => {
    const chats = await client.getChats();
    const groups = [];

    for (const chat of chats) {
      if (!chat.isGroup) {
        continue;
      }

      try {
        const groupChat = await loadGroupChat(client, chat);

        if (!await isBotGroupAdmin(groupChat, client)) {
          continue;
        }

        const id = normalizeId(groupChat.id?._serialized || groupChat.id);
        const name = groupChat.name || id;
        const monitoredGroups = botState.config?.monitoredGroups || [];

        groups.push({
          id,
          name,
          participantCount: groupChat.participants?.length || 0,
          monitored: isMonitoredGroupId(id, monitoredGroups)
            || isMonitoredGroupName(name, monitoredGroups),
        });
      } catch (error) {
        logError(`Failed to inspect group ${chat.name || chat.id}`, error);
      }
    }

    const sorted = groups.sort((a, b) => a.name.localeCompare(b.name));
    setCachedGroups(sorted);
    return sorted;
  }, 'list-groups');
}

async function listWhatsAppGroups(forceRefresh = false) {
  try {
    return await fetchWhatsAppGroups(forceRefresh);
  } catch (error) {
    logError('Failed to list WhatsApp groups', error);

    const cached = getCachedGroups();
    if (cached?.groups?.length) {
      return cached.groups;
    }

    throw error;
  }
}

function createDashboardApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/status', (_req, res) => {
    const config = botState.config || loadConfig();

    res.json({
      ready: botState.ready,
      authenticated: botState.authenticated,
      hasQr: Boolean(botState.qrCode),
      qrUpdatedAt: botState.qrUpdatedAt,
      dryRun: config.rules?.dryRun ?? true,
      rules: config.rules || {},
      commands: config.commands || {},
      monitoredGroups: config.monitoredGroups || [],
      keywords: config.rules?.keywords || [],
    });
  });

  app.get('/api/qr', async (_req, res) => {
    if (botState.ready) {
      res.json({ connected: true, message: 'WhatsApp is already connected.' });
      return;
    }

    if (!botState.qrCode) {
      res.status(404).json({
        connected: false,
        message: 'No QR code available yet. Wait a few seconds and refresh.',
      });
      return;
    }

    try {
      const dataUrl = await QRCode.toDataURL(botState.qrCode, {
        margin: 2,
        width: 320,
      });

      res.json({
        connected: false,
        qrUpdatedAt: botState.qrUpdatedAt,
        dataUrl,
      });
    } catch (error) {
      logError('Failed to render QR code', error);
      res.status(500).json({ error: 'Failed to render QR code' });
    }
  });

  app.post('/api/reset-auth', async (_req, res) => {
    res.status(501).json({
      error: 'Restart the bot with npm run reset-auth && npm start for a fresh QR code.',
    });
  });

  app.get('/api/logs', (req, res) => {
    const limit = Number(req.query.limit || 100);
    const groupId = req.query.groupId || undefined;
    const groupName = req.query.groupName || undefined;

    res.json({
      entries: readModerationLogs({ limit, groupId, groupName }),
    });
  });

  app.get('/api/groups', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === '1';
      const groups = await listWhatsAppGroups(forceRefresh);
      const cached = getCachedGroups();

      res.json({
        groups,
        ready: botState.ready,
        cachedAt: cached?.fetchedAt || null,
        cacheTtlMs: CACHE_TTL_MS,
      });
    } catch (error) {
      logError('Failed to list WhatsApp groups', error);
      res.status(500).json({ error: 'Failed to list WhatsApp groups. Try Refresh in a few seconds.' });
    }
  });

  app.get('/api/config/groups', (_req, res) => {
    const config = botState.config || loadConfig();
    res.json({ monitoredGroups: config.monitoredGroups || [] });
  });

  app.get('/api/config/rules', (_req, res) => {
    const config = botState.config || loadConfig();
    res.json({
      rules: config.rules || {},
      commands: config.commands || {},
    });
  });

  app.put('/api/config/rules', (req, res) => {
    try {
      const { rules, commands } = req.body;

      if (!rules || typeof rules !== 'object') {
        res.status(400).json({ error: 'rules object is required' });
        return;
      }

      const sanitizedRules = { ...rules };
      if (Array.isArray(rules.keywords)) {
        sanitizedRules.keywords = rules.keywords
          .map((keyword) => String(keyword).trim())
          .filter(Boolean);
      }

      const updatedConfig = updateSettings({
        rules: sanitizedRules,
        commands: commands && typeof commands === 'object' ? commands : undefined,
      });

      emitConfigChange(updatedConfig);
      clearGroupCache();

      logInfo('Updated spam rules from dashboard');

      res.json({
        ok: true,
        rules: updatedConfig.rules,
        commands: updatedConfig.commands,
      });
    } catch (error) {
      logError('Failed to update rules', error);
      res.status(500).json({ error: 'Failed to update rules' });
    }
  });

  app.put('/api/config/groups', (req, res) => {
    try {
      const { monitoredGroups } = req.body;

      if (!Array.isArray(monitoredGroups)) {
        res.status(400).json({ error: 'monitoredGroups must be an array' });
        return;
      }

      const sanitized = monitoredGroups.map((group) => ({
        id: group.id || undefined,
        name: group.name || undefined,
      })).filter((group) => group.id || group.name);

      const updatedConfig = updateMonitoredGroups(sanitized);
      emitConfigChange(updatedConfig);

      logInfo('Updated monitored groups from dashboard', {
        count: sanitized.length,
      });

      res.json({
        ok: true,
        monitoredGroups: updatedConfig.monitoredGroups,
      });
    } catch (error) {
      logError('Failed to update monitored groups', error);
      res.status(500).json({ error: 'Failed to update monitored groups' });
    }
  });

  app.post('/api/config/groups/toggle', async (req, res) => {
    try {
      const { id, name, monitored } = req.body;

      if (!id && !name) {
        res.status(400).json({ error: 'Group id or name is required' });
        return;
      }

      const config = botState.config || loadConfig();
      let monitoredGroups = [...(config.monitoredGroups || [])];

      const existingIndex = monitoredGroups.findIndex((group) => {
        if (id && group.id && normalizeId(group.id) === normalizeId(id)) {
          return true;
        }

        if (name && group.name && group.name.trim().toLowerCase() === name.trim().toLowerCase()) {
          return true;
        }

        return false;
      });

      if (monitored) {
        const entry = { id, name: name || undefined };

        if (existingIndex >= 0) {
          monitoredGroups[existingIndex] = {
            ...monitoredGroups[existingIndex],
            ...entry,
          };
        } else {
          monitoredGroups.push(entry);
        }
      } else if (existingIndex >= 0) {
        monitoredGroups.splice(existingIndex, 1);
      }

      const updatedConfig = updateMonitoredGroups(monitoredGroups);
      emitConfigChange(updatedConfig);
      clearGroupCache();

      res.json({
        ok: true,
        monitoredGroups: updatedConfig.monitoredGroups,
      });
    } catch (error) {
      logError('Failed to toggle monitored group', error);
      res.status(500).json({ error: 'Failed to toggle monitored group' });
    }
  });

  return app;
}

function startDashboard(config) {
  const app = createDashboardApp();
  const port = Number(process.env.DASHBOARD_PORT || config.dashboard?.port || 3000);

  app.listen(port, () => {
    logInfo(`Dashboard available at http://localhost:${port}`);
  });
}

module.exports = {
  createDashboardApp,
  startDashboard,
};
