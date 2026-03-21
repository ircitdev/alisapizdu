const crypto = require('crypto');

const SALT = 'alisapizdu-2024-salt';

function hashIP(ip) {
  return crypto.createHash('sha256').update(ip + SALT).digest('hex').slice(0, 16);
}

module.exports = { hashIP };
