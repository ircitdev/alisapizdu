const express = require('express');
const router = express.Router();
const { getMessageImage } = require('../db');

// GET /api/image/:messageId — returns JPEG image
router.get('/:messageId', (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    if (!messageId || isNaN(messageId)) {
      return res.status(400).end();
    }

    const base64 = getMessageImage(messageId);
    if (!base64) {
      return res.status(404).end();
    }

    const buffer = Buffer.from(base64, 'base64');
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    res.send(buffer);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] GET /api/image error: ${err.message}`);
    res.status(500).end();
  }
});

module.exports = router;
