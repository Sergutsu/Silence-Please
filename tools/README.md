# The test bench

Optional developer tooling. **None of this is needed to play** — the game itself has no dependencies, no bundler and no build step. These scripts run the real game code headlessly so changes can be verified without clicking through a browser.

They need one dev-only package:

```sh
npm install --no-save jsdom
node tools/smoke.mjs
```

| Script | What it does |
| --- | --- |
| `harness.mjs` | Shared boot: builds a jsdom window, installs a recording PixiJS stub, evaluates `src/*.js` in order and dispatches `DOMContentLoaded`. The stub throws on `addChild(undefined)`, on double `destroy()`, and on any non-finite number passed to a drawing call. |
| `smoke.mjs` | 36 checks: serving, rooms, the shop, every modal tab, every typed word, every gag, every event, every prop, every patron, the win and loss paths, save/reload, and a 900-frame soak run. |
| `inspect.mjs` | Numeric layout audit at four stage sizes. Asserts that cards, room art, patrons, the machine and every text label stay inside their card, and that nothing in the backdrop band collides with the rooms. |
| `apicheck.mjs` | Loads the vendored `vendor/pixi.min.js` and asserts that every PixiJS class, method and property the game uses really exists in that build. |
| `pub-tutorial.mjs` | 7 checks on the pub's own briefing: the landlord's three-page introduction, the evening's-orders checklist ticking off as a patron is served, a zone toggled, the vent pressed and the Desk opened, the ledger round-trip, and a returning landlord who is not briefed twice. |
| `balance.mjs` | Plays the pub itself with a simple policy (serve the most impatient patron, hold the zones just below capacity, buy rooms and tiers) and prints a week-by-week ledger. `node tools/balance.mjs . 25` runs twenty-five Wednesdays in about ninety seconds and shows whether the economy still holds together. |

All three print a single line on success and exit non-zero on failure.


## Absolute Superiority campaign

The pub harness boots from `index.html` (the pub is a department of the command page; the harness un-hides `#pub-realm` first). `scope-pub-css.mjs` regenerates `pub-realm.css` from `style.css` + `pub-annex.css`. The campaign adds no runtime packages.

| Script | Coverage |
| --- | --- |
| `combat.mjs` | 12 deterministic combat checks: formation tradeoffs, suppression, support-ship adaptation, field protection, delayed hysteresis, safe weapons, pause, and legacy battle restoration. No npm dependencies. |
| `campaign.mjs` | Basic DOM integration: authorize, test, certify, deploy, pause, fight, advance production, select a system, and reset. Requires jsdom. |
| `campaign-edge.mjs` | Campaign policy checks: sortie limits, revision hearings, mutiny, funding shortfalls, save/reload, migration, malformed archives, safe dispatch rendering, and complete standardization/synergy victories from the starting economy. Requires jsdom. |
| `story.mjs` | The Long Question integration: map contact, three-stage decoding, both response branches, first-contact ending, Easter-egg rewards, cycle gag, and old-save migration. Requires jsdom. |
| `tutorial.mjs` | The campaign briefing: the five-page introduction, the eleven-step tutorial coach walked end to end, the mission panel's next-order rules and its jump buttons, the end-of-cycle report, and migration for archives that predate the briefing. Requires jsdom. |

Run from the repository root. These tools don't change the campaign archive in your real browser.
