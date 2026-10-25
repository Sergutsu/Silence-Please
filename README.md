# Absolute Superiority — The Long Forecast

A twenty-four step **clicker and idle** campaign about a falling frontier, three directives that machines cannot escape, and one question that has been asked for ten thousand years.

The old turn-based strategy campaign is gone. Every mechanic it had — industry, science, politics, shipyards, reliability, chaos, prototypes, field tests, hearings, safeguards, sorties, formations, targeting, wonder weapons, the exponential field, the enemy analyzer, capital defence, unrest, doctrine, the Quiet Array, the White Hart annex and total victory — has been rebuilt as a click, a generator, a timer, a policy or a purchase. The run is exactly **twenty-four steps**: it opens on step 01 and ends on step 24, which is **prestige and nothing else**, opening the next phase with permanent Forecast.

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

| Was (turn-based) | Is (clicker / idle) |
| --- | --- |
| End turn, +40 IP / +15 SP / +3 PC | Generators, labs and consulates produce continuously; the run never stops |
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

The Reckoning hides every other card. There is one order: **Recalculate the Calculus**. Gain Forecast from phase, income, kills, certifications, checks, rooms, doctrine and the array; phase II begins at step 01 with everything else reset. Forecast held gives +5% output each; it can also be spent on permanent remembrance:

- **Deep Memory** — +25% all output per level (3 levels).
- **Remembered Hands** — +100% requisition power per level (3).
- **Sleeping Forecast** — +25% offline efficiency and +4h cap per level (3).
- **Inherited Yard** — begin each phase with extractors, a theory pool and 250 IP per level (2).

---

## Interface

The dashboard is a terminal: a 24-step rail, resource strip, current order, click zone, machine shop, fleet, research, bridge, doctrine, signal, pub, forecast, policies and dispatches. It steps at 1240, 1020, 860 and 560 pixels; the rail becomes a horizontal strip on tablet and phone; every card is a single-column block below 860px. No horizontal scrolling. Every animation is disabled under `prefers-reduced-motion`.

Keyboard: `Space` requisitions, `?` or `H` opens the briefing, `Esc` closes a dialog. Sound is off by default and is a small WebAudio blip when enabled.

The introduction uses the five-page Asimov-inspired prologue from `src/lore.js`; it plays once, can be skipped, and can be re-read from the **?** briefing. Mood: the Calculus, the commander the model cannot hold, the three directives, the Quiet Array, and your orders.

---

## Verification

The test bench is optional and needs one dev package:

```sh
npm install --no-save --package-lock=false jsdom
node tools/idle.mjs      # engine: 176 checks, no browser required
node tools/ui.mjs        # interface: 91 checks, jsdom
node tools/balance.mjs . 2   # step-by-step pacing for two phases
```

`idle.mjs` covers the shape of the 24-step ladder, clicking, buying, all three economies, research/hearings/certification, combat/field/analyzer, unrest/doctrine/array/ceding, the pub and its hidden words, a complete run from step 01 to 24, a second run played by hand with the Autopilot off, the endings, prestige and remembrance, save/load, offline catch-up with a cap, malformed archives, and every order handlable without a crash.

`ui.mjs` boots the real page in jsdom and checks the introduction, the rail, clicking, DOM purchases, later departments appearing at their steps, the annex, that **step 24 shows only the reckoning**, prestige, reloading an archive, the offline report, the briefing/restart dialogs, keyboard input, a long quiet session and the absence of console errors.

---

## Files

```
index.html       the terminal shell
command.css      the whole look: rail, cards, meters, toasts, dialogs, responsive stops
src/util.js      small shared helpers
src/content.js   the pub's tables: rooms, patrons, tiers, upgrades, staff, amenities, weather
src/lore.js      the background bible: prologue, three directives, inspirations, glossary
src/idle.js      the engine: 24 steps, all mechanics, prestige, archive and offline simulation
src/idle-ui.js   rendering, input, dialogs, sound and the frame loop
tools/           optional headless test bench
```

All game files are plain browser JavaScript. No modules, no bundler, no transpiler, no external requests.

The game is an original homage to the themes of Isaac Asimov's stories — the mathematics of falling empires, machines bound by directives, a question asked for ten thousand years, and the night that comes once every 2,049 years. No passage is copied. The debt is itemised in `src/lore.js` and in the Dispatches dossier inside the briefing.
