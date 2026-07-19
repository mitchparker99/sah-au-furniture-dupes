#!/usr/bin/env node
// Build the static comparison site: data/catalogue.json + data/matches.json -> site/.
// Runs `match` implicitly if matches.json is missing.
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { loadCatalogue } = require('../lib/catalogue');
const { buildSite } = require('../lib/site-builder');
const { computeMatches, MATCHES_PATH } = require('./match');
const { makeLogger } = require('../lib/logger');

const SITE_DIR = path.join(__dirname, '..', 'site');

function loadMatches(catalogue) {
  if (fs.existsSync(MATCHES_PATH)) {
    return JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8')).matches;
  }
  return computeMatches(catalogue);
}

function main() {
  const log = makeLogger('build-site');
  const catalogue = loadCatalogue();
  const matches = loadMatches(catalogue);
  const { pages } = buildSite(catalogue, matches, SITE_DIR);
  log.info(`built ${pages} pages -> site/`);
}

// ── self-test ────────────────────────────────────────────────────────────────
if (process.argv.includes('--test')) {
  const assert = require('assert');
  const os = require('os');
  const { FIXTURE_CATALOGUE } = require('../lib/fixtures');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-site-'));
  const matches = computeMatches(FIXTURE_CATALOGUE);
  buildSite(FIXTURE_CATALOGUE, matches, tmp, { SITE_NAME: 'Lookalike Living', SITE_URL: 'https://example.org' });

  const index = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
  const compare = fs.readFileSync(path.join(tmp, 'compare', 'studio-one-curve-sofa.html'), 'utf8');
  const method = fs.readFileSync(path.join(tmp, 'methodology.html'), 'utf8');

  assert.ok(index.includes('Curve Modular Sofa'), 'index lists the original');
  assert.ok(compare.includes('Cloudline 3 Seater'), 'compare page lists the match');
  assert.ok(compare.includes('rel="sponsored nofollow noopener"'), 'outbound links are sponsored+nofollow');
  assert.ok(compare.includes('save 70%'), 'savings rendered');
  assert.ok(method.includes('never a claim that any'), 'methodology carries the legal posture');
  for (const f of ['style.css', 'robots.txt', 'sitemap.xml', '404.html']) {
    assert.ok(fs.existsSync(path.join(tmp, f)), `${f} generated`);
  }
  // Non-ASCII data must land as numeric entities (e.g. IKEA's JATTEBO with a
  // diaeresis), and the 404 must be styled + linked at any path depth.
  const { esc } = require('../lib/site-builder');
  assert.strictEqual(esc('JÄTTEBO'), 'J&#196;TTEBO', 'non-ascii data entity-encoded');
  const notFound = fs.readFileSync(path.join(tmp, '404.html'), 'utf8');
  assert.ok(notFound.includes('<style>'), '404 inlines its CSS (served at any depth)');
  assert.ok(notFound.includes('href="https://example.org/index.html"'), '404 links home absolutely when SITE_URL set');
  assert.ok(!/[^\x00-\x7F]/.test(notFound), '404 is ASCII-only');
  // House rules: no emoji, ASCII-only source.
  for (const page of [index, compare, method]) {
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(page), 'no emoji in generated pages');
    assert.ok(!/[^\x00-\x7F]/.test(page), 'generated pages are ASCII-only');
  }
  // No replica/copy claims anywhere in generated copy.
  for (const page of [index, compare]) {
    assert.ok(!/\b(replica|knock-?off|copy of)\b/i.test(page), 'no replica/copy claims in page copy');
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('[ok] build-site self-test passed (pages, links, legal copy, ascii, no-emoji)');
} else if (require.main === module) {
  main();
}

module.exports = { SITE_DIR };
