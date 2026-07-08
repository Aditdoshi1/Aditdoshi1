const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { botState, setBotState, emitConfigChange } = require('./botState');
const { loadConfig } = require('./utils/config');
const { logInfo, logError } = require('./utils/logger');
const { classifySpam } = require('./spamClassifier');
const { isGroupAdmin, normalizeId } = require('./utils/isAdmin');
const Moderator = require('./moderator');
const { startDashboard } = require('./dashboard/server');
const { handleManualSpamCommand } = require('./manualModeration');

let reconnectTimer = null;
let activeClient = null;

function isMonitoredGroup(chat, monitoredGroups) {
  if (!chat.isGroup) {
    return false;
  }

  if (!monitoredGroups || monitoredGroups.length === 0) {
    return false;
  }

  const chatId = normalizeId(chat.id?._serialized || chat.id);
  const chatName = (chat.name || '').trim().toLowerCase();

  return monitoredGroups.some((group) => {
    if (group.id && idsEqual(group.id, chatId)) {
      return true;
    }

    if (group.name && group.name.trim().toLowerCase() === chatName) {
      return true;
    }

    return false;
  });
}

function idsEqual(a, b) {
  return normalizeId(a) === normalizeId(b);
}

function createClient() {
  return new Client({
    authStrategy: new LocalAuth({
      dataPath: '.wwebjs_auth',
    }),
    restartOnAuthFail: true,
    takeoverOnConflict: true,
    qrMaxRetries: 10,
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-accelerated-2d-canvas',
      ],
    },
  });
}

function scheduleReconnect(startFn) {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    logInfo('Attempting to reconnect...');

    setBotState({ ready: false, authenticated: false });

    if (activeClient) {
      try {
        await activeClient.destroy();
      } catch {
        // Ignore cleanup errors during reconnect.
      }
      activeClient = null;
    }

    startFn();
  }, 5000);
}

async function handleMessage(client, message) {
  const config = botState.config;

  if (!config) {
    return;
  }

  const chat = await message.getChat();

  if (!chat.isGroup) {
    return;
  }

  if (message.fromMe) {
    if (isMonitoredGroup(chat, config.monitoredGroups)) {
      await handleManualSpamCommand({
        client,
        message,
        chat,
        config,
        moderator: botState.moderator,
      });
    }
    return;
  }

  if (!isMonitoredGroup(chat, config.monitoredGroups)) {
    return;
  }

  if (await isGroupAdmin(message, chat, client)) {
    return;
  }

  const text = message.body || '';
  const classification = classifySpam(text, config.rules);

  if (!classification.isSpam) {
    return;
  }

  await botState.moderator.moderateMessage({
    client,
    message,
    chat,
    classification,
  });
}

async function start() {
  const config = loadConfig();
  const moderator = new Moderator(config);

  setBotState({
    config,
    moderator,
    ready: false,
    authenticated: false,
    qrCode: null,
    qrUpdatedAt: null,
  });

  startDashboard(config);

  const client = createClient();
  activeClient = client;
  setBotState({ client });

  client.on('qr', (qr) => {
    setBotState({
      qrCode: qr,
      qrUpdatedAt: new Date().toISOString(),
      ready: false,
      authenticated: false,
    });
    logInfo('Scan this QR code with WhatsApp (Linked Devices):');
    logInfo('Or open the dashboard connect page for a scannable image.');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    setBotState({ authenticated: true, qrCode: null });
    logInfo('Authenticated successfully');
  });

  client.on('auth_failure', (message) => {
    setBotState({ authenticated: false, ready: false, qrCode: null });
    logError('Authentication failed', message);
  });

  client.on('ready', () => {
    setBotState({ ready: true, qrCode: null });
    logInfo('WhatsApp Spam Guard is ready', {
      dryRun: config.rules.dryRun,
      monitoredGroups: config.monitoredGroups.length,
      keywords: config.rules.keywords.length,
      dashboardPort: process.env.DASHBOARD_PORT || config.dashboard?.port || 3000,
    });
  });

  client.on('message', async (message) => {
    try {
      await handleMessage(client, message);
    } catch (error) {
      logError('Unhandled message processing error', error);
    }
  });

  client.on('disconnected', (reason) => {
    setBotState({ ready: false, authenticated: false, qrCode: null });
    logError('Client disconnected', reason);
    scheduleReconnect(start);
  });

  await client.initialize();
}

start().catch((error) => {
  logError('Failed to start bot', error);
  process.exit(1);
});

module.exports = {
  emitConfigChange,
};
