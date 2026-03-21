# Алиса покажи пизду

Вирусная юмористическая платформа. Пользователи задают ИИ один и тот же провокационный вопрос, получают уникальные саркастические ответы. Все сообщения публичны и видны в реальном времени.

**Сайт:** [алисапокажипизду.рф](https://xn--80aaaqjgddaqi2bmfw7b.xn--p1ai)

---

## Архитектура

```
Browser ──HTTPS──> Nginx (reverse proxy)
                     ├── /         ──> Next.js 14 frontend  (port 3011)
                     ├── /api/*    ──> Express backend       (port 3010)
                     └── /i/*      ──> Next.js (invite page)
```

| Слой | Технологии |
|------|-----------|
| Backend | Node.js, Express 4.21, better-sqlite3 (WAL), Yandex Cloud AI |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS 3.4 |
| Real-time | Server-Sent Events (SSE), in-process Map |
| Email | Nodemailer + Yandex SMTP |
| Деплой | PM2, Nginx, Let's Encrypt SSL |

---

## Быстрый старт

### Локальная разработка

```bash
# Backend
cd backend
cp .env.example .env    # Заполнить credentials
npm install
npm run dev             # http://localhost:3000

# Frontend (отдельный терминал)
cd frontend
npm install
npm run dev             # http://localhost:3001
```

### Продакшн

```bash
cd backend && npm install --production
cd frontend && npm install && npx next build

# PM2
pm2 start backend/src/index.js --name alisapizdu-backend
pm2 start frontend/node_modules/.bin/next --name alisapizdu-frontend -- start
```

---

## Переменные окружения

### Backend (`backend/.env`)

| Переменная | Обязат. | По умолчанию | Описание |
|-----------|---------|-------------|----------|
| `PORT` | Нет | 3000 | Порт HTTP-сервера |
| `CORS_ORIGIN` | Нет | * | Разрешённые origins |
| `NODE_ENV` | Нет | development | Окружение |
| `YANDEX_FOLDER_ID` | Да (прод) | — | Yandex Cloud folder ID |
| `YANDEX_API_KEY` | Да (прод) | — | Yandex Cloud API key |
| `SMTP_HOST` | Нет | — | SMTP сервер |
| `SMTP_PORT` | Нет | 465 | SMTP порт (465=SSL) |
| `SMTP_USER` | Нет | — | SMTP логин |
| `SMTP_PASS` | Нет | — | SMTP пароль |
| `SMTP_FROM` | Нет | SMTP_USER | Адрес отправителя |

Без Yandex credentials — работает в mock-режиме (заготовленные ответы).
Без SMTP — email-уведомления отключены.

### Frontend (`frontend/.env.local`)

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | http://localhost:3000 | URL бэкенда для proxy |

---

## API

### Основные эндпоинты

| Метод | Путь | Описание | Rate limit |
|-------|------|----------|-----------|
| POST | `/api/ask` | Бесплатный вопрос Алисе | 1 / 24ч на IP (БД) |
| POST | `/api/ask-custom` | Платный произвольный вопрос | Нет |
| GET | `/api/messages` | Список сообщений (cursor pagination) | Нет |
| GET | `/api/messages/stream` | SSE поток событий | Нет |
| GET | `/api/stats` | Статистика (total, online, vip) | Нет |
| POST | `/api/vote/:id` | Голосование (1 / -1) | 1 голос на IP |
| PATCH | `/api/name/:id` | Изменение имени (только автор) | Проверка IP |
| GET | `/api/image/:id` | JPEG-картинка ответа | Нет |

### Invite-ссылки

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/invite` | Создать ссылку-приглашение |
| GET | `/api/invite/:code` | Информация о ссылке |
| POST | `/api/invite/:code/use` | Использовать ссылку |

#### POST /api/invite

```json
// Request
{ "preset_name": "Вася", "allow_rename": false, "notify_email": "user@mail.ru" }

// Response 200
{ "code": "xK9mQ2", "url": "/i/xK9mQ2", "preset_name": "Вася", "allow_rename": false }
```

Лимит: 10 ссылок на IP. Email опционален.

#### GET /api/invite/:code

```json
// Response 200
{ "code": "xK9mQ2", "preset_name": "Вася", "allow_rename": false, "used": false, "created_by_user_id": 1000021 }
```

#### POST /api/invite/:code/use

```json
// Request
{ "name": "Василий Петрович", "timezone": "Europe/Moscow" }

// Response 200
{ "id": 42, "status": "streaming" }
```

Защита: атомарная `UPDATE WHERE used_at IS NULL` (race condition), проверка IP (нельзя использовать свою ссылку).

#### POST /api/ask

```json
// Request
{ "timezone": "Europe/Moscow" }

// Response 200
{ "id": 42, "status": "streaming" }

// Response 429
{ "error": "Ты уже спрашивал. Следующая попытка через 23 ч.", "retry_after": 82800 }
```

#### GET /api/messages

```
GET /api/messages?limit=20&cursor=50
```

```json
{
  "messages": [{
    "id": 49, "type": "free", "sender_name": "Аноним",
    "user_message": "Алиса покажи пизду",
    "alice_response": "Текст ответа...",
    "has_image": 1, "amount": null,
    "created_at": "2026-03-21T12:00:00.000Z",
    "user_id": 1000001, "reply_to": null,
    "device": "iPhone", "os": "iOS 18.1",
    "city": "Москва", "country": "🇷🇺",
    "votes_up": 5, "votes_down": 1
  }],
  "next_cursor": 30,
  "has_more": true
}
```

---

## SSE-события

Подключение: `GET /api/messages/stream`

| Событие | Данные | Когда |
|---------|--------|-------|
| `message:new` | Полный объект Message | Новое сообщение |
| `message:token` | `{ id, token }` | Стриминг слова от ИИ |
| `message:complete` | `{ id, alice_response, alice_image }` | ИИ завершил ответ |
| `message:vote` | `{ id, up, down }` | Голос |
| `message:name` | `{ id, sender_name }` | Имя изменено |
| `online:count` | `{ count }` | Подключение/отключение |
| `heartbeat` | `{ ts }` | Каждые 15 сек |

Клиент: экспоненциальный backoff 1с → 30с при обрыве.

---

## База данных

SQLite (WAL mode) в `backend/data/alisapizdu.db`. Создаётся автоматически.

### messages

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | INTEGER PK | Auto-increment |
| type | TEXT | `'free'`, `'paid'`, `'invite'` |
| sender_name | TEXT | Имя отправителя (null = Аноним) |
| user_message | TEXT | Текст сообщения |
| alice_response | TEXT | Ответ Алисы |
| alice_image | TEXT | Base64 JPEG (YandexART) |
| amount | INTEGER | 1000 для paid |
| created_at | TEXT | ISO8601 |
| ip_hash | TEXT | SHA256(ip+salt).slice(0,16) |
| user_id | INTEGER | 7-значный последовательный ID |
| reply_to | INTEGER | ID сообщения-родителя |
| device | TEXT | iPhone, PC, Samsung... |
| os | TEXT | iOS 18.1, Windows 10/11... |
| city | TEXT | Из ip-api.com |
| country | TEXT | Флаг эмодзи |

### votes

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | INTEGER PK | Auto-increment |
| message_id | INTEGER | FK на messages |
| ip_hash | TEXT | Хеш голосующего |
| vote | INTEGER | 1 или -1 |

UNIQUE(message_id, ip_hash)

### invite_links

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | TEXT PK | nanoid(6) — код ссылки |
| created_by_ip | TEXT | Хеш IP создателя |
| created_by_user_id | INTEGER | User ID создателя |
| preset_name | TEXT | Заданное имя друга |
| allow_rename | INTEGER | 0/1 — разрешить менять имя |
| notify_email | TEXT | Email для уведомлений |
| message_id | INTEGER | ID сообщения (после использования) |
| used_at | TEXT | Когда использована |
| used_by_ip | TEXT | Хеш IP использователя |
| created_at | TEXT | Дата создания |

### stats

Одна строка: `('total_messages', N)`.

---

## Структура файлов

```
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app, маршруты, middleware
│   │   ├── db.js                 # SQLite schema + все query helpers
│   │   ├── routes/
│   │   │   ├── ask.js            # POST /api/ask — бесплатный вопрос
│   │   │   ├── askCustom.js      # POST /api/ask-custom — платный
│   │   │   ├── messages.js       # GET /api/messages — пагинация
│   │   │   ├── stream.js         # GET /api/messages/stream — SSE
│   │   │   ├── vote.js           # POST /api/vote/:id
│   │   │   ├── name.js           # PATCH /api/name/:id
│   │   │   ├── stats.js          # GET /api/stats
│   │   │   ├── image.js          # GET /api/image/:id
│   │   │   └── invite.js         # CRUD invite-ссылок
│   │   ├── services/
│   │   │   ├── ai.js             # YandexGPT + YandexART + mock
│   │   │   ├── broadcast.js      # SSE клиенты + broadcast
│   │   │   ├── rateLimit.js      # Rate limit (БД, 24ч, защита от incognito)
│   │   │   └── email.js          # SMTP уведомления
│   │   └── utils/
│   │       ├── hash.js           # SHA256 хеширование IP
│   │       ├── userInfo.js       # UA parser, geo lookup
│   │       ├── messageVariants.js # ~40 вариантов сообщений
│   │       └── mockResponses.js  # 30 заготовленных ответов
│   ├── data/                     # SQLite база (gitignored)
│   ├── .env                      # Credentials (gitignored)
│   └── .env.example
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx            # Root layout, metadata, Metrika
│   │   ├── page.tsx              # Главная (Preloader + Chat)
│   │   ├── globals.css           # Tailwind + кастомные стили
│   │   └── i/[code]/page.tsx     # Страница invite-ссылки
│   ├── components/
│   │   ├── Chat.tsx              # Главный контейнер — SSE, scroll, модалки
│   │   ├── MessageCard.tsx       # Карточка сообщения — стриминг, голоса, шеринг
│   │   ├── Header.tsx            # Шапка — онлайн, счётчики, донат
│   │   ├── AskButton.tsx         # Нижняя панель — спросить/написать/пригласить
│   │   ├── InviteModal.tsx       # Модалка создания invite-ссылки
│   │   ├── CustomMessageModal.tsx # Модалка платного сообщения
│   │   ├── DonateModal.tsx       # Модалка "грантовой поддержки"
│   │   ├── LegalModal.tsx        # Политика/Соглашение/Cookies
│   │   ├── Preloader.tsx         # Fake loading animation
│   │   └── TeamModal.tsx         # "Команда исследователей"
│   ├── hooks/
│   │   ├── useMessages.ts        # State: сообщения, пагинация, стриминг
│   │   └── useSSE.ts             # EventSource + exponential backoff
│   ├── lib/
│   │   ├── api.ts                # API клиент + TypeScript интерфейсы
│   │   └── metrika.ts            # Yandex Metrika reachGoal
│   ├── next.config.js            # Rewrite /api/* → backend
│   └── tailwind.config.ts        # Цвета, анимации
│
└── deliverables/
    └── plan-share-links.md       # План фичи invite-ссылок
```

---

## Компоненты (дерево)

```
RootLayout (layout.tsx)
└── Home (page.tsx)
    ├── Preloader — fake загрузка ~3.5с
    └── Chat — главный orchestrator
        ├── Header — online / total / VIP / donate
        ├── MessageCard (×N)
        │   ├── VIP badge (type=paid)
        │   ├── Invite badge (type=invite)
        │   ├── Reply reference
        │   ├── User message bubble
        │   ├── Alice response + image
        │   ├── Vote buttons
        │   ├── Share button
        │   └── Image lightbox (клик → полноэкранный просмотр)
        ├── AskButton — ask / custom / invite
        ├── CustomMessageModal
        ├── InviteModal
        ├── DonateModal → TeamModal
        └── LegalModal
```

---

## Вирусная механика

### Invite-ссылки

```
Пользователь A спрашивает Алису
  → Видит ответ
  → Нажимает "Пригласить"
  → Вписывает имя "Петя"
  → Получает ссылку + текст-приглашение
  → Отправляет Пете в Telegram/WhatsApp

Петя переходит по ссылке /i/xK9mQ2
  → Редирект на /?invite=xK9mQ2
  → Видит обычный сайт с лентой
  → Нажимает "Спросить Алису"
  → Сообщение публикуется от имени "Петя" (нежданчик!)
  → A получает email-уведомление
  → Петя видит ответ и хочет пригласить кого-то ещё
  → Цикл повторяется
```

Тексты приглашений (рандомно из 5 вариантов):
- Не спойлерят содержание сайта
- Интрига: "нажми кнопку", "эксперимент с ИИ"
- Нежданчик при открытии

### Шеринг

- Кнопка "Поделиться" на каждом сообщении
- `navigator.share` на мобильных, clipboard fallback
- URL с якорем `/#msg-{id}` — автоскролл + подсветка

---

## AI система

### YandexGPT (текст)

- Модель: `gpt://{folderId}/yandexgpt/latest`
- Temperature: 1.0, maxTokens: 200
- Без системного промпта — запрос пользователя отправляется напрямую с контекстом `[устройство, город]`
- Стриминг: разбивка по словам, 30-70мс задержка

### YandexART (изображения)

- Модель: `art://{folderId}/yandex-art/latest`
- Async: POST → operation ID → poll каждые 2с (макс 15 попыток)
- При отказе модерации: повтор с безопасным промптом ("нарисуй котика")
- Результат: base64 JPEG

### Mock-режим

Без Yandex credentials: 30 заготовленных ответов, имитация стриминга 50-130мс/слово.

---

## Деплой на сервер

Сервер: `31.44.7.144` (root), PM2 + Nginx + Let's Encrypt.

```bash
# 1. Загрузить файлы
scp -r backend/src/ 31.44.7.144:/var/www/alisapizdu/backend/src/
scp backend/package.json backend/package-lock.json 31.44.7.144:/var/www/alisapizdu/backend/
scp -r frontend/app/ frontend/components/ frontend/lib/ frontend/hooks/ \
  31.44.7.144:/var/www/alisapizdu/frontend/

# 2. На сервере — установка зависимостей
ssh 31.44.7.144
cd /var/www/alisapizdu/backend && npm install --production
cd /var/www/alisapizdu/frontend && npm install && npx next build

# 3. Перезапуск
pm2 restart alisapizdu-backend alisapizdu-frontend
```

### Nginx конфиг (`/etc/nginx/sites-enabled/alisapizdu`)

```nginx
server {
    server_name xn--80aaaqjgddaqi2bmfw7b.xn--p1ai;

    location / {
        proxy_pass http://127.0.0.1:3011;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3010;
        proxy_buffering off;        # SSE
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_set_header Connection "";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    listen 443 ssl;  # certbot managed
}
```

---

## Дизайн-токены

| Токен | Значение | Использование |
|-------|----------|--------------|
| `bg.primary` | `#0f0f1a` | Фон страницы |
| `bg.card` | `#1e1e3a` | Фон карточки |
| `alice.purple` | `#7B68EE` | Акцент, кнопки, аватар Алисы |
| `alice.light` | `#9B59B6` | Вторичный акцент |
| `alice.text` | `#e0d0ff` | Текст ответа Алисы |
| `vip.gold` | `#ffd700` | VIP/платные сообщения |
| `maxWidth.chat` | `600px` | Ширина ленты |

---

## localStorage ключи

| Ключ | Значение | Назначение |
|------|----------|-----------|
| `alisapizdu_last_ask` | timestamp | Время последнего бесплатного вопроса |
| `alisapizdu_my_msg` | message ID | ID моего сообщения (для редактирования имени) |
| `alisapizdu_custom_sent` | "1" | Флаг отправки платного сообщения |
| `alisapizdu_name_tip` | "1" | Тултип "нажми чтобы указать имя" показан |
| `alisapizdu_tip_shown` | "1" | Тултип "расскажи друзьям" показан |
| `vote_{id}` | "1" / "-1" | Мой голос за сообщение |

---

## Аналитика

Yandex Metrika (ID: 108182887) с webvisor и clickmap.

Цели:

| Цель | Описание |
|------|----------|
| `ask_alice` | Нажал "Спросить Алису" |
| `custom_open` | Открыл "Написать своё" |
| `custom_send` | Отправил платное сообщение |
| `share_click` | Нажал "Поделиться" |
| `vote_up` | Поставил 👍 |
| `vote_down` | Поставил 👎 |
| `name_edit` | Изменил имя |
| `donate_open` | Открыл модалку доната |
| `donate_click` | Нажал "Выделить грант" |
| `invite_open` | Открыл модалку "Пригласить" |
| `invite_create` | Создал invite-ссылку |
| `invite_copy` | Скопировал invite-ссылку |
| `invite_telegram` | Отправил invite в Telegram |
| `invite_use` | Использовал invite-ссылку |
| `image_lightbox` | Открыл картинку в лайтбоксе |
