// Optional Claude helpers: image-pair similarity + photo attribute extraction.
// Both are OFF unless ANTHROPIC_API_KEY is set; the pipeline never depends on
// them. Uses native fetch (node >= 18), no SDK dependency.
'use strict';

const { strEnv, isBlank } = require('./env');

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function visionAvailable(env = process.env) {
  return !isBlank(env.ANTHROPIC_API_KEY);
}

async function callClaude(content, env = process.env, maxTokens = 500) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': strEnv('ANTHROPIC_API_KEY', env),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: strEnv('CLAUDE_MODEL', env, DEFAULT_MODEL),
      max_tokens: maxTokens,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function extractJson(text) {
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`no JSON object in model reply: ${String(text).slice(0, 120)}`);
  return JSON.parse(match[0]);
}

// Compare two product images -> { score: 0-100, rationale }.
async function imagePairScore(imageUrlA, imageUrlB, env = process.env) {
  const text = await callClaude([
    { type: 'image', source: { type: 'url', url: imageUrlA } },
    { type: 'image', source: { type: 'url', url: imageUrlB } },
    {
      type: 'text',
      text: 'You compare furniture product photos for visual resemblance (silhouette, proportions, leg/arm design, upholstery texture). Ignore backgrounds, staging and photography style. Reply with ONLY a JSON object: {"score": <integer 0-100 where 100 = near-identical form>, "rationale": "<one sentence>"}',
    },
  ], env);
  const parsed = extractJson(text);
  const score = Number(parsed.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error(`bad vision score: ${parsed.score}`);
  return { score: Math.round(score), rationale: String(parsed.rationale || '') };
}

// Describe a user-supplied photo -> catalogue-style attributes for matching.
async function photoAttributes(imageSource, env = process.env) {
  const image = typeof imageSource === 'string'
    ? { type: 'image', source: { type: 'url', url: imageSource } }
    : { type: 'image', source: { type: 'base64', media_type: imageSource.mediaType, data: imageSource.data } };
  const text = await callClaude([
    image,
    {
      type: 'text',
      text: 'Describe this furniture piece as JSON only: {"category": one of ["sofas","armchairs","dining","coffee-tables","bedroom","lighting"], "materials": [lowercase tokens], "style_tags": [lowercase visual descriptors like "curved","modular","pedestal","mid-century"], "colour": "<dominant colour, lowercase>"}',
    },
  ], env);
  return extractJson(text);
}

module.exports = { visionAvailable, imagePairScore, photoAttributes, extractJson, callClaude, DEFAULT_MODEL };
