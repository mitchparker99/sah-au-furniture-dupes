#!/usr/bin/env node
// Staleness report: which prices haven't been re-checked in STALE_DAYS
// (default 45)? Prices are only ever updated by a human or a feed - v1 does
// no scraping - so this is the nightly nudge that keeps the site honest.
// Writes staleness.md; always exits 0 (informational).
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { loadCatalogue } = require('../lib/catalogue');
const { intEnv } = require('../lib/env');
const { makeLogger } = require('../lib/logger');

function findStale(catalogue, now, staleDays) {
  const cutoff = now - staleDays * 24 * 60 * 60 * 1000;
  return catalogue.products
    .map((p) => {
      const checked = Date.parse(p.price_last_checked || '');
      return { id: p.id, name: p.name, url: p.url, checked, age_days: Number.isFinite(checked) ? Math.floor((now - checked) / 86400000) : null };
    })
    .filter((p) => p.checked === null || !Number.isFinite(p.checked) || p.checked < cutoff)
    .sort((a, b) => (b.age_days || 9999) - (a.age_days || 9999));
}

function main() {
  const log = makeLogger('staleness');
  const staleDays = intEnv('STALE_DAYS', process.env, 45);
  const catalogue = loadCatalogue();
  const stale = findStale(catalogue, Date.now(), staleDays);
  const lines = [
    `# Price staleness report`,
    ``,
    `Generated ${new Date().toISOString().slice(0, 10)} - threshold ${staleDays} days - ${stale.length}/${catalogue.products.length} products stale`,
    ``,
  ];
  if (stale.length) {
    lines.push('| age (days) | product | url |', '| --- | --- | --- |');
    for (const s of stale) lines.push(`| ${s.age_days === null ? 'never' : s.age_days} | ${s.id} | ${s.url} |`);
  } else {
    lines.push('All prices within threshold.');
  }
  fs.writeFileSync(path.join(__dirname, '..', 'staleness.md'), lines.join('\n') + '\n');
  log.info(`${stale.length} stale price(s) (>${staleDays}d) -> staleness.md`);
}

// ── self-test ────────────────────────────────────────────────────────────────
if (process.argv.includes('--test')) {
  const assert = require('assert');
  const now = Date.parse('2026-07-20T00:00:00Z');
  const cat = { products: [
    { id: 'fresh', name: 'f', url: 'u', price_last_checked: '2026-07-19' },
    { id: 'old', name: 'o', url: 'u', price_last_checked: '2026-01-01' },
    { id: 'never', name: 'n', url: 'u' },
  ] };
  const stale = findStale(cat, now, 45);
  assert.deepStrictEqual(stale.map((s) => s.id).sort(), ['never', 'old'], 'old + never-checked flagged');
  assert.ok(!stale.some((s) => s.id === 'fresh'), 'fresh not flagged');
  const oldOne = stale.find((s) => s.id === 'old');
  assert.ok(oldOne.age_days >= 200, 'age computed');
  console.log('[ok] staleness self-test passed (threshold, never-checked, age)');
} else if (require.main === module) {
  main();
}

module.exports = { findStale };
