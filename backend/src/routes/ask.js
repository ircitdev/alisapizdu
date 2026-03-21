const express = require('express');
const router = express.Router();
const { checkRateLimit } = require('../services/rateLimit');
const { generateResponse } = require('../services/ai');
const { insertMessage, updateAliceResponse } = require('../db');
const { broadcastNewMessage, broadcastToken, broadcastComplete } = require('../services/broadcast');
const { parseUserAgent, parseBrowser, getGeoByIP, countryFlag } = require('../utils/userInfo');
const { getRandomMessage } = require('../utils/messageVariants');

function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

router.post('/', async (req, res) => {
  try {
    const rateCheck = checkRateLimit(req);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: rateCheck.message,
        retry_after: rateCheck.retryAfter
      });
    }

    // Generate varied message
    const displayMessage = getRandomMessage();

    // Parse device info
    const ua = req.headers['user-agent'] || '';
    const { device, os } = parseUserAgent(ua);
    const browser = parseBrowser(ua);

    // Geo lookup (async, non-blocking)
    const ip = getRealIP(req);
    const geo = await getGeoByIP(ip);
    const country = geo.country ? countryFlag(geo.country) : null;

    const contextParts = [`#${rateCheck.userId}`, device, geo.city].filter(Boolean);
    const userMessage = `[${contextParts.join(', ')}] ${displayMessage}`;

    const message = insertMessage({
      type: 'free',
      sender_name: null,
      user_message: displayMessage,
      alice_response: '...',
      alice_image: null,
      amount: null,
      ip_hash: rateCheck.ipHash,
      user_id: rateCheck.userId,
      device,
      os,
      city: geo.city,
      country,
    });

    const messageId = Number(message.id);
    console.log(`[${new Date().toISOString()}] #${messageId} from ${device} ${os} ${geo.city || ''} ${geo.country || ''}`);

    res.json({ id: messageId, status: 'streaming' });

    broadcastNewMessage({ ...message, id: messageId, alice_response: '', alice_image: null });

    generateResponse(userMessage, {
      onToken: (token) => broadcastToken(messageId, token),
      onComplete: (aliceResponse, aliceImage) => {
        updateAliceResponse(messageId, aliceResponse, aliceImage);
        broadcastComplete(messageId, aliceResponse, aliceImage);
        console.log(`[${new Date().toISOString()}] Response #${messageId} complete`);
      },
      onError: (err) => {
        console.error(`[${new Date().toISOString()}] AI error #${messageId}: ${err.message}`);
      }
    }).catch(err => {
      console.error(`[${new Date().toISOString()}] Generate error: ${err.message}`);
    });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/ask error: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
