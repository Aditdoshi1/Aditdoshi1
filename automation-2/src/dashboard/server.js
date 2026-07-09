const express = require('express');
const path = require('path');

function startDashboard(port = 3001) {
  const app = express();
  const publicDir = path.join(__dirname, 'public');

  app.use(express.static(publicDir));

  app.get('/api/status', (_req, res) => {
    res.json({
      ready: true,
      name: 'Automation 2',
      phase: 'development',
      message: 'Scaffold running — build your automation in src/',
      uptimeSec: Math.round(process.uptime()),
    });
  });

  return app.listen(port, '127.0.0.1', () => {
    console.log(`[automation-2] Dev dashboard listening on http://127.0.0.1:${port}`);
  });
}

module.exports = {
  startDashboard,
};
