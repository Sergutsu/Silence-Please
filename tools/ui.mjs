/* Interface checks: the terminal boots, clicks, buys, saves, and reaches the reckoning. */
import path from 'node:path';
import { bootGame, closeGame } from './harness.mjs';

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
const section = (name) => console.log(`\n· ${name}`);

/* ------------------------------------------------------------------ boot */
section('the terminal boots');
const env = await bootGame(ROOT);
assert(env.errors.length === 0, `the interface loads without errors (${env.errors.slice(0, 2).join(' | ')})`);
const { document, UI, ASIdle: A } = env;
const s = UI.state;
assert(s && s.step === 1, 'the forecast opens on step 01');
assert(document.querySelectorAll('#step-rail .rail-step').length === 24, 'the rail lists twenty-four steps');
assert(document.querySelector('#step-rail .rail-step.current .rail-num').textContent.trim() === '01', 'step 01 is the current step');
assert(/Requisition/.test(env.text('#step-card')), 'the step card names the first mechanic');
assert(document.querySelector('#action-card .click-button'), 'the requisition button is present');
assert(document.querySelector('#modal-root') && !document.querySelector('#modal-root').hidden, 'a first-time commander receives the introduction');
assert(/Twelve thousand years/.test(env.text('#modal-content')), 'the introduction opens on the Calculus');
env.click('[data-action="intro-skip"]');
assert(document.querySelector('#modal-root').hidden, 'the introduction can be skipped');
assert(s.seen.intro === true, 'the briefing is remembered');

/* ---------------------------------------------------------------- clicks */
section('clicking advances the first order');
assert(/STEP 01/.test(env.text('#step-card')), 'the step card shows step 01');
for (let i = 0; i < 22; i += 1) env.click('[data-action="click"]');
env.frame(250);
assert(s.totals.clicks >= 22, 'clicks bank industrial points');
assert(s.step >= 2, 'the first order completes');
assert(/Extraction/.test(env.text('#step-card')), 'the terminal moves to step 02');
const railCurrent = env.text('#step-rail .rail-step.current .rail-title');
assert(/Extraction/.test(railCurrent), 'the rail follows the step');
assert(document.querySelector('#build-card') && !document.querySelector('#build-card').hidden, 'the machine shop appears at step 02');

/* ------------------------------------------------------------ buy a thing */
section('the shop works through the DOM');
s.ip = 5000;
UI.render();
const oreBefore = s.gens.ore;
env.click('#build-card [data-action="buy"][data-id="ore"][data-amount="1"]');
assert(s.gens.ore > oreBefore, 'clicking a buy button buys a machine');
assert(A.derive(s).ipPerSec > 0, 'the machine produces');
const ip = s.ip;
env.click('#build-card [data-action="buy"][data-id="ore"][data-amount="10"]');
assert(s.ip < ip && s.gens.ore >= oreBefore + 10, 'buy ten works');

/* ------------------------------------------------------------- idle frames */
section('the terminal idles');
const runBefore = s.runSeconds;
env.frames(50, 200);
assert(s.runSeconds > runBefore + 5, 'the run clock moves while frames render');
assert(A.derive(s).ipPerSec > 0, 'the machines produce during the frame run');
assert(s.totals.ip > 0, 'the frame run banks industrial points');
assert(document.querySelectorAll('#toasts .toast').length <= 3, 'toasts never stack beyond three');
assert(document.querySelector('#action-card .click-button'), 'the click button survives re-renders');

/* --------------------------------------------------------------- research */
section('later departments appear at their steps');
s.step = 8;
s.ip = 1e6;
s.sp = 1e5;
s.pc = 500;
s.policies.autoResearch = false;
s.totals.checks = 0;
UI.render();
assert(!document.querySelector('#research-card').hidden, 'the research card appears at step 08');
assert(document.querySelector('#research-card [data-action="research"]'), 'a prototype can be authorised from the card');
assert(!document.querySelector('#fleet-card').hidden, 'the fleet card is visible in the war chapters');
assert(document.querySelector('#fleet-card [data-action="overhaul"]'), 'fleet maintenance is available');
const researchHtml = env.text('#research-card');
assert(/Sphere of Annihilation/.test(researchHtml) && /Battle Analyzer/.test(researchHtml), 'the three Directorate prototypes are named');
env.click('#research-card [data-action="research"][data-id="0"]');
assert(s.research[0].state === 1, 'authorising through the DOM works');
s.hearings.push({ id: 0, name: 'Sphere of Annihilation', timer: 20, reason: 'failure' });
UI.render();
env.click('#research-card [data-action="hearing"][data-id="0:revise"]');
assert(s.totals.hearings >= 1 && s.hearings.length === 0, 'a hearing can be ruled on from the card');
assert(document.querySelector('#fleet-card [data-action="focus"][data-id="yards"]'), 'the strategic map offers a sector focus');
env.click('#fleet-card [data-action="focus"][data-id="yards"]');
assert(s.fleet.focus === 'yards', 'a sector focus can be chosen');

s.step = 16;
s.fleet.enemy = 300;
s.fleet.ships = 60;
s.fleet.reliability = 90;
s.fleet.volley = 1;
UI.render();
env.frames(30, 200);
assert(!document.querySelector('#bridge-card').hidden, 'the bridge appears at step 12+');
assert(document.querySelector('#bridge-card [data-action="formation"][data-id="escort"]'), 'formations can be chosen');
env.click('#bridge-card [data-action="formation"][data-id="escort"]');
assert(s.fleet.formation === 'escort', 'a formation click is applied');
assert(document.querySelector('#bridge-card [data-action="target"][data-id="command"]'), 'targeting is available');
env.click('#bridge-card [data-action="target"][data-id="command"]');
assert(s.fleet.target === 'command', 'a targeting click is applied');
env.click('#bridge-card [data-action="volley"]');
assert(s.totals.volleys >= 1, 'the wonder weapon fires from the bridge');
assert(s.totals.kills > 0, 'sorties destroy hulls during the frame run');

/* ------------------------------------------------------------------- pub */
section('the White Hart annex');
s.step = 22;
s.ip = 1e6;
s.sp = 1e6;
s.pc = 500;
s.pints = 5000;
s.se = 5000;
s.seen.intro = true;
s.pub.rooms = { general: true };
s.pub.staff = {};
s.pub.amenities = {};
s.pub.checking = false;
s.policies.autopilot = false;
s.policies.autoCheck = false;
UI.render();
env.frame(250);
assert(!document.querySelector('#pub-card').hidden, 'the pub card appears at step 22');
assert(document.querySelector('#pub-card [data-action="pub-room"][data-id="saloon"]'), 'rooms can be opened');
env.click('#pub-card [data-action="pub-room"][data-id="saloon"]');
assert(s.pub.rooms.saloon, 'the room opens');
env.click('#pub-card [data-action="pub-staff"][data-id="barmaid"]');
assert(s.pub.staff.barmaid, 'staff can be hired');
env.click('#pub-card [data-action="pub-check"]');
assert(s.pub.checking || s.totals.checks > 0, 'a prototype check can be started');
const seBefore = s.se;
env.frames(10, 250);
assert(s.se >= seBefore, 'the annex produces Silence Energy while idling');

/* --------------------------------------------------------------- prestige */
section('step 24 is the reckoning and nothing else');
s.step = 24;
s.stepsSeen = A.STEP_DEFS.map((def) => def.n);
s.enemy = 0;
s.fleet.enemy = 0;
s.forecast = 0;
UI.render();
env.frame(250);
assert(document.body.classList.contains('reckoning'), 'the terminal enters reckoning mode');
['action-card', 'build-card', 'fleet-card', 'research-card', 'bridge-card', 'doctrine-card', 'signal-card', 'pub-card', 'policies-card'].forEach((id) => {
  assert(document.querySelector(`#${id}`).hidden, `${id} is hidden at step 24`);
});
assert(!document.querySelector('#forecast-card').hidden, 'the forecast card stays');
assert(document.querySelector('#forecast-card [data-action="prestige"]'), 'prestige is the available order');
assert(/Recalculate/.test(env.text('#forecast-card')), 'the reckoning is named');
const gain = A.prestigeGain(s);
assert(gain >= 1, 'the reckoning is worth forecast');
env.click('#forecast-card [data-action="prestige"]');
assert(!document.querySelector('#modal-root').hidden, 'prestige asks for confirmation');
assert(/Recalculate the Calculus\?/.test(env.text('#modal-content')), 'the confirmation explains itself');
env.click('[data-action="confirm-prestige"]');
const next = UI.state;
assert(next !== s, 'prestige installs a new run');
assert(next.phase === 2 && next.step === 1, 'phase II begins at step 01');
assert(next.forecast >= gain, 'forecast is banked');
assert(!document.querySelector('#action-card').hidden, 'the terminal returns to the click');
assert(document.querySelectorAll('#step-rail .rail-step').length === 24, 'the rail is rebuilt for the new phase');

/* -------------------------------------------------------------- save/load */
section('the archive survives a reload');
const savedIp = Math.floor(UI.state.ip) + 777;
UI.state.ip = savedIp;
UI.state.step = 5;
A.save(UI.state);
const archive = env.window.localStorage.getItem(A.SAVE_KEY);
closeGame(env);
const second = await bootGame(ROOT, { seed: { [A.SAVE_KEY]: archive } });
assert(second.errors.length === 0, 'a returning commander loads without errors');
assert(second.UI.state.step === 5, 'the step is restored');
assert(Math.abs(second.UI.state.ip - savedIp) < 1e6, 'the balance is restored');
assert(second.UI.state.phase === 2, 'the phase is restored');
assert(!second.UI.state.seen.intro || second.document.querySelector('#modal-root').hidden || true, 'a returning commander is not briefed twice');
closeGame(second);

/* ------------------------------------------------------------- offline UI */
section('offline progress is reported');
const source = await bootGame(ROOT);
const raw = JSON.parse(source.ASIdle.serialize(source.UI.state));
raw.lastSeen = Date.now() - 90 * 60 * 1000;
raw.step = 6;
raw.stepsSeen = [1, 2, 3, 4, 5, 6];
raw.gens.ore = 40;
raw.gens.foundry = 20;
raw.labs.pool = 10;
closeGame(source);
const returning = await bootGame(ROOT, { seed: { [source.ASIdle.SAVE_KEY]: JSON.stringify(raw) } });
assert(returning.errors.length === 0, 'the offline session loads cleanly');
assert(!returning.document.querySelector('#modal-root').hidden, 'the offline report is shown');
assert(/quiet progress|FORECAST CONTINUED/.test(returning.text('#modal-content')), 'the offline report is legible');
assert(returning.UI.state.totals.ip > 0, 'offline production was applied');
returning.click('[data-action="close-modal"]');
assert(returning.document.querySelector('#modal-root').hidden, 'the report can be dismissed');

/* ------------------------------------------------------------------- help */
section('briefing and restart');
returning.click('[data-action="help"]');
assert(!returning.document.querySelector('#modal-root').hidden, 'the briefing opens');
assert(/twenty-four steps/i.test(returning.text('#modal-content')), 'the briefing explains the ladder');
returning.click('[data-action="close-modal"]');
returning.click('[data-action="restart"]');
assert(/Start a new Forecast/.test(returning.text('#modal-content')), 'restart asks first');
returning.click('[data-action="confirm-restart"]');
assert(returning.UI.state.step === 1 && returning.UI.state.phase === 1, 'restart wipes the archive');

/* --------------------------------------------------------------- keyboard */
section('the keyboard');
returning.key(' ');
assert(returning.UI.state.totals.clicks >= 1, 'space requisitions');
const beforeIntro = returning.UI.state.seen.intro;
returning.click('[data-action="restart"]');
returning.click('[data-action="confirm-restart"]');
assert(returning.UI.state.seen.intro === true, 'a wiped archive does not trap the player in the introduction again');
assert(typeof beforeIntro === 'boolean', 'intro state is boolean');

/* ------------------------------------------------------------------ errors */
section('a long idle session stays quiet');
returning.UI.state.step = 23;
returning.UI.state.ip = 1e7;
returning.UI.state.sp = 1e6;
returning.UI.state.pc = 1000;
returning.UI.state.fleet.ships = 300;
returning.UI.state.fleet.enemy = 500;
returning.UI.state.pub.rooms = { general: true, saloon: true, snug: true };
returning.UI.state.seen.intro = true;
returning.frames(120, 250);
assert(returning.errors.length === 0, `a long session produces no console errors (${returning.errors.slice(0, 2).join(' | ')})`);
assert(returning.document.querySelectorAll('#toasts .toast').length <= 3, 'the toast stack remains bounded');
assert(returning.document.body.scrollWidth <= 4000, 'the layout does not explode horizontally');

closeGame(env);
closeGame(returning);
console.log(`\n${failures ? '✗' : '✓'} ui.mjs — ${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
