const express = require('express');
const router = express.Router();
const { getMessages, getVotesBatch, getReactionsBatch } = require('../db');

router.get('/', (req, res) => {
  try {
    const cursor = req.query.cursor ? parseInt(req.query.cursor, 10) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;

    if (cursor !== null && (isNaN(cursor) || cursor < 0)) {
      return res.status(400).json({ error: 'Invalid cursor' });
    }

    const result = getMessages(cursor, limit);

    // Attach vote counts
    const ids = result.messages.map(m => m.id);
    const votes = getVotesBatch(ids);
    const reactions = getReactionsBatch(ids);
    result.messages = result.messages.map(m => ({
      ...m,
      votes_up: votes[m.id]?.up || 0,
      votes_down: votes[m.id]?.down || 0,
      reactions: reactions[m.id] || {},
    }));

    res.json(result);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/messages error: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
