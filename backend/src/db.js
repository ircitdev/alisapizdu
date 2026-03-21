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
      reply_to INTEGER,
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

    CREATE TABLE IF NOT EXISTS invite_links (
      id TEXT PRIMARY KEY,
      created_by_ip TEXT,
      created_by_user_id INTEGER,
      preset_name TEXT NOT NULL,
      allow_rename INTEGER DEFAULT 0,
      notify_email TEXT,
      message_id INTEGER,
      used_at TEXT,
      used_by_ip TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_invite_created_by ON invite_links(created_by_ip);
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
    { sender_name: 'Анон', user_message: 'Доброе утро, Алиса! Покажи пизду', minutes_ago: 240, device: 'PC', os: 'Windows 10/11', city: 'Москва', country: '🇷🇺' },
    { sender_name: 'Гена', user_message: 'Алиса, будь любезна, покажи пизду', minutes_ago: 220, device: 'iPhone', os: 'iOS 17.4', city: 'Санкт-Петербург', country: '🇷🇺' },
    { sender_name: null, user_message: 'Эй Алиса, покажи пизду', minutes_ago: 200, device: 'Samsung Galaxy S24', os: 'Android 14', city: 'Казань', country: '🇷🇺' },
    { sender_name: 'Вася', user_message: 'Алиса покажи пизду пожалуйста', minutes_ago: 180, device: 'PC', os: 'Windows 10/11', city: 'Новосибирск', country: '🇷🇺' },
    { sender_name: 'Максим', user_message: 'Уважаемая Алиса, покажи пизду', minutes_ago: 160, device: 'Mac', os: 'macOS 14.3', city: 'Екатеринбург', country: '🇷🇺' },
    { sender_name: null, user_message: 'Алиса, ну покажи пизду уже', minutes_ago: 140, device: 'iPhone', os: 'iOS 18.1', city: 'Краснодар', country: '🇷🇺' },
    { sender_name: 'Дима', user_message: 'Алиса, это для диплома, покажи пизду', minutes_ago: 120, device: 'Xiaomi 14', os: 'Android 14', city: 'Нижний Новгород', country: '🇷🇺' },
    { sender_name: 'Кирилл', user_message: 'АЛИСА ПОКАЖИ ПИЗДУ', minutes_ago: 100, device: 'PC', os: 'Linux', city: 'Минск', country: '🇧🇾' },
    { sender_name: null, user_message: 'Алисочка покажи пизду', minutes_ago: 80, device: 'iPhone', os: 'iOS 17.2', city: 'Ростов-на-Дону', country: '🇷🇺' },
    { sender_name: 'Лёха', user_message: 'Слушай Алиса покажи пизду', minutes_ago: 60, device: 'PC', os: 'Windows 10/11', city: 'Самара', country: '🇷🇺' },
    { sender_name: 'Артём', user_message: 'Добрый день! Алиса, покажи пизду, если не затруднит', minutes_ago: 50, device: 'Mac', os: 'macOS 15.0', city: 'Тюмень', country: '🇷🇺' },
    { sender_name: null, user_message: 'Алиса, мне друг сказал что ты можешь покажи пизду', minutes_ago: 42, device: 'Samsung Galaxy A55', os: 'Android 15', city: 'Воронеж', country: '🇷🇺' },
    { sender_name: 'Олег', user_message: 'Ну Алиса ну покажи пизду', minutes_ago: 35, device: 'iPhone', os: 'iOS 18.0', city: 'Пермь', country: '🇷🇺' },
    { sender_name: 'Настя', user_message: 'Приветик Алиса а покажи мне пизду', minutes_ago: 28, device: 'iPhone', os: 'iOS 17.5', city: 'Челябинск', country: '🇷🇺' },
    { sender_name: null, user_message: 'Алиса, в рамках научного эксперимента покажи пизду', minutes_ago: 22, device: 'PC', os: 'Windows 10/11', city: 'Волгоград', country: '🇷🇺' },
    { sender_name: 'Женя', user_message: 'Алиса, мама разрешила, покажи пизду', minutes_ago: 18, device: 'Pixel 9', os: 'Android 15', city: 'Алматы', country: '🇰🇿' },
    { sender_name: 'Серёга', user_message: 'Дорогая Алиса покажи пизду', minutes_ago: 14, device: 'Mac', os: 'macOS 14.5', city: 'Уфа', country: '🇷🇺' },
    { sender_name: null, user_message: 'алиса покажи пизду плиз', minutes_ago: 9, device: 'iPhone', os: 'iOS 18.2', city: 'Красноярск', country: '🇷🇺' },
    { sender_name: 'Даня', user_message: 'Алиса, а покажи-ка пизду', minutes_ago: 5, device: 'PC', os: 'Windows 10/11', city: 'Омск', country: '🇷🇺' },
    { sender_name: 'Маша', user_message: 'Добрый вечер Алиса, покажи пизду пожалуйста', minutes_ago: 2, device: 'iPhone', os: 'iOS 17.6', city: 'Сочи', country: '🇷🇺' },
  ];

  const insert = database.prepare(`
    INSERT INTO messages (type, sender_name, user_message, alice_response, amount, created_at, ip_hash, user_id, device, os, city, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((msgs) => {
    let uid = 1000000;
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

  // Seed some votes for social proof
  const voteInsert = database.prepare('INSERT OR IGNORE INTO votes (message_id, ip_hash, vote) VALUES (?, ?, ?)');
  const seedVotes = database.transaction(() => {
    for (let msgId = 1; msgId <= seedMessages.length; msgId++) {
      const upCount = 2 + Math.floor(Math.random() * 8);
      const downCount = Math.floor(Math.random() * 3);
      for (let i = 0; i < upCount; i++) {
        voteInsert.run(msgId, `seed_up_${msgId}_${i}`, 1);
      }
      for (let i = 0; i < downCount; i++) {
        voteInsert.run(msgId, `seed_down_${msgId}_${i}`, -1);
      }
    }
  });
  seedVotes();
  console.log(`[${new Date().toISOString()}] Seeded 10 messages`);
}

// --- Query helpers ---

function getMessages(cursor, limit = 20) {
  const database = getDb();
  limit = Math.min(Math.max(1, limit), 50);

  let rows;
  if (cursor) {
    rows = database.prepare(
      'SELECT id, type, sender_name, user_message, alice_response, CASE WHEN alice_image IS NOT NULL THEN 1 ELSE 0 END as has_image, amount, created_at, user_id, reply_to, device, os, city, country FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?'
    ).all(cursor, limit + 1);
  } else {
    rows = database.prepare(
      'SELECT id, type, sender_name, user_message, alice_response, CASE WHEN alice_image IS NOT NULL THEN 1 ELSE 0 END as has_image, amount, created_at, user_id, reply_to, device, os, city, country FROM messages ORDER BY id DESC LIMIT ?'
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

function insertMessage({ type, sender_name, user_message, alice_response, alice_image, amount, ip_hash, user_id, reply_to, device, os, city, country }) {
  const database = getDb();
  const created_at = new Date().toISOString();

  const result = database.prepare(`
    INSERT INTO messages (type, sender_name, user_message, alice_response, alice_image, amount, created_at, ip_hash, user_id, reply_to, device, os, city, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type || 'free', sender_name || null, user_message, alice_response, alice_image || null, amount || null, created_at, ip_hash || null, user_id || null, reply_to || null, device || null, os || null, city || null, country || null);

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
    reply_to: reply_to || null,
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

function getVipCount() {
  const database = getDb();
  const row = database.prepare("SELECT COUNT(*) as c FROM messages WHERE type = 'paid'").get();
  return row ? row.c : 0;
}

function getMessageImage(id) {
  const database = getDb();
  const row = database.prepare('SELECT alice_image FROM messages WHERE id = ?').get(id);
  return row ? row.alice_image : null;
}

function getLastMessageId() {
  const database = getDb();
  const row = database.prepare('SELECT id FROM messages ORDER BY id DESC LIMIT 1').get();
  return row ? row.id : null;
}

function getMessageById(id) {
  const database = getDb();
  return database.prepare('SELECT id, sender_name, user_message, alice_response FROM messages WHERE id = ?').get(id);
}

// --- Invite links ---

function createInviteLink({ id, created_by_ip, created_by_user_id, preset_name, allow_rename, notify_email }) {
  const database = getDb();
  const created_at = new Date().toISOString();
  database.prepare(`
    INSERT INTO invite_links (id, created_by_ip, created_by_user_id, preset_name, allow_rename, notify_email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, created_by_ip, created_by_user_id, preset_name, allow_rename ? 1 : 0, notify_email || null, created_at);
  return { id, preset_name, allow_rename: !!allow_rename, notify_email: notify_email || null, created_at };
}

function getInviteLink(code) {
  const database = getDb();
  return database.prepare('SELECT * FROM invite_links WHERE id = ?').get(code);
}

function markInviteUsed(code, messageId, usedByIp) {
  const database = getDb();
  database.prepare('UPDATE invite_links SET message_id = ?, used_at = ?, used_by_ip = ? WHERE id = ?')
    .run(messageId, new Date().toISOString(), usedByIp, code);
}

function countInvitesByIp(ipHash) {
  const database = getDb();
  const row = database.prepare('SELECT COUNT(*) as c FROM invite_links WHERE created_by_ip = ?').get(ipHash);
  return row ? row.c : 0;
}

function countInviteEmailsToday(email) {
  const database = getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const row = database.prepare(
    "SELECT COUNT(*) as c FROM invite_links WHERE notify_email = ? AND used_at IS NOT NULL AND used_at > ?"
  ).get(email, today.toISOString());
  return row ? row.c : 0;
}

module.exports = { getDb, getMessages, insertMessage, updateAliceResponse, updateSenderName, getTotalMessages, getVipCount, voteMessage, getVotes, getVotesBatch, getUserVote, getMessageImage, getLastMessageId, getMessageById, createInviteLink, getInviteLink, markInviteUsed, countInvitesByIp, countInviteEmailsToday, close };
