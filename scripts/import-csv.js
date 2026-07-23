#!/usr/bin/env node
// CSV bulk import: data/inbox.csv -> catalogue. Built so a non-technical
// contributor (hi Ashley) can add finds in a spreadsheet and hand over a CSV.
//
// Header row (order-free, extra columns ignored):
//   role,category,brand,retailer,name,price,url,for,w,d,h,materials,styles,colour,checked,image
// materials/styles are comma-lists INSIDE a quoted cell: "boucle, oak".
// Rows that fail validation are reported and skipped; good rows still land.
//
//   npm run import            # reads data/inbox.csv
//   npm run import -- --file path/to.csv
'use strict';

const fs = require('fs');
const path = require('path');
const { loadCatalogue, saveCatalogue, validateCatalogue } = require('../lib/catalogue');
const { productFromArgs } = require('./add-product');

const DEFAULT_INBOX = path.join(__dirname, '..', 'data', 'inbox.csv');

// Minimal CSV parser: quoted cells, escaped quotes (""), CRLF tolerant.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

function rowsToProducts(rows, today) {
  if (!rows.length) return { products: [], errors: ['empty csv'] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const products = [];
  const errors = [];
  for (let r = 1; r < rows.length; r++) {
    const args = {};
    header.forEach((h, i) => {
      const v = (rows[r][i] || '').trim();
      if (v !== '') args[h] = v;
    });
    try {
      products.push(productFromArgs(args, today));
    } catch (err) {
      errors.push(`row ${r + 1} (${args.name || 'unnamed'}): ${err.message}`);
    }
  }
  return { products, errors };
}

function importInto(catalogue, products) {
  const seen = new Set(catalogue.products.map((p) => p.id));
  const added = [];
  const skipped = [];
  for (const p of products) {
    if (seen.has(p.id)) { skipped.push(`${p.id}: id already in catalogue`); continue; }
    seen.add(p.id);
    catalogue.products.push(p);
    added.push(p.id);
  }
  return { added, skipped };
}

function main() {
  const idx = process.argv.indexOf('--file');
  const file = idx > -1 ? process.argv[idx + 1] : DEFAULT_INBOX;
  if (!fs.existsSync(file)) {
    console.error(`[fail] ${file} not found - drop a CSV there (header: role,category,brand,retailer,name,price,url,for,w,d,h,materials,styles,colour,checked,image)`);
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  const { products, errors } = rowsToProducts(parseCsv(fs.readFileSync(file, 'utf8')), today);
  const catalogue = loadCatalogue();
  const { added, skipped } = importInto(catalogue, products);
  const { errors: postErrors } = validateCatalogue(catalogue);
  if (postErrors.length) {
    console.error('[fail] import would corrupt the catalogue - nothing written:\n  - ' + postErrors.join('\n  - '));
    process.exit(1);
  }
  catalogue.updated = today;
  saveCatalogue(catalogue);
  for (const e of errors) console.log('[warn] ' + e);
  for (const s of skipped) console.log('[warn] skipped ' + s);
  console.log(`[ok] imported ${added.length} product(s), ${errors.length} bad row(s), ${skipped.length} duplicate(s)`);
  if (added.length) console.log('     next: npm run match && npm run build');
}

// ── self-test ────────────────────────────────────────────────────────────────
if (require.main === module && process.argv.includes('--test')) {
  const assert = require('assert');
  const csv = [
    'role,category,retailer,name,price,url,for,w,h,materials,styles,colour,checked',
    'alternative,sofas,Kmart,"Boucle, Curved Sofa",399,https://example.com/a,orig-1,200,75,"boucle, pine","curved,modular",cream,true',
    'alternative,sofas,Kmart,Bad Row No Price,,https://example.com/b,orig-1,200,75,boucle,curved,cream,',
    'original,lighting,,Missing Brand Lamp,100,https://example.com/c,,,,,,,',
  ].join('\r\n');
  const { products, errors } = rowsToProducts(parseCsv(csv), '2026-07-21');
  assert.strictEqual(products.length, 1, `one valid row, got ${products.length}`);
  assert.strictEqual(products[0].id, 'kmart-boucle-curved-sofa');
  assert.strictEqual(products[0].name, 'Boucle, Curved Sofa', 'quoted comma survives');
  assert.deepStrictEqual(products[0].materials, ['boucle', 'pine']);
  assert.strictEqual(products[0].price_confidence, 'checked');
  assert.strictEqual(errors.length, 2, 'two bad rows reported');
  assert.ok(errors[0].includes('--price'), 'price error surfaced');
  const cat = { products: [{ id: 'kmart-boucle-curved-sofa' }] };
  const { added, skipped } = importInto(cat, products);
  assert.strictEqual(added.length, 0, 'duplicate id skipped');
  assert.strictEqual(skipped.length, 1);
  console.log('[ok] import-csv self-test passed (parser, validation, dupes)');
} else if (require.main === module) {
  main();
}

module.exports = { parseCsv, rowsToProducts, importInto };
