# Setup — au-furniture-dupes

Everything below is optional-but-ordered; the pipeline runs locally with zero
secrets from day one (`npm install && npm run build`).

## 1. Repo + hosting (once)

1. Create a GitHub repo `sah-au-furniture-dupes` (gh CLI is broken locally —
   create it in the browser), then:
   `git remote add origin git@github.com:<you>/sah-au-furniture-dupes.git && git push -u origin main`
2. Repo Settings -> Pages -> Source: **GitHub Actions**. The nightly workflow
   deploys `site/` on every push to main and every night at 11pm AEST.
3. Optional repo **variables**: `SITE_NAME`, `SITE_URL`, `OG_IMAGE_BASE_URL`,
   `UTM_SOURCE`, `STALE_DAYS`, `VISION_ENABLED`, `VISION_MAX_PAIRS`,
   `CLAUDE_MODEL`. Kill-switch variable: `PAUSED=true`.

## 1a. OG share cards (Vercel — already set up, here for reference)

GitHub Pages can't run serverless functions, so the share-preview image
generator (`api/og.js`) lives on its own Vercel deployment:

1. `vercel link --yes --project sah-au-furniture-dupes` from the repo root
   (Vercel CLI must be installed + authenticated — `vercel whoami` to check).
   It auto-connects the same GitHub repo, so pushes to `main` redeploy it too.
2. `vercel deploy --prod --yes` to ship. Test with
   `curl -I https://<project>.vercel.app/api/og` — should be `200 image/png`.
3. Set the GitHub repo variable `OG_IMAGE_BASE_URL` to that Vercel URL, then
   re-run the nightly workflow once so the static HTML picks up the
   `og:image` meta tags (`gh workflow run nightly.yml -R <repo>`).

If you ever touch `api/og.js` or `api/_og-card.mjs`: test locally first with
`npm run test:og` (renders 3 real PNGs via the actual handler, no Vercel
needed) before deploying — three real deploy-only failure modes already got
found and fixed this way (see the git log for `api/`). The short version:
Vercel's Edge Runtime has no `require` global and no working
`import.meta.url`-relative asset fetching, and its esbuild bundler rejects
the `with { type: 'json' }` import-attribute syntax Node's ESM loader
requires for JSON imports — none of those show up in a local Node test
unless you specifically guard for them, which `npm run test:og` now does.

## 2. Domain (when ready)

Point a domain (working name: `lookalikeliving.com.au`) at GitHub Pages and
set `SITE_URL` so canonicals + sitemap go live. Check the name is clean
(trademark search + domain availability) before buying.

## 3. Affiliate networks (revenue switch-on)

1. Apply to **Commission Factory** (AU network: Temple & Webster, Freedom,
   Mocka, Interior Secrets, ...) and **Impact** (Castlery, West Elm).
2. When approved, add repo secrets `AFFILIATE_CF_ID` / `AFFILIATE_IMPACT_ID`.
   Links upgrade automatically on the next nightly build; until then they are
   plain UTM-tagged links (site works fine, just unpaid).

## 4. Claude key (optional extras)

Repo secret `ANTHROPIC_API_KEY` unlocks:
- vision blend on match scores (`VISION_ENABLED=true`, capped by
  `VISION_MAX_PAIRS`, default 25 pairs/run)
- `npm run photo` photo search

## 5. Growing the catalogue

- `npm run add -- --role original --category sofas --brand "..." --name "..."
  --price 5995 --url https://... --w 240 --d 100 --h 70
  --materials "boucle,oak" --styles "curved,modular" --colour ivory --checked true`
- Alternatives: same, plus `--role alternative --retailer "..." --for <original-id>`.
- Or edit `data/catalogue.json` directly; `npm run doctor` validates it.
- The nightly staleness report (`staleness.md` artifact) lists prices older
  than `STALE_DAYS` (45) — re-check those pages and update `price_aud` +
  `price_last_checked`.

## Guardrails

- No scraping in v1 — catalogue is curated; automated prices arrive later via
  retailer/affiliate product feeds, which come with permission built in.
- Copy discipline: "lookalike", "similar", "alternative" — never "replica",
  "copy", "knockoff". The build test enforces this on generated pages.
- No emoji anywhere; generated HTML is ASCII-only (enforced by test).
