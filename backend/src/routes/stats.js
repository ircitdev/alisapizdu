const express = require('express');
const router = express.Router();
const { getTotalMessages, getVipCount } = require('../db');
const { getOnlineCount } = require('../services/broadcast');

router.get('/', (req, res) => {
  try {
    res.json({
      total_messages: getTotalMessages(),
      online_count: getOnlineCount(),
      vip_count: getVipCount()
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/stats error: ${err.message}`);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
