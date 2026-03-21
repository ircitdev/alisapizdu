const express = require('express');
const router = express.Router();
const { updateSenderName } = require('../db');
const { hashIP, getRealIP } = require('../utils/hash');
const { broadcastNameUpdate } = require('../services/broadcast');

function getRealIPFromReq(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

router.patch('/:messageId', (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    if (!messageId || isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const senderName = (req.body.sender_name || '').replace(/<[^>]*>/g, '').trim().slice(0, 30);
    if (!senderName) {
      return res.status(400).json({ error: 'Имя не может быть пустым' });
    }

    const ip = getRealIPFromReq(req);
    const ipHash = hashIP(ip);

    const updated = updateSenderName(messageId, senderName, ipHash);
    if (!updated) {
      return res.status(403).json({ error: 'Можно менять только своё имя' });
    }

    // Broadcast name update to all clients
    broadcastNameUpdate(messageId, senderName);

    res.json({ ok: true, sender_name: senderName });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] PATCH /api/name error: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка' });
  }
});

module.exports = router;
