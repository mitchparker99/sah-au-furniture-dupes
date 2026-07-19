// Outbound link decoration. With no affiliate IDs configured, links get clean
// UTM tags only — the site works day one and upgrades in place once networks
// approve. All outbound links are rendered rel="sponsored nofollow noopener".
'use strict';

const { strEnv } = require('./env');

// Which network each retailer sits on (operator fills IDs in .env as
// approvals land; unknown retailers just get UTM tags).
const RETAILER_NETWORKS = {
  'temple & webster': 'cf',
  'castlery': 'impact',
  'west elm': 'impact',
  'freedom': 'cf',
  'adairs': 'cf',
  'mocka': 'cf',
  'interior secrets': 'cf',
  'luxo living': 'cf',
  'life interiors': 'cf',
};

function decorateUrl(url, retailer, env = process.env) {
  let u;
  try {
    u = new URL(url);
  } catch (_) {
    return url; // never break the site over a malformed URL
  }
  const utmSource = strEnv('UTM_SOURCE', env, 'lookalikeliving');
  if (!u.searchParams.has('utm_source')) {
    u.searchParams.set('utm_source', utmSource);
    u.searchParams.set('utm_medium', 'comparison');
  }
  const network = RETAILER_NETWORKS[String(retailer || '').toLowerCase().trim()];
  const cfId = strEnv('AFFILIATE_CF_ID', env);
  const impactId = strEnv('AFFILIATE_IMPACT_ID', env);
  if (network === 'cf' && cfId) u.searchParams.set('cfclick', cfId);
  if (network === 'impact' && impactId) u.searchParams.set('irclickid', impactId);
  return u.toString();
}

// ── self-test ────────────────────────────────────────────────────────────────
if (require.main === module && process.argv.includes('--test')) {
  const assert = require('assert');
  const bare = decorateUrl('https://www.templeandwebster.com.au/p/sofa', 'Temple & Webster', {});
  assert.ok(bare.includes('utm_source=lookalikeliving'), 'utm applied with no env');
  assert.ok(!bare.includes('cfclick'), 'no affiliate param without an ID');
  const withId = decorateUrl('https://www.templeandwebster.com.au/p/sofa', 'Temple & Webster', { AFFILIATE_CF_ID: 'abc123' });
  assert.ok(withId.includes('cfclick=abc123'), 'cf id applied');
  const blankId = decorateUrl('https://www.castlery.com/au/p/sofa', 'Castlery', { AFFILIATE_IMPACT_ID: '   ' });
  assert.ok(!blankId.includes('irclickid'), 'blank secret treated as unset');
  assert.strictEqual(decorateUrl('not a url', 'Kmart', {}), 'not a url', 'malformed url passes through');
  console.log('[ok] affiliates self-test passed (utm, ids, blank-secret, malformed url)');
}

module.exports = { decorateUrl, RETAILER_NETWORKS };
