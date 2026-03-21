const express = require('express');
const router = express.Router();
const { toggleReaction } = require('../db');
const { broadcast } = require('../services/broadcast');
const { hashIP } = require('../utils/hash');

function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

// POST /api/reaction/:messageId
router.post('/:messageId', (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'emoji required' });

    const ip = getRealIP(req);
    const ipHash = hashIP(ip);
    const reactions = toggleReaction(messageId, ipHash, emoji);
    if (!reactions) return res.status(400).json({ error: 'invalid emoji' });

    broadcast('message:reactions', { id: messageId, reactions });
    res.json({ ok: true, reactions });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/reaction error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
