const express = require('express');
const path = require('path');

const {
  listAutomationStatuses,
  startAutomation,
  stopAutomation,
  pauseAutomation,
  resumeAutomation,
  getAutomationLogs,
} = require('./src/automationManager');

const app = express();
const PORT = Number(process.env.HUB_PORT || 8080);
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get('/api/automations', async (_req, res) => {
  try {
    const automations = await listAutomationStatuses();
    res.json({ automations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/automations/:id/logs', (req, res) => {
  try {
    res.json({
      logs: getAutomationLogs(req.params.id),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/automations/:id/start', (req, res) => {
  try {
    const result = startAutomation(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/automations/:id/stop', (req, res) => {
  try {
    const result = stopAutomation(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/automations/:id/pause', (req, res) => {
  try {
    const result = pauseAutomation(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/automations/:id/resume', (req, res) => {
  try {
    const result = resumeAutomation(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Automation Hub running at http://127.0.0.1:${PORT}`);
});
