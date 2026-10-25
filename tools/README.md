# The test bench

Optional developer tooling. **None of this is needed to play** — the game itself has no dependencies, bundler or build step. These scripts run the real game headlessly so changes can be verified without a browser.

One dev-only package is needed for the interface bench:

```sh
npm install --no-save --package-lock=false jsdom
node tools/idle.mjs
```

| Script | What it does |
| --- | --- |
| `harness.mjs` | Builds a jsdom page from `index.html`, evaluates `src/util.js`, `src/content.js`, `src/lore.js`, `src/idle.js` and `src/idle-ui.js`, then hands control of the animation clock to the test. Exposes `frame`, `frames`, `click`, `text`, `key`, the engine and the live `ASIdleUI` state. |
| `idle.mjs` | 176 engine checks, no browser required. The 24-step ladder (step 01 is the click, step 24 is prestige), every economy, research/tests/hearings/certification, combat/formations/targeting/field/analyzer, unrest/doctrine/array/ceding, the pub annex and its hidden words, a deterministic complete run from step 01 to 24 in under forty-five minutes, a hand-played run with the Autopilot off, the five endings, prestige and remembrance, save/load, malformed archives, offline catch-up with a cap, and every order resolving without a crash. |
| `ui.mjs` | 91 interface checks in jsdom. The introduction, the 24-step rail, clicking, buying through the DOM, cards appearing at their steps, the annex, **step 24 showing only the reckoning**, prestige and confirmation, archive reload, the offline report, briefing/restart dialogs, keyboard input, a long quiet session and a clean console. |
| `balance.mjs` | Plays the campaign with the Autopilot and an active click, and prints a step-by-step ledger: time spent per step, IP and science rates, cruisers, kills, checks and the Forecast on offer. `node tools/balance.mjs . 3` runs three phases. |

All three print a single line on success and exit non-zero on failure. Run them from the repository root.
