// Static site generator: catalogue + matches -> site/.
//
// Aesthetic: dark instrument panel — hairline borders, monospace labels,
// restrained accent, subtle staggered reveals + animated score rings. No
// emoji anywhere. Source is ASCII-only (entities for dashes/middots) so the
// pages survive being served without a charset header.
//
// Legal posture baked into every page: products are presented as visually
// similar alternatives ("lookalikes") scored on published specs — never as
// copies or replicas. Affiliate links carry rel="sponsored nofollow".
'use strict';

const fs = require('fs');
const path = require('path');
const { slugify } = require('./catalogue');
const { decorateUrl } = require('./affiliates');
const { strEnv } = require('./env');

const CATEGORY_LABELS = {
  sofas: 'Sofas', armchairs: 'Armchairs', dining: 'Dining',
  'coffee-tables': 'Coffee + Side Tables', bedroom: 'Bedroom', lighting: 'Lighting',
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    // House rule: generated HTML is ASCII-only (pages may be served without a
    // charset header). Any non-ASCII data - e.g. IKEA's "JATTEBO" with a
    // diaeresis - becomes a numeric entity instead of a mojibake risk.
    .replace(/[\u{0080}-\u{10FFFF}]/gu, (c) => '&#' + c.codePointAt(0) + ';');
}

function money(n) {
  return '$' + Number(n).toLocaleString('en-AU', { maximumFractionDigits: 0 });
}

function dims(d) {
  if (!d) return '&mdash;';
  const parts = [];
  if (d.w) parts.push(`W ${d.w}`);
  if (d.d) parts.push(`D ${d.d}`);
  if (d.h) parts.push(`H ${d.h}`);
  return parts.length ? parts.map(esc).join(' &middot; ') : '&mdash;';
}

// Dimensions with per-axis delta vs the original, e.g. "W 235 (-2%)".
function dimsWithDelta(alt, orig) {
  if (!alt) return '&mdash;';
  if (!orig) return dims(alt);
  const parts = [];
  for (const [k, label] of [['w', 'W'], ['d', 'D'], ['h', 'H']]) {
    const a = Number(alt[k]);
    if (!(a > 0)) continue;
    const o = Number(orig[k]);
    if (o > 0) {
      const pct = Math.round(((a - o) / o) * 100);
      const badge = pct === 0 ? 'exact' : `${pct > 0 ? '+' : ''}${pct}%`;
      parts.push(`${label} ${esc(String(a))} <span class="delta${pct === 0 ? ' zero' : ''}">${esc(badge)}</span>`);
    } else {
      parts.push(`${label} ${esc(String(a))}`);
    }
  }
  return parts.length ? parts.join(' &middot; ') : '&mdash;';
}

// JSON kept ASCII-safe for embedding in <script> tags.
function asciiJson(obj) {
  return JSON.stringify(obj)
    .replace(/[\u0080-\uffff]/g, (c) => '\u005cu' + c.charCodeAt(0).toString(16).padStart(4, '0'))
    .replace(/</g, '\\u003c');
}

function tagList(items) {
  return (items || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
}

const LEGAL_FOOTER = `
  <footer class="footer">
    <div class="wrap">
      <p class="footer-brand">LOOKALIKE LIVING</p>
      <p class="footer-legal">Independent comparisons based on published dimensions, materials and styling.
      Similarity scores measure resemblance of published specifications and appearance only. Every product is
      presented as a visually similar alternative &mdash; never as being made by, endorsed by, or affiliated
      with the original brand. All trademarks belong to their owners. Prices are checked periodically and may
      have changed &mdash; always confirm on the retailer's site. Some outbound links may earn us a commission
      at no cost to you.</p>
      <p class="footer-links"><a href="{ROOT}index.html">Home</a> &middot; <a href="{ROOT}methodology.html">How scoring works</a> &middot; <a href="{ROOT}privacy.html">Privacy</a> &middot; <a href="{ROOT}under-500.html">Under $500</a> &middot; <a href="{ROOT}under-1000.html">Under $1,000</a> &middot; <a href="{ROOT}under-2000.html">Under $2,000</a></p>
    </div>
  </footer>`;

const REVEAL_JS = `
  <script>
  (function () {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
    document.querySelectorAll('.ring').forEach(function (r) {
      var v = Number(r.getAttribute('data-score') || 0);
      requestAnimationFrame(function () { r.style.setProperty('--p', v); });
    });
    var chips = document.querySelectorAll('.chip');
    var search = document.getElementById('search');
    function applyFilters() {
      var on = document.querySelector('.chip.on');
      var cap = on ? Number(on.getAttribute('data-cap') || 0) : 0;
      var q = search ? search.value.trim().toLowerCase() : '';
      document.querySelectorAll('.card').forEach(function (card) {
        var p = Number(card.getAttribute('data-price') || 0);
        var hay = card.getAttribute('data-search') || '';
        var hide = (cap > 0 && p > cap) || (q && hay.indexOf(q) === -1);
        card.classList.toggle('hide', hide);
      });
      document.querySelectorAll('.cat-block').forEach(function (b) {
        b.classList.toggle('hide', !b.querySelectorAll('.card:not(.hide)').length);
      });
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
        c.classList.add('on');
        c.setAttribute('aria-pressed', 'true');
        applyFilters();
      });
    });
    if (search) search.addEventListener('input', applyFilters);
  })();
  </script>`;

function page({ title, description, canonical, body, root = '' }) {
  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <link rel="stylesheet" href="${root}style.css">
</head>
<body>
  <nav class="nav">
    <div class="wrap nav-inner">
      <a class="brand" href="${root}index.html">LOOKALIKE<span class="brand-thin">LIVING</span></a>
      <span class="nav-tag">AU designer lookalike index</span>
      <a class="nav-link" href="${root}methodology.html">Methodology</a>
    </div>
  </nav>
${body}
${LEGAL_FOOTER.replace(/\{ROOT\}/g, root)}
${REVEAL_JS}
</body>
</html>
`;
}

function scoreRing(score, band) {
  return `<div class="ring" data-score="${score}" role="img" aria-label="Similarity ${score} out of 100">
    <div class="ring-fill"></div>
    <div class="ring-core"><span class="ring-num">${score}</span><span class="ring-unit">/100</span></div>
  </div>
  <p class="band-label">${esc(band)}</p>`;
}

function buildIndex(catalogue, matchMap, env) {
  const siteName = strEnv('SITE_NAME', env, 'Lookalike Living');
  const originals = catalogue.products.filter((p) => p.role === 'original');
  const withMatches = originals.filter((o) => (matchMap[o.id] || []).length);
  const allSavings = withMatches.flatMap((o) => matchMap[o.id].map((m) => m.savings_pct));
  const avgSavings = allSavings.length ? Math.round(allSavings.reduce((a, b) => a + b, 0) / allSavings.length) : 0;
  const totalAlts = Object.values(matchMap).reduce((a, list) => a + list.length, 0);

  const sections = Object.keys(CATEGORY_LABELS).map((cat) => {
    const inCat = withMatches.filter((o) => o.category === cat);
    if (!inCat.length) return '';
    const cards = inCat.map((o) => {
      const top = matchMap[o.id][0];
      const alt = catalogue.products.find((p) => p.id === top.alt_id);
      const altsInList = matchMap[o.id]
        .map((mm) => catalogue.products.find((p) => p.id === mm.alt_id))
        .filter(Boolean);
      const haystack = [o.brand, o.name, o.category, ...(o.style_tags || []), ...(o.materials || []),
        ...altsInList.flatMap((a) => [a.retailer, a.name])].filter(Boolean).join(' ').toLowerCase();
      return `<a class="card reveal" data-price="${alt ? Number(alt.price_aud) : 0}" data-search="${esc(haystack)}" href="compare/${esc(slugify(o.id))}.html">
        <div class="card-head">
          <span class="card-brand">${esc(o.brand || '')}</span>
          <span class="card-price">${money(o.price_aud)}</span>
        </div>
        <h3 class="card-name">${esc(o.name)}</h3>
        <div class="card-match">
          <span class="match-score">${top.score}/100</span>
          <span class="match-detail">${esc(alt ? alt.retailer || '' : '')} &middot; ${money(alt ? alt.price_aud : 0)} &middot; save ${top.savings_pct}%</span>
        </div>
        <span class="card-cta">${matchMap[o.id].length} lookalike${matchMap[o.id].length === 1 ? '' : 's'} found</span>
      </a>`;
    }).join('\n');
    return `<section class="cat-block reveal" id="${esc(cat)}">
      <h2 class="cat-title"><span class="cat-index">${esc(CATEGORY_LABELS[cat])}</span></h2>
      <div class="grid">${cards}</div>
    </section>`;
  }).join('\n');

  const body = `
  <header class="hero">
    <div class="scanline"></div>
    <div class="wrap hero-inner">
      <p class="eyebrow">Australia &middot; furniture price intelligence</p>
      <h1 class="hero-h1">The designer look.<br>A fraction of the price.</h1>
      <p class="hero-sub">We index designer furniture sold in Australia and score budget pieces on how closely
      their published dimensions, materials and styling resemble them. You choose where the money goes.</p>
      <div class="stats">
        <div class="stat"><span class="stat-n">${originals.length}</span><span class="stat-l">Designer pieces tracked</span></div>
        <div class="stat"><span class="stat-n">${totalAlts}</span><span class="stat-l">Lookalikes scored</span></div>
        <div class="stat"><span class="stat-n">${avgSavings}%</span><span class="stat-l">Average saving</span></div>
      </div>
    </div>
  </header>
  <div class="chipbar reveal wrap" role="group" aria-label="Filter the index">
    <input class="search" id="search" type="search" placeholder="Search: togo, wishbone, boucle, kmart..." aria-label="Search designer pieces and lookalikes">
    <span class="chipbar-label">Top match under</span>
    <button class="chip on" data-cap="0" aria-pressed="true">Any price</button>
    <button class="chip" data-cap="500" aria-pressed="false">$500</button>
    <button class="chip" data-cap="1000" aria-pressed="false">$1,000</button>
    <button class="chip" data-cap="2000" aria-pressed="false">$2,000</button>
    <span class="chipbar-label" style="margin-left:auto"><a class="text-link" href="under-1000.html">Budget lists</a></span>
  </div>
  <main class="wrap main">
${sections}
  </main>`;

  return page({
    title: `${siteName} - Designer furniture lookalikes in Australia`,
    description: 'Compare designer furniture with visually similar budget alternatives sold in Australia, scored on published dimensions, materials and styling.',
    canonical: strEnv('SITE_URL', env) ? strEnv('SITE_URL', env) + '/' : '',
    body,
  });
}

function buildComparePage(original, matches, catalogue, env) {
  const siteName = strEnv('SITE_NAME', env, 'Lookalike Living');
  const rows = matches.map((m, i) => {
    const alt = catalogue.products.find((p) => p.id === m.alt_id);
    if (!alt) return '';
    const out = decorateUrl(alt.url, alt.retailer, env);
    return `<article class="alt-row reveal" style="transition-delay:${i * 60}ms">
      <div class="alt-score">${scoreRing(m.score, m.band)}</div>
      <div class="alt-body">
        <div class="alt-head"><span class="alt-retailer">${esc(alt.retailer || '')}</span>
        <span class="alt-conf">${alt.price_confidence === 'checked' ? 'price checked' : 'price indicative'} ${esc(alt.price_last_checked || '')}</span></div>
        <h3 class="alt-name">${esc(alt.name)}</h3>
        <dl class="spec-mini">
          <div><dt>Dimensions (cm)</dt><dd>${dimsWithDelta(alt.dimensions_cm, original.dimensions_cm)}</dd></div>
          <div><dt>Materials</dt><dd>${tagList(alt.materials)}</dd></div>
          <div><dt>Styling</dt><dd>${tagList(alt.style_tags)}</dd></div>
        </dl>
      </div>
      <div class="alt-buy">
        <span class="alt-price">${money(alt.price_aud)}</span>
        <span class="alt-save">save ${m.savings_pct}%</span>
        <a class="btn" href="${esc(out)}" rel="sponsored nofollow noopener" target="_blank">View at ${esc(alt.retailer || 'retailer')}</a>
      </div>
    </article>`;
  }).join('\n');

  const body = `
  <main class="wrap main">
    <p class="crumb reveal"><a href="../index.html">Index</a> &middot; ${esc(CATEGORY_LABELS[original.category] || original.category)}</p>
    <section class="orig-panel reveal">
      <p class="eyebrow">Designer original</p>
      <div class="orig-grid">
        <div>
          <h1 class="orig-name">${esc(original.brand ? original.brand + ' ' : '')}${esc(original.name)}</h1>
          <p class="orig-price">${money(original.price_aud)} <span class="orig-conf">${original.price_confidence === 'checked' ? 'price checked' : 'price indicative'} ${esc(original.price_last_checked || '')}</span></p>
          <a class="text-link" href="${esc(decorateUrl(original.url, original.brand, env))}" rel="nofollow noopener" target="_blank">View the original</a>
        </div>
        <dl class="spec-sheet">
          <div><dt>Dimensions (cm)</dt><dd>${dims(original.dimensions_cm)}</dd></div>
          <div><dt>Materials</dt><dd>${tagList(original.materials)}</dd></div>
          <div><dt>Styling</dt><dd>${tagList(original.style_tags)}</dd></div>
          ${original.colour ? `<div><dt>Colour</dt><dd>${tagList([original.colour])}</dd></div>` : ''}
        </dl>
      </div>
    </section>
    <section class="seo-note reveal">
      <p>${seoBlock(original, matches, catalogue)}</p>
    </section>
    <section class="alts">
      <h2 class="alts-title">${matches.length} lookalike${matches.length === 1 ? '' : 's'}, ranked by resemblance</h2>
${rows}
    </section>
  </main>
  <script type="application/ld+json">${compareJsonLd(original, matches, catalogue, env)}</script>`;

  const fullName = `${original.brand ? original.brand + ' ' : ''}${original.name}`;
  const best = matches[0];
  return page({
    title: `${fullName} dupes and lookalikes in Australia - ${siteName}`,
    description: `${matches.length} budget alternatives that resemble the ${fullName}, scored on published dimensions, materials and styling${best ? ` - save up to ${Math.max(...matches.map((m) => m.savings_pct))}%` : ''}.`,
    body,
    root: '../',
  });
}

// Deterministic SEO copy: search vernacular ("dupe") appears only as the
// quoted search term; our own claims stay lookalike/alternative.
function seoBlock(original, matches, catalogue) {
  const byId = new Map(catalogue.products.map((p) => [p.id, p]));
  const alts = matches.map((m) => byId.get(m.alt_id)).filter(Boolean);
  const retailers = [...new Set(alts.map((a) => a.retailer).filter(Boolean))];
  const minPrice = Math.min(...alts.map((a) => Number(a.price_aud)));
  const maxSave = Math.max(...matches.map((m) => m.savings_pct));
  const tags = (original.style_tags || []).slice(0, 3).join(', ');
  const fullName = `${original.brand ? original.brand + ' ' : ''}${original.name}`;
  return esc(`Searching for a ${fullName} "dupe"? We tracked ${alts.length} lookalike${alts.length === 1 ? '' : 's'} sold in Australia by ${retailers.join(', ')} that echo its ${tags} lines, from ${money(minPrice)} - up to ${maxSave}% less than the original at ${money(original.price_aud)}. Every score below measures resemblance of published dimensions, materials and styling only; none of these pieces is made or endorsed by ${original.brand || 'the original brand'}.`);
}

function compareJsonLd(original, matches, catalogue, env) {
  const byId = new Map(catalogue.products.map((p) => [p.id, p]));
  const items = matches.map((m, i) => {
    const alt = byId.get(m.alt_id);
    if (!alt) return null;
    return {
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: alt.name,
        brand: alt.retailer || undefined,
        url: decorateUrl(alt.url, alt.retailer, env),
        offers: { '@type': 'Offer', price: String(alt.price_aud), priceCurrency: 'AUD' },
      },
    };
  }).filter(Boolean);
  return asciiJson({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${original.brand ? original.brand + ' ' : ''}${original.name} lookalikes in Australia`,
    numberOfItems: items.length,
    itemListElement: items,
  });
}

function buildMethodology(env) {
  const siteName = strEnv('SITE_NAME', env, 'Lookalike Living');
  const body = `
  <main class="wrap main method">
    <h1 class="orig-name reveal">How scoring works</h1>
    <section class="method-block reveal">
      <h2>What the score measures</h2>
      <p>Every score compares a designer original with a cheaper piece using only what both retailers publish:
      dimensions (30%), materials (25%), styling descriptors (30%) and colourway (15%). When a retailer does not
      publish an attribute, the score reweights across what is available rather than guessing &mdash; but a pair
      with no comparable dimensions is capped at 89, so the top band is reserved for pieces we could actually
      measure against each other. Products in different categories are never compared.</p>
    </section>
    <section class="method-block reveal">
      <h2>Bands</h2>
      <table class="band-table">
        <tr><td class="mono">90&ndash;100</td><td>Very close match</td></tr>
        <tr><td class="mono">80&ndash;89</td><td>Close alternative</td></tr>
        <tr><td class="mono">70&ndash;79</td><td>Similar aesthetic</td></tr>
        <tr><td class="mono">55&ndash;69</td><td>Same style family</td></tr>
        <tr><td class="mono">&lt;55</td><td>Not shown</td></tr>
      </table>
    </section>
    <section class="method-block reveal">
      <h2>What the score is not</h2>
      <p>A similarity score is a measure of resemblance in published specifications and appearance. It is not a
      statement about quality, construction, provenance or authorisation, and it is never a claim that any
      product is a copy or replica of another. Designer pieces carry design, materials and craftsmanship that a
      score cannot capture &mdash; when the original is within budget, buy the original.</p>
    </section>
    <section class="method-block reveal">
      <h2>Affiliate disclosure</h2>
      <p>Some outbound links are affiliate links: if you buy after clicking, the retailer may pay us a commission
      at no cost to you. Rankings are produced by the scoring engine alone &mdash; placement is never sold inside
      the ranked results, and any sponsored slot is labelled as such.</p>
    </section>
  </main>`;
  return page({
    title: `Methodology - ${siteName}`,
    description: 'How Lookalike Living scores visual and specification resemblance between designer furniture and budget alternatives.',
    body,
  });
}

// Privacy page - affiliate networks require one before approval.
function buildPrivacy(env) {
  const siteName = strEnv('SITE_NAME', env, 'Lookalike Living');
  const contact = strEnv('CONTACT_EMAIL', env, 'mitch@sahstudios.com');
  const body = `
  <main class="wrap main method">
    <h1 class="orig-name reveal">Privacy</h1>
    <section class="method-block reveal">
      <h2>What we collect</h2>
      <p>Nothing directly. ${esc(siteName)} has no accounts, no forms and no trackers of its own. We do not set
      cookies and we run no analytics scripts on this site today; if that ever changes, this page will say so
      first.</p>
    </section>
    <section class="method-block reveal">
      <h2>Hosting</h2>
      <p>The site is served by GitHub Pages, which may log standard technical request data (IP address,
      user agent) to operate the service. See GitHub's privacy documentation for how that data is handled.</p>
    </section>
    <section class="method-block reveal">
      <h2>Outbound links</h2>
      <p>Links to retailers may be affiliate links. If you click one, the retailer or its affiliate network
      (for example Commission Factory or Impact) may set cookies on the retailer's own site to attribute the
      referral - that happens on their domain, under their privacy policy, not ours. We only ever receive
      aggregate, non-identifying commission reporting.</p>
    </section>
    <section class="method-block reveal">
      <h2>Contact</h2>
      <p>Questions or takedown requests: <a class="text-link" href="mailto:${esc(contact)}">${esc(contact)}</a>.</p>
    </section>
  </main>`;
  return page({
    title: `Privacy - ${siteName}`,
    description: 'What Lookalike Living collects (nothing directly), how hosting and affiliate links work, and how to get in touch.',
    body,
  });
}

// Budget landing pages: every published pair whose lookalike is under the cap.
function buildBudgetPage(cap, catalogue, matchMap, env) {
  const siteName = strEnv('SITE_NAME', env, 'Lookalike Living');
  const byId = new Map(catalogue.products.map((p) => [p.id, p]));
  const entries = [];
  for (const o of catalogue.products.filter((p) => p.role === 'original')) {
    for (const m of matchMap[o.id] || []) {
      const alt = byId.get(m.alt_id);
      if (alt && Number(alt.price_aud) <= cap) entries.push({ o, alt, m });
    }
  }
  entries.sort((a, b) => b.m.score - a.m.score);
  const capLabel = '$' + cap.toLocaleString('en-AU');
  const rows = entries.map(({ o, alt, m }, i) => `<a class="card reveal" style="transition-delay:${Math.min(i, 8) * 50}ms" href="compare/${esc(slugify(o.id))}.html">
      <div class="card-head"><span class="card-brand">${esc(alt.retailer || '')}</span><span class="card-price">${money(alt.price_aud)}</span></div>
      <h3 class="card-name">${esc(alt.name)}</h3>
      <div class="card-match"><span class="match-score">${m.score}/100</span>
      <span class="match-detail">echoes the ${esc(o.brand || '')} ${esc(o.name)} &middot; save ${m.savings_pct}%</span></div>
    </a>`).join('\n');
  const body = `
  <main class="wrap main">
    <p class="crumb reveal"><a href="index.html">Index</a> &middot; Budget lists</p>
    <h1 class="orig-name reveal">Designer lookalikes under ${esc(capLabel)}</h1>
    <p class="hero-sub reveal" style="margin:14px 0 34px">${entries.length} pieces sold in Australia that echo a designer original,
    every one under ${esc(capLabel)}, ranked by resemblance of published dimensions, materials and styling.</p>
    <div class="grid">
${rows}
    </div>
  </main>`;
  return page({
    title: `Designer furniture lookalikes under ${capLabel} in Australia - ${siteName}`,
    description: `${entries.length} budget pieces under ${capLabel} that resemble designer furniture, scored on published specs and sold by Australian retailers.`,
    canonical: strEnv('SITE_URL', env) ? `${strEnv('SITE_URL', env)}/under-${cap}.html` : '',
    body,
  });
}

const STYLE_CSS = `/* Lookalike Living - instrument-panel dark theme. ASCII-only source. */
:root {
  --bg: #0a0c10; --panel: #10131a; --panel-2: #141824; --line: #1e2430;
  --text: #e6e9ef; --dim: #8b93a3; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --accent: #7ee0b8; --accent-dim: #2a4a3d;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { background: var(--bg); color: var(--text); font: 16px/1.6 -apple-system, "Segoe UI", Inter, Roboto, sans-serif; }
.wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
a { color: inherit; text-decoration: none; }

.nav { border-bottom: 1px solid var(--line); position: sticky; top: 0; background: rgba(10,12,16,.86); backdrop-filter: blur(8px); z-index: 10; }
.nav-inner { display: flex; align-items: center; gap: 16px; height: 56px; }
.brand { font-family: var(--mono); font-size: 14px; letter-spacing: .18em; }
.brand-thin { color: var(--dim); }
.nav-tag { font-family: var(--mono); font-size: 11px; color: var(--dim); letter-spacing: .08em; flex: 1; text-transform: uppercase; }
.nav-link { font-size: 13px; color: var(--dim); border: 1px solid var(--line); padding: 6px 14px; border-radius: 999px; transition: border-color .2s, color .2s; }
.nav-link:hover { border-color: var(--accent); color: var(--accent); }

.hero { position: relative; border-bottom: 1px solid var(--line); overflow: hidden;
  background: radial-gradient(1200px 400px at 30% -10%, #141b2a 0%, var(--bg) 60%); }
.hero-inner { padding: 88px 24px 72px; }
.scanline { position: absolute; left: 0; right: 0; height: 1px; top: 0;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  opacity: .5; animation: scan 7s linear infinite; }
@keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
.eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: .22em; text-transform: uppercase; color: var(--accent); margin-bottom: 18px; }
.hero-h1 { font-size: clamp(34px, 5.5vw, 58px); line-height: 1.08; font-weight: 650; letter-spacing: -.01em; }
.hero-sub { color: var(--dim); max-width: 620px; margin-top: 18px; }
.stats { display: flex; gap: 12px; margin-top: 36px; flex-wrap: wrap; }
.stat { border: 1px solid var(--line); background: var(--panel); padding: 14px 22px; border-radius: 10px; min-width: 150px; }
.stat-n { display: block; font-family: var(--mono); font-size: 26px; color: var(--accent); }
.stat-l { font-size: 12px; color: var(--dim); letter-spacing: .04em; }

.main { padding: 48px 24px 72px; }
.cat-block { margin-bottom: 48px; }
.cat-title { font-family: var(--mono); font-size: 13px; letter-spacing: .2em; text-transform: uppercase; color: var(--dim);
  border-bottom: 1px solid var(--line); padding-bottom: 10px; margin-bottom: 20px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.card { border: 1px solid var(--line); background: var(--panel); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 10px;
  transition: transform .25s, border-color .25s; }
.card:hover { transform: translateY(-3px); border-color: var(--accent-dim); }
.card-head { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 12px; color: var(--dim); }
.card-price { color: var(--text); }
.card-name { font-size: 18px; font-weight: 600; line-height: 1.3; }
.card-match { display: flex; align-items: baseline; gap: 10px; border-top: 1px solid var(--line); padding-top: 12px; }
.match-score { font-family: var(--mono); color: var(--accent); font-size: 15px; }
.match-detail { font-size: 13px; color: var(--dim); }
.card-cta { font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--dim); }

.crumb { font-family: var(--mono); font-size: 12px; color: var(--dim); margin-bottom: 20px; }
.crumb a:hover { color: var(--accent); }
.orig-panel { border: 1px solid var(--line); background: linear-gradient(180deg, var(--panel-2), var(--panel)); border-radius: 14px; padding: 32px; margin-bottom: 40px; }
.orig-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 32px; }
.orig-name { font-size: clamp(24px, 3.4vw, 34px); line-height: 1.15; font-weight: 650; }
.orig-price { font-family: var(--mono); font-size: 22px; margin-top: 12px; }
.orig-conf { font-size: 11px; color: var(--dim); margin-left: 10px; letter-spacing: .06em; }
.text-link { display: inline-block; margin-top: 16px; font-size: 13px; color: var(--dim); border-bottom: 1px solid var(--line); transition: color .2s; }
.text-link:hover { color: var(--accent); }
.spec-sheet div, .spec-mini div { display: grid; grid-template-columns: 130px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); }
dt { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--dim); padding-top: 3px; }
dd { font-size: 14px; }
.tag { display: inline-block; border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; font-size: 12px; color: var(--dim); margin: 2px 4px 2px 0; }

.alts-title { font-size: 20px; font-weight: 600; margin-bottom: 20px; }
.alt-row { display: grid; grid-template-columns: 130px 1fr 180px; gap: 24px; border: 1px solid var(--line); background: var(--panel);
  border-radius: 12px; padding: 24px; margin-bottom: 14px; align-items: center; }
.alt-head { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 11px; color: var(--dim); letter-spacing: .08em; text-transform: uppercase; }
.alt-name { font-size: 17px; font-weight: 600; margin: 6px 0 10px; }
.alt-buy { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.alt-price { font-family: var(--mono); font-size: 22px; }
.alt-save { font-family: var(--mono); font-size: 12px; color: var(--accent); letter-spacing: .08em; }
.btn { border: 1px solid var(--accent-dim); color: var(--accent); font-size: 13px; padding: 9px 18px; border-radius: 8px;
  font-family: var(--mono); letter-spacing: .04em; transition: background .2s, border-color .2s; white-space: nowrap; }
.btn:hover { background: var(--accent-dim); border-color: var(--accent); }

.ring { --p: 0; width: 92px; height: 92px; position: relative; margin: 0 auto; }
.ring-fill { position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--line) 0);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
  transition: background 1.1s cubic-bezier(.22,1,.36,1); }
.ring-core { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-num { font-family: var(--mono); font-size: 24px; color: var(--text); }
.ring-unit { font-family: var(--mono); font-size: 10px; color: var(--dim); }
.band-label { text-align: center; font-family: var(--mono); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); margin-top: 10px; }

.method h2 { font-size: 17px; margin-bottom: 10px; }
.method-block { border: 1px solid var(--line); background: var(--panel); border-radius: 12px; padding: 24px; margin: 16px 0; color: var(--dim); }
.method-block p { font-size: 14px; }
.band-table { width: 100%; border-collapse: collapse; }
.band-table td { border-bottom: 1px solid var(--line); padding: 8px 4px; font-size: 14px; }
.mono { font-family: var(--mono); color: var(--accent); }

.footer { border-top: 1px solid var(--line); padding: 40px 0 56px; margin-top: 40px; }
.footer-brand { font-family: var(--mono); font-size: 12px; letter-spacing: .2em; color: var(--dim); margin-bottom: 14px; }
.footer-legal { font-size: 12px; color: var(--dim); max-width: 760px; line-height: 1.7; }
.footer-links { margin-top: 14px; font-size: 13px; }
.footer-links a { color: var(--dim); border-bottom: 1px solid var(--line); }
.footer-links a:hover { color: var(--accent); }

.delta { font-family: var(--mono); font-size: 10px; color: var(--dim); letter-spacing: .04em; border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; margin-left: 2px; }
.delta.zero { color: var(--accent); border-color: var(--accent-dim); }
.seo-note { border-left: 2px solid var(--accent-dim); padding: 4px 0 4px 18px; margin-bottom: 36px; }
.seo-note p { font-size: 13px; color: var(--dim); max-width: 760px; line-height: 1.7; }

.chipbar { display: flex; align-items: center; gap: 10px; padding: 26px 24px 0; flex-wrap: wrap; }
.search { background: var(--panel); border: 1px solid var(--line); border-radius: 999px; color: var(--text);
  font: inherit; font-size: 13px; padding: 8px 18px; width: 100%; max-width: 340px; outline: none; transition: border-color .2s; }
.search:focus { border-color: var(--accent); }
.search::placeholder { color: var(--dim); }
.chipbar-label { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }
.chip { background: none; cursor: pointer; font: inherit; font-size: 13px; color: var(--dim); border: 1px solid var(--line); padding: 6px 14px; border-radius: 999px; transition: border-color .2s, color .2s; }
.chip:hover { border-color: var(--accent); color: var(--accent); }
.chip.on { border-color: var(--accent); color: var(--accent); }
.hide { display: none !important; }

.reveal { opacity: 0; transform: translateY(14px); transition: opacity .6s ease, transform .6s ease; }
.reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } .scanline { animation: none; } }
@media (max-width: 800px) {
  .orig-grid { grid-template-columns: 1fr; }
  .alt-row { grid-template-columns: 1fr; }
  .alt-buy { align-items: flex-start; }
  .nav-tag { display: none; }
}
`;

function buildSite(catalogue, matches, outDir, env = process.env) {
  const matchMap = {};
  for (const m of matches) matchMap[m.original_id] = m.matches;

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'compare'), { recursive: true });

  fs.writeFileSync(path.join(outDir, 'style.css'), STYLE_CSS);
  fs.writeFileSync(path.join(outDir, 'index.html'), buildIndex(catalogue, matchMap, env));
  fs.writeFileSync(path.join(outDir, 'methodology.html'), buildMethodology(env));
  fs.writeFileSync(path.join(outDir, 'privacy.html'), buildPrivacy(env));
  const BUDGET_CAPS = [500, 1000, 2000];
  for (const cap of BUDGET_CAPS) {
    fs.writeFileSync(path.join(outDir, `under-${cap}.html`), buildBudgetPage(cap, catalogue, matchMap, env));
  }

  const pages = [];
  for (const o of catalogue.products.filter((p) => p.role === 'original')) {
    const list = matchMap[o.id] || [];
    if (!list.length) continue;
    const file = path.join(outDir, 'compare', `${slugify(o.id)}.html`);
    fs.writeFileSync(file, buildComparePage(o, list, catalogue, env));
    pages.push(file);
  }

  const siteUrl = strEnv('SITE_URL', env);
  fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`);
  if (siteUrl) {
    const urls = ['', 'methodology.html', 'privacy.html', 'under-500.html', 'under-1000.html', 'under-2000.html', ...pages.map((p) => 'compare/' + path.basename(p))];
    fs.writeFileSync(path.join(outDir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${siteUrl}/${u}</loc></url>`).join('\n') + '\n</urlset>\n');
  }
  // GitHub Pages serves 404.html at ANY missing path depth, so relative
  // links/styles would break under /compare/. Inline the CSS, and when the
  // site URL is known make every nav/footer link absolute via root.
  const notFoundRoot = siteUrl ? siteUrl + '/' : '';
  fs.writeFileSync(path.join(outDir, '404.html'), page({
    title: 'Not found', description: 'Page not found', root: notFoundRoot,
    body: `<main class="wrap main"><h1 class="orig-name">404 &mdash; not found</h1><p class="hero-sub" style="margin-top:12px"><a class="text-link" href="${esc(notFoundRoot)}index.html">Back to the index</a></p></main>`,
  }).replace(`<link rel="stylesheet" href="${notFoundRoot}style.css">`, `<style>${STYLE_CSS}</style>`));

  return { pages: pages.length + 3 + 1 + BUDGET_CAPS.length };
}

module.exports = { buildSite, buildIndex, buildComparePage, buildMethodology, buildPrivacy, buildBudgetPage, page, esc, money, STYLE_CSS, CATEGORY_LABELS };
