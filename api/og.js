// Vercel Edge Function: /api/og?id=<original-slug> -> a branded 1200x630 PNG
// share card for that comparison (falls back to a generic site-wide card if
// id is missing, unknown, or has no qualifying match). Runs on Vercel's Edge
// Runtime (WASM-based rendering via @vercel/og - no native image libs, no
// build step for this file beyond Vercel's own bundler).
import { ImageResponse } from '@vercel/og';
import { loadCatalogue, buildOriginalCard, buildSiteWideCard, loadFonts, IMAGE_RESPONSE_OPTS } from './_og-card.mjs';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const [catalogue, fonts] = await Promise.all([loadCatalogue(), loadFonts()]);
  const original = id ? catalogue.products.find((p) => p.id === id && p.role === 'original') : null;
  const tree = (original && buildOriginalCard(original, catalogue)) || buildSiteWideCard(catalogue);

  return new ImageResponse(tree, {
    ...IMAGE_RESPONSE_OPTS,
    fonts,
    headers: { 'cache-control': 'public, immutable, no-transform, max-age=86400' },
  });
}
