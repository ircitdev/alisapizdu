const { hashIP } = require('../utils/hash');

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Map<ipHash, { timestamp, userId }>
const rateLimitMap = new Map();

// Counter for unique user IDs (7 digits)
let userIdCounter = 1000000;

function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

function checkRateLimit(req) {
  const ip = getRealIP(req);
  const ipHash = hashIP(ip);
  const now = Date.now();
  const entry = rateLimitMap.get(ipHash);

  // Generate or retrieve user ID
  let userId;
  if (entry) {
    userId = entry.userId;
  } else {
    userId = ++userIdCounter;
  }

  if (entry && (now - entry.timestamp) < COOLDOWN_MS) {
    const remainingMs = COOLDOWN_MS - (now - entry.timestamp);
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    return {
      allowed: false,
      ipHash,
      userId,
      retryAfter: Math.ceil(remainingMs / 1000),
      message: `Ты уже спрашивал. Следующая попытка через ${remainingHours} ч.`
    };
  }

  rateLimitMap.set(ipHash, { timestamp: now, userId });
  return { allowed: true, ipHash, userId };
}

function getUserId(req) {
  const ip = getRealIP(req);
  const ipHash = hashIP(ip);
  const entry = rateLimitMap.get(ipHash);
  return entry ? entry.userId : null;
}

function startCleanup() {
  const interval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of rateLimitMap) {
      if (now - entry.timestamp > COOLDOWN_MS) {
        rateLimitMap.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[${new Date().toISOString()}] Rate limit cleanup: removed ${cleaned} entries`);
    }
  }, CLEANUP_INTERVAL_MS);

  interval.unref();
  console.log(`[${new Date().toISOString()}] Rate limit cleanup started (${CLEANUP_INTERVAL_MS / 1000}s interval)`);
}

module.exports = { checkRateLimit, getUserId, startCleanup, getRealIP };
