# TODO — Mitch (operator tasks)

- [x] 1. GitHub repo + Pages — DONE 2026-07-21. Repo:
       https://github.com/mitchparker99/sah-au-furniture-dupes (public; needed
       for free Pages). Live site:
       https://mitchparker99.github.io/sah-au-furniture-dupes/
       CI deploys nightly at 11pm AEST and on every push.
- [x] 2. Indicative prices — verified against live retailer pages by the
       price-verify fleet 2026-07-21 (see data/catalogue.json confidence
       flags). Only ones it could not confirm are listed in staleness.md /
       flagged "estimate" — spot-check those when convenient.
- [ ] 3. Apply to Commission Factory + Impact. Everything you need is in
       AFFILIATES.md (what to say, which advertiser programs, where the IDs
       go). On approval add repo secrets `AFFILIATE_CF_ID` /
       `AFFILIATE_IMPACT_ID` — links upgrade automatically next build.
- [ ] 4. Brand + domain. Checked 2026-07-21: lookalikeliving.com.au, .com and
       .au are ALL available to register, and no existing "Lookalike Living"
       furniture business or indexed AU trademark was found. Remaining: run
       the name through IP Australia's TM Checker (5 min), then buy
       lookalikeliving.com.au (+.com if cheap), point it at GitHub Pages, and
       update the SITE_URL repo variable.
- [ ] 5. Optional: repo secret `ANTHROPIC_API_KEY` + variable
       `VISION_ENABLED=true` to blend image-pair scores into rankings.
- [ ] 6. Ashley — this was Ashley's idea (2026-07-15). Options + a
       ready-to-send message are in ASHLEY-COLLAB.md (kept out of the public
       repo). Decide the split before it earns a dollar.
