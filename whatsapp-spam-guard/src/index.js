const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { botState, setBotState, emitConfigChange } = require('./botState');
const { loadConfig } = require('./utils/config');
const { logInfo, logError } = require('./utils/logger');
const { classifySpam } = require('./spamClassifier');
const { isGroupAdmin, isBotGroupAdmin, normalizeId } = require('./utils/isAdmin');
const Moderator = require('./moderator');
const { startDashboard } = require('./dashboard/server');
const { handleManualSpamCommand } = require('./manualModeration');
const { runClientTask } = require('./utils/clientQueue');
const { isAutomationPaused } = require('./utils/pause');

let reconnectTimer = null;
let activeClient = null;
let dashboardStarted = false;
let clientStarting = false;

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
        '--disable-extensions',
      ],
    },
  });
}

function scheduleReconnect() {
  if (reconnectTimer) {
    return;
  }

  setBotState({ ready: false, reconnecting: true });

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    logInfo('Attempting to reconnect WhatsApp...');

    try {
      await connectWhatsApp();
    } catch (error) {
      logError('Reconnect failed, retrying in 10 seconds', error);
      scheduleReconnect();
    }
  }, 5000);
}

async function destroyActiveClient() {
  if (!activeClient) {
    return;
  }

  const client = activeClient;
  activeClient = null;

  try {
    client.removeAllListeners();
    await client.destroy();
  } catch {
    // Ignore cleanup errors during reconnect.
  }
}

function attachClientEvents(client, config) {
  client.on('qr', (qr) => {
    setBotState({
      qrCode: qr,
      qrUpdatedAt: new Date().toISOString(),
      ready: false,
      authenticated: false,
      reconnecting: false,
    });
    logInfo('Scan this QR code with WhatsApp (Linked Devices):');
    logInfo('Or open the dashboard connect page for a scannable image.');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    setBotState({ authenticated: true, qrCode: null, reconnecting: false });
    logInfo('Authenticated successfully');
  });

  client.on('auth_failure', (message) => {
    setBotState({ authenticated: false, ready: false, qrCode: null, reconnecting: false });
    logError('Authentication failed', message);
  });

  client.on('ready', () => {
    setBotState({
      ready: true,
      qrCode: null,
      reconnecting: false,
      lastReadyAt: new Date().toISOString(),
    });
    logInfo('WhatsApp Spam Guard is ready', {
      dryRun: config.rules.dryRun,
      monitoredGroups: config.monitoredGroups.length,
      keywords: config.rules.keywords.length,
      dashboardPort: process.env.DASHBOARD_PORT || config.dashboard?.port || 3000,
    });
  });

  client.on('message', async (message) => {
    if (message.fromMe) {
      return;
    }

    try {
      await runClientTask(() => handleMessage(client, message), 'handle-message', 30000);
    } catch (error) {
      logError('Unhandled message processing error', error);
    }
  });

  client.on('message_create', async (message) => {
    if (!message.fromMe) {
      return;
    }

    try {
      await runClientTask(() => handleMessage(client, message), 'handle-own-message', 30000);
    } catch (error) {
      logError('Unhandled own-message processing error', error);
    }
  });

  client.on('disconnected', (reason) => {
    setBotState({ ready: false, authenticated: false, qrCode: null, reconnecting: true });
    logError('WhatsApp disconnected — moderation paused until reconnect', reason);
    scheduleReconnect();
  });
}

async function handleMessage(client, message) {
  if (isAutomationPaused()) {
    return;
  }

  const config = botState.config;

  if (!config) {
    return;
  }

  const chat = await message.getChat();

  if (!chat.isGroup) {
    return;
  }

  if (message.fromMe) {
    if (isMonitoredGroup(chat, config.monitoredGroups) && await isBotGroupAdmin(chat, client)) {
      const handled = await handleManualSpamCommand({
        client,
        message,
        chat,
        config,
        moderator: botState.moderator,
      });

      if (handled) {
        botState.config = loadConfig();
      }
    }
    return;
  }

  if (!isMonitoredGroup(chat, config.monitoredGroups)) {
    return;
  }

  if (!await isBotGroupAdmin(chat, client)) {
    return;
  }

  const text = message.body || '';
  const classification = classifySpam(text, config.rules);

  if (!classification.isSpam) {
    return;
  }

  if (await isGroupAdmin(message, chat, client)) {
    return;
  }

  await botState.moderator.moderateMessage({
    client,
    message,
    chat,
    classification,
  });
}

async function connectWhatsApp() {
  if (clientStarting) {
    logInfo('WhatsApp client is already starting');
    return;
  }

  clientStarting = true;
  setBotState({ reconnecting: true });

  try {
    const config = loadConfig();
    const moderator = botState.moderator || new Moderator(config);

    setBotState({
      config,
      moderator,
      ready: false,
    });

    await destroyActiveClient();

    const client = createClient();
    activeClient = client;
    setBotState({ client });
    attachClientEvents(client, config);

    await client.initialize();
  } finally {
    clientStarting = false;
  }
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
    reconnecting: false,
    lastReadyAt: null,
  });

  if (!dashboardStarted) {
    startDashboard(config);
    dashboardStarted = true;
  }

  await connectWhatsApp();
}

process.on('unhandledRejection', (reason) => {
  logError('Unhandled promise rejection (bot keeps running)', reason);
});

process.on('uncaughtException', (error) => {
  logError('Uncaught exception', error);
});

start().catch((error) => {
  logError('Failed to start bot', error);
  scheduleReconnect();
});

module.exports = {
  emitConfigChange,
};
