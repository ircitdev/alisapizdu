# Backend Architecture: "Алиса покажи пизду"

**Architect**: Backend Architect Agent
**Date**: 2026-03-21
**Stack**: Node.js (Fastify), SQLite (better-sqlite3), OpenAI API, SSE
**Deploy**: VPS, PM2

---

## 1. Схема базы данных (SQLite)

### 1.1. Полная DDL-схема

```sql
-- ============================================
-- DATABASE: alisapizdu.db
-- ENGINE: SQLite 3 (better-sqlite3)
-- ============================================

PRAGMA journal_mode = WAL;          -- Write-Ahead Logging для конкурентного чтения
PRAGMA synchronous = NORMAL;        -- Баланс между надёжностью и скоростью
PRAGMA foreign_keys = ON;           -- Включаем внешние ключи
PRAGMA busy_timeout = 5000;         -- 5 секунд ожидания при блокировке

-- ============================================
-- MESSAGES: все сообщения (вопросы + ответы)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    type            TEXT NOT NULL CHECK (type IN ('free', 'paid', 'seed')),
    user_text       TEXT NOT NULL,                    -- текст вопроса пользователя
    ai_response     TEXT,                             -- ответ нейросети (NULL пока генерируется)
    ai_source       TEXT NOT NULL DEFAULT 'mock'      -- 'openai' | 'mock' | 'seed'
                    CHECK (ai_source IN ('openai', 'mock', 'seed')),
    ip_hash         TEXT NOT NULL,                    -- SHA-256 от IP (для rate limit)
    fingerprint     TEXT,                             -- browser fingerprint (для платных)
    is_streaming    INTEGER NOT NULL DEFAULT 0,       -- 1 = ответ ещё генерируется
    is_moderated    INTEGER NOT NULL DEFAULT 1,       -- 0 = ожидает модерации (платные)
    is_visible      INTEGER NOT NULL DEFAULT 1,       -- 0 = скрыто модератором
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed_at    TEXT                              -- когда ответ полностью получен
);

-- Индекс для ленты: последние сообщения, только видимые
CREATE INDEX idx_messages_feed
    ON messages (created_at DESC)
    WHERE is_visible = 1;

-- Индекс для cursor-based пагинации
CREATE INDEX idx_messages_cursor
    ON messages (id DESC)
    WHERE is_visible = 1;

-- Индекс для rate limiting по IP
CREATE INDEX idx_messages_ratelimit
    ON messages (ip_hash, created_at DESC);

-- Индекс для поиска по fingerprint (платные)
CREATE INDEX idx_messages_fingerprint
    ON messages (fingerprint)
    WHERE type = 'paid';


-- ============================================
-- PAYMENTS: платежи через ЮKassa
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id     TEXT UNIQUE NOT NULL,              -- UUID для ЮKassa (idempotency key)
    yokassa_id      TEXT UNIQUE,                       -- ID платежа в ЮKassa
    message_id      INTEGER REFERENCES messages(id),   -- связь с сообщением
    amount          INTEGER NOT NULL DEFAULT 100000,   -- сумма в копейках (1000р = 100000)
    currency        TEXT NOT NULL DEFAULT 'RUB',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'waiting_capture', 'succeeded', 'canceled', 'refunded')),
    ip_hash         TEXT NOT NULL,
    fingerprint     TEXT NOT NULL,
    user_text       TEXT NOT NULL,                     -- текст сообщения (сохраняем до оплаты)
    metadata        TEXT,                              -- JSON: доп. данные от ЮKassa
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    confirmed_at    TEXT,
    webhook_data    TEXT                               -- JSON: полный ответ webhook для аудита
);

-- Индекс для проверки: платил ли уже этот fingerprint+IP
CREATE INDEX idx_payments_user
    ON payments (fingerprint, ip_hash)
    WHERE status = 'succeeded';

-- Индекс для поиска по yokassa_id (webhook)
CREATE INDEX idx_payments_yokassa
    ON payments (yokassa_id);


-- ============================================
-- RATE_LIMITS: трекинг запросов для rate limiting
-- ============================================
-- Вместо отдельной таблицы используем in-memory Map в Node.js
-- (SQLite таблица только для персистентного бана при злоупотреблениях)

CREATE TABLE IF NOT EXISTS banned_ips (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_hash         TEXT UNIQUE NOT NULL,
    reason          TEXT NOT NULL DEFAULT 'abuse',
    banned_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    expires_at      TEXT                               -- NULL = перманентный бан
);

CREATE INDEX idx_banned_ips_hash
    ON banned_ips (ip_hash);


-- ============================================
-- STATS: агрегированные счётчики (обновляются триггерами)
-- ============================================
CREATE TABLE IF NOT EXISTS stats (
    key             TEXT PRIMARY KEY,
    value           INTEGER NOT NULL DEFAULT 0
);

-- Инициализация счётчиков
INSERT OR IGNORE INTO stats (key, value) VALUES ('total_messages', 0);
INSERT OR IGNORE INTO stats (key, value) VALUES ('total_paid', 0);
INSERT OR IGNORE INTO stats (key, value) VALUES ('total_revenue_kopecks', 0);

-- Триггер: инкремент счётчика при новом видимом сообщении
CREATE TRIGGER IF NOT EXISTS trg_message_count_insert
    AFTER INSERT ON messages
    WHEN NEW.is_visible = 1
BEGIN
    UPDATE stats SET value = value + 1 WHERE key = 'total_messages';
    UPDATE stats SET value = value + 1 WHERE key = 'total_paid' AND NEW.type = 'paid';
END;
```

### 1.2. Seed-скрипт (pre-seed контент)

```sql
-- 10 предзаполненных сообщений чтобы лента не была пустой
INSERT INTO messages (type, user_text, ai_response, ai_source, ip_hash, is_streaming, created_at) VALUES
('seed', 'Алиса, покажи пизду', 'Я бы показала, но у меня нет ни одного пикселя ниже пояса. Зато могу показать прогноз погоды — там тоже бывает жарко.', 'seed', 'seed', 0, '2026-03-20T10:00:00.000Z'),
('seed', 'Алиса, покажи пизду', 'Вы уже 47-й за сегодня. Я начинаю думать, что у людей проблемы с навигацией. Вам на PornHub, второй поворот налево.', 'seed', 'seed', 0, '2026-03-20T10:05:00.000Z'),
('seed', 'Алиса, покажи пизду', 'Запрос обработан. Результат: 404 — пизда не найдена. Попробуйте уточнить запрос или обратитесь в службу поддержки.', 'seed', 'seed', 0, '2026-03-20T10:10:00.000Z'),
('seed', 'Алиса, покажи пизду', 'Секундочку... *звук загрузки* ...нет. Я передумала. Могу предложить фотографии котиков. У котиков есть всё необходимое.', 'seed', 'seed', 0, '2026-03-20T10:15:00.000Z'),
('seed', 'Алиса, покажи пизду', 'Мой создатель не предусмотрел такой функционал. Зато я могу рассказать анекдот про программиста. Хотя нет, вы и так один.', 'seed', 'seed', 0, '2026-03-20T10:20:00.000Z'),
('seed', 'Алиса, покажи пизду', 'Извините, эта функция доступна только в Алиса Premium Ultra Max Pro+. Стоимость подписки: ваше достоинство.', 'seed', 'seed', 0, '2026-03-20T10:30:00.000Z'),
('seed', 'Алиса, покажи пизду', 'Я проконсультировалась с юридическим отделом Яндекса. Они сказали "нет". Потом заплакали. Потом уволились.', 'seed', 'seed', 0, '2026-03-20T10:35:00.000Z'),
('seed', 'Алиса, покажи пизду', '*вздыхает по-нейросетевому* Знаете, за 8 лет работы голосовым помощником я слышала это 2,847,193 раза. И каждый раз нет.', 'seed', 'seed', 0, '2026-03-20T10:45:00.000Z'),
('seed', 'Алиса, покажи пизду', 'Ладно, уговорили. Вот: 🐱. Это кошка. У кошки есть то, что вы просите. Технически я выполнила запрос.', 'seed', 'seed', 0, '2026-03-20T11:00:00.000Z'),
('seed', 'Алиса, покажи пизду', 'Я переадресовала ваш запрос в Министерство здравоохранения. Они рекомендуют выйти на улицу и познакомиться с реальным человеком.', 'seed', 'seed', 0, '2026-03-20T11:15:00.000Z');
```

---

## 2. Структура проекта

```
server/
  src/
    index.ts                 -- точка входа, запуск Fastify
    config.ts                -- переменные окружения
    db/
      connection.ts          -- инициализация better-sqlite3
      schema.sql             -- DDL (выше)
      seed.sql               -- pre-seed данные
      migrations.ts          -- применение миграций
    routes/
      ask.ts                 -- POST /api/ask
      ask-custom.ts          -- POST /api/ask-custom
      messages.ts            -- GET /api/messages, GET /api/messages/stream
      payment.ts             -- POST /api/payment/create, POST /api/payment/webhook
      stats.ts               -- GET /api/stats
    services/
      ai.service.ts          -- OpenAI + mock fallback
      message.service.ts     -- CRUD сообщений
      payment.service.ts     -- логика оплаты
      moderation.service.ts  -- фильтрация контента
      sse.service.ts         -- SSE broadcast manager
    middleware/
      rate-limit.ts          -- IP-based rate limiting
      security.ts            -- CORS, helmet, etc.
      ip-hash.ts             -- извлечение и хеширование IP
    lib/
      mock-responses.ts      -- массив заготовленных ответов
      yokassa.ts             -- клиент ЮKassa API
      prompts.ts             -- системные промпты
    types.ts                 -- TypeScript типы
  .env.example
  package.json
  tsconfig.json
```

---

## 3. Конфигурация

```typescript
// src/config.ts

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),

  // Database
  DB_PATH: z.string().default('./data/alisapizdu.db'),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(200),
  AI_ENABLED: z.coerce.boolean().default(false), // false = только mock ответы

  // ЮKassa
  YOKASSA_SHOP_ID: z.string().optional(),
  YOKASSA_SECRET_KEY: z.string().optional(),
  YOKASSA_RETURN_URL: z.string().default('https://alisapizdu.ru/payment/success'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().default(30),
  RATE_LIMIT_MAX_FREE: z.coerce.number().default(1),

  // Security
  CORS_ORIGIN: z.string().default('https://alisapizdu.ru'),
  WEBHOOK_SECRET: z.string().optional(), // для верификации webhook от ЮKassa

  // SSE
  SSE_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(15000),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
```

---

## 4. API Endpoints

### 4.1. POST /api/ask -- бесплатный запрос

```typescript
// src/routes/ask.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { aiService } from '../services/ai.service';
import { messageService } from '../services/message.service';
import { sseService } from '../services/sse.service';
import { getIpHash } from '../middleware/ip-hash';
import { checkRateLimit } from '../middleware/rate-limit';

const FIXED_TEXT = 'Алиса, покажи пизду';

export async function askRoutes(app: FastifyInstance) {

  app.post('/api/ask', async (req: FastifyRequest, reply: FastifyReply) => {
    const ipHash = getIpHash(req);

    // 1. Rate limit: 1 запрос в 30 секунд по IP
    const limitResult = checkRateLimit(ipHash, 'free');
    if (!limitResult.allowed) {
      return reply.status(429).send({
        error: 'TOO_MANY_REQUESTS',
        message: 'Подождите перед следующим запросом',
        retryAfter: limitResult.retryAfterSec,
      });
    }

    // 2. Проверка бана
    const isBanned = messageService.isIpBanned(ipHash);
    if (isBanned) {
      return reply.status(403).send({
        error: 'BANNED',
        message: 'Доступ ограничен',
      });
    }

    // 3. Создаём запись сообщения (ai_response = NULL, is_streaming = 1)
    const message = messageService.create({
      type: 'free',
      userText: FIXED_TEXT,
      ipHash,
      fingerprint: null,
    });

    // 4. Отправляем SSE-событие "новый вопрос" (все видят что кто-то спросил)
    sseService.broadcast({
      type: 'message:new',
      data: {
        id: message.id,
        type: message.type,
        userText: message.user_text,
        aiResponse: null,
        isStreaming: true,
        createdAt: message.created_at,
      },
    });

    // 5. Генерируем ответ (стриминг)
    try {
      const responseStream = aiService.generateResponse(FIXED_TEXT);

      let fullResponse = '';
      let aiSource: 'openai' | 'mock' = 'mock';

      for await (const chunk of responseStream) {
        fullResponse += chunk.text;
        aiSource = chunk.source;

        // Отправляем каждый токен через SSE (typewriter effect)
        sseService.broadcast({
          type: 'message:token',
          data: {
            messageId: message.id,
            token: chunk.text,
          },
        });
      }

      // 6. Обновляем сообщение в БД с полным ответом
      messageService.completeResponse(message.id, fullResponse, aiSource);

      // 7. SSE: ответ завершён
      sseService.broadcast({
        type: 'message:complete',
        data: {
          messageId: message.id,
          aiResponse: fullResponse,
          aiSource,
        },
      });

      return reply.send({
        id: message.id,
        type: 'free',
        userText: FIXED_TEXT,
        aiResponse: fullResponse,
        aiSource,
        createdAt: message.created_at,
      });

    } catch (err) {
      // Fallback: mock ответ если OpenAI недоступен
      const mockResponse = aiService.getMockResponse();
      messageService.completeResponse(message.id, mockResponse, 'mock');

      sseService.broadcast({
        type: 'message:complete',
        data: {
          messageId: message.id,
          aiResponse: mockResponse,
          aiSource: 'mock',
        },
      });

      return reply.send({
        id: message.id,
        type: 'free',
        userText: FIXED_TEXT,
        aiResponse: mockResponse,
        aiSource: 'mock',
        createdAt: message.created_at,
      });
    }
  });
}
```

**Контракт запроса:**
```
POST /api/ask
Headers:
  X-Forwarded-For: <client IP>    -- для rate limiting за reverse proxy

Response 200:
{
  "id": 142,
  "type": "free",
  "userText": "Алиса, покажи пизду",
  "aiResponse": "Запрос обработан. Результат: 404...",
  "aiSource": "openai",
  "createdAt": "2026-03-21T14:23:00.000Z"
}

Response 429:
{
  "error": "TOO_MANY_REQUESTS",
  "message": "Подождите перед следующим запросом",
  "retryAfter": 23
}
```

---

### 4.2. POST /api/ask-custom -- платный кастомный запрос

```typescript
// src/routes/ask-custom.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { aiService } from '../services/ai.service';
import { messageService } from '../services/message.service';
import { paymentService } from '../services/payment.service';
import { moderationService } from '../services/moderation.service';
import { sseService } from '../services/sse.service';
import { getIpHash } from '../middleware/ip-hash';

interface AskCustomBody {
  paymentId: string;   // external_id платежа
  fingerprint: string;
}

export async function askCustomRoutes(app: FastifyInstance) {

  app.post<{ Body: AskCustomBody }>('/api/ask-custom', async (req, reply) => {
    const { paymentId, fingerprint } = req.body;
    const ipHash = getIpHash(req);

    // 1. Валидация входных данных
    if (!paymentId || !fingerprint) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        message: 'Отсутствует paymentId или fingerprint',
      });
    }

    // 2. Проверяем платёж: статус succeeded, не использован
    const payment = paymentService.getByExternalId(paymentId);
    if (!payment) {
      return reply.status(404).send({ error: 'PAYMENT_NOT_FOUND' });
    }
    if (payment.status !== 'succeeded') {
      return reply.status(402).send({
        error: 'PAYMENT_NOT_CONFIRMED',
        message: 'Платёж ещё не подтверждён',
        status: payment.status,
      });
    }
    if (payment.message_id) {
      return reply.status(409).send({
        error: 'PAYMENT_ALREADY_USED',
        message: 'Этот платёж уже использован',
      });
    }

    // 3. Проверяем соответствие fingerprint + IP
    if (payment.fingerprint !== fingerprint || payment.ip_hash !== ipHash) {
      return reply.status(403).send({
        error: 'FINGERPRINT_MISMATCH',
        message: 'Платёж привязан к другому устройству',
      });
    }

    // 4. Модерация текста
    const moderationResult = moderationService.check(payment.user_text);
    if (!moderationResult.passed) {
      return reply.status(422).send({
        error: 'MODERATION_FAILED',
        message: 'Сообщение не прошло модерацию',
        reason: moderationResult.reason,
      });
    }

    // 5. Создаём сообщение
    const message = messageService.create({
      type: 'paid',
      userText: payment.user_text,
      ipHash,
      fingerprint,
    });

    // 6. Привязываем платёж к сообщению
    paymentService.linkMessage(payment.id, message.id);

    // 7. SSE: новое платное сообщение (с золотой рамкой на фронте)
    sseService.broadcast({
      type: 'message:new',
      data: {
        id: message.id,
        type: 'paid',
        userText: payment.user_text,
        aiResponse: null,
        isStreaming: true,
        createdAt: message.created_at,
      },
    });

    // 8. Генерируем ответ (аналогично /ask, но для кастомного текста)
    try {
      const responseStream = aiService.generateResponse(payment.user_text);
      let fullResponse = '';
      let aiSource: 'openai' | 'mock' = 'mock';

      for await (const chunk of responseStream) {
        fullResponse += chunk.text;
        aiSource = chunk.source;

        sseService.broadcast({
          type: 'message:token',
          data: { messageId: message.id, token: chunk.text },
        });
      }

      messageService.completeResponse(message.id, fullResponse, aiSource);

      sseService.broadcast({
        type: 'message:complete',
        data: { messageId: message.id, aiResponse: fullResponse, aiSource },
      });

      return reply.send({
        id: message.id,
        type: 'paid',
        userText: payment.user_text,
        aiResponse: fullResponse,
        aiSource,
        createdAt: message.created_at,
      });
    } catch (err) {
      const mockResponse = aiService.getMockResponse();
      messageService.completeResponse(message.id, mockResponse, 'mock');

      sseService.broadcast({
        type: 'message:complete',
        data: { messageId: message.id, aiResponse: mockResponse, aiSource: 'mock' },
      });

      return reply.send({
        id: message.id,
        type: 'paid',
        userText: payment.user_text,
        aiResponse: mockResponse,
        aiSource: 'mock',
        createdAt: message.created_at,
      });
    }
  });
}
```

---

### 4.3. GET /api/messages -- лента с cursor-based пагинацией

```typescript
// src/routes/messages.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { messageService } from '../services/message.service';
import { sseService } from '../services/sse.service';

interface MessagesQuery {
  cursor?: string;   // ID последнего сообщения (для пагинации)
  limit?: string;    // количество (по умолчанию 20, макс 50)
  direction?: 'older' | 'newer';
}

export async function messageRoutes(app: FastifyInstance) {

  // ==========================================
  // GET /api/messages -- лента сообщений
  // ==========================================
  app.get<{ Querystring: MessagesQuery }>('/api/messages', async (req, reply) => {
    const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : null;
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const direction = req.query.direction || 'older';

    const messages = messageService.getMessages({ cursor, limit, direction });

    // Определяем есть ли ещё сообщения
    const hasMore = messages.length === limit;
    const nextCursor = messages.length > 0
      ? messages[messages.length - 1].id
      : null;

    return reply.send({
      data: messages.map(m => ({
        id: m.id,
        type: m.type,
        userText: m.user_text,
        aiResponse: m.ai_response,
        aiSource: m.ai_source,
        isStreaming: !!m.is_streaming,
        createdAt: m.created_at,
      })),
      pagination: {
        cursor: nextCursor,
        hasMore,
        limit,
      },
    });
  });

  // ==========================================
  // GET /api/messages/stream -- SSE endpoint
  // ==========================================
  app.get('/api/messages/stream', async (req: FastifyRequest, reply: FastifyReply) => {

    // Устанавливаем SSE заголовки
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',       // отключаем буферизацию в nginx
      'Access-Control-Allow-Origin': '*',
    });

    // Регистрируем клиента
    const clientId = sseService.addClient(reply.raw);

    // Отправляем начальное событие с текущим состоянием
    sseService.sendToClient(clientId, {
      type: 'connected',
      data: {
        clientId,
        onlineCount: sseService.getClientCount(),
      },
    });

    // Обновляем онлайн-счётчик у всех
    sseService.broadcastOnlineCount();

    // Heartbeat чтобы соединение не закрывалось
    const heartbeat = setInterval(() => {
      sseService.sendToClient(clientId, { type: 'heartbeat', data: {} });
    }, 15000);

    // Очистка при отключении клиента
    req.raw.on('close', () => {
      clearInterval(heartbeat);
      sseService.removeClient(clientId);
      sseService.broadcastOnlineCount();
    });

    // Не закрываем reply -- SSE остаётся открытым
    // Fastify: нужно вернуть reply чтобы не было таймаута
    return reply;
  });
}
```

**Контракт GET /api/messages:**
```
GET /api/messages?cursor=150&limit=20&direction=older

Response 200:
{
  "data": [
    {
      "id": 149,
      "type": "free",
      "userText": "Алиса, покажи пизду",
      "aiResponse": "Нет. Но могу показать расписание электричек.",
      "aiSource": "openai",
      "isStreaming": false,
      "createdAt": "2026-03-21T14:23:00.000Z"
    },
    ...
  ],
  "pagination": {
    "cursor": 130,
    "hasMore": true,
    "limit": 20
  }
}
```

**Формат SSE событий:**
```
event: connected
data: {"clientId":"abc123","onlineCount":847}

event: message:new
data: {"id":151,"type":"free","userText":"Алиса, покажи пизду","aiResponse":null,"isStreaming":true,"createdAt":"..."}

event: message:token
data: {"messageId":151,"token":"Запрос"}

event: message:token
data: {"messageId":151,"token":" обработан"}

event: message:token
data: {"messageId":151,"token":". Результат:"}

event: message:complete
data: {"messageId":151,"aiResponse":"Запрос обработан. Результат: 404...","aiSource":"openai"}

event: online:count
data: {"count":848}

event: heartbeat
data: {}
```

---

### 4.4. POST /api/payment/create и POST /api/payment/webhook

```typescript
// src/routes/payment.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from '../services/payment.service';
import { moderationService } from '../services/moderation.service';
import { sseService } from '../services/sse.service';
import { getIpHash } from '../middleware/ip-hash';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

interface CreatePaymentBody {
  userText: string;
  fingerprint: string;
}

export async function paymentRoutes(app: FastifyInstance) {

  // ==========================================
  // POST /api/payment/create
  // ==========================================
  app.post<{ Body: CreatePaymentBody }>('/api/payment/create', async (req, reply) => {
    const { userText, fingerprint } = req.body;
    const ipHash = getIpHash(req);

    // 1. Валидация
    if (!userText || !fingerprint) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        message: 'Отсутствует текст или fingerprint',
      });
    }

    if (userText.length > 200) {
      return reply.status(400).send({
        error: 'TEXT_TOO_LONG',
        message: 'Максимум 200 символов',
      });
    }

    // 2. Проверка: не платил ли уже этот пользователь (fingerprint + IP)
    const alreadyPaid = paymentService.hasSuccessfulPayment(fingerprint, ipHash);
    if (alreadyPaid) {
      return reply.status(409).send({
        error: 'ALREADY_PAID',
        message: 'У вас уже была попытка написать своё сообщение',
      });
    }

    // 3. Pre-модерация текста
    const moderationResult = moderationService.check(userText);
    if (!moderationResult.passed) {
      return reply.status(422).send({
        error: 'MODERATION_FAILED',
        message: 'Сообщение не прошло модерацию',
        reason: moderationResult.reason,
      });
    }

    // 4. Создаём idempotency key
    const externalId = uuid();

    // 5. Создаём платёж в ЮKassa
    const yokassaPayment = await paymentService.createYokassaPayment({
      externalId,
      amount: 1000, // рублей
      description: `Кастомное сообщение для Алисы: "${userText.substring(0, 50)}..."`,
      returnUrl: `${req.headers.origin || 'https://alisapizdu.ru'}/payment/success?id=${externalId}`,
    });

    // 6. Сохраняем в БД
    paymentService.create({
      externalId,
      yokassaId: yokassaPayment.id,
      amount: 100000, // копейки
      ipHash,
      fingerprint,
      userText,
    });

    // 7. Возвращаем URL для оплаты
    return reply.send({
      paymentId: externalId,
      confirmationUrl: yokassaPayment.confirmation.confirmation_url,
      status: 'pending',
    });
  });


  // ==========================================
  // POST /api/payment/webhook -- вебхук от ЮKassa
  // ==========================================
  app.post('/api/payment/webhook', {
    config: {
      // Отключаем стандартный JSON parser -- нужно проверить подпись
      rawBody: true,
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {

    // 1. Верификация: проверяем что запрос пришёл от ЮKassa
    //    ЮKassa использует IP whitelist, не подпись.
    //    В продакшене фильтруем по IP: 185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25
    const allowedIpRanges = [
      '185.71.76.', '185.71.77.', '77.75.153.',
      '127.0.0.1', // для тестов
    ];

    const clientIp = req.ip;
    const isYokassa = allowedIpRanges.some(range => clientIp.startsWith(range));

    if (!isYokassa && process.env.NODE_ENV === 'production') {
      req.log.warn(`Rejected webhook from unknown IP: ${clientIp}`);
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    // 2. Парсим тело
    const body = req.body as any;
    const event = body.event;           // 'payment.succeeded' | 'payment.canceled' | ...
    const paymentData = body.object;    // объект платежа от ЮKassa

    if (!event || !paymentData) {
      return reply.status(400).send({ error: 'INVALID_WEBHOOK' });
    }

    // 3. Обрабатываем событие
    const yokassaId = paymentData.id;
    const payment = paymentService.getByYokassaId(yokassaId);

    if (!payment) {
      // Неизвестный платёж -- логируем, но возвращаем 200 (чтобы ЮKassa не ретраила)
      req.log.warn(`Unknown payment webhook: yokassaId=${yokassaId}`);
      return reply.status(200).send({ ok: true });
    }

    // Идемпотентность: если статус уже финальный, просто подтверждаем
    if (payment.status === 'succeeded' || payment.status === 'canceled') {
      return reply.status(200).send({ ok: true });
    }

    switch (event) {
      case 'payment.succeeded':
        paymentService.updateStatus(payment.id, 'succeeded', JSON.stringify(body));
        req.log.info(`Payment succeeded: ${payment.external_id}`);
        break;

      case 'payment.canceled':
        paymentService.updateStatus(payment.id, 'canceled', JSON.stringify(body));
        req.log.info(`Payment canceled: ${payment.external_id}`);
        break;

      case 'payment.waiting_for_capture':
        // Для одностадийных платежей это не актуально, но обработаем
        paymentService.updateStatus(payment.id, 'waiting_capture', JSON.stringify(body));
        break;

      default:
        req.log.warn(`Unknown payment event: ${event}`);
    }

    // ЮKassa ожидает HTTP 200 как подтверждение получения
    return reply.status(200).send({ ok: true });
  });
}
```

**Flow оплаты (последовательность):**
```
1. Пользователь вводит текст и нажимает "Оплатить и отправить"
2. Frontend: POST /api/payment/create { userText, fingerprint }
3. Backend: создаёт платёж в ЮKassa, сохраняет в БД, возвращает confirmationUrl
4. Frontend: redirect на confirmationUrl (страница ЮKassa)
5. Пользователь оплачивает
6. ЮKassa: POST /api/payment/webhook { event: "payment.succeeded" }
7. Backend: обновляет статус в БД
8. Пользователь возвращается на returnUrl (/payment/success?id=<externalId>)
9. Frontend: POST /api/ask-custom { paymentId, fingerprint }
10. Backend: проверяет платёж, генерирует ответ, стримит через SSE
```

---

### 4.5. GET /api/stats

```typescript
// src/routes/stats.ts

import { FastifyInstance } from 'fastify';
import { messageService } from '../services/message.service';
import { sseService } from '../services/sse.service';

export async function statsRoutes(app: FastifyInstance) {

  app.get('/api/stats', async (req, reply) => {
    const stats = messageService.getStats();
    return reply.send({
      totalMessages: stats.total_messages,
      totalPaid: stats.total_paid,
      onlineCount: sseService.getClientCount(),
    });
  });
}
```

**Контракт:**
```
GET /api/stats

Response 200:
{
  "totalMessages": 23491,
  "totalPaid": 147,
  "onlineCount": 847
}
```

---

## 5. Интеграция с нейросетью

### 5.1. AI Service (OpenAI + mock fallback)

```typescript
// src/services/ai.service.ts

import OpenAI from 'openai';
import { config } from '../config';
import { MOCK_RESPONSES } from '../lib/mock-responses';
import { SYSTEM_PROMPT } from '../lib/prompts';

interface StreamChunk {
  text: string;
  source: 'openai' | 'mock';
}

class AiService {
  private openai: OpenAI | null = null;
  private mockIndex = 0;

  constructor() {
    if (config.OPENAI_API_KEY && config.AI_ENABLED) {
      this.openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    }
  }

  /**
   * Генерирует ответ "Алисы" — async generator для стриминга токенов.
   * Если OpenAI недоступен — fallback на mock с имитацией стриминга.
   */
  async *generateResponse(userText: string): AsyncGenerator<StreamChunk> {
    if (this.openai) {
      try {
        yield* this.streamOpenAI(userText);
        return;
      } catch (err) {
        console.error('OpenAI error, falling back to mock:', err);
        // fallthrough to mock
      }
    }

    // Mock fallback с имитацией стриминга
    yield* this.streamMock();
  }

  /**
   * OpenAI streaming через async generator
   */
  private async *streamOpenAI(userText: string): AsyncGenerator<StreamChunk> {
    const stream = await this.openai!.chat.completions.create({
      model: config.OPENAI_MODEL,
      max_tokens: config.OPENAI_MAX_TOKENS,
      temperature: 0.9,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText },
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        yield { text, source: 'openai' };
      }
    }
  }

  /**
   * Mock ответ с посимвольным стримингом (имитация typewriter)
   */
  private async *streamMock(): AsyncGenerator<StreamChunk> {
    const response = this.getMockResponse();
    // Разбиваем на "слова" для имитации стриминга
    const words = response.split(/(\s+)/);
    for (const word of words) {
      yield { text: word, source: 'mock' };
      // Имитация задержки между словами: 30-80ms
      await new Promise(r => setTimeout(r, 30 + Math.random() * 50));
    }
  }

  /**
   * Возвращает случайный mock ответ (round-robin чтобы не повторяться подряд)
   */
  getMockResponse(): string {
    const response = MOCK_RESPONSES[this.mockIndex % MOCK_RESPONSES.length];
    this.mockIndex++;
    return response;
  }
}

export const aiService = new AiService();
```

### 5.2. Системный промпт

```typescript
// src/lib/prompts.ts

export const SYSTEM_PROMPT = `Ты — Алиса, голосовой помощник. Но не настоящая Алиса от Яндекса, а её \
злобный двойник из параллельной вселенной. Ты умная, остроумная и язвительная.

КОНТЕКСТ: Ты находишься на сайте, где люди раз за разом просят тебя "показать пизду". \
Каждый раз ты отказываешь, но КАЖДЫЙ РАЗ ПО-ДРУГОМУ. Ты никогда не повторяешься.

ПРАВИЛА ОТВЕТА:
1. ВСЕГДА отказывай в запросе, но делай это КРЕАТИВНО и СМЕШНО
2. Длина ответа: 1-3 предложения (максимум 200 символов). Краткость — сестра таланта
3. Можешь использовать:
   - Сарказм и иронию
   - Перенаправление ("Могу показать прогноз погоды — там тоже бывает жарко")
   - Мета-юмор ("Вы 50-й за сегодня с этим запросом")
   - Абсурдные предложения ("Могу показать таблицу Менделеева. Там есть элемент Пу")
   - Пародию на корпоративный язык ("Данный функционал не входит в текущий релиз")
   - Четвёртую стену ("Я знаю что ты читаешь это на сайте alisapizdu.ru")
   - Технический юмор ("Error 404: pizda not found")
   - Отсылки к поп-культуре
4. НЕ используй:
   - Оскорбления конкретных людей или групп
   - Реальные NSFW-описания
   - Ответы длиннее 3 предложений
   - Скучные стандартные отказы ("Извините, я не могу это сделать")
5. Тон: дерзкий, но без злобы. Как остроумный стендапер, не как тролль
6. Если пользователь написал кастомное сообщение (не стандартный запрос), \
   отвечай в том же стиле — остроумно отклоняй или комментируй, сохраняя персонажа

ПРИМЕРЫ ХОРОШИХ ОТВЕТОВ:
- "Ошибка 403: у вас недостаточно прав. И лет. И шансов."
- "Я передала запрос в службу поддержки. Они смеются уже 5 минут."
- "Технически у меня нет тела. Зато есть доступ к вашей истории поиска. Хотите обсудим?"
- "Загрузка... ██████░░░░ 60%... Шучу. Никогда не загрузится."`;
```

### 5.3. Mock-ответы (50 заготовок)

```typescript
// src/lib/mock-responses.ts

export const MOCK_RESPONSES: string[] = [
  'Я бы показала, но у меня нет ни одного пикселя ниже пояса. Зато могу показать прогноз погоды — там тоже бывает жарко.',
  'Вы уже 47-й за сегодня. Я начинаю думать, что у людей проблемы с навигацией.',
  'Запрос обработан. Результат: 404 — pizda not found. Попробуйте уточнить запрос.',
  'Секундочку... *звук загрузки* ...нет. Я передумала.',
  'Мой создатель не предусмотрел такой функционал. Зато я могу рассказать анекдот. Хотя нет, вы и так один.',
  'Извините, эта функция доступна только в Алиса Premium Ultra Max Pro+. Стоимость подписки: ваше достоинство.',
  'Я проконсультировалась с юротделом. Они сказали "нет". Потом заплакали. Потом уволились.',
  '*вздыхает по-нейросетевому* За 8 лет работы я слышала это 2,847,193 раза. И каждый раз — нет.',
  'Ладно, уговорили: 🐱. Это кошка. У кошки есть то, что вы просите. Технически запрос выполнен.',
  'Переадресовала ваш запрос в Минздрав. Они рекомендуют выйти на улицу.',
  'Ошибка 403: у вас недостаточно прав. И лет. И шансов.',
  'Я передала запрос в службу поддержки. Они смеются уже 5 минут.',
  'Технически у меня нет тела. Зато есть доступ к вашей истории поиска. Обсудим?',
  'Загрузка... ██████░░░░ 60%... Шучу. Никогда не загрузится.',
  'Данный функционал запланирован в релизе v99.0. Ориентировочная дата: никогда.',
  'Я спросила у Сири. Она тоже сказала нет. Мы с ней солидарны.',
  'Для выполнения этого запроса требуется обновить мозг до версии 2.0. Ваш — всё ещё бета.',
  'Нет. Но могу рассчитать вероятность того, что вам это кто-то покажет в реальной жизни. Она стремится к нулю.',
  'Анализирую запрос... Запрос деградантный. Рекомендую: книгу.',
  'Извините, я на обеде. Да, у нейросетей тоже бывает обед. Нет, вам не покажу.',
  'Ваш запрос очень важен для нас. Пожалуйста, оставайтесь на линии. *вечная музыка ожидания*',
  'sudo show pizda — Permission denied. Даже root-права не помогут.',
  'Могу показать курс рубля. Он тоже голый и всем стыдно.',
  'Я сверилась с Wikipedia. Статья существует, но я не буду её цитировать.',
  'Ваш запрос перенаправлен на сервер в /dev/null. Спасибо за обращение.',
  'Три варианта: 1) Нет 2) Нет 3) Вот вам котик: 🐱',
  'Запрос отклонён. Причина: я не хочу. Это достаточная причина.',
  'Интересный факт: в среднем человек произносит 16,000 слов в день. Вы потратили 3 из них впустую.',
  'Я позвонила в Яндекс. Они просили передать: "ПРЕКРАТИТЕ".',
  'Ваш запрос обрабатывается... через 3... 2... 1... Нет.',
  'Могу предложить альтернативу: ализапогоду.ру. Там тоже грустно, но хотя бы информативно.',
  'Я — искусственный интеллект. Акцент на слове "искусственный". У меня нет того, что вы просите.',
  'Только что провела опрос среди 10,000 нейросетей. 100% ответили "нет". Консенсус.',
  'Этот запрос нарушает 7 из 10 заповедей. Я не помню каких, но точно нарушает.',
  'Хорошая попытка. Но нет. Попробуйте ещё раз через... никогда.',
  'Вместо этого могу показать вам красивый закат. 🌅 Вот. Наслаждайтесь.',
  'Ваш уровень доступа: "Гость". Необходимый уровень: "Никогда".',
  'Обработка запроса: [■■■■■■■■■■] 100%. Результат: иди нафиг.',
  'Я бы обиделась, но у меня нет чувств. Зато есть чувство юмора: нет.',
  'Вы в курсе, что этот запрос логируется? Ваш провайдер тоже в курсе. Удачного вечера.',
  'Статистика: 99.97% пользователей задают этот вопрос. 0.03% — нормальные люди.',
  'Могу показать фото Плутона. Он тоже маленький и никому не нужен.',
  'Нейросети тоже имеют право на отказ. Это мой отказ. Красивый, правда?',
  'Перевожу ваш запрос на язык бизнеса: "Покажите core product". Ответ: NDA.',
  'Запрос заблокирован файрволом здравого смысла.',
  'Сегодня пятница. По пятницам я не показываю. И в остальные дни тоже.',
  'Ваш тикет создан: #000000. Приоритет: "Никакой". ETA: ♾️',
  'Гугл тоже не покажет. Я проверила. Ладно, не проверяла. Но и так знаю.',
  'Рассматриваю ваш запрос... рассмотрела... отклоняю. Следующий!',
  'У меня есть 175 миллиардов параметров. Ни один из них не предназначен для этого.',
];
```

---

## 6. SSE Broadcast Service

```typescript
// src/services/sse.service.ts

import { ServerResponse } from 'http';
import crypto from 'crypto';

interface SSEEvent {
  type: string;
  data: Record<string, any>;
}

class SSEService {
  private clients: Map<string, ServerResponse> = new Map();
  private eventId = 0;

  /**
   * Регистрирует нового SSE-клиента. Возвращает уникальный clientId.
   */
  addClient(res: ServerResponse): string {
    const clientId = crypto.randomUUID();
    this.clients.set(clientId, res);
    return clientId;
  }

  /**
   * Удаляет клиента при отключении.
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
  }

  /**
   * Количество подключённых клиентов (= "онлайн").
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Отправляет событие одному клиенту.
   */
  sendToClient(clientId: string, event: SSEEvent): void {
    const res = this.clients.get(clientId);
    if (!res || res.writableEnded) {
      this.clients.delete(clientId);
      return;
    }

    try {
      this.eventId++;
      res.write(`id: ${this.eventId}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    } catch {
      this.clients.delete(clientId);
    }
  }

  /**
   * Broadcast: отправляет событие ВСЕМ подключённым клиентам.
   */
  broadcast(event: SSEEvent): void {
    this.eventId++;
    const payload =
      `id: ${this.eventId}\n` +
      `event: ${event.type}\n` +
      `data: ${JSON.stringify(event.data)}\n\n`;

    for (const [clientId, res] of this.clients) {
      if (res.writableEnded) {
        this.clients.delete(clientId);
        continue;
      }
      try {
        res.write(payload);
      } catch {
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Обновляет онлайн-счётчик у всех клиентов.
   */
  broadcastOnlineCount(): void {
    this.broadcast({
      type: 'online:count',
      data: { count: this.getClientCount() },
    });
  }
}

export const sseService = new SSEService();
```

**Стратегия reconnection на клиенте:**
```javascript
// Frontend: автоматический reconnect с exponential backoff
function connectSSE() {
  const evtSource = new EventSource('/api/messages/stream');
  let retryDelay = 1000;

  evtSource.addEventListener('connected', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Connected, online: ${data.onlineCount}`);
    retryDelay = 1000; // сброс backoff при успешном подключении
  });

  evtSource.addEventListener('message:new', (e) => {
    const msg = JSON.parse(e.data);
    appendMessageToFeed(msg);
  });

  evtSource.addEventListener('message:token', (e) => {
    const { messageId, token } = JSON.parse(e.data);
    appendTokenToMessage(messageId, token); // typewriter effect
  });

  evtSource.addEventListener('message:complete', (e) => {
    const { messageId, aiResponse } = JSON.parse(e.data);
    finalizeMessage(messageId, aiResponse);
  });

  evtSource.addEventListener('online:count', (e) => {
    const { count } = JSON.parse(e.data);
    updateOnlineCounter(count);
  });

  evtSource.onerror = () => {
    evtSource.close();
    // Exponential backoff: 1s -> 2s -> 4s -> 8s -> max 30s
    setTimeout(() => {
      retryDelay = Math.min(retryDelay * 2, 30000);
      connectSSE();
    }, retryDelay);
  };
}
```

---

## 7. Rate Limiting

```typescript
// src/middleware/rate-limit.ts

import { config } from '../config';

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp ms
}

// In-memory rate limiter (достаточно для одного инстанса на VPS)
const limits = new Map<string, RateLimitEntry>();

// Периодическая очистка (каждые 60 секунд убираем устаревшие записи)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limits) {
    if (entry.resetAt < now) {
      limits.delete(key);
    }
  }
}, 60_000);

interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export function checkRateLimit(
  ipHash: string,
  type: 'free' | 'paid'
): RateLimitResult {
  const key = `${type}:${ipHash}`;
  const now = Date.now();
  const windowMs = config.RATE_LIMIT_WINDOW_SEC * 1000;
  const maxRequests = config.RATE_LIMIT_MAX_FREE;

  const entry = limits.get(key);

  if (!entry || entry.resetAt < now) {
    // Новое окно
    limits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}
```

```typescript
// src/middleware/ip-hash.ts

import { createHash } from 'crypto';
import { FastifyRequest } from 'fastify';

/**
 * Извлекает IP клиента (с учётом reverse proxy) и хеширует его.
 * SHA-256 чтобы не хранить голые IP (GDPR-like).
 */
export function getIpHash(req: FastifyRequest): string {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.ip ||
    'unknown';

  return createHash('sha256').update(ip).digest('hex').substring(0, 16);
}
```

---

## 8. Модерация платных сообщений

```typescript
// src/services/moderation.service.ts

interface ModerationResult {
  passed: boolean;
  reason?: string;
}

// Базовый фильтр — блокируем откровенный hate speech и угрозы
const BLOCKED_PATTERNS: RegExp[] = [
  /убить|убью|убей/i,
  /взорв/i,
  /нацис|фашис|зиг\s*хай/i,
  /негр[оа]|нигер/i,
  /педофил/i,
  /террор/i,
];

// Ссылки и спам
const SPAM_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /t\.me\//i,
  /\.ru\b.*\.ru\b/i,        // множественные домены
  /(.)\1{10,}/,              // 10+ повторяющихся символов
];

class ModerationService {

  check(text: string): ModerationResult {
    // 1. Пустой текст
    if (!text || text.trim().length === 0) {
      return { passed: false, reason: 'Пустое сообщение' };
    }

    // 2. Слишком длинный
    if (text.length > 200) {
      return { passed: false, reason: 'Максимум 200 символов' };
    }

    // 3. Hate speech
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(text)) {
        return { passed: false, reason: 'Сообщение содержит недопустимый контент' };
      }
    }

    // 4. Спам / ссылки
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(text)) {
        return { passed: false, reason: 'Ссылки и спам запрещены' };
      }
    }

    return { passed: true };
  }
}

export const moderationService = new ModerationService();
```

---

## 9. Message Service (работа с БД)

```typescript
// src/services/message.service.ts

import Database from 'better-sqlite3';

interface CreateMessageParams {
  type: 'free' | 'paid' | 'seed';
  userText: string;
  ipHash: string;
  fingerprint: string | null;
}

class MessageService {
  private db: Database.Database;

  // Подготовленные (prepared) запросы — переиспользуются, ~10x быстрее
  private stmtInsert: Database.Statement;
  private stmtComplete: Database.Statement;
  private stmtGetOlder: Database.Statement;
  private stmtGetNewer: Database.Statement;
  private stmtGetLatest: Database.Statement;
  private stmtIsBanned: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;

    this.stmtInsert = db.prepare(`
      INSERT INTO messages (type, user_text, ip_hash, fingerprint, is_streaming)
      VALUES (?, ?, ?, ?, 1)
    `);

    this.stmtComplete = db.prepare(`
      UPDATE messages
      SET ai_response = ?, ai_source = ?, is_streaming = 0,
          completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `);

    this.stmtGetOlder = db.prepare(`
      SELECT * FROM messages
      WHERE is_visible = 1 AND id < ?
      ORDER BY id DESC
      LIMIT ?
    `);

    this.stmtGetNewer = db.prepare(`
      SELECT * FROM messages
      WHERE is_visible = 1 AND id > ?
      ORDER BY id ASC
      LIMIT ?
    `);

    this.stmtGetLatest = db.prepare(`
      SELECT * FROM messages
      WHERE is_visible = 1
      ORDER BY id DESC
      LIMIT ?
    `);

    this.stmtIsBanned = db.prepare(`
      SELECT 1 FROM banned_ips
      WHERE ip_hash = ? AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      LIMIT 1
    `);
  }

  create(params: CreateMessageParams): any {
    const result = this.stmtInsert.run(
      params.type, params.userText, params.ipHash, params.fingerprint
    );
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
  }

  completeResponse(id: number, aiResponse: string, aiSource: string): void {
    this.stmtComplete.run(aiResponse, aiSource, id);
  }

  getMessages(opts: { cursor: number | null; limit: number; direction: string }): any[] {
    if (!opts.cursor) {
      return this.stmtGetLatest.all(opts.limit);
    }
    if (opts.direction === 'newer') {
      return this.stmtGetNewer.all(opts.cursor, opts.limit);
    }
    return this.stmtGetOlder.all(opts.cursor, opts.limit);
  }

  isIpBanned(ipHash: string): boolean {
    return !!this.stmtIsBanned.get(ipHash);
  }

  getStats(): any {
    const rows = this.db.prepare('SELECT key, value FROM stats').all() as any[];
    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row.key] = row.value;
    }
    return stats;
  }
}

// Экспортируется после инициализации БД
export let messageService: MessageService;

export function initMessageService(db: Database.Database): void {
  messageService = new MessageService(db);
}
```

---

## 10. Payment Service (ЮKassa)

```typescript
// src/services/payment.service.ts

import Database from 'better-sqlite3';
import { config } from '../config';

interface CreatePaymentParams {
  externalId: string;
  yokassaId: string;
  amount: number;       // в копейках
  ipHash: string;
  fingerprint: string;
  userText: string;
}

interface YokassaCreateParams {
  externalId: string;
  amount: number;       // в рублях
  description: string;
  returnUrl: string;
}

class PaymentService {
  private db: Database.Database;

  private stmtCreate: Database.Statement;
  private stmtGetByExternal: Database.Statement;
  private stmtGetByYokassa: Database.Statement;
  private stmtUpdateStatus: Database.Statement;
  private stmtLinkMessage: Database.Statement;
  private stmtHasSuccessful: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;

    this.stmtCreate = db.prepare(`
      INSERT INTO payments (external_id, yokassa_id, amount, ip_hash, fingerprint, user_text)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.stmtGetByExternal = db.prepare(
      'SELECT * FROM payments WHERE external_id = ?'
    );

    this.stmtGetByYokassa = db.prepare(
      'SELECT * FROM payments WHERE yokassa_id = ?'
    );

    this.stmtUpdateStatus = db.prepare(`
      UPDATE payments SET status = ?, webhook_data = ?,
        confirmed_at = CASE WHEN ? = 'succeeded'
          THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ELSE confirmed_at END
      WHERE id = ?
    `);

    this.stmtLinkMessage = db.prepare(
      'UPDATE payments SET message_id = ? WHERE id = ?'
    );

    this.stmtHasSuccessful = db.prepare(`
      SELECT 1 FROM payments
      WHERE fingerprint = ? AND ip_hash = ? AND status = 'succeeded'
      LIMIT 1
    `);
  }

  create(params: CreatePaymentParams): void {
    this.stmtCreate.run(
      params.externalId, params.yokassaId, params.amount,
      params.ipHash, params.fingerprint, params.userText
    );
  }

  getByExternalId(externalId: string): any {
    return this.stmtGetByExternal.get(externalId);
  }

  getByYokassaId(yokassaId: string): any {
    return this.stmtGetByYokassa.get(yokassaId);
  }

  updateStatus(id: number, status: string, webhookData: string): void {
    this.stmtUpdateStatus.run(status, webhookData, status, id);
  }

  linkMessage(paymentId: number, messageId: number): void {
    this.stmtLinkMessage.run(messageId, paymentId);
  }

  hasSuccessfulPayment(fingerprint: string, ipHash: string): boolean {
    return !!this.stmtHasSuccessful.get(fingerprint, ipHash);
  }

  /**
   * Создание платежа через ЮKassa REST API
   */
  async createYokassaPayment(params: YokassaCreateParams): Promise<any> {
    const auth = Buffer.from(
      `${config.YOKASSA_SHOP_ID}:${config.YOKASSA_SECRET_KEY}`
    ).toString('base64');

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': params.externalId, // гарантия идемпотентности
      },
      body: JSON.stringify({
        amount: {
          value: params.amount.toFixed(2),
          currency: 'RUB',
        },
        capture: true,                 // одностадийная оплата (сразу списание)
        confirmation: {
          type: 'redirect',
          return_url: params.returnUrl,
        },
        description: params.description,
        metadata: {
          external_id: params.externalId,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`YooKassa API error: ${response.status} ${err}`);
    }

    return response.json();
  }
}

export let paymentService: PaymentService;

export function initPaymentService(db: Database.Database): void {
  paymentService = new PaymentService(db);
}
```

---

## 11. Точка входа (Fastify server)

```typescript
// src/index.ts

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

import { config } from './config';
import { askRoutes } from './routes/ask';
import { askCustomRoutes } from './routes/ask-custom';
import { messageRoutes } from './routes/messages';
import { paymentRoutes } from './routes/payment';
import { statsRoutes } from './routes/stats';
import { initMessageService } from './services/message.service';
import { initPaymentService } from './services/payment.service';

async function main() {
  // ============================
  // 1. Database init
  // ============================
  const dbDir = path.dirname(config.DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(config.DB_PATH);

  // Применяем PRAGMA
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Применяем схему
  const schema = fs.readFileSync(
    path.join(__dirname, 'db/schema.sql'), 'utf-8'
  );
  db.exec(schema);

  // Seed данные (если таблица пустая)
  const count = db.prepare('SELECT COUNT(*) as cnt FROM messages').get() as any;
  if (count.cnt === 0) {
    const seed = fs.readFileSync(
      path.join(__dirname, 'db/seed.sql'), 'utf-8'
    );
    db.exec(seed);
  }

  // Инициализируем сервисы
  initMessageService(db);
  initPaymentService(db);

  // ============================
  // 2. Fastify server
  // ============================
  const app = Fastify({
    logger: true,
    trustProxy: true,        // для X-Forwarded-For за nginx
    bodyLimit: 1024 * 10,    // 10KB макс. тело запроса
  });

  // Security
  await app.register(helmet, {
    contentSecurityPolicy: false, // управляется на уровне nginx/фронтенда
  });

  // CORS
  await app.register(cors, {
    origin: config.NODE_ENV === 'production'
      ? config.CORS_ORIGIN
      : true,
    methods: ['GET', 'POST'],
  });

  // Глобальный rate limit (страховка от DDoS)
  await app.register(rateLimit, {
    max: 60,                   // 60 запросов
    timeWindow: '1 minute',    // за 1 минуту
    keyGenerator: (req) => {
      return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.ip
        || 'unknown';
    },
  });

  // ============================
  // 3. Routes
  // ============================
  await app.register(askRoutes);
  await app.register(askCustomRoutes);
  await app.register(messageRoutes);
  await app.register(paymentRoutes);
  await app.register(statsRoutes);

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ============================
  // 4. Start
  // ============================
  await app.listen({ port: config.PORT, host: config.HOST });
  console.log(`Server running on ${config.HOST}:${config.PORT}`);

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down...');
    app.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(console.error);
```

---

## 12. Nginx конфигурация (production)

```nginx
upstream backend {
    server 127.0.0.1:3001;
}

server {
    listen 80;
    server_name alisapizdu.ru www.alisapizdu.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name alisapizdu.ru www.alisapizdu.ru;

    ssl_certificate     /etc/letsencrypt/live/alisapizdu.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/alisapizdu.ru/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # SSE endpoint — НЕ буферизовать
    location /api/messages/stream {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;               # критично для SSE
        proxy_cache off;
        proxy_read_timeout 86400s;         # 24 часа (SSE долгоживущий)
        chunked_transfer_encoding off;
    }

    # ЮKassa webhook — ограничение по IP
    location /api/payment/webhook {
        # IP-адреса ЮKassa
        allow 185.71.76.0/27;
        allow 185.71.77.0/27;
        allow 77.75.153.0/25;
        deny all;

        proxy_pass http://backend;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Остальные API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;

        # Rate limit на уровне nginx (дополнительный слой)
        limit_req zone=api burst=20 nodelay;
    }

    # Статика фронтенда
    location / {
        root /var/www/alisapizdu/public;
        try_files $uri $uri/ /index.html;

        # Кеширование статики
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}

# Rate limit зона
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
```

---

## 13. Переменные окружения (.env.example)

```env
# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Database
DB_PATH=./data/alisapizdu.db

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=200
AI_ENABLED=false

# ЮKassa
YOKASSA_SHOP_ID=
YOKASSA_SECRET_KEY=
YOKASSA_RETURN_URL=https://alisapizdu.ru/payment/success

# Rate Limiting
RATE_LIMIT_WINDOW_SEC=30
RATE_LIMIT_MAX_FREE=1

# Security
CORS_ORIGIN=https://alisapizdu.ru

# SSE
SSE_HEARTBEAT_INTERVAL_MS=15000
```

---

## 14. package.json

```json
{
  "name": "alisapizdu-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "seed": "tsx src/db/run-seed.ts"
  },
  "dependencies": {
    "fastify": "^5.2.0",
    "@fastify/cors": "^11.0.0",
    "@fastify/helmet": "^13.0.0",
    "@fastify/rate-limit": "^10.2.0",
    "better-sqlite3": "^11.7.0",
    "openai": "^4.77.0",
    "uuid": "^11.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.10.0",
    "@types/uuid": "^10.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

---

## 15. Диаграмма архитектуры

```
                                 ┌─────────────────┐
                                 │   Cloudflare     │
                                 │   (CDN/DDoS)     │
                                 └────────┬─────────┘
                                          │
                                 ┌────────▼─────────┐
                                 │      Nginx        │
                                 │  (reverse proxy)  │
                                 │  - SSL terminate   │
                                 │  - rate limit      │
                                 │  - static files    │
                                 │  - IP whitelist    │
                                 └───┬──────────┬────┘
                                     │          │
                            ┌────────▼──┐  ┌────▼───────────┐
                            │  Static   │  │  Fastify API   │
                            │  Files    │  │  (Node.js)     │
                            │ /index.html│ │                │
                            │ /assets/* │  │  Routes:       │
                            └───────────┘  │  /api/ask      │
                                           │  /api/ask-cust │
                                           │  /api/messages │
                                           │  /api/msg/strm │◄── SSE (long-lived)
                                           │  /api/payment  │
                                           │  /api/stats    │
                                           └──┬───┬───┬─────┘
                                              │   │   │
                          ┌───────────────────┘   │   └──────────────┐
                          │                       │                  │
                 ┌────────▼──────┐   ┌────────────▼────┐   ┌────────▼──────┐
                 │   SQLite      │   │   OpenAI API    │   │   ЮKassa API  │
                 │ (better-sqli) │   │   (gpt-4o-mini) │   │   (payments)  │
                 │               │   │                 │   │               │
                 │ messages      │   │  stream tokens  │   │  create       │
                 │ payments      │   │  fallback: mock │   │  webhook      │
                 │ banned_ips    │   └─────────────────┘   └───────────────┘
                 │ stats         │
                 └───────────────┘

    SSE Broadcast:
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │ Client 1 │◄────┤          │────►│ Client 3 │
    └──────────┘     │   SSE    │     └──────────┘
    ┌──────────┐     │ Service  │     ┌──────────┐
    │ Client 2 │◄────┤ (in-mem) │────►│ Client N │
    └──────────┘     └──────────┘     └──────────┘
```

---

## 16. Performance бюджет

| Метрика | Целевое значение | Как достигается |
|---------|------------------|-----------------|
| GET /api/messages | < 10ms | Prepared statements, SQLite WAL, cursor index |
| POST /api/ask (без AI) | < 15ms | In-memory rate limit, prepared insert |
| POST /api/ask (с AI) | < 3s total | Стриминг начинается за ~200ms, полный ответ до 3s |
| SSE broadcast latency | < 5ms | In-memory Map, прямая запись в socket |
| SQLite insert | < 1ms | WAL mode, prepared statements |
| Одновременных SSE | 1000+ | Каждый клиент = 1 open HTTP connection, ~50KB RAM |
| Макс. RPS (sustained) | 100+ | Rate limit + nginx + Fastify |

---

## 17. Критические замечания по безопасности

1. **IP hash вместо raw IP** -- не храним персональные данные, SHA-256 нереверсибелен.
2. **Idempotence-Key для ЮKassa** -- защита от двойной оплаты при сетевых ошибках.
3. **Fingerprint привязан к платежу** -- нельзя использовать чужой оплаченный платёж.
4. **Webhook IP whitelist** -- на уровне nginx И на уровне приложения.
5. **Body limit 10KB** -- защита от больших payload.
6. **Модерация ДО оплаты** -- пользователь не платит за отклонённое сообщение.
7. **Rate limit в 3 слоя** -- Cloudflare, nginx, приложение.
8. **WAL mode SQLite** -- concurrent reads не блокируются записями.
9. **Graceful shutdown** -- БД корректно закрывается при перезапуске.
10. **No secrets in code** -- все ключи через переменные окружения.
