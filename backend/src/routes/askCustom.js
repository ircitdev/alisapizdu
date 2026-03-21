const express = require('express');
const router = express.Router();
const { generateResponse } = require('../services/ai');
const { insertMessage, updateAliceResponse, getLastMessageId, getMessageById } = require('../db');
const { broadcastNewMessage, broadcastToken, broadcastComplete } = require('../services/broadcast');
const { parseUserAgent, parseBrowser, getGeoByIP, countryFlag } = require('../utils/userInfo');
const { hashIP } = require('../utils/hash');

function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

function sanitize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim().slice(0, 200);
}

router.post('/', async (req, res) => {
  try {
    const ip = getRealIP(req);
    const ipHash = hashIP(ip);

    const customMessage = sanitize(req.body.message);
    const senderName = sanitize(req.body.sender_name || '');

    if (!customMessage) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    }

    // Parse device info
    const ua = req.headers['user-agent'] || '';
    const { device, os } = parseUserAgent(ua);
    const browser = parseBrowser(ua);
    const geo = await getGeoByIP(ip);
    const country = geo.country ? countryFlag(geo.country) : null;

    // Find last message to reply to
    const replyToId = getLastMessageId();
    const replyToMsg = replyToId ? getMessageById(replyToId) : null;

    // Build context for AI — include the message being replied to
    const contextParts = [device, os, browser, geo.city, country].filter(Boolean);
    let aiMessage = `[Пользователь: ${contextParts.join(', ')}]\n`;
    if (replyToMsg && replyToMsg.alice_response) {
      aiMessage += `[Это ответ на предыдущий диалог. Алиса ответила: "${replyToMsg.alice_response.slice(0, 100)}"]\n`;
    }
    aiMessage += customMessage;

    const message = insertMessage({
      type: 'paid',
      sender_name: senderName || null,
      user_message: customMessage,
      alice_response: '...',
      alice_image: null,
      amount: 1000,
      ip_hash: ipHash,
      user_id: 1000000 + Math.floor(Math.random() * 9000000),
      reply_to: replyToId,
      device,
      os,
      city: geo.city,
      country,
    });

    const messageId = Number(message.id);
    console.log(`[${new Date().toISOString()}] Custom #${messageId}: "${customMessage.slice(0, 50)}"`);

    res.json({ id: messageId, status: 'streaming' });

    broadcastNewMessage({ ...message, id: messageId, alice_response: '', alice_image: null });

    generateResponse(aiMessage, {
      onToken: (token) => broadcastToken(messageId, token),
      onComplete: (aliceResponse, aliceImage) => {
        updateAliceResponse(messageId, aliceResponse, aliceImage);
        broadcastComplete(messageId, aliceResponse, aliceImage);
        console.log(`[${new Date().toISOString()}] Custom response #${messageId} complete`);
      },
      onError: (err) => {
        console.error(`[${new Date().toISOString()}] Custom AI error #${messageId}: ${err.message}`);
      }
    }).catch(err => {
      console.error(`[${new Date().toISOString()}] Custom generate error: ${err.message}`);
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/ask-custom error: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
