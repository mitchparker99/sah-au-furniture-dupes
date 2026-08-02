// Shared OG share-card logic: builds a Satori-compatible element tree from
// live catalogue data. Used by api/og.js (the Vercel Edge Function) and by
// scripts/test-og.mjs (a plain-Node local test harness) - both call the SAME
// functions here, so what you test locally is exactly what deploys.
//
// No JSX: Satori/ImageResponse accept a plain object tree, so `h()` builds
// one directly and this file needs no build/transpile step, in Node or Edge.
//
// Scoring reuses lib/similarity.js's exact similarity()/savingsPct()/MIN_SCORE
// (a CommonJS module, imported here via its default export) so a card's
// headline score can never drift from the real match engine's output - both
// call the identical pure functions, just at different times.
import similarityModule from '../lib/similarity.js';
const { similarity, savingsPct, MIN_SCORE } = similarityModule;

// Catalogue + fonts as plain imports, not `fetch(new URL('./x', import.meta.url))`.
// That relative-asset-fetch pattern is a Next.js build-time convenience, not
// a bare-Vercel-Edge-Function guarantee - it 500'd with "Invalid URL string"
// on the very first real deploy of this project (no framework, so nothing
// rewrote it). A plain import is bundled deterministically by any bundler.
// Catalogue data is therefore frozen as of the last deploy (same staleness
// cadence as the GitHub Pages build - both only refresh on a new build).
import catalogueData from '../data/catalogue.json' with { type: 'json' };
import fontRegularB64 from './fonts/space-mono-regular.mjs';
import fontBoldB64 from './fonts/space-mono-bold.mjs';

const CATEGORY_LABELS = {
  sofas: 'Sofas', armchairs: 'Armchairs', dining: 'Dining',
  'coffee-tables': 'Coffee + Side Tables', bedroom: 'Bedroom', lighting: 'Lighting',
};

const COLORS = {
  bg: '#0a0c10', panel: '#10131a', line: '#1e2430',
  text: '#e6e9ef', dim: '#8b93a3', accent: '#7ee0b8', accentDim: '#2a4a3d',
};

const WIDTH = 1200;
const HEIGHT = 630;
const TOP_N = 6;

// Satori has no implicit block layout - every element needs an explicit
// `display` or it can throw on multi-child nodes. Default every element to
// flex so individual calls below don't have to remember it every time.
function h(type, props, ...children) {
  const flat = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  const style = { display: 'flex', ...(props.style || {}) };
  return { type, props: { ...props, style, children: flat.length === 1 ? flat[0] : flat } };
}

function truncate(str, max) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max - 3).trimEnd() + '...' : s;
}

function money(n) {
  return '$' + Number(n).toLocaleString('en-AU', { maximumFractionDigits: 0 });
}

export function loadCatalogue() {
  return catalogueData;
}

// Mirrors scripts/match.js's core filter (score >= floor, genuinely cheaper)
// but scoped to ONE original, computed live - no dependency on the gitignored
// build-time matches.json.
export function matchesFor(original, catalogue) {
  const out = [];
  for (const p of catalogue.products) {
    if (p.role !== 'alternative' || p.category !== original.category) continue;
    const sim = similarity(original, p);
    if (!sim || sim.score < MIN_SCORE) continue;
    const savings = savingsPct(original, p);
    if (savings === null || savings <= 0) continue;
    out.push({ alt: p, score: sim.score, band: sim.band, savings });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, TOP_N);
}

function frame(...children) {
  return h('div', {
    style: {
      width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column',
      backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: 'Space Mono',
      padding: '52px 64px', position: 'relative',
    },
  },
    h('div', { style: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: COLORS.accent } }),
    h('div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: { display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 2 } },
        h('span', { style: { color: COLORS.text } }, 'LOOKALIKE'),
        h('span', { style: { color: COLORS.dim } }, 'LIVING'),
      ),
      h('div', { style: { fontSize: 13, color: COLORS.dim, letterSpacing: 3, textTransform: 'uppercase' } }, 'AU Designer Lookalike Index'),
    ),
    ...children,
  );
}

function footer(leftText) {
  return h('div', {
    style: {
      display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 'auto', paddingTop: 26, borderTop: `1px solid ${COLORS.line}`, fontSize: 14, color: COLORS.dim,
    },
  },
    h('div', { style: { display: 'flex', maxWidth: 780 } }, leftText),
    h('div', { style: { display: 'flex' } }, 'lookalikeliving.com.au'),
  );
}

function scoreRing(score, band) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 210 } },
    h('div', {
      style: {
        width: 150, height: 150, borderRadius: '50%', border: `9px solid ${COLORS.accent}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      },
    },
      h('span', { style: { fontSize: 44, fontWeight: 700 } }, String(score)),
      h('span', { style: { fontSize: 14, color: COLORS.dim } }, '/100'),
    ),
    h('div', { style: { display: 'flex', fontSize: 13, color: COLORS.accent, letterSpacing: 2, textTransform: 'uppercase', marginTop: 16, textAlign: 'center' } }, band),
  );
}

// The card for one comparison: original vs its single best-scoring lookalike.
export function buildOriginalCard(original, catalogue) {
  const matches = matchesFor(original, catalogue);
  if (!matches.length) return null;
  const top = matches[0];
  const origName = truncate(`${original.brand ? original.brand + ' ' : ''}${original.name}`, 46);
  const altName = truncate(`${top.alt.name}`, 46);

  const tree = frame(
    h('div', { style: { display: 'flex', fontSize: 14, color: COLORS.accent, letterSpacing: 3, textTransform: 'uppercase', marginTop: 40 } },
      CATEGORY_LABELS[original.category] || original.category),
    h('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', flex: 1, marginTop: 18, gap: 30 } },
      h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
        h('div', { style: { display: 'flex', fontSize: 13, color: COLORS.dim, letterSpacing: 2, textTransform: 'uppercase' } }, 'Designer original'),
        h('div', { style: { display: 'flex', fontSize: 32, fontWeight: 700, marginTop: 10, lineHeight: 1.2 } }, origName),
        h('div', { style: { display: 'flex', fontSize: 24, marginTop: 14 } }, money(original.price_aud)),
      ),
      scoreRing(top.score, top.band),
      h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'flex-end', textAlign: 'right' } },
        h('div', { style: { display: 'flex', fontSize: 13, color: COLORS.dim, letterSpacing: 2, textTransform: 'uppercase' } }, 'Lookalike'),
        h('div', { style: { display: 'flex', fontSize: 32, fontWeight: 700, marginTop: 10, lineHeight: 1.2, textAlign: 'right' } }, altName),
        h('div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'baseline', marginTop: 14, gap: 12 } },
          h('span', { style: { fontSize: 24 } }, money(top.alt.price_aud)),
          h('span', { style: { fontSize: 18, color: COLORS.accent } }, `save ${top.savings}%`),
        ),
      ),
    ),
    footer('Similarity measures resemblance of published specs only - not a claim of being a copy.'),
  );
  return tree;
}

// The generic site-wide card (index, methodology, privacy pages).
export function buildSiteWideCard(catalogue) {
  const originals = catalogue.products.filter((p) => p.role === 'original');
  const allMatches = originals.flatMap((o) => matchesFor(o, catalogue));
  const avgSaving = allMatches.length
    ? Math.round(allMatches.reduce((a, m) => a + m.savings, 0) / allMatches.length) : 0;

  return frame(
    h('div', { style: { display: 'flex', flexDirection: 'column', marginTop: 48 } },
      h('div', { style: { display: 'flex', fontSize: 48, fontWeight: 700, lineHeight: 1.15 } }, 'The designer look.'),
      h('div', { style: { display: 'flex', fontSize: 48, fontWeight: 700, lineHeight: 1.15 } }, 'A fraction of the price.'),
    ),
    h('div', { style: { display: 'flex', flexDirection: 'row', gap: 16, marginTop: 44 } },
      [[String(originals.length), 'Designer pieces tracked'], [String(allMatches.length), 'Lookalikes scored'], [`${avgSaving}%`, 'Average saving']]
        .map(([n, label]) => h('div', {
          style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '18px 26px', border: `1px solid ${COLORS.line}`, borderRadius: 10, backgroundColor: COLORS.panel },
        },
          h('span', { style: { fontSize: 32, fontWeight: 700, color: COLORS.accent } }, n),
          h('span', { style: { fontSize: 13, color: COLORS.dim, letterSpacing: 1, textTransform: 'uppercase' } }, label),
        )),
    ),
    footer('Compare designer furniture with visually similar Australian alternatives, scored on published specs.'),
  );
}

// atob(), not Buffer - guaranteed present in both Node 18+ and a genuine
// Edge/browser-like runtime, unlike Node's Buffer global.
function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function loadFonts() {
  return [
    { name: 'Space Mono', data: base64ToArrayBuffer(fontRegularB64), weight: 400, style: 'normal' },
    { name: 'Space Mono', data: base64ToArrayBuffer(fontBoldB64), weight: 700, style: 'normal' },
  ];
}

export const IMAGE_RESPONSE_OPTS = { width: WIDTH, height: HEIGHT };
