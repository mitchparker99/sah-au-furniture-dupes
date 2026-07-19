#!/usr/bin/env node
// Match engine: score every alternative against every original in the same
// category (not just its linked one — cross-matching surfaces extra finds),
// keep score >= floor AND cheaper-than-original, write data/matches.json.
//
// Optional: VISION_ENABLED=true + ANTHROPIC_API_KEY blends a Claude image-pair
// score for the top spec-matched pairs (capped by VISION_MAX_PAIRS).
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { loadCatalogue } = require('../lib/catalogue');
const { similarity, savingsPct, blendVision, bandFor, MIN_SCORE } = require('../lib/similarity');
const { boolEnv, intEnv } = require('../lib/env');
const { isPaused } = require('../lib/killswitch');
const { makeLogger } = require('../lib/logger');

const MATCHES_PATH = path.join(__dirname, '..', 'data', 'matches.json');
const TOP_N = 6;

function computeMatches(catalogue) {
  const originals = catalogue.products.filter((p) => p.role === 'original');
  const alternatives = catalogue.products.filter((p) => p.role === 'alternative');
  const out = [];
  for (const o of originals) {
    const scored = [];
    for (const a of alternatives) {
      if (a.category !== o.category) continue;
      const sim = similarity(o, a);
      if (!sim || sim.score < MIN_SCORE) continue;
      const savings = savingsPct(o, a);
      if (savings === null || savings <= 0) continue;
      scored.push({ alt_id: a.id, score: sim.score, band: sim.band, savings_pct: savings, components: sim.components });
    }
    scored.sort((x, y) => y.score - x.score);
    out.push({ original_id: o.id, matches: scored.slice(0, TOP_N) });
  }
  return out;
}

// Blend a vision score into a match, then re-apply every invariant the
// pre-blend pipeline established: the no-dims 89 cap, the band label, and
// (via the caller) the MIN_SCORE floor. Blending must never let a match
// contradict the published methodology.
function applyVisionScore(m, visionScore) {
  m.vision_score = visionScore;
  m.score = blendVision(m.score, visionScore);
  if (m.components && m.components.dimensions === null) m.score = Math.min(m.score, 89);
  m.band = bandFor(m.score);
  return m;
}

async function applyVision(catalogue, matches, log) {
  const { visionAvailable, imagePairScore } = require('../lib/vision');
  if (!boolEnv('VISION_ENABLED') || !visionAvailable()) {
    log.info('vision blend off (VISION_ENABLED unset or no ANTHROPIC_API_KEY) - spec-only scores');
    return matches;
  }
  const byId = new Map(catalogue.products.map((p) => [p.id, p]));
  let budget = intEnv('VISION_MAX_PAIRS', process.env, 25);
  for (const group of matches) {
    const orig = byId.get(group.original_id);
    if (!orig || !orig.image_url) continue;
    for (const m of group.matches) {
      if (budget <= 0) break;
      const alt = byId.get(m.alt_id);
      if (!alt || !alt.image_url) continue;
      try {
        const v = await imagePairScore(orig.image_url, alt.image_url);
        applyVisionScore(m, v.score);
        budget--;
      } catch (err) {
        log.warn(`vision pair ${group.original_id} x ${m.alt_id} failed: ${err.message}`);
      }
    }
    // Re-apply the publishable floor: a blend can drag a match under 55.
    group.matches = group.matches.filter((m) => m.score >= MIN_SCORE);
    group.matches.sort((x, y) => y.score - x.score);
  }
  return matches;
}

async function main() {
  const log = makeLogger('match');
  if (isPaused()) {
    log.warn('PAUSED - kill-switch engaged, skipping match run');
    return;
  }
  const catalogue = loadCatalogue();
  for (const w of catalogue.warnings || []) log.warn(w);
  let matches = computeMatches(catalogue);
  matches = await applyVision(catalogue, matches, log);
  fs.mkdirSync(path.dirname(MATCHES_PATH), { recursive: true });
  fs.writeFileSync(MATCHES_PATH, JSON.stringify({ generated: new Date().toISOString(), matches }, null, 2) + '\n');
  const total = matches.reduce((n, g) => n + g.matches.length, 0);
  log.info(`matched ${total} lookalikes across ${matches.length} originals -> data/matches.json`);
}

// ── self-test ────────────────────────────────────────────────────────────────
if (require.main === module && process.argv.includes('--test')) {
  const assert = require('assert');
  const { FIXTURE_CATALOGUE } = require('../lib/fixtures');
  const matches = computeMatches(FIXTURE_CATALOGUE);
  assert.strictEqual(matches.length, 2, 'one group per original');
  const sofa = matches.find((m) => m.original_id === 'studio-one-curve-sofa');
  assert.ok(sofa.matches.some((m) => m.alt_id === 'budgetco-cloudline-sofa'), 'close sofa matched');
  assert.ok(!sofa.matches.some((m) => m.alt_id === 'budgetco-metro-sofa'), 'dissimilar sofa excluded');
  assert.ok(!sofa.matches.some((m) => m.alt_id === 'lampland-dome-lamp'), 'cross-category excluded');
  const lamp = matches.find((m) => m.original_id === 'studio-one-halo-lamp');
  assert.strictEqual(lamp.matches[0].alt_id, 'lampland-dome-lamp', 'lamp matched');
  assert.ok(lamp.matches[0].savings_pct >= 85, 'lamp savings computed');
  assert.ok(sofa.matches.every((m) => m.score >= MIN_SCORE), 'floor respected');
  // Vision blending must preserve every published invariant.
  const noDims = applyVisionScore({ score: 89, band: 'Close alternative', components: { dimensions: null } }, 100);
  assert.ok(noDims.score <= 89, `no-dims cap survives vision blend, got ${noDims.score}`);
  assert.strictEqual(noDims.band, 'Close alternative', 'band re-derived after blend');
  const dragged = applyVisionScore({ score: 100, band: 'Very close match', components: { dimensions: 0.9 } }, 0);
  assert.strictEqual(dragged.score, 65, 'blend math');
  assert.strictEqual(dragged.band, 'Same style family', 'band must follow the blended score, not the spec score');
  const sunk = applyVisionScore({ score: 60, band: 'Same style family', components: { dimensions: 0.9 } }, 0);
  assert.ok(sunk.score < MIN_SCORE, 'a blend can sink below floor; caller filters it out');
  console.log('[ok] match self-test passed (grouping, exclusions, floor, savings, vision invariants)');
} else if (require.main === module) {
  main().catch((err) => { console.error('[fail]', err.message); process.exit(1); });
}

module.exports = { computeMatches, applyVisionScore, MATCHES_PATH };
