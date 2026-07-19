// Shared in-memory fixtures for --test runs. Deliberately generic fake
// products (no real brands) so tests never depend on live catalogue edits.
'use strict';

const FIXTURE_CATALOGUE = {
  updated: '2026-07-20',
  products: [
    {
      id: 'studio-one-curve-sofa', role: 'original', category: 'sofas',
      brand: 'Studio One', name: 'Curve Modular Sofa', price_aud: 5995,
      price_confidence: 'checked', price_last_checked: '2026-07-20',
      url: 'https://example.com/original-sofa',
      dimensions_cm: { w: 240, d: 100, h: 70 },
      materials: ['boucle', 'oak'], style_tags: ['curved', 'modular', 'low-profile'], colour: 'ivory',
    },
    {
      id: 'budgetco-cloudline-sofa', role: 'alternative', for: 'studio-one-curve-sofa', category: 'sofas',
      retailer: 'BudgetCo', name: 'Cloudline 3 Seater', price_aud: 1799,
      price_confidence: 'checked', price_last_checked: '2026-07-20',
      url: 'https://example.com/alt-sofa',
      dimensions_cm: { w: 235, d: 98, h: 72 },
      materials: ['boucle', 'pine'], style_tags: ['curved', 'modular'], colour: 'cream',
    },
    {
      id: 'budgetco-metro-sofa', role: 'alternative', for: 'studio-one-curve-sofa', category: 'sofas',
      retailer: 'BudgetCo', name: 'Metro Slimline Sofa', price_aud: 999,
      price_confidence: 'estimate', price_last_checked: '2026-05-01',
      url: 'https://example.com/alt-sofa-2',
      dimensions_cm: { w: 150, d: 70, h: 90 },
      materials: ['leather', 'steel'], style_tags: ['mid-century', 'slim-arm'], colour: 'black',
    },
    {
      id: 'studio-one-halo-lamp', role: 'original', category: 'lighting',
      brand: 'Studio One', name: 'Halo Mushroom Lamp', price_aud: 1190,
      price_confidence: 'checked', price_last_checked: '2026-07-20',
      url: 'https://example.com/original-lamp',
      dimensions_cm: { w: 25, h: 44 },
      materials: ['steel', 'glass'], style_tags: ['mushroom', 'sculptural'], colour: 'white',
    },
    {
      id: 'lampland-dome-lamp', role: 'alternative', for: 'studio-one-halo-lamp', category: 'lighting',
      retailer: 'LampLand', name: 'Dome Table Lamp', price_aud: 129,
      price_confidence: 'checked', price_last_checked: '2026-07-20',
      url: 'https://example.com/alt-lamp',
      dimensions_cm: { w: 24, h: 42 },
      materials: ['steel'], style_tags: ['mushroom', 'sculptural'], colour: 'ivory',
    },
  ],
};

module.exports = { FIXTURE_CATALOGUE };
