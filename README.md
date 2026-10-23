# Absolute Superiority — The Burden of Genius · The Long Forecast

An offline retro-futurist strategy game with **The White Hart** as its officers’ recreation annex. The campaign now opens with a five-page **introduction**, teaches itself through an eleven-step **tutorial coach**, and keeps a **mission panel** on every screen that names the next order — so the loop is legible before it is playable. The whole background is drawn from the themes of **Isaac Asimov’s stories**: an empire whose fall has become arithmetic, machines that cannot escape their own directives, one question asked for ten thousand years, and a night that comes once every 2,049 years. It is an original homage, not an adaptation — no passage is copied, and the full debt is itemised in the Dispatches dossier. Built with plain JavaScript, CSS, and vendored PixiJS: no runtime dependencies, bundler, or network requests.

## The terminal is never still

The command interface is a running machine, not a form. A scanner crosses the glass every twenty-one seconds, a rail of light walks the sidebar, a trace runs the length of the top bar, and the strategic map has a radar cone sweeping behind the contacts. Panels arrive in sequence rather than appearing all at once, cards lift and take a sheen on hover, meters shimmer while they fill, the current-order button breathes, and **every resource number flashes once when it changes** — so a cycle's cost is visible without reading the report. When the next order changes, the mission panel pulses. Every one of these is switched off under `prefers-reduced-motion`.

## First ten minutes

1. **The introduction** opens on load: five short pages — the Calculus, the commander the model cannot hold, the Directorate and its three directives, the Quiet Array, and your orders. Every page can be skipped; it can be replayed from the `?` briefing or Dispatches.
2. **The tutorial coach** takes over in the corner of the screen and walks the whole loop in eleven steps: read the map, understand the currencies, queue cruisers, authorize a prototype, test it twice, certify it, fly one sortie, rule on the failure report it files, end the cycle, listen to the array, and walk over to the pub. Steps complete themselves the moment you do the thing; each one can be skipped, and the coach stands down while an engagement is live.
3. **The mission panel** stays after the tutorial. It shows the current order with the reason for it, a button that jumps to the right department, the six-phase loop strip (ASSESS · BUILD · RESEARCH · ENGAGE · LISTEN · ADVANCE) with each phase marked done / open / blocked, and three meters: enemy vessels remaining, cycles left, and unrest.
4. **The cycle report** lands after every *End turn* and lists exactly what the cycle paid and cost — +40 IP, +15 SP, +3 PC, capital integrity, reliability, chaos, enemy strength — then repeats the next order.

5. **Restart, at any time.** The `⟲` button in the top bar opens three separate switches, each with what it does spelled out: **replay the introduction** (the five pages, from the top), **restart the tutorial** (the coach returns to step 1 and clears its marks; the campaign carries on exactly as it is), and **start a new campaign** (wipes the archive, begins again at cycle 012 — introduction included — after a confirmation). The same three are reachable from the `?` briefing and from Dispatches.

Old archives are not dragged through any of it: a campaign that predates the briefing is marked as already briefed, and both can be replayed on demand.

## Enter Supreme Command

Serve this folder with `python3 -m http.server 8000 --bind 0.0.0.0`, then open `index.html`. The campaign also works directly from the static files (browser storage availability may vary for file URLs).

- **Headquarters:** select systems on the animated strategic map and review intelligence, resources, and correspondence. The Quiet Array appears as a pulsing unknown contact.
- **The Long Question (Deep Signal):** spend IP / SP across three listening passes to decode a transmission that turns out to be a question, asked by a machine that has outlived its makers. Answer it to open a first-contact ending, or hold the silence for a fleet-strength advantage. Three campaign-cycle gags and two archive Easter eggs reward close attention; one can be found by typing `lighthouse` outside the pub.
- **Research Directorate:** authorize prototypes, interrupt production, conduct two field tests, and fund engineering safeguards. Unsafe weapons have real consequences. Hire theorists for faster research at the cost of reliability, or dismiss Norden for standardization.
- **Fleet & Production:** commission cruisers, restore reliability, reduce chaos, or cede a base with a poisoned prototype.
- **Tactical Bridge:** one sortie per campaign cycle. Deploy, pause with the button or Space, then issue formation and targeting orders. Line ahead balances fire and protection; escort screens protect vulnerable support ships; breakthrough trades safety for firepower. Command-vessel targeting disrupts enemy fire. Torpedoes fire automatically; wonder weapons are activated manually. Leaving the bridge or hiding the browser tab pauses combat. Strategic changes require fleet recovery.
- **The three directives:** every Directorate machine is built to them — it may not allow a crew to be destroyed, it must obey its specification, it must preserve its own calibration. They are why uncertified weapons file failure reports, why safeguards matter, and why the exponential field goes into hysteresis when it is switched off.
- **Scientific hearings:** failures create persistent reports. Pay 30 IP / 12 PC to demand revisions (grounds the prototype until certified, adds one retooling cycle, reduces unrest), or endorse the excuse (+25 military unrest and +8 chaos). Unresolved reports block turn advancement and deployment; 100 unrest triggers a mutiny.
- **Enemy adaptation:** the analyzer boosts firepower while its support vessel survives. Enemies learn to prioritize it across engagements. The exponential field protects only the flagship; an unsafe field causes a six-second command blackout on deactivation, including recovery after victory or withdrawal.
- **The White Hart (Research Directorate’s local):** the pub sits beside the Directorate on the headquarters map. Authorize a project, then open the pub’s *experimental round*. Keep the pub running for 12 seconds and serve one control pint; the report is filed to the campaign at Norden’s claimed 0.000001% statistical deviation. The first checks count as field tests (20 IP / 15 SP); certified projects can be re-audited for 5 IP. Engineering safeguards remain mandatory. The pub’s own ledger and gameplay are unchanged.
- **End turn:** receive resources and advance production, while the enemy damages capital integrity. Defeat the enemy before cycle 24. Capital, reliability, or political capital reaching zero ends the campaign.
- **Endings:** win through standardization after dismissing Norden, deploy a certified weapon for scientific synergy, settle for an expensive peace, or answer the array and reach **A greeting in the dark**. Campaign starts mid-war at cycle 12.
- **Background:** Vesper Reach is the enemy’s six-sun homeworld, where night falls once every 2,049 years; Vega runs the Encyclopaedia Project shipyards; the enemy commander appears in no census the Calculus can read. The dossier at the end of Dispatches lists every inspiration and where it shows up in play.
- **The White Hart:** the pub is a department of the same page — pick it from the sidebar or walk over from the map/Research cards. The pub only runs while you are standing in it. Its ledger (save) and mechanics are retained; `white-hart.html` now just redirects into the command page.

Campaign progress is archived in localStorage separately from the pub. Earlier v1 campaign archives migrate automatically; restored engagements always pause. Malformed saves fall back to a new campaign. Reset from Dispatches. This is a playable vertical slice: fleet-level tactical simulation, not individual-ship movement orders or a full grand-strategy territory simulation.

Key game files: `src/lore.js` (the background bible: prologue, three directives, dossier, glossary), `command.css` (command interface, dark theme, introduction/coach/mission styling), `src/campaign.js` (campaign state, story, briefing, and rendering), `src/campaign-combat.js` (deterministic combat rules), `src/directorate.js` + `src/pub-annex.js` (shared pub/Directorate contract), and `tools/*.mjs` (integration and rules tests). The pub's markup lives inside `index.html`; its stylesheets (`style.css`, `pub-annex.css`) are compiled into `pub-realm.css` by `node tools/scope-pub-css.mjs` so they only apply inside the pub realm. Pub game code is unchanged apart from pausing while off-screen.

### Verification

```sh
npm install --no-save --package-lock=false jsdom
node tools/combat.mjs
node tools/campaign.mjs
node tools/campaign-edge.mjs
node tools/story.mjs
node tools/tutorial.mjs
node tools/motion.mjs
node tools/smoke.mjs
node tools/pub-tutorial.mjs
node tools/apicheck.mjs
node tools/inspect.mjs
```

---

# Silence, Please — The White Hart

A PixiJS pub-management game about the quietest pub on Fleet Street, the loudest machine in London, and the landlord who refuses to choose between them.

**Play now:** [sergutsu.github.io/Silence-Please](https://sergutsu.github.io/Silence-Please/)

## Open the pub

There is no install, bundler, or build step. Open `index.html` directly, or serve the folder with any static web server. PixiJS 8.6.6 is vendored in `vendor/`, so the game runs fully offline and fetches nothing.

## Wednesday service

- **Tap a patron** in a room, **pull the pint** at the Beer Tap, then **tap that same patron again** to serve. A tankard appears over their head the moment the beer is ready.
- **Tap a room** to switch its Silencer Zone on or off. Silenced rooms read 0 dB and their absorbed noise fills the Silence Energy meter.
- At 70%, 85% and 95% capacity the warnings get progressively less polite. At 100%, the machine explodes: everything freezes for two seconds, then the housing is destroyed and rebuilt. Three explosions and the pub closes.
- **Spend Silence Energy** on filters, microphones, a vent, reinforced casing, or the one-use Emergency Dump. Open the Vent while a safe vent rate is showing.
- **The Landlord's Desk** sells rooms, Silencer research, staff and amenities. Swipe or use the arrows below the pub to page through rooms.
- **Pause** with the header button or the space bar. **Long-press a patron** for patience, noise and trade. Progress saves in this browser.
- **First Wednesday:** a returning player is spared it, but a new ledger opens with the **landlord’s briefing** — three pages on service, on Mr Fenton’s positronic apparatus and its three directives, and on the evening’s orders. The **evening’s orders** card then sits at the top of the management column and ticks off the loop as you perform it: tap a patron, pull the pint, serve them, switch a zone on, vent, and open the Landlord’s Desk. It stays as a permanent reminder of the loop — serve → silence → vent → spend → grow — and can be run again from the card. The header's **NEW** button opens the restart sheet, which offers all three separately: wipe the ledger and start a new Wednesday (the briefing plays again, as it did the first time), replay the briefing alone, or run the evening's orders again with the ledger untouched.

Win by reaching Silencer Tier 5 with all nine rooms open, ten Wednesdays survived, and the pantry stocked. Lose at zero reputation, three explosions, or a full minute above 95 dB.

## What is in the pub

- **9 rooms**, each hand-drawn in code with its own wallpaper, floor, furniture and lighting — plus a secret room that only opens if you can guess where it is.
- **14 kinds of patron**, from newspaper men to a ghost that pays in damp shillings, each with their own silhouette, walk-in, blink, patience bar and opinions.
- **28 achievements**, **9 diary pages**, **16 random events**, **6 weather systems**, **11 amenities**, **9 staff**, **7 machine upgrades** and **6 machine tiers**.
- **18 gag moments** — hats flying off, a piano starting itself, a queue forming under the silenced sign, a football landing in someone's pint.
- **Props** that wander across the ceiling: a cat, a mouse, a pigeon, a ghost, a flying teapot, a UFO, a cab and a hat. Tap them.
- **Easter eggs.** Type words into the pub. There are at least fourteen, and one of them is the only way to learn the truth about Mr Fenton. There is also an old cheat code that the landlord used to use.

## More than quiet

The pub runs on a live decibel model: each room generates noise from its patrons and stops noise from its neighbours, silenced rooms absorb it, and the machine fills up. Weather, seasons, and the paper's latest headline all push the numbers around. The clock on the wall keeps the pub's time, which is not the world's time.

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Select a patron | tap them in their room | `Tab` / `⇧Tab` |
| Pull a pint, then serve | Beer Tap button | `Enter` or `B` |
| Toggle a room's zone | tap the room card | `Z` (the selected patron's room) |
| Page through rooms | swipe, or the arrows below the pub | `←` `→` |
| Vent | Vent button | `V` |
| Pause | header button | `space` |
| Journal / Help | header buttons | `J` / `?` |
| Close a panel | the ✕ | `Esc` |

The pub also listens to what you type: letters typed at the keyboard are matched against a list of words, and the shortcuts above only fire when what you typed cannot be the start of one of them.

## Layout of the repository

```
index.html      markup and the fixed UI shell
style.css       the whole look of the chrome, plus the shaking and crises
vendor/         PixiJS 8.6.6 (MIT) and its licence
src/util.js     maths, easing, formatting, reduced-motion detection
src/content.js  every table: rooms, patrons, gags, events, achievements, eggs
src/audio.js    WebAudio sound effects, no samples
src/fx.js       particle system, props, weather, flash and shake
src/scene.js    the Pixi stage: backdrop, room interiors, patrons, the machine
src/game.js     state, economy, the noise model, saving
src/ui.js       DOM rendering, modals, toasts, tooltips
src/main.js     boot, ticker, input, keyboard and touch
tools/          optional headless test bench (see tools/README.md)
```

Every file in `src/` is plain browser JavaScript: no modules, no bundler, no transpiler.

The project vendors the PixiJS 8.6.6 browser distribution under the MIT License at `vendor/PIXIJSLICENSE.txt`.
