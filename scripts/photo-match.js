#!/usr/bin/env node
// Photo search: describe a furniture photo with Claude, then rank the whole
// catalogue (originals AND alternatives) by resemblance to it.
//
//   npm run photo -- --image https://.../inspo.jpg
//   npm run photo -- --image ./screenshot.png
//
// Requires ANTHROPIC_API_KEY. This is the seed of the consumer "search by
// Pinterest screenshot" feature; v1 is operator-run.
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { loadCatalogue } = require('../lib/catalogue');
const { similarity } = require('../lib/similarity');
const { makeLogger } = require('../lib/logger');

// Rank catalogue products against an attribute description (category,
// materials, style_tags, colour) produced by vision or typed by hand.
function rankByAttributes(catalogue, attrs, topN = 10) {
  const probe = {
    category: attrs.category,
    materials: attrs.materials || [],
    style_tags: attrs.style_tags || [],
    colour: attrs.colour,
    // no dimensions from a photo - similarity reweights automatically
  };
  const ranked = [];
  for (const p of catalogue.products) {
    const sim = similarity(probe, p);
    if (!sim) continue;
    ranked.push({ id: p.id, role: p.role, name: p.name, seller: p.brand || p.retailer, price_aud: p.price_aud, score: sim.score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, topN);
}

async function main() {
  const log = makeLogger('photo-match');
  const { isPaused } = require('../lib/killswitch');
  if (isPaused()) {
    log.warn('PAUSED - kill-switch engaged, not spending API calls');
    return;
  }
  const idx = process.argv.indexOf('--image');
  const image = idx > -1 ? process.argv[idx + 1] : null;
  if (!image) {
    console.error('[fail] usage: npm run photo -- --image <url-or-path>');
    process.exit(1);
  }
  const { visionAvailable, photoAttributes } = require('../lib/vision');
  if (!visionAvailable()) {
    console.error('[fail] ANTHROPIC_API_KEY not set - photo search needs a key');
    process.exit(1);
  }
  let source = image;
  if (!/^https?:/.test(image)) {
    const ext = path.extname(image).toLowerCase().replace('.', '') || 'png';
    source = {
      mediaType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      data: fs.readFileSync(image).toString('base64'),
    };
  }
  const attrs = await photoAttributes(source);
  log.info(`photo read as: ${attrs.category} / ${(attrs.style_tags || []).join(', ')} / ${(attrs.materials || []).join(', ')} / ${attrs.colour || '?'}`);
  const results = rankByAttributes(loadCatalogue(), attrs);
  if (!results.length) {
    console.log('no catalogue products in that category yet');
    return;
  }
  console.log('\nrank score  price     product');
  results.forEach((r, i) => {
    console.log(`${String(i + 1).padStart(4)} ${String(r.score).padStart(5)}  ${('$' + r.price_aud).padStart(8)}  ${r.seller} ${r.name} [${r.role}]`);
  });
}

// ── self-test ────────────────────────────────────────────────────────────────
if (process.argv.includes('--test')) {
  const assert = require('assert');
  const { FIXTURE_CATALOGUE } = require('../lib/fixtures');
  // Mocked vision output for a boucle curved sofa photo:
  const attrs = { category: 'sofas', materials: ['boucle'], style_tags: ['curved', 'modular'], colour: 'ivory' };
  const results = rankByAttributes(FIXTURE_CATALOGUE, attrs);
  assert.ok(results.length >= 2, 'ranks sofa products');
  assert.ok(['studio-one-curve-sofa', 'budgetco-cloudline-sofa'].includes(results[0].id), 'boucle curved sofa ranks first');
  assert.ok(!results.some((r) => r.id.includes('lamp')), 'other categories excluded');
  const none = rankByAttributes(FIXTURE_CATALOGUE, { category: 'dining', materials: ['oak'], style_tags: ['pedestal'] });
  assert.strictEqual(none.length, 0, 'empty category returns nothing');
  console.log('[ok] photo-match self-test passed (ranking from attributes, category gate)');
} else if (require.main === module) {
  main().catch((err) => { console.error('[fail]', err.message); process.exit(1); });
}

module.exports = { rankByAttributes };
