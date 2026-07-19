// Kill-switch: a PAUSED file at the venture root (npm run pause) or the
// PAUSED env/repo variable halts anything that spends money or calls APIs.
'use strict';

const fs = require('fs');
const path = require('path');
const { boolEnv } = require('./env');

function isPaused(env = process.env) {
  if (boolEnv('PAUSED', env)) return true;
  try {
    fs.accessSync(path.join(__dirname, '..', 'PAUSED'));
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { isPaused };
