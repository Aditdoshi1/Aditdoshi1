const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.yaml');
const EXAMPLE_PATH = path.join(__dirname, '..', 'config.example.yaml');

const DEFAULTS = {
  name: 'Automation 2',
  dashboard: {
    port: 3001,
  },
};

function parseSimpleYaml(text) {
  const result = { dashboard: { ...DEFAULTS.dashboard } };

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (trimmed.startsWith('name:')) {
      result.name = trimmed.slice(5).trim();
      continue;
    }

    const portMatch = trimmed.match(/^port:\s*(\d+)/);
    if (portMatch) {
      result.dashboard.port = Number(portMatch[1]);
    }
  }

  return result;
}

function loadConfig() {
  const filePath = fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : EXAMPLE_PATH;

  if (!fs.existsSync(filePath)) {
    return { ...DEFAULTS, dashboard: { ...DEFAULTS.dashboard } };
  }

  return parseSimpleYaml(fs.readFileSync(filePath, 'utf8'));
}

module.exports = {
  loadConfig,
  CONFIG_PATH,
};
