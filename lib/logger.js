// Minimal logger: console + append to <name>.log at the venture root.
// Text tags only ([ok] / [warn] / [fail]) — no emoji, per house style.
'use strict';

const fs = require('fs');
const path = require('path');

function makeLogger(name) {
  const file = path.join(__dirname, '..', `${name}.log`);
  function write(tag, msg) {
    const line = `${new Date().toISOString()} ${tag} ${msg}`;
    console.log(line);
    try { fs.appendFileSync(file, line + '\n'); } catch (_) { /* read-only CI is fine */ }
  }
  return {
    info: (msg) => write('[ok]', msg),
    warn: (msg) => write('[warn]', msg),
    fail: (msg) => write('[fail]', msg),
  };
}

module.exports = { makeLogger };
