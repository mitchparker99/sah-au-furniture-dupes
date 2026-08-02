#!/usr/bin/env node
// Local self-test for the OG card Edge Function - exercises the REAL code
// path (api/og.js's default export) via plain Node's global Request/Response
// (Node 18+), with no Vercel deploy needed. Renders three cards to
// scratch/og-preview/*.png so you can eyeball them before shipping.
//
//   node scripts/test-og.mjs [--test]
// Both forms run the same checks; --test matches the repo's other suites.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const { default: handler } = await import('../api/og.js');
const { matchesFor } = await import('../api/_og-card.mjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'scratch', 'og-preview');

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

async function render(qs) {
  const res = await handler(new Request(`https://lookalikeliving.com.au/api/og${qs}`));
  const buf = Buffer.from(await res.arrayBuffer());
  return { res, buf };
}

// Regression check for a real bug caught on first Vercel deploy: lib/*.js
// files loaded by api/_og-card.mjs must not throw when merely EVALUATED in
// an environment with no `require` global (Vercel's Edge Runtime). Node's
// own module loader always injects `require` for CJS files, so a normal
// `node script.js --test` run can never reproduce this - it has to be
// simulated. `module` IS provided (as a real object) so the file's own
// `module.exports = {...}` still succeeds; only `require` is withheld.
function assertEdgeSafe(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sandbox = { module: { exports: {} }, process: { argv: [], env: {} }, console };
  sandbox.exports = sandbox.module.exports;
  vm.createContext(sandbox);
  try {
    vm.runInContext(src, sandbox, { filename: file });
  } catch (err) {
    throw new Error(`${path.basename(file)} throws when \`require\` is absent (breaks api/og.js's Edge Function import chain): ${err.message}`);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of ['similarity.js']) assertEdgeSafe(path.join(__dirname, '..', 'lib', f));

  const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'catalogue.json'), 'utf8'));
  const sample = catalogue.products.find((p) => p.role === 'original' && p.image_url && matchesFor(p, catalogue).length > 0);
  assert.ok(sample, 'fixture precondition: catalogue needs at least one original with an image and a qualifying match');

  const cases = [
    { name: 'compare', qs: `?id=${sample.id}` },
    { name: 'sitewide', qs: '' },
    { name: 'unknown-id-fallback', qs: '?id=does-not-exist' },
  ];

  const buffers = {};
  for (const c of cases) {
    const { res, buf } = await render(c.qs);
    assert.strictEqual(res.status, 200, `${c.name}: expected 200, got ${res.status}`);
    assert.match(res.headers.get('content-type') || '', /image\/png/, `${c.name}: content-type is PNG`);
    assert.ok(buf.subarray(0, 4).equals(PNG_MAGIC), `${c.name}: output starts with the PNG magic bytes`);
    assert.ok(buf.length > 5000, `${c.name}: output is a real image (${buf.length} bytes), not an empty/error stub`);
    fs.writeFileSync(path.join(OUT_DIR, `${c.name}.png`), buf);
    buffers[c.name] = buf;
  }

  // The specific-comparison render must actually differ from the generic
  // fallback - proves the ?id lookup found the product, not just that
  // *some* PNG came back.
  assert.ok(!buffers.compare.equals(buffers.sitewide), 'compare card renders different content than the site-wide fallback');
  // Two different unmatched/no-id requests SHOULD hit the identical fallback.
  assert.ok(buffers.sitewide.equals(buffers['unknown-id-fallback']), 'no-id and unknown-id both hit the same site-wide fallback');

  console.log(`[ok] og card self-test passed (3 renders, PNG verified, compare != fallback) -> ${path.relative(process.cwd(), OUT_DIR)}/`);
}

main().catch((err) => { console.error('[fail]', err.message); process.exit(1); });
