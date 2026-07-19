# TODO — Mitch (operator tasks)

Everything the engine cannot do for itself. Nothing here blocks local runs;
items 1–2 make it public, 3 turns on revenue.

- [ ] 1. Create GitHub repo `sah-au-furniture-dupes` in the browser (gh CLI broken),
       `git remote add origin ... && git push -u origin main`, then Settings ->
       Pages -> Source: GitHub Actions. Site deploys itself from then on.
- [ ] 2. Skim the seed catalogue (`data/catalogue.json`) before the site goes
       public — especially any product marked `"price_confidence": "estimate"`:
       open the URL, confirm price, flip to `"checked"` + today's date.
- [ ] 3. Apply to Commission Factory + Impact (affiliate networks). On approval
       add repo secrets `AFFILIATE_CF_ID` / `AFFILIATE_IMPACT_ID` — links
       upgrade automatically next build.
- [ ] 4. Brand/domain: check "Lookalike Living" is clean (trademark + domain
       search), buy the domain, set repo variable `SITE_URL`.
- [ ] 5. Optional: repo secret `ANTHROPIC_API_KEY` + variable
       `VISION_ENABLED=true` to blend image-pair scores into rankings.
- [ ] 6. Tell Ashley — this was Ashley's idea (2026-07-15); decide if this is a
       collab and on what terms before it earns a dollar.
