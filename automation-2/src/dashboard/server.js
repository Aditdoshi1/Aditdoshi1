const express = require('express');
const path = require('path');
const { loadConfig, isPaused, setPaused } = require('../config');
const store = require('../db/store');
const { getDeferredSources } = require('../sources/affiliateApis');
const { buildCanopy } = require('../engine/ingester');

function createDashboardApp({ scheduler, getConfig }) {
  const app = express();
  const publicDir = path.join(__dirname, 'public');

  app.use(express.json());
  app.use(express.static(publicDir));

  app.get('/api/status', (_req, res) => {
    const config = getConfig();
    const stats = store.getStats();
    const schedulerState = scheduler.getState();
    const canopy = buildCanopy(config);

    res.json({
      ready: true,
      name: config.name,
      phase: 'running',
      paused: isPaused(),
      scheduler: {
        enabled: config.scheduler?.enabled !== false,
        intervalMinutes: config.scheduler?.intervalMinutes || 120,
        ...schedulerState,
      },
      stats,
      sources: {
        slickdeals: config.sources?.slickdeals?.enabled !== false,
        mock: Boolean(config.sources?.mock?.enabled),
        canopy: Boolean(config.sources?.canopy?.enabled && canopy.isEnabled()),
        reddit: Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET),
        deferred: getDeferredSources(),
      },
      recentRuns: store.getLatestFeedRuns(5),
      uptimeSec: Math.round(process.uptime()),
    });
  });

  app.get('/api/deals', (req, res) => {
    const deals = store.listDeals({
      retailer: req.query.retailer || null,
      minDrop: req.query.minDrop != null ? Number(req.query.minDrop) : null,
      keyword: req.query.keyword || null,
      limit: Number(req.query.limit || 100),
    });
    res.json({ deals });
  });

  app.get('/api/retailers', (_req, res) => {
    res.json({ retailers: store.listRetailers() });
  });

  app.get('/api/watchlist', (_req, res) => {
    res.json({ items: store.listWatchlist() });
  });

  app.post('/api/watchlist', (req, res) => {
    const { url, label } = req.body || {};
    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }

    const { addWatchlistUrl } = require('../engine/ingester');
    addWatchlistUrl(url, label);
    res.json({ ok: true, items: store.listWatchlist() });
  });

  app.delete('/api/watchlist/:id', (req, res) => {
    store.removeWatchlistItem(Number(req.params.id));
    res.json({ ok: true, items: store.listWatchlist() });
  });

  app.get('/api/keywords', (_req, res) => {
    res.json({ keywords: store.listKeywords() });
  });

  app.post('/api/keywords', (req, res) => {
    const { term } = req.body || {};
    if (!term?.trim()) {
      res.status(400).json({ error: 'term is required' });
      return;
    }
    store.addKeyword(term.trim());
    res.json({ ok: true, keywords: store.listKeywords() });
  });

  app.delete('/api/keywords/:id', (req, res) => {
    store.removeKeyword(Number(req.params.id));
    res.json({ ok: true, keywords: store.listKeywords() });
  });

  app.post('/api/scan', async (_req, res) => {
    try {
      const result = await scheduler.tick(true);
      res.json({ ok: true, result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/pause', (_req, res) => {
    setPaused(true);
    res.json({ ok: true, paused: true });
  });

  app.post('/api/resume', (_req, res) => {
    setPaused(false);
    res.json({ ok: true, paused: false });
  });

  return app;
}

function startDashboard({ port, scheduler, getConfig }) {
  const app = createDashboardApp({ scheduler, getConfig });
  return app.listen(port, '127.0.0.1', () => {
    console.log(`[deal-scout] Dashboard listening on http://127.0.0.1:${port}`);
  });
}

module.exports = {
  createDashboardApp,
  startDashboard,
};
