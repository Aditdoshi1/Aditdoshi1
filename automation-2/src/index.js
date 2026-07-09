const { loadConfig } = require('./config');
const { startDashboard } = require('./dashboard/server');
const { createScheduler } = require('./engine/scheduler');
const store = require('./db/store');

let config = loadConfig();

store.seedKeywords(config.keywords);

const scheduler = createScheduler(config, {
  onComplete(result) {
    console.log(`[deal-scout] Scan complete: ${result.totalItems} items, ${result.totalNew} new, ${result.totalDrops} drops`);
  },
  onError(error) {
    console.error('[deal-scout] Scan failed:', error.message);
  },
});

const dashboard = startDashboard({
  port: config.dashboard?.port || 3001,
  scheduler,
  getConfig: () => config,
});

if (config.scheduler?.enabled !== false) {
  scheduler.start();
  scheduler.tick(true).catch((error) => {
    console.error('[deal-scout] Initial scan failed:', error.message);
  });
}

function shutdown(signal) {
  console.log(`[deal-scout] ${signal} received — shutting down`);
  scheduler.stop();
  dashboard.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log(`[deal-scout] ${config.name} running`);
console.log(`[deal-scout] Dashboard: http://127.0.0.1:${config.dashboard?.port || 3001}`);
