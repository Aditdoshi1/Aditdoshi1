const { startDashboard } = require('./dashboard/server');
const { loadConfig } = require('./config');

const config = loadConfig();

console.log(`[automation-2] Starting (${config.name})…`);

const dashboard = startDashboard(config.dashboard?.port || 3001);

function shutdown(signal) {
  console.log(`[automation-2] ${signal} received — shutting down`);
  dashboard.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log(`[automation-2] Dashboard: http://127.0.0.1:${config.dashboard?.port || 3001}`);
console.log('[automation-2] Ready for development — add your automation logic in src/');
