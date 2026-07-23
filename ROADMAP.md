# Roadmap — au-furniture-dupes

Status: v1 engine + site shipped 2026-07-20. Items ordered inside each phase.
`[x]` done, `[ ]` open.

## Phase 1 — Foundation (v1)

- [x] 1. Catalogue schema + validation (flat products list, original/alternative roles)
- [x] 2. Spec similarity engine (dims/materials/style/colour, reweighting, bands, 55 floor)
- [x] 3. Match engine with cross-matching within category + top-6 per original
- [x] 4. Static site generator (index, compare pages, methodology, sitemap, 404)
- [x] 5. Legal posture: lookalike language only, disclaimer footer, build-test enforcement
- [x] 6. Affiliate link decoration with graceful UTM-only fallback
- [x] 7. Optional Claude vision blend (image pairs, capped) + photo search CLI
- [x] 8. CLI product intake (npm run add) with validation
- [x] 9. Staleness report + catalogue digest
- [x] 10. Nightly CI: doctor -> tests -> match -> build -> deploy (GitHub Pages) + kill-switch
- [x] 11. Seed catalogue researched across 6 categories (web-verified where possible)
- [x] 12. GitHub repo + Pages live (2026-07-21: mitchparker99/sah-au-furniture-dupes, site deployed) (operator: see SETUP.md)
- [ ] 13. Domain + brand check (working name: Lookalike Living)

## Phase 2 — Catalogue depth

- [x] 14. 30+ originals across all 6 categories (34 as of 2026-07-23; Camaleonda, Togo, Wishbone, Componibili, Panthella, Eames, Noguchi, Barcelona, Louis Ghost, Cesca, Saarinen, Ultrafragola all in)
- [ ] 15. Image URLs recorded for every product (for vision + future UI)
- [ ] 16. Weekly "new lookalikes" additions cadence (batch add via CSV import script)
- [x] 17. CSV bulk import (npm run import, data/inbox.csv, per-row validation)
- [ ] 18. Colour variants as first-class data (one product, many colourways)
- [ ] 19. Category expansion: outdoor, rugs, office
- [ ] 20. "Verified dimensions" badge when both retailers publish full W/D/H

## Phase 3 — Product quality

- [ ] 21. Vision scoring pass across the full catalogue (one-off backfill)
- [x] 22. Per-axis dimension deltas on compare pages (W/D/H vs original, % badges)
- [x] 23. Budget-cap filter chips on index (category/material filters still open)
- [ ] 24. Client-side search box (lunr-style prebuilt index, static-friendly)
- [x] 25. "Under $X" budget landing pages (under-500/1000/2000, in sitemap)
- [x] 26. Per-original SEO copy block (deterministic, dupe-as-search-term only)
- [ ] 27. OG images per compare page (generated spec-card PNGs)
- [x] 28. JSON-LD ItemList + Product offers on compare pages

## Phase 4 — Automation (runs while asleep)

- [ ] 29. Affiliate product feeds (Commission Factory datafeeds) -> automated price refresh for member retailers
- [ ] 30. Price-drop detection + "price moved" flags on site
- [ ] 31. Nightly digest email to operator (reuse fleet mailer pattern, EMAIL_SEND_ENABLED gate)
- [ ] 32. Broken-link checker on catalogue URLs (nightly, report-only)
- [ ] 33. Claude-assisted intake: paste a product URL -> extracted attributes draft (human approves)
- [ ] 34. Auto-suggest candidate lookalikes: new alternative arrives -> engine proposes which originals it matches
- [ ] 35. Notion mirror of catalogue + matches (fleet pattern) for mobile edits

## Phase 5 — Audience + revenue

- [ ] 36. Email capture: "alert me when a closer/cheaper lookalike appears" (the premium seed)
- [ ] 37. Pinterest/Instagram content engine: top-savings pairs as branded spec cards
- [ ] 38. "Submit a find" public form (moderated -> catalogue inbox)
- [ ] 39. Featured placement offer sheet for budget retailers (clearly-labelled sponsored slots)
- [ ] 40. Retailer outreach engine (fleet outreach pattern) selling placements
- [ ] 41. Trade accounts: interior designers, saved boards, CSV export
- [ ] 42. Public photo search ("upload your Pinterest screenshot") behind rate-limited endpoint
- [ ] 43. Monthly "State of the Dupe" report (PR/SEO asset)

## Phase 6 — Moat

- [ ] 44. pgvector/embedding store for true image-embedding search at scale
- [ ] 45. Historical price charts per product
- [ ] 46. Out-of-stock detection via feeds
- [ ] 47. NZ expansion (same engine, NZ retailers)
- [ ] 48. API for publishers ("similar for less" widget embeds)
- [ ] 49. White-label for interiors publishers
- [ ] 50. Auto-generated category guides ("The best boucle sofa lookalikes in Australia, ranked by score")
- [x] 51. Privacy policy page (affiliate network requirement)
