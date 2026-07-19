#!/usr/bin/env node
// Preflight doctor: is this venture wired up correctly?
//   node scripts/doctor.js          strict (non-zero exit on failures)
//   node scripts/doctor.js --soft   report-only (CI pre-launch mode)
//   node scripts/doctor.js --test   fixture self-test
// Everything in v1 runs with zero secrets, so most checks are informational.
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { validateCatalogue, CATALOGUE_PATH } = require('../lib/catalogue');
const { isBlank, boolEnv } = require('../lib/env');
const { isPaused } = require('../lib/killswitch');

function runChecks(env = process.env) {
  const checks = [];
  const add = (level, msg) => checks.push({ level, msg });

  const major = Number(process.versions.node.split('.')[0]);
  add(major >= 18 ? 'ok' : 'fail', `node ${process.versions.node} (need >= 18)`);

  if (fs.existsSync(CATALOGUE_PATH)) {
    try {
      const cat = JSON.parse(fs.readFileSync(CATALOGUE_PATH, 'utf8'));
      const { errors, warnings } = validateCatalogue(cat);
      errors.forEach((e) => add('fail', `catalogue: ${e}`));
      warnings.forEach((w) => add('warn', `catalogue: ${w}`));
      if (!errors.length) add('ok', `catalogue: ${cat.products.length} products valid`);
      const originals = cat.products.filter((p) => p.role === 'original').length;
      if (originals < 3) add('warn', `catalogue: only ${originals} originals - thin site`);
    } catch (err) {
      add('fail', `catalogue: unparseable (${err.message})`);
    }
  } else {
    add('fail', 'catalogue: data/catalogue.json missing');
  }

  if (isPaused(env)) add('warn', 'PAUSED - kill-switch engaged, pipeline runs will no-op');
  if (isBlank(env.ANTHROPIC_API_KEY)) add('ok', 'vision: no ANTHROPIC_API_KEY - spec-only scoring (fine)');
  else add('ok', `vision: key present, VISION_ENABLED=${boolEnv('VISION_ENABLED', env)}`);
  if (isBlank(env.AFFILIATE_CF_ID) && isBlank(env.AFFILIATE_IMPACT_ID)) {
    add('warn', 'affiliates: no network IDs yet - links are UTM-only (no revenue)');
  } else {
    add('ok', 'affiliates: at least one network ID configured');
  }
  if (isBlank(env.SITE_URL)) add('warn', 'SITE_URL unset - canonical/sitemap URLs omitted');

  return checks;
}

function main() {
  const soft = process.argv.includes('--soft');
  const checks = runChecks();
  let failed = 0;
  for (const c of checks) {
    const tag = c.level === 'ok' ? '[ok]  ' : c.level === 'warn' ? '[warn]' : '[fail]';
    console.log(`${tag} ${c.msg}`);
    if (c.level === 'fail') failed++;
  }
  console.log(failed ? `doctor: ${failed} failure(s)` : 'doctor: all clear');
  if (failed && !soft) process.exit(1);
}

// ── self-test ────────────────────────────────────────────────────────────────
if (process.argv.includes('--test')) {
  const assert = require('assert');
  const checks = runChecks({});
  assert.ok(checks.some((c) => c.msg.startsWith('node ')), 'node check present');
  assert.ok(checks.some((c) => c.msg.includes('catalogue')), 'catalogue check present');
  assert.ok(checks.some((c) => c.msg.includes('spec-only scoring')), 'blank key read as vision-off');
  assert.ok(checks.some((c) => c.msg.includes('UTM-only')), 'blank affiliate ids detected');
  assert.ok(!checks.some((c) => c.level === 'fail' && c.msg.includes('unparseable')), 'live catalogue parseable');
  console.log('[ok] doctor self-test passed (env-blank handling, catalogue checks)');
} else if (require.main === module) {
  main();
}

module.exports = { runChecks };
