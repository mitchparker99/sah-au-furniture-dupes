#!/usr/bin/env node
// Broken-link checker: probe every catalogue URL, report-only -> link-check.md.
//
// Retailers bot-block aggressively (403/429), so a block is reported as
// "blocked" (unknown), never as broken - only hard 404/410s and dead hosts
// count. Nightly CI runs this with continue-on-error; a human acts on the
// report. Never edits the catalogue.
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const fs = require('fs');
const path = require('path');
const { loadCatalogue } = require('../lib/catalogue');
const { intEnv } = require('../lib/env');
const { makeLogger } = require('../lib/logger');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function classify(status) {
  if (status >= 200 && status < 400) return 'ok';
  if ([401, 403, 405, 429, 503].includes(status)) return 'blocked';
  if ([404, 410].includes(status)) return 'broken';
  return 'blocked'; // odd statuses are inconclusive, not proof of death
}

async function probe(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA } });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': UA } });
    }
    return { status: res.status, verdict: classify(res.status) };
  } catch (err) {
    return { status: 0, verdict: 'error', note: String(err.cause && err.cause.code || err.name) };
  } finally {
    clearTimeout(timer);
  }
}

async function checkAll(products, { timeoutMs = 10000, concurrency = 5 } = {}) {
  const queue = [...products];
  const results = [];
  async function worker() {
    while (queue.length) {
      const p = queue.shift();
      const r = await probe(p.url, timeoutMs);
      results.push({ id: p.id, url: p.url, ...r });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, products.length) }, worker));
  return results;
}

async function main() {
  const log = makeLogger('link-check');
  const catalogue = loadCatalogue();
  const results = await checkAll(catalogue.products, { timeoutMs: intEnv('LINK_TIMEOUT_MS', process.env, 10000) });
  const broken = results.filter((r) => r.verdict === 'broken');
  const errors = results.filter((r) => r.verdict === 'error');
  const blocked = results.filter((r) => r.verdict === 'blocked');
  const lines = [
    '# Link check report',
    '',
    `Generated ${new Date().toISOString().slice(0, 10)} - ${results.length} URLs: ${results.length - broken.length - errors.length - blocked.length} ok, ${blocked.length} blocked (inconclusive), ${errors.length} network errors, ${broken.length} BROKEN`,
    '',
  ];
  if (broken.length + errors.length) {
    lines.push('| verdict | status | product | url |', '| --- | --- | --- | --- |');
    for (const r of [...broken, ...errors]) lines.push(`| ${r.verdict} | ${r.status || r.note} | ${r.id} | ${r.url} |`);
  } else {
    lines.push('No hard-broken links.');
  }
  fs.writeFileSync(path.join(__dirname, '..', 'link-check.md'), lines.join('\n') + '\n');
  log.info(`${broken.length} broken, ${errors.length} errors, ${blocked.length} blocked of ${results.length} -> link-check.md`);
}

// ── self-test ────────────────────────────────────────────────────────────────
if (require.main === module && process.argv.includes('--test')) {
  const assert = require('assert');
  const http = require('http');
  assert.strictEqual(classify(200), 'ok');
  assert.strictEqual(classify(301), 'ok');
  assert.strictEqual(classify(403), 'blocked');
  assert.strictEqual(classify(429), 'blocked');
  assert.strictEqual(classify(404), 'broken');
  assert.strictEqual(classify(410), 'broken');
  assert.strictEqual(classify(500), 'blocked');
  const server = http.createServer((req, res) => {
    if (req.url === '/ok') { res.writeHead(200); res.end(); }
    else if (req.url === '/gone') { res.writeHead(404); res.end(); }
    else { res.writeHead(403); res.end(); }
  });
  server.listen(0, async () => {
    const base = `http://127.0.0.1:${server.address().port}`;
    const results = await checkAll([
      { id: 'a', url: `${base}/ok` },
      { id: 'b', url: `${base}/gone` },
      { id: 'c', url: `${base}/blocked` },
      { id: 'd', url: 'http://127.0.0.1:1/dead' },
    ], { timeoutMs: 3000 });
    const byId = Object.fromEntries(results.map((r) => [r.id, r.verdict]));
    assert.strictEqual(byId.a, 'ok');
    assert.strictEqual(byId.b, 'broken');
    assert.strictEqual(byId.c, 'blocked');
    assert.strictEqual(byId.d, 'error');
    server.close();
    console.log('[ok] link-check self-test passed (classification, probe, concurrency)');
  });
} else if (require.main === module) {
  main().catch((err) => { console.error('[fail]', err.message); process.exit(1); });
}

module.exports = { classify, checkAll };
