// Similarity engine: spec-based resemblance score between two products.
//
// Scores only what BOTH products publish (dimensions, materials, style tags,
// colour), reweighting across the attribute groups that are available, so a
// missing depth measurement never silently drags a score down. Products in
// different categories never match. The score measures resemblance of
// published specifications and styling only — it is never a claim that one
// product is a copy of another (see site methodology page).
'use strict';

const WEIGHTS = { dimensions: 30, materials: 25, style: 30, colour: 15 };

// Bands: label + floor. Anything under 55 is not shown on the site.
const BANDS = [
  { min: 90, label: 'Very close match' },
  { min: 80, label: 'Close alternative' },
  { min: 70, label: 'Similar aesthetic' },
  { min: 55, label: 'Same style family' },
];
const MIN_SCORE = 55;

const MATERIAL_SYNONYMS = {
  'boucle': 'boucle', 'boucle fabric': 'boucle', 'teddy': 'boucle', 'sherpa': 'boucle',
  'timber': 'wood', 'hardwood': 'wood', 'solid wood': 'wood',
};
// Family tokens: retailers describe the same material differently ("abs
// plastic" vs "plastic", "linen" vs "polyester upholstery"), so members of a
// family also contribute a shared family token to the overlap.
const MATERIAL_FAMILIES = {
  wood: ['oak', 'walnut', 'ash', 'teak', 'acacia', 'mango wood', 'rubberwood', 'pine', 'elm', 'beech', 'birch', 'wood', 'timber', 'veneer', 'plywood'],
  fabric: ['linen', 'cotton', 'polyester', 'velvet', 'wool', 'fabric', 'boucle', 'upholstery', 'sherpa fabric'],
  plastic: ['abs', 'abs plastic', 'polypropylene', 'polycarbonate', 'plastic', 'resin', 'acrylic'],
  stone: ['travertine', 'marble', 'granite', 'stone', 'terrazzo', 'concrete'],
  metal: ['steel', 'stainless steel', 'iron', 'brass', 'chrome', 'aluminium', 'aluminum', 'metal'],
};
const COLOUR_FAMILIES = {
  light: ['white', 'ivory', 'cream', 'beige', 'oat', 'oatmeal', 'natural', 'linen', 'off-white', 'sand', 'bone', 'ecru', 'snow'],
  dark: ['black', 'charcoal', 'ebony', 'onyx', 'ink'],
  grey: ['grey', 'gray', 'silver', 'smoke', 'slate'],
  timber: ['oak', 'walnut', 'tan', 'brown', 'chestnut', 'caramel', 'honey', 'natural oak', 'chocolate'],
  green: ['green', 'sage', 'olive', 'forest'],
  blue: ['blue', 'navy', 'denim', 'sky'],
  warm: ['terracotta', 'rust', 'orange', 'clay', 'brick'],
  pink: ['pink', 'blush', 'rose'],
  yellow: ['yellow', 'mustard', 'ochre'],
};

function normaliseToken(t) {
  const s = String(t).toLowerCase().trim();
  return MATERIAL_SYNONYMS[s] || s;
}

function materialSet(materials) {
  const set = new Set();
  for (const m of materials || []) {
    const t = normaliseToken(m);
    set.add(t);
    for (const [family, members] of Object.entries(MATERIAL_FAMILIES)) {
      if (members.includes(t)) set.add(family); // oak ~ walnut, abs plastic ~ plastic
    }
  }
  return set;
}

function overlapCoefficient(a, b) {
  if (!a.size || !b.size) return null;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits++;
  return hits / Math.min(a.size, b.size);
}

// Per-axis: full credit at identical, zero credit at >=25% off.
function dimensionScore(da, db) {
  if (!da || !db) return null;
  const axes = ['w', 'd', 'h'].filter((k) => Number(da[k]) > 0 && Number(db[k]) > 0);
  if (!axes.length) return null;
  let total = 0;
  for (const k of axes) {
    const a = Number(da[k]);
    const b = Number(db[k]);
    const diff = Math.abs(a - b) / Math.max(a, b);
    total += Math.max(0, 1 - diff / 0.25);
  }
  return total / axes.length;
}

function colourFamily(c) {
  const t = normaliseToken(c || '');
  if (!t) return null;
  for (const [fam, members] of Object.entries(COLOUR_FAMILIES)) {
    if (members.includes(t)) return fam;
  }
  return t; // unknown colours are their own family
}

function colourScore(a, b) {
  const ta = normaliseToken(a || '');
  const tb = normaliseToken(b || '');
  if (!ta || !tb) return null;
  if (ta === tb) return 1;
  return colourFamily(ta) === colourFamily(tb) ? 0.7 : 0;
}

function styleScore(a, b) {
  return overlapCoefficient(new Set((a || []).map(normaliseToken)), new Set((b || []).map(normaliseToken)));
}

// Returns { score, band, components } or null when there isn't enough shared
// data to compare honestly (needs style tags on both, plus dims or materials).
function similarity(original, candidate) {
  if (!original || !candidate || original.category !== candidate.category) return null;
  const components = {
    dimensions: dimensionScore(original.dimensions_cm, candidate.dimensions_cm),
    materials: overlapCoefficient(materialSet(original.materials), materialSet(candidate.materials)),
    style: styleScore(original.style_tags, candidate.style_tags),
    colour: colourScore(original.colour, candidate.colour),
  };
  if (components.style === null) return null;
  if (components.dimensions === null && components.materials === null) return null;
  let earned = 0;
  let available = 0;
  for (const [group, weight] of Object.entries(WEIGHTS)) {
    if (components[group] === null) continue;
    earned += components[group] * weight;
    available += weight;
  }
  const score = Math.round((earned / available) * 100);
  return { score, band: bandFor(score), components };
}

function bandFor(score) {
  for (const b of BANDS) if (score >= b.min) return b.label;
  return null; // below the publishable floor
}

function savingsPct(original, candidate) {
  const o = Number(original.price_aud);
  const c = Number(candidate.price_aud);
  if (!(o > 0) || !(c > 0)) return null;
  return Math.round(((o - c) / o) * 100);
}

// Blend an optional vision (image-pair) score into the spec score.
function blendVision(specScore, visionScore) {
  if (!Number.isFinite(visionScore)) return specScore;
  return Math.round(0.65 * specScore + 0.35 * visionScore);
}

// ── self-test ────────────────────────────────────────────────────────────────
if (require.main === module && process.argv.includes('--test')) {
  const assert = require('assert');
  const orig = {
    category: 'sofas', price_aud: 5995, colour: 'ivory',
    dimensions_cm: { w: 240, d: 100, h: 70 },
    materials: ['boucle', 'oak'],
    style_tags: ['curved', 'modular', 'low-profile'],
  };
  const close = {
    category: 'sofas', price_aud: 1799, colour: 'cream',
    dimensions_cm: { w: 235, d: 98, h: 72 },
    materials: ['boucle', 'pine'],
    style_tags: ['curved', 'modular'],
  };
  const far = {
    category: 'sofas', price_aud: 999, colour: 'black',
    dimensions_cm: { w: 150, d: 70, h: 90 },
    materials: ['leather', 'steel'],
    style_tags: ['mid-century', 'slim-arm'],
  };
  const r1 = similarity(orig, close);
  assert.ok(r1 && r1.score >= 80, `close pair should score >=80, got ${r1 && r1.score}`);
  assert.ok(['Very close match', 'Close alternative'].includes(r1.band), `close pair band, got ${r1 && r1.band}`);
  const r2 = similarity(orig, far);
  assert.ok(!r2 || r2.score < MIN_SCORE, `far pair should be under floor, got ${r2 && r2.score}`);
  assert.strictEqual(similarity(orig, { ...close, category: 'lighting' }), null, 'category mismatch must not match');
  assert.strictEqual(similarity(orig, { ...close, style_tags: [] }), null, 'no style tags -> insufficient data');
  const noDims = similarity(orig, { ...close, dimensions_cm: undefined });
  assert.ok(noDims && noDims.score > 0, 'missing dims should reweight, not zero');
  assert.strictEqual(savingsPct(orig, close), 70, 'savings pct');
  assert.strictEqual(blendVision(80, 100), 87, 'vision blend');
  assert.strictEqual(blendVision(80, undefined), 80, 'vision blend no-op without vision score');
  assert.strictEqual(colourScore('ivory', 'cream'), 0.7, 'colour family match');
  console.log('[ok] similarity self-test passed (close/far pairs, gates, reweighting, savings, blend)');
}

module.exports = { WEIGHTS, BANDS, MIN_SCORE, similarity, bandFor, savingsPct, blendVision };
