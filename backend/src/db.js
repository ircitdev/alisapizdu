const Database = require('better-sqlite3');
const path = require('path');
const { getRandomMockResponse } = require('./utils/mockResponses');

const DB_PATH = path.join(__dirname, '..', 'data', 'alisapizdu.db');

let db;

function getDb() {
  if (db) return db;

  const fs = require('fs');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'free',
      sender_name TEXT,
      user_message TEXT NOT NULL,
      alice_response TEXT NOT NULL,
      alice_image TEXT,
      amount INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ip_hash TEXT,
      user_id INTEGER,
      user_agent TEXT,
      device TEXT,
      os TEXT,
      city TEXT,
      country TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_id ON messages(id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );

    INSERT OR IGNORE INTO stats (key, value) VALUES ('total_messages', 0);

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      ip_hash TEXT NOT NULL,
      vote INTEGER NOT NULL,
      UNIQUE(message_id, ip_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_votes_message ON votes(message_id);
  `);

  seed(db);

  console.log(`[${new Date().toISOString()}] Database initialized at ${DB_PATH}`);
  return db;
}

function seed(database) {
  const count = database.prepare('SELECT COUNT(*) as cnt FROM messages').get();
  if (count.cnt > 0) return;

  console.log(`[${new Date().toISOString()}] Seeding database with initial messages...`);

  const seedMessages = [
    { sender_name: 'Анон', user_message: 'Алиса покажи пизду', minutes_ago: 240, device: 'PC', os: 'Windows 10/11', city: 'Москва', country: '🇷🇺 RU' },
    { sender_name: 'Гена', user_message: 'Алиса покажи пизду', minutes_ago: 220, device: 'iPhone', os: 'iOS 17.4', city: 'Санкт-Петербург', country: '🇷🇺 RU' },
    { sender_name: null, user_message: 'Алиса покажи пизду', minutes_ago: 200, device: 'Samsung Galaxy S24', os: 'Android 14', city: 'Казань', country: '🇷🇺 RU' },
    { sender_name: 'Вася', user_message: 'Алиса покажи пизду', minutes_ago: 180, device: 'PC', os: 'Windows 10/11', city: 'Новосибирск', country: '🇷🇺 RU' },
    { sender_name: 'Максим', user_message: 'Алиса покажи пизду', minutes_ago: 160, device: 'Mac', os: 'macOS 14.3', city: 'Екатеринбург', country: '🇷🇺 RU' },
    { sender_name: null, user_message: 'Алиса покажи пизду', minutes_ago: 140, device: 'iPhone', os: 'iOS 18.1', city: 'Краснодар', country: '🇷🇺 RU' },
    { sender_name: 'Дима', user_message: 'Алиса покажи пизду', minutes_ago: 120, device: 'Xiaomi 14', os: 'Android 14', city: 'Нижний Новгород', country: '🇷🇺 RU' },
    { sender_name: 'Кирилл', user_message: 'Алиса покажи пизду', minutes_ago: 100, device: 'PC', os: 'Linux', city: 'Минск', country: '🇧🇾 BY' },
    { sender_name: null, user_message: 'Алиса покажи пизду', minutes_ago: 80, device: 'iPhone', os: 'iOS 17.2', city: 'Ростов-на-Дону', country: '🇷🇺 RU' },
    { sender_name: 'Лёха', user_message: 'Алиса покажи пизду', minutes_ago: 60, device: 'PC', os: 'Windows 10/11', city: 'Самара', country: '🇷🇺 RU' },
    { sender_name: 'Артём', user_message: 'Алиса покажи пизду', minutes_ago: 50, device: 'Mac', os: 'macOS 15.0', city: 'Тюмень', country: '🇷🇺 RU' },
    { sender_name: null, user_message: 'Алиса покажи пизду', minutes_ago: 42, device: 'Samsung Galaxy A55', os: 'Android 15', city: 'Воронеж', country: '🇷🇺 RU' },
    { sender_name: 'Олег', user_message: 'Алиса покажи пизду', minutes_ago: 35, device: 'iPhone', os: 'iOS 18.0', city: 'Пермь', country: '🇷🇺 RU' },
    { sender_name: 'Настя', user_message: 'Алиса покажи пизду', minutes_ago: 28, device: 'iPhone', os: 'iOS 17.5', city: 'Челябинск', country: '🇷🇺 RU' },
    { sender_name: null, user_message: 'Алиса покажи пизду', minutes_ago: 22, device: 'PC', os: 'Windows 10/11', city: 'Волгоград', country: '🇷🇺 RU' },
    { sender_name: 'Женя', user_message: 'Алиса покажи пизду', minutes_ago: 18, device: 'Pixel 9', os: 'Android 15', city: 'Алматы', country: '🇰🇿 KZ' },
    { sender_name: 'Серёга', user_message: 'Алиса покажи пизду', minutes_ago: 14, device: 'Mac', os: 'macOS 14.5', city: 'Уфа', country: '🇷🇺 RU' },
    { sender_name: null, user_message: 'Алиса покажи пизду', minutes_ago: 9, device: 'iPhone', os: 'iOS 18.2', city: 'Красноярск', country: '🇷🇺 RU' },
    { sender_name: 'Даня', user_message: 'Алиса покажи пизду', minutes_ago: 5, device: 'PC', os: 'Windows 10/11', city: 'Омск', country: '🇷🇺 RU' },
    { sender_name: 'Маша', user_message: 'Алиса покажи пизду', minutes_ago: 2, device: 'iPhone', os: 'iOS 17.6', city: 'Сочи', country: '🇷🇺 RU' },
  ];

  const insert = database.prepare(`
    INSERT INTO messages (type, sender_name, user_message, alice_response, amount, created_at, ip_hash, user_id, device, os, city, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((msgs) => {
    let uid = 1000;
    for (const msg of msgs) {
      const createdAt = new Date(Date.now() - msg.minutes_ago * 60000).toISOString();
      insert.run(
        'free',
        msg.sender_name,
        msg.user_message,
        getRandomMockResponse(),
        null,
        createdAt,
        'seed',
        ++uid,
        msg.device || null,
        msg.os || null,
        msg.city || null,
        msg.country || null
      );
    }
  });

  insertMany(seedMessages);

  database.prepare('UPDATE stats SET value = ? WHERE key = ?').run(seedMessages.length, 'total_messages');
  console.log(`[${new Date().toISOString()}] Seeded 10 messages`);
}

// --- Query helpers ---

function getMessages(cursor, limit = 20) {
  const database = getDb();
  limit = Math.min(Math.max(1, limit), 50);

  let rows;
  if (cursor) {
    rows = database.prepare(
      'SELECT id, type, sender_name, user_message, alice_response, alice_image, amount, created_at, user_id, device, os, city, country FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?'
    ).all(cursor, limit + 1);
  } else {
    rows = database.prepare(
      'SELECT id, type, sender_name, user_message, alice_response, alice_image, amount, created_at, user_id, device, os, city, country FROM messages ORDER BY id DESC LIMIT ?'
    ).all(limit + 1);
  }

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  const nextCursor = hasMore && rows.length > 0 ? rows[rows.length - 1].id : null;

  return {
    messages: rows,
    next_cursor: nextCursor,
    has_more: hasMore
  };
}

function insertMessage({ type, sender_name, user_message, alice_response, alice_image, amount, ip_hash, user_id, device, os, city, country }) {
  const database = getDb();
  const created_at = new Date().toISOString();

  const result = database.prepare(`
    INSERT INTO messages (type, sender_name, user_message, alice_response, alice_image, amount, created_at, ip_hash, user_id, device, os, city, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type || 'free', sender_name || null, user_message, alice_response, alice_image || null, amount || null, created_at, ip_hash || null, user_id || null, device || null, os || null, city || null, country || null);

  database.prepare('UPDATE stats SET value = value + 1 WHERE key = ?').run('total_messages');

  return {
    id: result.lastInsertRowid,
    type: type || 'free',
    sender_name: sender_name || null,
    user_message,
    alice_response,
    alice_image: alice_image || null,
    amount: amount || null,
    created_at,
    user_id: user_id || null,
    device: device || null,
    os: os || null,
    city: city || null,
    country: country || null,
  };
}

function updateSenderName(messageId, senderName, ipHash) {
  const database = getDb();
  // Only allow the original author to update their name
  const msg = database.prepare('SELECT ip_hash FROM messages WHERE id = ?').get(messageId);
  if (!msg || msg.ip_hash !== ipHash) return false;
  database.prepare('UPDATE messages SET sender_name = ? WHERE id = ?').run(senderName, messageId);
  return true;
}

function updateAliceResponse(id, alice_response, alice_image) {
  const database = getDb();
  if (alice_image) {
    database.prepare('UPDATE messages SET alice_response = ?, alice_image = ? WHERE id = ?').run(alice_response, alice_image, id);
  } else {
    database.prepare('UPDATE messages SET alice_response = ? WHERE id = ?').run(alice_response, id);
  }
}

function getTotalMessages() {
  const database = getDb();
  const row = database.prepare('SELECT value FROM stats WHERE key = ?').get('total_messages');
  return row ? row.value : 0;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

function voteMessage(messageId, ipHash, vote) {
  const database = getDb();
  // vote: 1 = up, -1 = down
  try {
    database.prepare('INSERT OR REPLACE INTO votes (message_id, ip_hash, vote) VALUES (?, ?, ?)').run(messageId, ipHash, vote);
    return getVotes(messageId);
  } catch {
    return getVotes(messageId);
  }
}

function getVotes(messageId) {
  const database = getDb();
  const up = database.prepare('SELECT COUNT(*) as c FROM votes WHERE message_id = ? AND vote = 1').get(messageId);
  const down = database.prepare('SELECT COUNT(*) as c FROM votes WHERE message_id = ? AND vote = -1').get(messageId);
  return { up: up.c, down: down.c };
}

function getVotesBatch(messageIds) {
  if (!messageIds.length) return {};
  const database = getDb();
  const placeholders = messageIds.map(() => '?').join(',');
  const rows = database.prepare(
    `SELECT message_id, vote, COUNT(*) as c FROM votes WHERE message_id IN (${placeholders}) GROUP BY message_id, vote`
  ).all(...messageIds);
  const result = {};
  for (const row of rows) {
    if (!result[row.message_id]) result[row.message_id] = { up: 0, down: 0 };
    if (row.vote === 1) result[row.message_id].up = row.c;
    else result[row.message_id].down = row.c;
  }
  return result;
}

function getUserVote(messageId, ipHash) {
  const database = getDb();
  const row = database.prepare('SELECT vote FROM votes WHERE message_id = ? AND ip_hash = ?').get(messageId, ipHash);
  return row ? row.vote : 0;
}

module.exports = { getDb, getMessages, insertMessage, updateAliceResponse, updateSenderName, getTotalMessages, voteMessage, getVotes, getVotesBatch, getUserVote, close };
