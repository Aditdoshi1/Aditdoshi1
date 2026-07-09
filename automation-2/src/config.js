const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.yaml');
const EXAMPLE_PATH = path.join(ROOT, 'config.example.yaml');
const PAUSE_FILE = path.join(ROOT, '.paused');

const DEFAULTS = {
  name: 'Deal Scout',
  dashboard: { port: 3001 },
  scheduler: { intervalMinutes: 120, enabled: true },
  deals: { minDropPct: 10, minAbsoluteDrop: 5 },
  sources: {
    slickdeals: { enabled: true, feeds: ['popdeals', 'frontpage'] },
    canopy: { enabled: false, maxWatchlistItems: 5, refreshIntervalHours: 24 },
    mock: { enabled: false },
  },
  watchlist: [],
  keywords: [],
};

function parseYamlValue(raw) {
  const value = raw.trim();
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseYamlStructured(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  let listContainer = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\t/g, '  ');
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
      listContainer = null;
    }

    const parent = stack[stack.length - 1].value;

    if (trimmed.startsWith('- ')) {
      if (Array.isArray(listContainer)) {
        listContainer.push(parseYamlValue(trimmed.slice(2)));
      }
      continue;
    }

    const colon = trimmed.indexOf(':');
    if (colon === -1) {
      continue;
    }

    const key = trimmed.slice(0, colon).trim();
    const rest = trimmed.slice(colon + 1).trim();

    if (rest === '') {
      if (key === 'watchlist' || key === 'keywords' || key === 'feeds') {
        parent[key] = [];
        listContainer = parent[key];
      } else {
        parent[key] = {};
        stack.push({ indent, value: parent[key] });
        listContainer = null;
      }
      continue;
    }

    parent[key] = parseYamlValue(rest);
    listContainer = null;
  }

  return root;
}

function mergeDeep(base, override) {
  const output = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && typeof base[key] === 'object'
      && !Array.isArray(base[key])
    ) {
      output[key] = mergeDeep(base[key], value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function loadConfig() {
  try {
    require('dotenv').config({ path: path.join(ROOT, '.env') });
  } catch {
    // optional until npm install
  }

  const filePath = fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : EXAMPLE_PATH;
  if (!fs.existsSync(filePath)) {
    return mergeDeep({}, DEFAULTS);
  }

  return mergeDeep(DEFAULTS, parseYamlStructured(fs.readFileSync(filePath, 'utf8')));
}

function isPaused() {
  return fs.existsSync(PAUSE_FILE);
}

function setPaused(paused) {
  if (paused) {
    fs.writeFileSync(PAUSE_FILE, new Date().toISOString(), 'utf8');
  } else if (fs.existsSync(PAUSE_FILE)) {
    fs.unlinkSync(PAUSE_FILE);
  }
}

module.exports = {
  loadConfig,
  isPaused,
  setPaused,
  CONFIG_PATH,
  PAUSE_FILE,
  ROOT,
};
