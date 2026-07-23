# AU Furniture Lookalikes — Lookalike Living

An Australian designer-furniture comparison engine. We index designer originals
(Coco Republic, GlobeWest, Jardan, Gubi, Herman Miller, ...) alongside budget
pieces from AU retailers (Temple & Webster, Kmart, Ikea, Mocka, Fantastic
Furniture, ...), score how closely the budget pieces resemble the originals on
**published dimensions, materials, styling and colour**, and publish the
results as a static comparison site.

Idea credit: Ashley Bremner (2026-07-15) — "no website exists in Australia
that tracks designer furniture for its duplicate counterpart."

## How it works

```
data/catalogue.json ──> scripts/match.js ──> data/matches.json ──> scripts/build-site.js ──> site/
     (curated)           similarity engine       (scored pairs)        static comparison site
                         lib/similarity.js                             GitHub Pages deploy
```

- **Similarity score (0–100):** dimensions 30% + materials 25% + style tags 30%
  + colour 15%, reweighted across whatever both retailers actually publish.
  Cross-category comparisons are impossible by construction. Floor is 55; the
  bands are Very close match (90+), Close alternative (80–89), Similar
  aesthetic (70–79), Same style family (55–69).
- **Optional Claude vision blend:** with `ANTHROPIC_API_KEY` +
  `VISION_ENABLED=true`, the top spec matches get an image-pair resemblance
  score blended in at 35% (capped by `VISION_MAX_PAIRS`). Without a key the
  engine is pure-spec and still good.
- **Photo search (operator tool):** `npm run photo -- --image <url-or-path>`
  describes a photo with Claude vision and ranks the catalogue against it.
- **No scraping in v1.** Prices enter via the curated catalogue
  (`npm run add`) and the nightly staleness report nags when they age out.
  Retailer feeds/affiliate-network product APIs are the roadmap path to
  automated price updates — they come with permission built in.

## Legal posture (important, baked into the copy)

Products are presented as **visually similar alternatives**, never as copies,
replicas or knockoffs. Scores measure resemblance of published specs and
appearance only. Every page carries the disclaimer; the methodology page
spells it out; the build self-test fails if replica/copy language sneaks into
generated pages. Affiliate links are `rel="sponsored nofollow"` and disclosed.

## Revenue

1. **Affiliate commissions** — Commission Factory (Temple & Webster, Freedom,
   Mocka, ...) + Impact (Castlery, West Elm). Links upgrade in place once IDs
   land in env; until then they're clean UTM-tagged outbound links.
2. **Featured placements** — clearly-labelled sponsored slots for retailers
   (never inside the ranked results).
3. Later: alerts/premium, trade accounts for interior designers.

## Commands

```
npm run doctor       # preflight: catalogue valid? env wired? paused?
npm run match        # score alternatives -> data/matches.json
npm run build        # generate site/ (runs match implicitly if needed)
npm run add -- ...   # append a product to the catalogue (see scripts/add-product.js)
npm run import       # bulk import data/inbox.csv (spreadsheet-friendly, per-row validation)
npm run photo -- --image <url|path>   # Claude photo search over the catalogue
npm run staleness    # which prices are older than STALE_DAYS -> staleness.md
npm run report       # catalogue digest -> report.md
npm run pause        # kill-switch (blocks API-spending steps)
npm run test:all     # 10 self-test suites
```

## Ops

Nightly GitHub Actions (11pm AEST): doctor -> tests -> match -> build ->
staleness -> digest -> deploy to GitHub Pages. Kill-switch: repo variable
`PAUSED=true` or `npm run pause`. All env is optional; empty GitHub secrets
arrive as `''` and are treated as unset (`lib/env.js`).

See `SETUP.md` for the operator checklist and `TODO-MITCH.md` for current
to-dos.
