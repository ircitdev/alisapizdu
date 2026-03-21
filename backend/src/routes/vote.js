const express = require('express');
const router = express.Router();
const { voteMessage } = require('../db');
const { hashIP } = require('../utils/hash');
const { broadcast } = require('../services/broadcast');

function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '127.0.0.1';
}

// POST /api/vote/:messageId  body: { vote: 1 | -1 }
router.post('/:messageId', (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    if (!messageId || isNaN(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const vote = req.body.vote;
    if (vote !== 1 && vote !== -1) {
      return res.status(400).json({ error: 'Vote must be 1 or -1' });
    }

    const ip = getRealIP(req);
    const ipHash = hashIP(ip);

    const counts = voteMessage(messageId, ipHash, vote);

    // Broadcast vote update to all clients
    broadcast('message:vote', { id: messageId, up: counts.up, down: counts.down });

    res.json({ ok: true, up: counts.up, down: counts.down });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] POST /api/vote error: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка' });
  }
});

module.exports = router;
