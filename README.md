# Absolute Superiority — The Long Forecast

A twenty-four step **clicker and idle** campaign about a falling frontier, three directives that machines cannot escape, and one question that has been asked for ten thousand years.

The old Supreme Command terminal is still here — the same sidebar departments, the same top bar, the same page headings, the same Orion star map, the same tactical bridge and the same White Hart — and the turn-based campaign underneath it has been rebuilt as clicks, generators, timers, policies and purchases. Nothing from the old game was deleted; every mechanic became an idle form of itself: industry, science, politics, shipyards, reliability, chaos, prototypes, field tests, hearings, safeguards, sorties, formations, targeting, wonder weapons, the exponential field, the enemy analyzer, capital defence, unrest, doctrine, the Quiet Array, the White Hart annex and total victory. The run is exactly **twenty-four steps**: it opens on step 01 and ends on step 24, which is **prestige and nothing else**, opening the next phase with permanent Forecast.

**Play:** serve the folder, then open `index.html`.

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

No install, bundler, runtime dependency or network request. Progress saves locally every few seconds and while the tab is away, up to eight hours (more with *Sleeping Forecast*).

---

## The twenty-four steps

The rail on the left always shows where you are. A step completes the moment its order is met; nothing has to be claimed or clicked through.

| # | Step | The mechanic it introduces | The order |
| --- | --- | --- | --- |
| 01 | Requisition | The click. Industrial points by hand, with a cadence multiplier. | 20 requisitions |
| 02 | Extraction | Idle production. Extractors and foundries bank IP every second. | 4 extractors, 6 IP/sec |
| 03 | Theory | Scientific points. Study by hand, then let labs produce. | 60 SP |
| 04 | Authority | Political capital. Consulates produce it; lobbying buys it. | 15 PC |
| 05 | The Yards | Cruiser lines convert IP into Standard Cruisers automatically. | 8 cruisers |
| 06 | Reliability | Fleet upkeep. Maintenance bays and standardised hulls oppose decay. | 85% reliability with 8 cruisers |
| 07 | Chaos | Specification drift. Industry creates it; reforms and automation remove it. | chaos ≤ 15% |
| 08 | Prototypes | Three Directorate specifications, each drafted on a timer. | authorise all three |
| 09 | Field Tests | Automatic tests on timers, paid in science. | 6 successful tests |
| 10 | Hearings | Failure reports become decisions: revisions or endorsements. | 3 hearings resolved |
| 11 | Safeguards | Certification. Removes failure risk and grants a permanent bonus. | all three certified |
| 12 | Engagements | Auto-sorties every six seconds. Exchange arithmetic, not orders. | destroy 10 hulls |
| 13 | Formations | Line ahead, escort screen, breakthrough — with real trade-offs. | win 5 sorties |
| 14 | Targeting | Screen, support or command fire; command fire disrupts the enemy. | 5 command vessels disrupted |
| 15 | Wonder Weapons | A charged volley, fired by hand or by policy. | 4 volleys |
| 16 | The Exponential Field | Blocks raids, builds hysteresis, blacks out at 100%. | 4 raids blocked |
| 17 | The Analyzer | Enemy adaptation over time and an analyzer that must be killed. | 2 analyzers destroyed |
| 18 | Capital Defence | Raids, automatic repairs and the one-use ceded outpost. | capital ≥ 85% after 12 sorties |
| 19 | Unrest | The admirals' patience; mutiny halves output until revisions are funded. | unrest ≤ 15% |
| 20 | Doctrine | Norden (+science, −reliability) or Voss (+output, +reliability). | mastery 3/5 |
| 21 | The Quiet Array | Three listening passes, then reply or hold the silence. | answer the array |
| 22 | The White Hart | The pub as an idle department: rooms, patrons, pints, noise, SE, staff, checks. | 5 rooms · 3 checks · 150 SE |
| 23 | The Armada | Total mobilisation — everything doubled — and the last enemy fleet. | destroy the armada |
| 24 | The Reckoning | **Prestige only.** No machines, no research, no war. | recalculate the Calculus |

---

## Every mechanic, converted

Nothing from the old campaign was dropped; each system became a clicker or idle form.

| Was (turn-based) | Is (clicker / idle), in the same room |
| --- | --- |
| End turn, +40 IP / +15 SP / +3 PC | The old *Requisition* button and its step rail stay; generators, labs and consulates produce continuously between clicks |
| Requisition screens and department buttons | The REQUISITION click, cadence multiplier, machine purchases and policies |
| Build cruisers in a queue over two cycles | Cruiser lines convert IP to hulls every second |
| Fleet reliability decays with chaos | Continuous decay versus maintenance and standardisation; automatic overhaul policy |
| Bureaucratic chaos | Drift produced by industry, removed by reforms, priced as an output penalty |
| Authorise, test twice, certify | Timed drafting → timed tests (with failures) → hearings → certification bonus |
| Scientific hearings with a decision | Reports auto-resolve to your standing policy, or you rule by hand |
| One sortie per cycle, pause and orders | A sortie every six seconds, fully automatic, with formations and targeting policies |
| Torpedoes automatic, wonder weapons manual | Auto-fire policy, or the volley button when charged |
| Exponential field protection and hysteresis | A toggle with heat, blocked raids and six-second command blackouts |
| Enemy analyzer and adaptation | Spawning analyzer (kill it with support fire) and adaptation that rises over time |
| Capital integrity, repairs, cede a base | Raids damage the capital; repairs are automatic; cede outpost four once for eight kills |
| Military unrest and mutiny | Unrest rises with losses and endorsements; mutiny halves output until revision funding |
| Norden vs standardization | Two doctrines with mastery levels and a switching cost |
| Three listening passes, reply or silence | Passive listening passes, a manual listen shortcut, and a permanent branch reward |
| Pub: patrons, pints, zones, noise, SE, tiers, upgrades, staff, rooms, weather, checks, easter eggs | An idle annex with the same nouns, automatic service, a noise meter, venting, tier upgrades, repeatable prototype checks and typed hidden words |
| Win by cycle 24, with five possible endings | Step 23 wins the corridor; step 24 names the ending the phase earned (a greeting in the dark, the long silence, a working theory, reliability outweighs genius, an expensive peace) and opens the next phase |

The scripted defeats of the old game (capital zero, mutiny, zero political capital) have become **setbacks**, not resets: capital zero cuts output until emergency powers are found, mutiny halves it until revisions are funded, and the run always remains playable.

---

## How the idle loop works

- **Click** REQUISITION (or press `Space`) to bank IP. Repeated clicks build a cadence multiplier up to ×3.
- **Buy machines** with `×1`, `×10` or `MAX`. Industry, science and authority each have their own tree; cruiser lines live on the fleet card.
- **Permanent reforms** are one-time purchases that survive until prestige.
- **Autopilot** buys sensible things every half second: machines, cruiser lines, reforms, repairs, revisions, pub rooms, staff, amenities and Silencer upgrades. Turn it off in *Policies* and every purchase is yours.
- **Offline:** when you come back, the machines are simulated at 60% efficiency (up to 90% with *Sleeping Forecast*), capped at eight hours plus four hours per level. A report tells you exactly what the quiet produced. Sleeping tabs are settled when you return, too.
- **Moments:** every couple of minutes a small opportunity appears — a convoy, a favourable forecast, a raid, a choir, an inspector — with one button and a real consequence for ignoring it.

### Research and directives

Three prototypes survive from the old Directorate: the **Sphere of Annihilation**, the **Battle Analyzer** and the **Exponential Field**. Each is authorised for IP and SP, drafted for twenty seconds, then tested twice for 15 SP per test. Tests fail 40% of the time under unsafe specifications, filing a hearing; passing both tests also files a *specification-omission* hearing, because the tests have proved what the specification left out. Hearings cost either 30 IP and 5 PC (revisions, calm) or nothing (endorsement, +20 IP and +9 unrest). Certification costs 600 IP and 10 PC, requires a clean record, and grants the prototype's permanent bonus.

### War

Sorties resolve every six seconds: firepower against enemy power, with losses on both sides. Formations trade offence for protection; targeting picks screen, support (the only way to kill an analyzer) or command (halves raid damage and disrupts coordination). The exponential field blocks raids but builds heat; at 100% it blacks out the command link for six seconds. Capital damage, unrest and repairs all feed back into output.

### The White Hart

At step 22 the pub returns as an idle department rather than a second game. Pints accrue from patrons; noise accrues from patrons and the weather; absorption converts noise into **Silence Energy**; venting converts the rest. SE buys filters, microphones, absorbers, venting, a resonator, reinforced casing and an emergency dump. Pints buy rooms, staff, amenities and Silencer tiers. The pub's dividend — +3% output per SE upgrade, +4% per staff member, +3% per amenity, +3% per tier — feeds the whole terminal, and its prototype checks convert IP and SP into SE, science and reputation. Neglect it and the Silencer explodes: 40% of stored SE and some reputation. The pub also still answers to a few old words — type `pint`, `cheese`, `purvis`, `42` or `moom` while the terminal has focus, once per phase each, for a small gift and a line of dialogue.

### Step 24: prestige only

The Reckoning hides every other card. There is one order: **Recalculate the Calculus**. Gain Forecast from phase, income, kills, certifications, checks, rooms, doctrine and the array; phase II begins at step 01 with everything else reset, and every phase runs 10% faster than the last. Forecast held gives +1% output each; it can also be spent on permanent remembrance, which is worth far more per point but can only be bought once:

- **Deep Memory** — +30% all output per level (5 levels).
- **Remembered Hands** — +100% requisition power per level (5).
- **Remembered Clock** — +6% speed for the whole forecast per level (5), on top of +10% per phase.
- **Sleeping Forecast** — +25% offline efficiency and +4h cap per level (3).
- **Inherited Yard** — begin each phase with extractors, a theory pool and 250 IP per level (3).

---

## Interface

The dashboard is the original Supreme Command terminal: a sidebar of departments (Headquarters, Research Directorate, Fleet & Production, Tactical Bridge, Deep Signal, Dispatches, The White Hart), the imperial top bar, the page heading with the campaign step and the requisition button, the twenty-four step rail, the animated Orion star map, the tactical plot, and the White Hart's own paper-and-lamplight realm.

The idle layer was merged into that furniture rather than replacing it:

- **The resource strip** carries eight live figures in two rows of four — industrial points, science, political capital, reliability, chaos, capital, unrest and the Forecast multiplier — each with its per-second rate. The White Hart keeps its own bar for pints, patrons, noise, Silence Energy, checks and staff.
- **The mission card** under the strip is the current order, with the step rail and its tooltips doing the bookkeeping.
- **Headquarters** keeps the star map and the intelligence card, and adds the click zone, the machine shop, the reforms and the fleet card.
- **The White Hart** is the same room it always was — masthead, night clock, resource bar, room tabs, the patrons on the floor — with the Silencer, the shop tabs and the tour laid into it.
- **Step 24** closes every other department. The sidebar greys out, the pub shuts, and the reckoning card is the only order on the terminal.

### How the numbers move without redrawing the terminal

A clicker changes its figures several times a second. Rebuilding the markup on every tick is what makes that kind of interface feel broken: hover states drop, CSS animations restart, focus is lost mid-click, the page jumps, and every click has to land on a node that is about to be discarded.

So the interface and the engine run on two clocks:

- **The engine ticks on every animation frame** — income, sorties, prototypes and the pub all advance at the full rate.
- **The interface repaints on its own clock**, twelve times a second by default, and backs off to six if a repaint is expensive. That is faster than anyone can read and far cheaper than sixty.

Repaints no longer assign `innerHTML`. `src/live.js` reconciles the new markup against the live tree: it walks the two in parallel and writes only what actually differs — one text node for a banked figure, one `style` attribute for a meter, one `disabled` for an affordance. Elements keep their identity, so nothing the player can see is thrown away. In steady state the counters are stark: over four hundred frames of a running battle the reconciler replaced **zero** elements and removed **zero** nodes, while writing a hundred-odd text values. A frame whose markup is unchanged is skipped outright.

Two smaller things came out of the same work. The paint path no longer runs a dozen document-wide selector queries per frame — the shell's furniture (step counter, page heading, sidebar badges, the strip, the pub's readouts) is looked up once and held. And every live figure is set in `tabular-nums`, so a bank ticking from 999 to 1000 does not nudge the panel beside it.

It steps at 1240, 1020, 860 and 560 pixels; the rail becomes a horizontal strip on tablet and phone; every card is a single-column block below 860px. No horizontal scrolling. Every animation is disabled under `prefers-reduced-motion`.

Keyboard: `Space` requisitions, `?` or `H` opens the briefing, `Esc` closes a dialog. Sound is off by default and is a small WebAudio blip when enabled.

The introduction uses the five-page Asimov-inspired prologue from `src/lore.js`; it plays once, can be skipped, and can be re-read from the **?** briefing. Mood: the Calculus, the commander the model cannot hold, the three directives, the Quiet Array, and your orders.

## Verification

The test bench is optional and needs one dev package:

```sh
npm install --no-save --package-lock=false jsdom
node tools/idle.mjs      # engine: 181 checks, no browser required
node tools/ui.mjs        # interface: 140 checks against the old shell, jsdom
node tools/balance.mjs . 2   # step-by-step pacing for two phases
```

`idle.mjs` covers the shape of the 24-step ladder, clicking, buying, all three economies, research/hearings/certification, combat/field/analyzer, unrest/doctrine/array/ceding, the pub and its hidden words, a complete run from step 01 to 24, a second run played by hand with the Autopilot off, the endings, prestige and remembrance, save/load, offline catch-up with a cap, malformed archives, and every order handlable without a crash.

`ui.mjs` boots the real page in jsdom and checks the introduction, the rail, clicking, DOM purchases, later departments appearing at their steps, the annex, that **step 24 shows only the reckoning**, prestige, reloading an archive, the offline report, the briefing/restart dialogs, keyboard input, a long quiet session and the absence of console errors. It also holds the live-rendering contract: after a second of frames the resource cell, the number, the panels, the star map and its 118 stars are the *same elements*, nothing was removed, a focused button kept its focus and its click, and the repaint count stayed far below the frame count.

---

## Files

```
index.html       the terminal shell
command.css      the whole look: rail, cards, meters, toasts, dialogs, responsive stops
src/util.js      small shared helpers
src/content.js   the pub's tables: rooms, patrons, tiers, upgrades, staff, amenities, weather
src/lore.js      the background bible: prologue, three directives, inspirations, glossary
src/live.js      the live DOM layer: reconciles markup in place so nothing flashes
src/idle.js      the engine: 24 steps, all mechanics, prestige, archive and offline simulation
src/idle-ui.js   rendering, input, dialogs, sound and the frame loop
tools/           optional headless test bench
```

All game files are plain browser JavaScript. No modules, no bundler, no transpiler, no external requests.

The game is an original homage to the themes of Isaac Asimov's stories — the mathematics of falling empires, machines bound by directives, a question asked for ten thousand years, and the night that comes once every 2,049 years. No passage is copied. The debt is itemised in `src/lore.js` and in the Dispatches dossier inside the briefing.
