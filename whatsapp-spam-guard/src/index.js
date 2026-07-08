const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { loadConfig } = require('./utils/config');
const { logInfo, logError } = require('./utils/logger');
const { classifySpam } = require('./spamClassifier');
const { isGroupAdmin, normalizeId } = require('./utils/isAdmin');
const Moderator = require('./moderator');

let reconnectTimer = null;
let activeClient = null;

function isMonitoredGroup(chat, monitoredGroups) {
  if (!chat.isGroup) {
    return false;
  }

  if (!monitoredGroups || monitoredGroups.length === 0) {
    return true;
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
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
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

async function handleMessage(client, config, moderator, message) {
  if (message.fromMe) {
    return;
  }

  const chat = await message.getChat();

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

  await moderator.moderateMessage({
    client,
    message,
    chat,
    classification,
  });
}

async function start() {
  const config = loadConfig();
  const moderator = new Moderator(config);
  const client = createClient();
  activeClient = client;

  client.on('qr', (qr) => {
    logInfo('Scan this QR code with WhatsApp (Linked Devices):');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    logInfo('Authenticated successfully');
  });

  client.on('auth_failure', (message) => {
    logError('Authentication failed', message);
  });

  client.on('ready', () => {
    logInfo('WhatsApp Spam Guard is ready', {
      dryRun: config.rules.dryRun,
      monitoredGroups: config.monitoredGroups.length,
      keywords: config.rules.keywords.length,
    });
  });

  client.on('message', async (message) => {
    try {
      await handleMessage(client, config, moderator, message);
    } catch (error) {
      logError('Unhandled message processing error', error);
    }
  });

  client.on('disconnected', (reason) => {
    logError('Client disconnected', reason);
    scheduleReconnect(start);
  });

  await client.initialize();
}

start().catch((error) => {
  logError('Failed to start bot', error);
  process.exit(1);
});
