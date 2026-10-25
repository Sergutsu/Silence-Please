/* Balance bench: plays the twenty-four steps with the Autopilot and an active click,
   then prints a step-by-step ledger. `node tools/balance.mjs . 3` runs three phases. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PHASES = Math.max(1, Number(process.argv[3] || 1));

const store = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
const load = (file) => (0, eval)(fs.readFileSync(path.join(ROOT, file), 'utf8'));
load('src/util.js');
load('src/content.js');
load('src/idle.js');
const A = globalThis.ASIdle;

let seed = 20261025;
Math.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const pad = (value, width) => String(value).padEnd(width);
const left = (value, width) => String(value).padStart(width);

function runPhase(state, label) {
  const startedAt = state.runSeconds;
  let step = state.step;
  let lastAt = 0;
  const rows = [];
  const dt = 0.25;
  let guard = 0;
  const limit = 90 * 60;
  while (state.step < 24 && state.runSeconds - startedAt < limit) {
    A.act(state, 'click');
    A.tick(state, dt);
    guard += 1;
    if (state.step !== step) {
      const d = A.derive(state);
      rows.push({
        step: state.step,
        title: A.stepDef(state.step).title,
        seconds: state.runSeconds - startedAt - lastAt,
        total: state.runSeconds - startedAt,
        ip: d.ipPerSec,
        sp: d.spPerSec,
        ships: state.fleet.ships,
        enemy: state.fleet.enemy,
        capital: state.fleet.capital,
        unrest: state.fleet.unrest,
      });
      lastAt = state.runSeconds - startedAt;
      step = state.step;
    }
    if (guard > 400000) break;
  }
  const total = state.runSeconds - startedAt;
  const d = A.derive(state);
  console.log(`\n${label}`);
  console.log('─'.repeat(96));
  console.log(`${pad('STEP', 6)}${pad('MECHANIC', 24)}${left('SPENT', 8)}${left('ELAPSED', 10)}${left('IP/SEC', 11)}${left('SCI/SEC', 10)}${left('CRUISERS', 10)}`);
  rows.forEach((row) => {
    console.log(
      `${pad(String(row.step).padStart(2, '0'), 6)}${pad(row.title, 24)}` +
      `${left(`${row.seconds.toFixed(0)}s`, 8)}${left(`${(row.total / 60).toFixed(1)}m`, 10)}` +
      `${left(A.fmt(row.ip), 11)}${left(A.fmt(row.sp), 10)}${left(A.fmt(row.ships), 10)}`,
    );
  });
  console.log('─'.repeat(96));
  console.log(
    `${pad('DONE', 6)}${pad(state.step >= 24 ? 'The Reckoning' : 'STALLED', 24)}` +
    `${left('', 8)}${left(`${(total / 60).toFixed(1)}m`, 10)}${left(A.fmt(d.ipPerSec), 11)}${left(A.fmt(d.spPerSec), 10)}${left(A.fmt(state.fleet.ships), 10)}`,
  );
  console.log(`forecast on offer: ${A.prestigeGain(state)} · kills ${state.totals.kills} · tests ${state.totals.tests} · checks ${state.totals.checks} · rooms ${Object.keys(state.pub.rooms).length}`);
  if (state.step < 24) {
    console.log(`stalled at step ${state.step}: ${A.stepDef(state.step).title} — ${A.stepInfo(state).goal.label} ${A.fmt(A.stepInfo(state).goal.value)} / ${A.fmt(A.stepInfo(state).goal.target)}`);
  }
  return { total, gain: A.prestigeGain(state), complete: state.step >= 24 };
}

let state = A.newGame();
state.seen.intro = true;
for (let phase = 1; phase <= PHASES; phase += 1) {
  const result = runPhase(state, `PHASE ${phase} · from step 01`);
  if (!result.complete) break;
  if (phase === PHASES) {
    console.log(`\nA first forecast finishes in ${(result.total / 60).toFixed(1)} minutes with ${result.gain} Forecast.\n`);
    break;
  }
  const prestige = A.act(state, 'prestige');
  if (!prestige.ok) { console.error('prestige failed', prestige.msg); break; }
  state = prestige.state;
  state.seen.intro = true;
}
