const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const DEFAULT_CONFIG = {
  monitoredGroups: [],
  rules: {
    blockAllLinks: true,
    keywords: [],
    matchMode: 'any',
    dryRun: true,
    wordBoundaryKeywords: false,
  },
  moderation: {
    deleteMessage: true,
    removeUser: true,
    logToFile: true,
    rateLimitSeconds: 60,
  },
};

function loadConfig(configPath = process.env.CONFIG_PATH || './config.yaml') {
  const resolvedPath = path.resolve(configPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = YAML.parse(raw) || {};

  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    rules: { ...DEFAULT_CONFIG.rules, ...parsed.rules },
    moderation: { ...DEFAULT_CONFIG.moderation, ...parsed.moderation },
  };
}

module.exports = { loadConfig };
