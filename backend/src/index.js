require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { getDb, close } = require('./db');
const { initAI } = require('./services/ai');
const { startHeartbeat, stopHeartbeat } = require('./services/broadcast');
const { startCleanup } = require('./services/rateLimit');

const askRouter = require('./routes/ask');
const messagesRouter = require('./routes/messages');
const streamRouter = require('./routes/stream');
const statsRouter = require('./routes/stats');
const nameRouter = require('./routes/name');
const voteRouter = require('./routes/vote');
const askCustomRouter = require('./routes/askCustom');
const imageRouter = require('./routes/image');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(s => s.trim()),
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Don't log SSE stream or heartbeat pings
    if (req.path !== '/api/messages/stream') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// --- Routes ---
app.use('/api/ask', askRouter);
app.use('/api/messages/stream', streamRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/name', nameRouter);
app.use('/api/vote', voteRouter);
app.use('/api/ask-custom', askCustomRouter);
app.use('/api/image', imageRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Start ---
function start() {
  // Initialize database
  getDb();

  // Initialize YandexART
  initAI();

  // Start background services
  startHeartbeat();
  startCleanup();

  const server = app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] ==========================================`);
    console.log(`[${new Date().toISOString()}]   Алиса Покажи Пизду — Backend`);
    console.log(`[${new Date().toISOString()}]   Running on http://localhost:${PORT}`);
    console.log(`[${new Date().toISOString()}]   CORS origin: ${corsOrigin}`);
    console.log(`[${new Date().toISOString()}]   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[${new Date().toISOString()}] ==========================================`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`[${new Date().toISOString()}] ${signal} received, shutting down...`);
    stopHeartbeat();
    close();
    server.close(() => {
      console.log(`[${new Date().toISOString()}] Server closed`);
      process.exit(0);
    });
    // Force exit after 5s
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();

module.exports = app;
