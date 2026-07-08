const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const DEFAULT_CONFIG_PATH = process.env.CONFIG_PATH || './config.yaml';

const DEFAULT_CONFIG = {
  dashboard: {
    port: 3000,
  },
  monitoredGroups: [],
  rules: {
    blockAllLinks: true,
    keywords: [],
    matchMode: 'any',
    dryRun: true,
    wordBoundaryKeywords: false,
  },
  commands: {
    enabled: true,
    spam: '!spam',
    deleteCommandMessage: true,
  },
  moderation: {
    deleteMessage: true,
    removeUser: true,
    logToFile: true,
    rateLimitSeconds: 60,
  },
};

function resolveConfigPath(configPath = DEFAULT_CONFIG_PATH) {
  return path.resolve(configPath);
}

function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  const resolvedPath = resolveConfigPath(configPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, 'utf8');
  const parsed = YAML.parse(raw) || {};

  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    dashboard: { ...DEFAULT_CONFIG.dashboard, ...parsed.dashboard },
    rules: { ...DEFAULT_CONFIG.rules, ...parsed.rules },
    commands: { ...DEFAULT_CONFIG.commands, ...parsed.commands },
    moderation: { ...DEFAULT_CONFIG.moderation, ...parsed.moderation },
  };
}

function saveConfig(config, configPath = DEFAULT_CONFIG_PATH) {
  const resolvedPath = resolveConfigPath(configPath);
  const payload = {
    monitoredGroups: config.monitoredGroups || [],
    rules: {
      ...DEFAULT_CONFIG.rules,
      ...config.rules,
    },
    commands: {
      ...DEFAULT_CONFIG.commands,
      ...config.commands,
    },
    moderation: {
      ...DEFAULT_CONFIG.moderation,
      ...config.moderation,
    },
    dashboard: {
      ...DEFAULT_CONFIG.dashboard,
      ...config.dashboard,
    },
  };

  const yaml = YAML.stringify(payload);
  fs.writeFileSync(resolvedPath, yaml, 'utf8');
  return loadConfig(resolvedPath);
}

function updateMonitoredGroups(monitoredGroups, configPath = DEFAULT_CONFIG_PATH) {
  const config = loadConfig(configPath);
  config.monitoredGroups = monitoredGroups;
  return saveConfig(config, configPath);
}

function updateRules(rules, configPath = DEFAULT_CONFIG_PATH) {
  const config = loadConfig(configPath);
  config.rules = {
    ...config.rules,
    ...rules,
  };
  return saveConfig(config, configPath);
}

function updateSettings({ rules, commands }, configPath = DEFAULT_CONFIG_PATH) {
  const config = loadConfig(configPath);

  if (rules) {
    config.rules = {
      ...config.rules,
      ...rules,
    };
  }

  if (commands) {
    config.commands = {
      ...config.commands,
      ...commands,
    };
  }

  return saveConfig(config, configPath);
}

module.exports = {
  loadConfig,
  saveConfig,
  updateMonitoredGroups,
  updateRules,
  updateSettings,
  resolveConfigPath,
};
