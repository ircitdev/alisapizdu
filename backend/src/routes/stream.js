const express = require('express');
const router = express.Router();
const { addClient } = require('../services/broadcast');

router.get('/', (req, res) => {
  try {
    addClient(res);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] SSE stream error: ${err.message}`);
    res.status(500).end();
  }
});

module.exports = router;
