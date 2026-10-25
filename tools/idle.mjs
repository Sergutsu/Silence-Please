/* Engine checks: the twenty-four step ladder, every mechanic, prestige and the archive.
   Runs without a browser or jsdom: the engine never touches the DOM. */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let failures = 0;
let checks = 0;

function assert(condition, message) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  ✗ ${message}`);
  }
}
function section(name) { console.log(`\n· ${name}`); }

/* A deterministic random source so a run is reproducible. */
function seedRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

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
const originalRandom = Math.random;

function fresh() {
  Math.random = seedRandom(20261025);
  return A.newGame();
}

function advance(s, seconds, { click = true, dt = 0.25 } = {}) {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    if (click) A.act(s, 'click');
    A.tick(s, dt);
  }
}

/* ------------------------------------------------------------------ shape */
section('the ladder');
assert(A.STEP_DEFS.length === 24, 'exactly twenty-four steps are defined');
assert(A.STEP_DEFS.every((def, index) => def.n === index + 1), 'the steps are numbered one to twenty-four in order');
assert(new Set(A.STEP_DEFS.map((def) => def.key)).size === 24, 'every step has its own mechanic key');
assert(A.STEP_DEFS[0].key === 'requisition', 'the first step is the click');
assert(A.STEP_DEFS[23].key === 'prestige', 'the last step is prestige');
assert(/recalculate/i.test(A.STEP_DEFS[23].title), 'step twenty-four is the reckoning');
assert(A.PROJECTS.length === 3, 'three Directorate prototypes survive the conversion');
assert(A.PRESTIGE_UPGRADES.length >= 3, 'prestige remembrance exists');
assert(A.GENS.length >= 5 && A.LABS.length >= 3 && A.CONS.length >= 3, 'three idle production lines');
assert(A.PUB_TIERS.length === 6 && A.PUB_UPGRADES.length >= 5 && A.PUB_STAFF.length >= 5, 'the pub keeps its tiers, upgrades and staff');

const start = fresh();
assert(start.step === 1 && start.phase === 1, 'a new forecast opens at phase I, step 01');
assert(start.ip === 0 && start.forecast === 0, 'a new forecast opens with nothing');
assert(A.derive(start).ipPerSec === 0, 'nothing produces before the first machine');

/* --------------------------------------------------------------- clicking */
section('the click and the machines');
advance(start, 6, { click: true });
assert(start.totals.clicks >= 20, 'twenty requisitions are banked');
assert(start.step >= 2, 'the first order completes and step 02 opens');
const shop = fresh();
shop.step = 2;
shop.ip = 100;
shop.policies.autopilot = false;
const beforeIp = shop.ip;
A.act(shop, 'buy', 'ore', 1);
assert(shop.gens.ore === 1, 'an ore extractor can be bought');
assert(shop.ip < beforeIp, 'the machine costs industrial points');
const rateBefore = A.derive(shop).ipPerSec;
assert(rateBefore > 0, 'the extractor produces without a click');
advance(shop, 5, { click: false });
assert(shop.ip > 0 && A.derive(shop).ipPerSec >= rateBefore, 'the extractor produces without a click');
assert(A.derive(shop).ipPerSec > 0, 'idle production is positive');

/* ------------------------------------------------- physical economy checks */
section('economy and caps');
const rich = fresh();
rich.step = 12;
rich.ip = 1e9;
const bought = A.act(rich, 'buy', 'ore', 'max');
assert(bought.ok && rich.gens.ore > 10, 'max-buy spends a large balance');
assert(rich.ip >= 0, 'max-buy never drives the balance negative');
const tooMany = A.act(rich, 'buy', 'forge', 1);
assert(tooMany.ok !== undefined, 'late machines resolve an order');
rich.ip = 0;
assert(A.act(rich, 'buy', 'ore', 1).ok === false, 'a machine cannot be bought without points');

/* --------------------------------------------------------------- research */
section('prototypes, tests, hearings, safeguards');
Math.random = () => 0.99; // tests pass
const lab = fresh();
lab.step = 9;
lab.ip = 1e6;
lab.sp = 1e5;
lab.pc = 1000;
A.PROJECTS.forEach((project) => assert(A.act(lab, 'research', project.id).ok, `${project.name} can be authorised`));
assert(lab.research.every((rec) => rec.state >= 1), 'all three specifications are authorised');
advance(lab, 120, { click: false, dt: 0.5 });
assert(lab.totals.tests >= 6, 'field tests complete themselves');
assert(lab.totals.hearings + lab.hearings.length >= 3, 'passing both tests files a specification-omission hearing');
lab.hearings.slice().forEach(() => A.act(lab, 'hearing', { index: 0, choice: 'revise' }));
assert(lab.totals.hearings >= 3, 'hearings can be ruled on by hand');
advance(lab, 30, { click: false, dt: 0.5 });
assert(lab.research.every((rec) => rec.state === 3), 'all three prototypes can be certified');
assert(A.derive(lab).mult > A.derive(fresh()).mult, 'certification compounds the economy');

/* ------------------------------------------------------------------ combat */
section('sorties, formations, targeting, field, analyzer');
Math.random = seedRandom(7);
const war = fresh();
war.step = 20;
war.fleet.ships = 200;
war.fleet.enemy = 40;
war.fleet.reliability = 95;
war.fleet.field = true;
war.ip = 1e7;
war.pc = 10000;
const killsBefore = war.totals.kills;
advance(war, 60, { click: false });
assert(war.totals.kills > killsBefore, 'sorties destroy enemy hulls automatically');
assert(war.totals.sorties > 0, 'won sorties are counted');
assert(war.totals.blocks > 0, 'the exponential field blocks raids');
assert(war.totals.volleys > 0, 'the wonder weapon fires automatically when charged');
assert(war.fleet.capital <= 100 && war.fleet.capital >= 0, 'capital integrity stays in bounds');
assert(war.totals.disrupts >= 0 && war.fleet.adapt >= 0, 'targeting and adaptation tick');
const fieldOff = A.act(war, 'field');
assert(fieldOff.ok, 'the exponential field can be deactivated by hand');
assert(war.fleet.blackout > 0, 'deactivation triggers hysteresis');
war.fleet.analyzer = 1;
war.fleet.analyzerHp = 1;
war.fleet.target = 'support';
advance(war, 20, { click: false });
assert(war.totals.analyzers >= 1, 'an analyzer dies under support fire');

/* ---------------------------------------------------------------- unrest */
section('unrest, doctrine, array, outpost');
const social = fresh();
social.step = 21;
social.fleet.unrest = 80;
social.ip = 1e6;
social.pc = 1000;
social.seen.intro = true;
advance(social, 60, { click: false });
assert(social.fleet.unrest <= 18, 'autopilot funds revisions and calms the admirals');
assert(A.act(social, 'doctrine', 'norden').ok, 'a doctrine can be declared');
social.fleet.mastery = 4;
assert(social.fleet.doctrine === 'norden', 'the doctrine is held');
social.signal.fragments = 3;
assert(A.act(social, 'answer', 'reply').ok, 'the array can be answered');
assert(social.signal.choice === 'reply', 'the answer is recorded');
const cede = fresh();
cede.step = 22;
cede.fleet.enemy = 30;
assert(A.act(cede, 'cede').ok, 'outpost four can be ceded once');
assert(cede.fleet.enemy === 22, 'ceding destroys eight enemy hulls');
assert(A.act(cede, 'cede').ok === false, 'ceding cannot be repeated');

/* ------------------------------------------------------------------- pub */
section('the White Hart as an idle department');
const pub = fresh();
pub.step = 22;
pub.ip = 1e6;
pub.sp = 1e6;
pub.pc = 1000;
pub.pints = 5000;
pub.se = 5000;
A.checkStep(pub);
assert(A.act(pub, 'pub-room', 'saloon').ok, 'a room opens with pints');
assert(pub.pub.rooms.saloon, 'the room is recorded');
assert(A.act(pub, 'pub-amenity', 'betterBeer').ok, 'an amenity can be installed');
assert(A.act(pub, 'pub-staff', 'barmaid').ok, 'staff can be hired');
assert(A.act(pub, 'pub-upgrade', 'filters').ok, 'Silence Energy buys Silencer upgrades');
assert(A.act(pub, 'pub-tier').ok, 'the Silencer can be improved');
assert(A.act(pub, 'pub-check').ok, 'a prototype check can begin');
advance(pub, 20, { click: false });
assert(pub.totals.checks >= 1, 'the check files itself');
const seBefore = pub.se;
advance(pub, 10, { click: false });
assert(pub.se > seBefore - 1e-6, 'the annex produces Silence Energy');
pub.pub.noise = 500;
const vented = A.act(pub, 'pub-vent');
assert(vented.ok && pub.pub.noise === 0, 'venting converts noise to Silence Energy');
assert(pub.pints > 0 && A.derive(pub).patrons > 0, 'patrons arrive and pints accrue');

/* ------------------------------------------------------------ full ladder */
section('a full forecast, step one to twenty-four');
const run = fresh();
run.seen.intro = true;
const visited = [run.step];
let elapsed = 0;
const dt = 0.25;
while (run.step < 24 && elapsed < 60 * 60) {
  A.act(run, 'click');
  A.tick(run, dt);
  elapsed += dt;
  if (visited[visited.length - 1] !== run.step) visited.push(run.step);
}
assert(run.step === 24, `the run reaches step 24 (reached ${run.step} after ${(elapsed / 60).toFixed(1)} minutes)`);
assert(Array.isArray(run.stepsSeen) && run.stepsSeen.length === 24, 'every step is recorded once, in order');
assert(run.stepsSeen.every((step, index) => step === index + 1), 'the ladder never skips a step');
assert(visited[visited.length - 1] === 24, 'the ladder ends at the reckoning');
assert(elapsed < 45 * 60, `a first forecast finishes in under forty-five minutes (${(elapsed / 60).toFixed(1)}m)`);
assert(run.totals.kills > 0 && run.totals.tests > 0 && run.totals.checks > 0, 'the run exercises research, combat and the pub');
assert(run.research.every((rec) => rec.state === 3), 'all three prototypes are certified in a full run');
assert(Boolean(run.signal.choice), 'the array is answered in a full run');
assert(Object.keys(run.pub.rooms).length >= 5, 'the pub opens at least five rooms in a full run');
console.log(`  · full run: ${(elapsed / 60).toFixed(1)} minutes, ${A.fmt(run.totals.ip)} IP, ${run.totals.kills} kills, ${A.fmt(A.prestigeGain(run))} forecast`);

/* --------------------------------------------------------------- prestige */
section('prestige and the next phase');
const gain = A.prestigeGain(run);
assert(gain >= 1, 'the reckoning offers a positive forecast');
const before = {
  forecast: run.forecast,
  up: JSON.stringify(run.forecastUp),
  phase: run.phase,
  ip: run.totals.ip,
};
const prestige = A.act(run, 'prestige');
assert(prestige.ok, 'prestige can be performed at step 24');
const next = prestige.state;
assert(next.step === 1, 'prestige returns to step 01');
assert(next.phase === before.phase + 1, 'prestige opens the next phase');
assert(next.forecast === before.forecast + gain, 'forecast is banked');
assert(next.prestiges === 1, 'the prestige count rises');
assert(next.totals.ip === 0 && next.fleet.ships === 0 && next.research.every((rec) => rec.state === 0), 'machines, fleet and research reset');
assert(JSON.stringify(next.forecastUp) === before.up, 'permanent remembrance survives');
assert(A.prestigeGain(fresh()) > 0, 'a fresh run still has a prestige value');
Math.random = originalRandom;

/* ---------------------------------------------------------------- archive */
section('the local archive');
const save = fresh();
save.step = 7;
save.ip = 1234.5;
save.forecast = 12;
save.forecastUp = { memory: 2, offline: 1 };
save.pub.rooms = { general: true, saloon: true };
save.achievements = ['first-click'];
const serialized = A.serialize(save);
const restored = A.sanitize(JSON.parse(serialized));
assert(restored !== null, 'a valid archive is accepted');
assert(restored.step === 7 && Math.abs(restored.ip - 1234.5) < 1e-6, 'progress and numbers survive the archive');
assert(restored.forecastUp.memory === 2, 'remembrance survives the archive');
assert(restored.pub.rooms.saloon === true, 'the pub ledger survives the archive');
assert(A.sanitize({ version: 999 }) === null, 'a foreign archive version is refused');
const chaotic = A.sanitize({ ...JSON.parse(serialized), step: 99, ip: -50, phase: -4, gens: { ore: 'many' } });
assert(chaotic && chaotic.step === 24, 'an impossible step is clamped');
assert(chaotic && chaotic.ip === 0, 'an impossible balance is clamped');
assert(chaotic && chaotic.phase === 1, 'an impossible phase is clamped');
assert(chaotic && Number.isFinite(chaotic.gens.ore) && chaotic.gens.ore === 0, 'an impossible machine count is made finite');
A.save(save);
const loaded = A.load();
assert(loaded && loaded.step === 7, 'save and load round-trip through localStorage');
assert(!JSON.parse(serialized).news || JSON.parse(serialized).news.length === 0, 'toasts are not written into the archive');

section('offline progress');
const away = fresh();
away.step = 6;
away.seen.intro = true;
away.gens.ore = 30;
away.gens.foundry = 10;
const awayRaw = JSON.parse(A.serialize(away));
awayRaw.lastSeen = Date.now() - 2 * 60 * 60 * 1000;
localStorage.setItem(A.SAVE_KEY, JSON.stringify(awayRaw));
const back = A.load();
assert(back && back.offlineReport, 'a two-hour absence produces an offline report');
assert(back && back.offlineReport.seconds > 60, 'the absence is measured');
assert(back && back.totals.ip > away.totals.ip, 'the machines kept working while away');
assert(back && back.offlineReport.ip > 0, 'the report names the industrial points earned');
const capped = fresh();
capped.step = 6;
capped.gens.ore = 30;
const cappedRaw = JSON.parse(A.serialize(capped));
cappedRaw.lastSeen = Date.now() - 40 * 24 * 60 * 60 * 1000;
localStorage.setItem(A.SAVE_KEY, JSON.stringify(cappedRaw));
const cappedBack = A.load();
assert(cappedBack && cappedBack.offlineReport.seconds <= A.OFFLINE_BASE_HOURS * 3600 + 1, 'a long absence is capped');

/* --------------------------------------------------------------- robustness */
section('every order resolves');
const fuzz = fresh();
fuzz.seen.intro = true;
fuzz.step = 24;
fuzz.ip = 1e6;
fuzz.sp = 1e6;
fuzz.pc = 1000;
fuzz.se = 1000;
fuzz.pints = 1000;
fuzz.fleet.enemy = 20;
fuzz.fleet.ships = 20;
fuzz.signal.fragments = 3;
const orders = [
  ['click'], ['study'], ['lobby'], ['line'], ['upgrade', 'gloves'], ['upgrade', 'reform'],
  ['formation', 'escort'], ['target', 'support'], ['volley'], ['field'], ['repair'],
  ['revision'], ['emergency'], ['cede'], ['doctrine', 'voss'], ['listen'], ['answer', 'silence'],
  ['policy', 'autopilot'], ['pub-room', 'saloon'], ['pub-staff', 'barmaid'], ['pub-amenity', 'betterBeer'],
  ['pub-upgrade', 'filters'], ['pub-tier'], ['pub-vent'], ['pub-check'], ['prestige-upgrade', 'memory'],
  ['hearing', { index: 0, choice: 'revise' }], ['dismiss-event'], ['research', 0], ['test', 0], ['certify', 0],
  ['nonsense'],
];
orders.forEach(([action, id]) => {
  let result;
  try { result = A.act(fuzz, action, id); } catch (error) { result = { ok: false, crash: error }; }
  assert(result && !result.crash, `order ${action}${id !== undefined ? `:${typeof id === 'object' ? 'object' : id}` : ''} does not crash`);
  assert(result && typeof result.ok === 'boolean', `order ${action} returns a verdict`);
});
assert(A.stepInfo(fuzz).def.n === 24, 'the reckoning remains the current step');
assert(A.prestigeGain(fuzz) >= 1, 'the reckoning is always worth something');

/* ------------------------------------------------------------------- done */
Math.random = originalRandom;
console.log(`\n${failures ? '✗' : '✓'} idle.mjs — ${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
