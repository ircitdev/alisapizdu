const express = require('express');
const router = express.Router();

const BASE = 'https://storage.googleapis.com/uspeshnyy-projects/apokajipizdu';
const IMAGES = ['ogimage1.jpg', 'ogimage2.jpg', 'ogimage3.jpg', 'ogimage4.jpg', 'ogimage5.jpg'];

router.get('/', (req, res) => {
  const img = IMAGES[Math.floor(Math.random() * IMAGES.length)];
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.redirect(302, `${BASE}/${img}`);
});

module.exports = router;
