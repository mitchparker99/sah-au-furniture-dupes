// Catalogue: load, validate and normalise data/catalogue.json.
//
// Shape (flat list, linked by `for`):
//   { updated: "YYYY-MM-DD", products: [{
//       id, role: "original"|"alternative", for?: <original id>,
//       category, brand?, retailer?, name, price_aud, price_confidence,
//       price_last_checked, url, image_url?, dimensions_cm?: {w,d,h},
//       materials: [], style_tags: [], colour?
//   }] }
'use strict';

const fs = require('fs');
const path = require('path');

const CATALOGUE_PATH = path.join(__dirname, '..', 'data', 'catalogue.json');
const CATEGORIES = ['sofas', 'armchairs', 'dining', 'coffee-tables', 'bedroom', 'lighting'];

function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
}

function loadCatalogue(file = CATALOGUE_PATH) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { errors, warnings } = validateCatalogue(raw);
  if (errors.length) {
    throw new Error(`catalogue.json invalid:\n  - ${errors.join('\n  - ')}`);
  }
  return { ...raw, warnings };
}

function validateCatalogue(cat) {
  const errors = [];
  const warnings = [];
  if (!cat || !Array.isArray(cat.products)) {
    return { errors: ['missing products array'], warnings };
  }
  const ids = new Set();
  const originals = new Map();
  for (const p of cat.products) {
    const label = p.id || p.name || '(unnamed)';
    if (!p.id) errors.push(`${label}: missing id`);
    else if (ids.has(p.id)) errors.push(`${p.id}: duplicate id`);
    else ids.add(p.id);
    if (!['original', 'alternative'].includes(p.role)) errors.push(`${label}: role must be original|alternative`);
    if (!CATEGORIES.includes(p.category)) errors.push(`${label}: unknown category "${p.category}"`);
    if (!p.name) errors.push(`${label}: missing name`);
    if (!(Number(p.price_aud) > 0)) errors.push(`${label}: price_aud must be > 0`);
    if (!p.url) errors.push(`${label}: missing url`);
    if (!Array.isArray(p.materials)) errors.push(`${label}: materials must be an array`);
    if (!Array.isArray(p.style_tags)) errors.push(`${label}: style_tags must be an array`);
    if (p.role === 'original') originals.set(p.id, p);
  }
  for (const p of cat.products) {
    if (p.role !== 'alternative') continue;
    const orig = p.for && originals.get(p.for);
    if (p.for && !orig) warnings.push(`${p.id}: "for" points at unknown original "${p.for}"`);
    if (orig && Number(p.price_aud) >= Number(orig.price_aud)) {
      warnings.push(`${p.id}: not cheaper than its original ${orig.id}`);
    }
  }
  return { errors, warnings };
}

function saveCatalogue(cat, file = CATALOGUE_PATH) {
  const out = { updated: cat.updated, products: cat.products };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
}

function originalsOf(cat) { return cat.products.filter((p) => p.role === 'original'); }
function alternativesOf(cat) { return cat.products.filter((p) => p.role === 'alternative'); }

// ── self-test ────────────────────────────────────────────────────────────────
if (require.main === module && process.argv.includes('--test')) {
  const assert = require('assert');
  const good = {
    updated: '2026-07-20',
    products: [
      { id: 'a', role: 'original', category: 'sofas', name: 'A', price_aud: 100, url: 'https://x', materials: [], style_tags: [] },
      { id: 'b', role: 'alternative', for: 'a', category: 'sofas', name: 'B', price_aud: 50, url: 'https://y', materials: [], style_tags: [] },
    ],
  };
  assert.strictEqual(validateCatalogue(good).errors.length, 0, 'valid catalogue should pass');
  const dupe = { products: [good.products[0], { ...good.products[0] }] };
  assert.ok(validateCatalogue(dupe).errors.some((e) => e.includes('duplicate id')), 'duplicate ids should fail');
  const pricier = { products: [good.products[0], { ...good.products[1], price_aud: 200 }] };
  assert.ok(validateCatalogue(pricier).warnings.some((w) => w.includes('not cheaper')), 'pricier alternative should warn');
  assert.strictEqual(slugify('Coco Republic — Sofa 2.5'), 'coco-republic-sofa-25');
  const live = loadCatalogue();
  assert.ok(live.products.length >= 2, 'live catalogue should have products');
  console.log('[ok] catalogue self-test passed (validation, dupes, warnings, slugify, live load)');
}

module.exports = { CATALOGUE_PATH, CATEGORIES, slugify, loadCatalogue, validateCatalogue, saveCatalogue, originalsOf, alternativesOf };
