// Env parsing helpers shared across scripts.
//
// GitHub gotcha this guards against (see fleet-wide audit 2026-07-11):
//   • An uncreated GitHub secret arrives as '' (empty string), and Number('')===0,
//     which silently zeroes optional numeric config. Treat empty as unset.
'use strict';

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function strEnv(name, env = process.env, fallback = '') {
  const raw = env[name];
  return isBlank(raw) ? fallback : String(raw).trim();
}

function intEnv(name, env = process.env, fallback = 0) {
  const raw = env[name];
  if (isBlank(raw)) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function boolEnv(name, env = process.env, fallback = false) {
  const raw = env[name];
  if (isBlank(raw)) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

module.exports = { isBlank, strEnv, intEnv, boolEnv };
