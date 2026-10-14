# Absolute Superiority — The Burden of Genius

An offline retro-futurist strategy prototype, with **The White Hart** preserved as its officers’ recreation annex. Uses the existing plain JavaScript, CSS, and vendored PixiJS stack: no runtime dependencies, bundler, or network requests.

## Enter Supreme Command

Serve this folder with `python3 -m http.server 8000 --bind 0.0.0.0`, then open `index.html`. The campaign also works directly from the static files (browser storage availability may vary for file URLs).

- **Headquarters:** select systems on the strategic map and review intelligence, resources, and correspondence.
- **Research Directorate:** authorize prototypes, interrupt production, conduct two field tests, and fund engineering safeguards. Unsafe weapons have real consequences. Hire theorists for faster research at the cost of reliability, or dismiss Norden for standardization.
- **Fleet & Production:** commission cruisers, restore reliability, reduce chaos, or cede a base with a poisoned prototype.
- **Tactical Bridge:** one sortie per campaign cycle. Deploy, pause with the button or Space, then issue formation and targeting orders. Line ahead balances fire and protection; escort screens protect vulnerable support ships; breakthrough trades safety for firepower. Command-vessel targeting disrupts enemy fire. Torpedoes fire automatically; wonder weapons are activated manually. Leaving the bridge or hiding the browser tab pauses combat. Strategic changes require fleet recovery.
- **Scientific hearings:** failures create persistent reports. Pay 30 IP / 12 PC to demand revisions (grounds the prototype until certified, adds one retooling cycle, reduces unrest), or endorse the excuse (+25 military unrest and +8 chaos). Unresolved reports block turn advancement and deployment; 100 unrest triggers a mutiny.
- **Enemy adaptation:** the analyzer boosts firepower while its support vessel survives. Enemies learn to prioritize it across engagements. The exponential field protects only the flagship; an unsafe field causes a six-second command blackout on deactivation, including recovery after victory or withdrawal.
- **The White Hart (Research Directorate’s local):** the pub sits beside the Directorate on the headquarters map. Authorize a project, then open the pub’s *experimental round*. Keep the pub running for 12 seconds and serve one control pint; the report is filed to the campaign at Norden’s claimed 0.000001% statistical deviation. The first checks count as field tests (20 IP / 15 SP); certified projects can be re-audited for 5 IP. Engineering safeguards remain mandatory. The pub’s own ledger and gameplay are unchanged.
- **End turn:** receive resources and advance production, while the enemy damages capital integrity. Defeat the enemy before cycle 24. Capital, reliability, or political capital reaching zero ends the campaign.
- **Endings:** win through standardization after dismissing Norden, deploy a certified weapon for scientific synergy, or settle for an expensive peace. Campaign starts mid-war at cycle 12.
- **The White Hart:** play the original independent mini-game at `white-hart.html`, with a return link to command. Its original save key and mechanics are retained; annex progress does not modify campaign resources.

Campaign progress is archived in localStorage separately from the pub. Earlier v1 campaign archives migrate automatically; restored engagements always pause. Malformed saves fall back to a new campaign. Reset from Dispatches. This is a playable vertical slice: fleet-level tactical simulation, not individual-ship movement orders or a full grand-strategy territory simulation.

New files: `command.css` (command interface), `src/campaign.js` (campaign state and rendering), `src/campaign-combat.js` (deterministic combat rules), `src/directorate.js` + `src/pub-annex.js` (shared pub/Directorate contract), `tools/campaign*.mjs` and `tools/combat.mjs` (integration and rules tests). Original pub assets remain unchanged; its HTML shell is now `white-hart.html`.

### Verification

```sh
npm install --no-save --package-lock=false jsdom
node tools/combat.mjs
node tools/campaign.mjs
node tools/campaign-edge.mjs
node tools/smoke.mjs
node tools/apicheck.mjs
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
