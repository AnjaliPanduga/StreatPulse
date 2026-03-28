import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import cron from 'node-cron';

import signalRoutes from './routes/signalRoutes';
import dangerRoutes from './routes/dangerRoutes';
import alertRoutes from './routes/alertRoutes';
import { initSocketManager } from './socket/socketManager';
import { runDecayCycle } from './engine/decayService';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/signals', signalRoutes);
app.use('/api/danger-tap', dangerRoutes);
app.use('/api/alerts', alertRoutes);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'streetpulse-engine',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

initSocketManager(server);

cron.schedule('*/2 * * * *', async () => {
  try {
    await runDecayCycle();
  } catch (err) {
    console.error('[Cron] Decay cycle error:', err);
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ❌ Port ${PORT} is already in use.`);
    console.error(`  💡 Kill the existing process first, or use a different port.\n`);
  } else {
    console.error('[Server] Error:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\n  ⚡ StreetPulse Engine running on port ${PORT}`);
  console.log(`  📡 WebSocket server ready`);
  console.log(`  🔄 Decay cycle: every 2 minutes`);
  console.log(`  🏥 Health: http://localhost:${PORT}/api/health\n`);
});

export default app;
