const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const { hashIP } = require('../utils/hash');
const { getUserId } = require('../services/rateLimit');
const { createInviteLink, getInviteLink, markInviteUsed, updateInviteMessageId, countInvitesByIp, countInviteEmailsToday, insertMessage, updateAliceResponse } = require('../db');
const { generateResponse } = require('../services/ai');
const { broadcastNewMessage, broadcastToken, broadcastComplete } = require('../services/broadcast');
const { sendInviteNotification } = require('../services/email');
const { parseUserAgent, parseBrowser, getGeoByIP, countryFlag } = require('../utils/userInfo');
const { getRandomMessage } = require('../utils/messageVariants');

function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

// POST /api/invite — create invite link
router.post('/', (req, res) => {
  try {
    const { preset_name, allow_rename, notify_email } = req.body;

    if (!preset_name || typeof preset_name !== 'string' || preset_name.trim().length === 0) {
      return res.status(400).json({ error: 'Имя друга обязательно' });
    }

    const name = preset_name.trim().slice(0, 30);

    // Validate email if provided
    if (notify_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(notify_email) || notify_email.length > 100) {
        return res.status(400).json({ error: 'Некорректный email' });
      }
    }

    const ip = getRealIP(req);
    const ipHash = hashIP(ip);

    // Limit: max 10 invite links per IP
    const count = countInvitesByIp(ipHash);
    if (count >= 10) {
      return res.status(429).json({ error: 'Максимум 10 ссылок-приглашений' });
    }

    const code = nanoid(6);
    const invite = createInviteLink({
      id: code,
      created_by_ip: ipHash,
      created_by_user_id: getUserId(req) || null,
      preset_name: name,
      allow_rename: !!allow_rename,
      notify_email: notify_email || null,
    });

    res.json({
      code: invite.id,
      url: `/i/${invite.id}`,
      preset_name: invite.preset_name,
      allow_rename: invite.allow_rename,
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/invite error: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/invite/:code — get invite info
router.get('/:code', (req, res) => {
  try {
    const invite = getInviteLink(req.params.code);
    if (!invite) {
      return res.status(404).json({ error: 'Ссылка не найдена' });
    }

    res.json({
      code: invite.id,
      preset_name: invite.preset_name,
      allow_rename: !!invite.allow_rename,
      used: !!invite.used_at,
      created_by_user_id: invite.created_by_user_id,
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/invite/:code error: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/invite/:code/use — use invite link (send message)
router.post('/:code/use', async (req, res) => {
  try {
    const invite = getInviteLink(req.params.code);
    if (!invite) {
      return res.status(404).json({ error: 'Ссылка не найдена' });
    }
    if (invite.used_at) {
      return res.status(410).json({ error: 'Ссылка уже использована' });
    }

    const ip = getRealIP(req);
    const ipHash = hashIP(ip);

    // Cannot use own invite
    if (ipHash === invite.created_by_ip) {
      return res.status(403).json({ error: 'Нельзя использовать свою же ссылку' });
    }

    // Atomically claim the invite (prevents race condition)
    const claimed = markInviteUsed(invite.id, 0, ipHash);
    if (!claimed) {
      return res.status(410).json({ error: 'Ссылка уже использована' });
    }

    // Determine sender name
    let senderName;
    if (invite.allow_rename && req.body.name && typeof req.body.name === 'string' && req.body.name.trim()) {
      senderName = req.body.name.trim().replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '').slice(0, 30);
    } else {
      senderName = invite.preset_name;
    }

    // Parse device info
    const ua = req.headers['user-agent'] || '';
    const { device, os } = parseUserAgent(ua);
    const browser = parseBrowser(ua);

    // Geo lookup
    const geo = await getGeoByIP(ip);
    const country = geo.country ? countryFlag(geo.country) : null;

    // Generate varied message text
    const displayMessage = getRandomMessage();

    const contextParts = [device, geo.city].filter(Boolean);
    const userMessage = contextParts.length
      ? `[${contextParts.join(', ')}] ${displayMessage}`
      : displayMessage;

    // Create message with type 'invite'
    const message = insertMessage({
      type: 'invite',
      sender_name: senderName,
      user_message: displayMessage,
      alice_response: '...',
      alice_image: null,
      amount: null,
      ip_hash: ipHash,
      user_id: invite.created_by_user_id,
      device,
      os,
      city: geo.city,
      country,
    });

    const messageId = Number(message.id);

    // Update invite with actual message ID
    updateInviteMessageId(invite.id, messageId);

    console.log(`[${new Date().toISOString()}] Invite #${invite.id} used → msg #${messageId} by "${senderName}"`);

    res.json({ id: messageId, status: 'streaming' });

    // Broadcast & generate
    broadcastNewMessage({ ...message, id: messageId, alice_response: '', alice_image: null });

    generateResponse(userMessage, {
      onToken: (token) => broadcastToken(messageId, token),
      onComplete: (aliceResponse, aliceImage) => {
        updateAliceResponse(messageId, aliceResponse, aliceImage);
        broadcastComplete(messageId, aliceResponse, aliceImage);
        console.log(`[${new Date().toISOString()}] Invite response #${messageId} complete`);

        // Send email notification if configured
        if (invite.notify_email) {
          const emailCount = countInviteEmailsToday(invite.notify_email);
          if (emailCount < 10) {
            sendInviteNotification({
              to: invite.notify_email,
              presetName: invite.preset_name,
              senderName,
              device,
              os,
              city: geo.city,
              country,
              datetime: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
              userMessage: displayMessage,
              aliceResponse,
              messageId,
            });
          }
        }
      },
      onError: (err) => {
        console.error(`[${new Date().toISOString()}] AI error invite #${messageId}: ${err.message}`);
      }
    }).catch(err => {
      console.error(`[${new Date().toISOString()}] Generate error invite: ${err.message}`);
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/invite/:code/use error: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
