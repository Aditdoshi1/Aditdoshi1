const { isPaused } = require('../config');
const { runIngestion } = require('./ingester');

function createScheduler(config, { onComplete, onError } = {}) {
  let timer = null;
  let running = false;
  let lastResult = null;
  let lastError = null;

  const intervalMs = Math.max(5, config.scheduler?.intervalMinutes || 120) * 60 * 1000;

  async function tick(manual = false) {
    if (running) {
      return { skipped: true, reason: 'Scan already in progress' };
    }

    if (!manual && isPaused()) {
      return { skipped: true, reason: 'Scheduler paused' };
    }

    if (!manual && config.scheduler?.enabled === false) {
      return { skipped: true, reason: 'Scheduler disabled in config' };
    }

    running = true;
    try {
      const result = await runIngestion(config);
      lastResult = result;
      lastError = null;
      onComplete?.(result);
      return result;
    } catch (error) {
      lastError = error;
      onError?.(error);
      throw error;
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) {
      return;
    }

    timer = setInterval(() => {
      tick(false).catch((error) => {
        console.error('[deal-scout] scheduled scan failed:', error.message);
      });
    }, intervalMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
    tick,
    getState() {
      return {
        running,
        intervalMs,
        lastResult,
        lastError: lastError ? lastError.message : null,
        paused: isPaused(),
      };
    },
  };
}

module.exports = {
  createScheduler,
};
