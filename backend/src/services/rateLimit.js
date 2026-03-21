const { hashIP } = require('../utils/hash');

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Counter for unique user IDs (7 digits) — initialized from DB on first call
let userIdCounter = null;

function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

function initCounter() {
  if (userIdCounter !== null) return;
  const { getDb } = require('../db');
  const db = getDb();
  const row = db.prepare('SELECT MAX(user_id) as max_id FROM messages').get();
  userIdCounter = (row && row.max_id) ? row.max_id : 1000000;
}

function checkRateLimit(req) {
  const { getDb } = require('../db');
  const db = getDb();
  const ip = getRealIP(req);
  const ipHash = hashIP(ip);

  initCounter();

  // Check last message from this IP in the database
  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const lastMsg = db.prepare(
    "SELECT created_at, user_id FROM messages WHERE ip_hash = ? AND created_at > ? ORDER BY id DESC LIMIT 1"
  ).get(ipHash, cutoff);

  if (lastMsg) {
    const lastTime = new Date(lastMsg.created_at).getTime();
    const remainingMs = COOLDOWN_MS - (Date.now() - lastTime);
    if (remainingMs > 0) {
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
      return {
        allowed: false,
        ipHash,
        userId: lastMsg.user_id,
        retryAfter: Math.ceil(remainingMs / 1000),
        message: `Ты уже спрашивал. Следующая попытка через ${remainingHours} ч.`
      };
    }
  }

  const userId = ++userIdCounter;
  return { allowed: true, ipHash, userId };
}

function getUserId(req) {
  const { getDb } = require('../db');
  const db = getDb();
  const ip = getRealIP(req);
  const ipHash = hashIP(ip);
  const row = db.prepare('SELECT user_id FROM messages WHERE ip_hash = ? ORDER BY id DESC LIMIT 1').get(ipHash);
  return row ? row.user_id : null;
}

function startCleanup() {
  // No cleanup needed — DB is the source of truth
  console.log(`[${new Date().toISOString()}] Rate limit: using database (persistent)`);
}

module.exports = { checkRateLimit, getUserId, startCleanup, getRealIP };
