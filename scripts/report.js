#!/usr/bin/env node
// Catalogue digest: coverage + savings stats -> report.md and stdout.
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { loadCatalogue, CATEGORIES } = require('../lib/catalogue');
const { computeMatches } = require('./match');
const { makeLogger } = require('../lib/logger');

function digest(catalogue, matches) {
  const originals = catalogue.products.filter((p) => p.role === 'original');
  const alternatives = catalogue.products.filter((p) => p.role === 'alternative');
  const flat = matches.flatMap((g) => g.matches.map((m) => ({ ...m, original_id: g.original_id })));
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const best = flat.slice().sort((a, b) => b.savings_pct - a.savings_pct)[0] || null;
  const perCategory = CATEGORIES.map((c) => ({
    category: c,
    originals: originals.filter((p) => p.category === c).length,
    alternatives: alternatives.filter((p) => p.category === c).length,
  }));
  return {
    originals: originals.length,
    alternatives: alternatives.length,
    matched_pairs: flat.length,
    originals_with_matches: matches.filter((g) => g.matches.length).length,
    avg_score: avg(flat.map((m) => m.score)),
    avg_savings_pct: avg(flat.map((m) => m.savings_pct)),
    best_savings: best,
    per_category: perCategory,
  };
}

function main() {
  const log = makeLogger('report');
  const catalogue = loadCatalogue();
  const d = digest(catalogue, computeMatches(catalogue));
  const lines = [
    '# Catalogue digest',
    '',
    `Generated ${new Date().toISOString().slice(0, 10)}`,
    '',
    `- Originals tracked: ${d.originals} (${d.originals_with_matches} with published matches)`,
    `- Alternatives indexed: ${d.alternatives}`,
    `- Matched pairs on site: ${d.matched_pairs}`,
    `- Average similarity: ${d.avg_score}/100 - average saving: ${d.avg_savings_pct}%`,
    d.best_savings ? `- Best saving: ${d.best_savings.savings_pct}% (${d.best_savings.original_id} -> ${d.best_savings.alt_id})` : '- Best saving: n/a',
    '',
    '| category | originals | alternatives |',
    '| --- | --- | --- |',
    ...d.per_category.map((c) => `| ${c.category} | ${c.originals} | ${c.alternatives} |`),
  ];
  fs.writeFileSync(path.join(__dirname, '..', 'report.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  log.info('digest -> report.md');
}

// ── self-test ────────────────────────────────────────────────────────────────
if (process.argv.includes('--test')) {
  const assert = require('assert');
  const { FIXTURE_CATALOGUE } = require('../lib/fixtures');
  const d = digest(FIXTURE_CATALOGUE, computeMatches(FIXTURE_CATALOGUE));
  assert.strictEqual(d.originals, 2);
  assert.strictEqual(d.alternatives, 3);
  assert.ok(d.matched_pairs >= 2, 'pairs matched');
  assert.ok(d.avg_savings_pct > 0, 'savings averaged');
  assert.ok(d.per_category.find((c) => c.category === 'sofas').originals === 1, 'per-category counts');
  console.log('[ok] report self-test passed (digest stats)');
} else if (require.main === module) {
  main();
}

module.exports = { digest };
