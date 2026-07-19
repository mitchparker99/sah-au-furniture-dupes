#!/usr/bin/env node
// CLI intake: append a product to data/catalogue.json.
//
//   npm run add -- --role original --category sofas --brand "Coco Republic" \
//     --name "Sorrento Sofa" --price 5995 --url https://... \
//     --w 240 --d 100 --h 70 --materials "boucle,oak" --styles "curved,modular" \
//     --colour ivory [--for <original-id>] [--image https://...]
'use strict';

const { loadCatalogue, saveCatalogue, slugify, validateCatalogue, CATEGORIES } = require('../lib/catalogue');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

function productFromArgs(args, today) {
  const role = args.role;
  if (!['original', 'alternative'].includes(role)) throw new Error('--role must be original|alternative');
  if (!CATEGORIES.includes(args.category)) throw new Error(`--category must be one of ${CATEGORIES.join(', ')}`);
  const seller = role === 'original' ? args.brand : args.retailer;
  if (!seller) throw new Error(role === 'original' ? '--brand required' : '--retailer required');
  if (!args.name) throw new Error('--name required');
  const price = Number(args.price);
  if (!(price > 0)) throw new Error('--price must be a positive number');
  if (!args.url) throw new Error('--url required');
  if (role === 'alternative' && !args.for) throw new Error('--for <original-id> required for alternatives');

  const dimensions = {};
  for (const k of ['w', 'd', 'h']) if (Number(args[k]) > 0) dimensions[k] = Number(args[k]);
  const product = {
    id: slugify(`${seller} ${args.name}`),
    role,
    ...(role === 'alternative' ? { for: args.for } : {}),
    category: args.category,
    ...(role === 'original' ? { brand: seller } : { retailer: seller }),
    name: args.name,
    price_aud: price,
    price_confidence: args.checked === 'true' ? 'checked' : 'estimate',
    price_last_checked: today,
    url: args.url,
    ...(args.image ? { image_url: args.image } : {}),
    ...(Object.keys(dimensions).length ? { dimensions_cm: dimensions } : {}),
    materials: (args.materials || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    style_tags: (args.styles || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    ...(args.colour ? { colour: args.colour.toLowerCase() } : {}),
  };
  return product;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const today = new Date().toISOString().slice(0, 10);
  const product = productFromArgs(args, today);
  const catalogue = loadCatalogue();
  if (catalogue.products.some((p) => p.id === product.id)) {
    throw new Error(`id "${product.id}" already exists - edit data/catalogue.json to update it`);
  }
  const next = { updated: today, products: [...catalogue.products, product] };
  const { errors } = validateCatalogue(next);
  if (errors.length) throw new Error(`would produce invalid catalogue:\n  - ${errors.join('\n  - ')}`);
  saveCatalogue(next);
  console.log(`[ok] added ${product.role} "${product.id}" (${product.category})`);
  console.log('     next: npm run match && npm run build');
}

// ── self-test ────────────────────────────────────────────────────────────────
if (process.argv.includes('--test')) {
  const assert = require('assert');
  const p = productFromArgs({
    role: 'alternative', for: 'x', category: 'sofas', retailer: 'Kmart', name: 'Boucle Sofa',
    price: '399', url: 'https://example.com', w: '200', h: '75',
    materials: 'Boucle, Pine', styles: 'Curved,modular', colour: 'Cream', checked: 'true',
  }, '2026-07-20');
  assert.strictEqual(p.id, 'kmart-boucle-sofa');
  assert.deepStrictEqual(p.dimensions_cm, { w: 200, h: 75 });
  assert.deepStrictEqual(p.materials, ['boucle', 'pine']);
  assert.strictEqual(p.price_confidence, 'checked');
  assert.strictEqual(p.colour, 'cream');
  assert.throws(() => productFromArgs({ role: 'original', category: 'sofas' }, '2026-07-20'), /--brand required/);
  assert.throws(() => productFromArgs({ role: 'alternative', category: 'sofas', retailer: 'K', name: 'n', price: '1', url: 'u' }, '2026-07-20'), /--for/);
  assert.throws(() => productFromArgs({ role: 'original', category: 'nope' }, '2026-07-20'), /--category/);
  console.log('[ok] add-product self-test passed (parsing, normalisation, validation)');
} else if (require.main === module) {
  try { main(); } catch (err) { console.error('[fail]', err.message); process.exit(1); }
}

module.exports = { productFromArgs, parseArgs };
