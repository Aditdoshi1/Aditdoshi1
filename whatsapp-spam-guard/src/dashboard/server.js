const express = require('express');
const path = require('path');

const { botState, emitConfigChange } = require('../botState');
const { loadConfig, updateMonitoredGroups } = require('../utils/config');
const { readModerationLogs } = require('../utils/logReader');
const { normalizeId } = require('../utils/isAdmin');
const { logInfo, logError } = require('../utils/logger');

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

async function listWhatsAppGroups() {
  const { client, ready } = botState;

  if (!client || !ready) {
    return [];
  }

  const chats = await client.getChats();

  return chats
    .filter((chat) => chat.isGroup)
    .map((chat) => {
      const id = normalizeId(chat.id?._serialized || chat.id);
      const name = chat.name || id;
      const monitoredGroups = botState.config?.monitoredGroups || [];

      return {
        id,
        name,
        participantCount: chat.participants?.length || 0,
        monitored: isMonitoredGroupId(id, monitoredGroups)
          || isMonitoredGroupName(name, monitoredGroups),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
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
      dryRun: config.rules?.dryRun ?? true,
      monitoredGroups: config.monitoredGroups || [],
      keywords: config.rules?.keywords || [],
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

  app.get('/api/groups', async (_req, res) => {
    try {
      const groups = await listWhatsAppGroups();
      res.json({ groups, ready: botState.ready });
    } catch (error) {
      logError('Failed to list WhatsApp groups', error);
      res.status(500).json({ error: 'Failed to list WhatsApp groups' });
    }
  });

  app.get('/api/config/groups', (_req, res) => {
    const config = botState.config || loadConfig();
    res.json({ monitoredGroups: config.monitoredGroups || [] });
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
