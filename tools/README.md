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

All three print a single line on success and exit non-zero on failure.
