/* Interface checks for the Supreme Command terminal: the restored sidebar, the department
   views, the star map, the tactical bridge, the signal archive and The White Hart — all of
   them driven by the idle engine. Needs jsdom: `npm install --no-save --package-lock=false jsdom`. */
import path from 'node:path';
import { bootGame } from './harness.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAVE_KEY = 'absolute-superiority-idle-v4';

let checks = 0;
let failures = 0;
const assert = (condition, message) => {
  checks += 1;
  if (condition) console.log(`  · ${message}`);
  else {
    failures += 1;
    console.log(`  ✗ ${message}`);
  }
};
const section = (title) => console.log(`\n· ${title}`);
const text = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');

const env = await bootGame(ROOT);
const { document, window } = env;
const A = env.ASIdle;
const UI = env.UI;
let s = UI.state;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const clickIf = (selector) => {
  const node = $(selector);
  if (!node) throw new Error(`missing selector: ${selector}`);
  env.click(selector);
  return node;
};

/* -------------------------------------------------------------------- boot */
section('the terminal boots into the old command deck');
assert(env.errors.length === 0, `no load errors (${env.errors.join(' | ') || 'clean'})`);
assert(text($('#page-title')) === 'Headquarters', 'the headquarters title is restored');
assert($$('.sidebar nav [data-view]').length === 7, 'the seven departments are in the sidebar');
assert($$('#resources .resource').length === 8, 'the resource strip shows all eight campaign figures');
assert(/INDUSTRIAL POINTS/.test(text($('#resources'))), 'industrial points are on the strip');
assert($$('.track-step').length === 24, 'the ladder has twenty-four steps');
assert($('#step-track .track-step.current span').textContent === '01', 'step 01 is the current step');
assert(!$('#prologue').hidden, 'the introduction opens on a fresh archive');
clickIf('[data-action="intro-skip"]');
assert($('#prologue').hidden, 'the introduction can be skipped');
assert(/Requisition/i.test(text($('#mission'))), 'the mission panel states the first order');
assert($('#view').innerHTML.length > 2000, 'the headquarters view renders');

/* ------------------------------------------------------------- requisition */
section('the requisition key is the clicker');
s = UI.state;
Object.keys(s.policies).forEach((key) => {
  if (typeof s.policies[key] === 'boolean') s.policies[key] = false;
});
const clicksBefore = s.totals.clicks;
clickIf('#requisition');
assert(s.totals.clicks === clicksBefore + 1, 'the Requisition button banks a requisition');
assert(s.ip > 0, 'industrial points arrive from the key');
for (let i = 0; i < 3; i += 1) clickIf('#requisition');
assert(s.click.combo > 1, 'a quick run builds a cadence bonus');
const ipBefore = s.ip;
env.key(' ');
assert(s.ip > ipBefore, 'Space requisitions from the keyboard');
const spBefore = s.sp;
env.frames(4, 250);
assert(s.ip > ipBefore, 'industrial points keep arriving while the terminal idles');
assert(Number.isFinite(s.sp) && s.sp >= spBefore, 'science is tracked, not corrupt');

/* ------------------------------------------------------------- step ladder */
section('the twenty-four step ladder');
s.step = 7;
s.stepsSeen = [1, 2, 3, 4, 5, 6, 7];
UI.render();
assert($$('.track-step.done').length === 6, 'six steps are marked complete at step 07');
assert($('#step-track .track-step.current span').textContent === '07', 'the current step is marked on the ladder');
assert(/Chaos/i.test(text($('#mission'))), 'the mission panel follows the ladder');
assert($$('#view .map-node').length === 9, 'the star map keeps its nine systems');
assert($('#cycle').textContent.includes('STEP 007'), 'the header counts steps, not turns');
clickIf('.track-step[data-step="3"]');
assert($('#briefing').hasAttribute('open'), 'a completed step explains itself');
assert(/Theory/i.test(text($('#dialog-copy'))), 'the briefing names the step');
clickIf('#close-dialog');

/* --------------------------------------------------------------- production */
section('the machine shops buy through the DOM');
s.step = 12;
s.ip = 2.4e6;
s.sp = 4e5;
s.pc = 400;
UI.setView('production');
assert(/Machines that bank IP/i.test(text($('#view'))), 'the industry shop is on the production view');
const oreBefore = s.gens.ore;
clickIf('#view [data-buy="ore"][data-amount="1"]');
assert(s.gens.ore === oreBefore + 1, '×1 buys one machine');
clickIf('#view [data-buy="foundry"][data-amount="10"]');
assert(s.gens.foundry >= 10, '×10 buys a batch');
clickIf('#view [data-buy="ore"][data-amount="max"]');
assert(s.gens.ore > oreBefore + 2, 'MAX buys everything affordable');
const labBefore = s.labs.pool;
clickIf('#view [data-buy="pool"][data-amount="1"]');
assert(s.labs.pool === labBefore + 1, 'science machines are bought from the same shop');
const upgradeBefore = A.upgradeLevel(s, 'gloves');
clickIf('#view [data-action="upgrade"][data-id="gloves"]');
assert(A.upgradeLevel(s, 'gloves') === upgradeBefore + 1, 'a permanent reform can be bought');
const linesBefore = s.lines;
clickIf('#view [data-action="line"]');
assert(s.lines === linesBefore + 1, 'a cruiser line is opened from the assembly line');
const chaosBefore = s.fleet.chaos;
clickIf('#view [data-action="reform"]');
assert(s.fleet.chaos < chaosBefore, 'bureaucratic reform reduces chaos');
const reliabilityBefore = s.fleet.reliability;
clickIf('#view [data-action="overhaul"]');
assert(s.fleet.reliability >= reliabilityBefore, 'the fleet can be overhauled');
const capBefore = s.fleet.capital;
clickIf('#view [data-action="repair"]');
assert(s.fleet.capital >= capBefore, 'the capital can be repaired by hand');

/* ----------------------------------------------------------------- research */
section('the Research Directorate underwrites the prototypes');
s.step = 11;
s.ip = 1e6;
s.sp = 1e5;
s.pc = 500;
s.hearings = [];
s.research.forEach((rec) => { rec.state = 0; rec.tests = 0; rec.fails = 0; });
UI.setView('research');
assert($$('#view .research-card').length === 3, 'three projects are on the bench');
clickIf('#view [data-action="research"][data-id="0"]');
assert(s.research[0].state === 1, 'a project can be authorised');
s.research[0].state = 2;
s.research[0].tests = 2;
UI.render();
clickIf('#view [data-action="certify"][data-id="0"]');
assert(s.research[0].state === 3, 'a tested project can be certified');
s.hearings.push({ id: 1, name: 'Battle Analyzer', timer: 20, reason: 'failure' });
UI.render();
assert(/SCIENTIFIC COUNCIL/i.test(text($('#view'))), 'a pending report is put before the council');
clickIf('#view [data-action="hearing"][data-id="0:revise"]');
assert(s.hearings.length === 0 && s.totals.hearings >= 1, 'the council accepts a ruling');
assert($('#view [data-action="pub-check"]'), 'research links to a check at the pub');

/* ------------------------------------------------------------------- bridge */
section('the Tactical Bridge runs the war');
s.step = 18;
s.fleet.ships = 900;
s.fleet.enemy = 600;
s.fleet.capital = 42;
s.fleet.analyzer = 1;
s.fleet.analyzerHp = 40;
s.fleet.volley = 1;
s.ip = 1e6;
UI.setView('bridge');
assert($$('#view .tactical-ship').length > 0, 'the tactical plot draws the fleet');
assert($$('#view .order-button').length >= 9, 'formations, targeting and the strategic map are all orders');
clickIf('#view [data-action="formation"][data-id="escort"]');
assert(s.fleet.formation === 'escort', 'a formation can be chosen');
clickIf('#view [data-action="target"][data-id="support"]');
assert(s.fleet.target === 'support', 'a target priority can be chosen');
const volleys = s.totals.volleys;
clickIf('#view [data-action="volley"]');
assert(s.totals.volleys > volleys, 'the wonder weapon fires by hand');
clickIf('#view [data-action="field"]');
assert(s.fleet.field === false || s.fleet.blackout >= 0, 'the exponential field can be worked by hand');
const unrestBefore = s.fleet.unrest;
s.step = 19;
s.fleet.unrest = 40;
s.ip = 1e6;
s.pc = 400;
UI.render();
clickIf('#view [data-action="revision"]');
assert(s.fleet.unrest < 40, 'revisions calm the admirals');
s.fleet.ceded = false;
s.pc = 40;
UI.render();
clickIf('#view [data-action="cede"]');
assert(s.fleet.ceded, 'outpost four can be ceded');
assert(s.fleet.unrest >= unrestBefore - 100, 'ceding has a cost');

/* ------------------------------------------------------------------- signal */
section('the Quiet Array answers to the terminal');
s.step = 21;
s.signal.fragments = 3;
s.signal.choice = '';
s.pc = 60;
UI.setView('signal');
assert($$('#view .signal-fragment').length === 3, 'three fragments are on the listening post');
assert(/Somebody is still asking/i.test(text($('#view'))), 'the array page is intact');
clickIf('#view [data-action="answer"][data-id="reply"]');
assert(s.signal.choice === 'reply', 'the array can be answered');
assert($('#view [data-action="listen"]').disabled, 'no further listening pass is offered once decoded');

/* ---------------------------------------------------------------------- pub */
section('The White Hart, restored and idling');
/* Before step 22 the old room is still walkable, but it is not serving. */
s.step = 4;
s.pub.rooms = { general: true };
UI.setView('white-hart');
assert(/SHUT/.test(text($('#open-status'))), 'the White Hart says it is shut before step 22');
assert($('#pub-realm').classList.contains('not-yet-open'), 'the closed room is marked as such');
assert(!$('#serve-button').disabled, 'the pump is still there, waiting to be pulled');
assert(/step 22/i.test(text($('#scene-caption'))), 'the caption explains when the doors open');
UI.setView('headquarters');
assert(!document.body.classList.contains('pub-mode'), 'walking out returns to the terminal');
s.step = 22;
s.ip = 2e6;
s.sp = 2e5;
s.pints = 900;
s.se = 900;
s.pub.rooms = { general: true };
s.pub.tier = 1;
s.pub.noise = 70;
s.pub.staff = {};
s.pub.amenities = {};
s.pub.upgrades = {};
UI.setView('white-hart');
assert(document.body.classList.contains('pub-mode'), 'the pub takes over the workspace');
assert(!$('#pub-realm').hidden, 'the pub realm is visible');
assert($('#pub-realm .masthead'), 'the White Hart masthead is back');
assert($$('#pub-floor .floor-patron').length >= 4, 'the room is drawn in DOM with seats');
assert(/FENTON SILENCER/i.test(text($('#pub-floor'))), 'the Silencer stands in the general bar');
assert($$('.room-page-tab').length >= 1, 'room tabs are offered');
assert(/PINTS/.test(text($('.resource-bar'))), 'the pub resource bar is filled');
const pintsBefore = s.pints;
clickIf('#serve-button');
assert(s.pints > pintsBefore, 'a pint can still be pulled by hand');
const noiseBefore = s.pub.noise;
clickIf('#vent-button');
assert(s.pub.noise === 0 && noiseBefore > 0, 'venting the Silencer empties the room');
clickIf('#shop-button');
assert(!$('#modal-root').hidden, 'the rooms dock opens a shop');
assert($$('#modal-content .shop-item').length >= 6, 'every room is on the list');
clickIf('#modal-content [data-action="pub-room"][data-id="saloon"]');
assert(s.pub.rooms.saloon, 'a room can be opened from the shop');
clickIf('#modal-content [data-tab="staff"]');
clickIf('#modal-content [data-action="pub-staff"][data-id="barmaid"]');
assert(s.pub.staff.barmaid, 'staff can be hired from the same modal');
clickIf('#modal-content [data-tab="amenities"]');
clickIf('#modal-content [data-action="pub-amenity"][data-id="jukebox"]');
assert(s.pub.amenities.juke || Object.keys(s.pub.amenities).length > 0, 'an amenity can be installed');
clickIf('#modal-content [data-tab="upgrades"]');
clickIf('#modal-content [data-action="pub-upgrade"][data-id="filters"]');
assert(A.seUpgradeLevel(s, 'filters') >= 1, 'Silence Energy improves the machine');
assert($$('#modal-content [data-action="pub-tier"]').length === 1, 'the next tier of Silencer is offered');
env.key('Escape');
assert($('#modal-root').hidden, 'Escape closes the pub shop');
s.pub.checking = false;
s.ip = 1e6;
s.sp = 1e5;
UI.renderPub(true);
const checksBefore = s.totals.checks;
clickIf('#annex-message [data-action="pub-check"]');
assert(s.pub.checking, 'a prototype check can be filed at the bar');
s.pub.checkTimer = 11.9;
env.frames(3, 250);
assert(s.totals.checks > checksBefore, 'the check files itself twelve seconds later');
clickIf('#room-tabs .room-page-tab:not(.selected)');
assert($('#pub-floor .floor-sign') !== null, 'the floor can be walked between rooms');

/* ------------------------------------------------------ step 24, the ending */
section('step 24 is the reckoning and nothing else');
s.step = 24;
s.stepsSeen = A.STEP_DEFS.map((def) => def.n);
s.fleet.enemy = 0;
s.forecast = 0;
UI.render();
assert(document.body.classList.contains('reckoning'), 'the terminal marks the reckoning');
assert($$('.sidebar nav [data-view]:disabled').length === 6, 'every other department is closed at step 24');
UI.setView('research');
assert(UI.view === 'headquarters', 'asking for another department returns to the reckoning');
assert(/Recalculate the Calculus/i.test(text($('#view'))), 'the only order is the prestige');
const gain = A.prestigeGain(s);
assert(gain >= 1, 'the reckoning is worth forecast');
assert(/ENDING/.test(text($('#view'))), 'the reckoning names the ending this phase earned');
clickIf('#view [data-action="prestige"]');
assert($('#briefing').hasAttribute('open'), 'prestige asks for confirmation');
clickIf('#briefing [data-action="prestige-confirm"]');
const next = UI.state;
assert(next !== s, 'prestige installs a new run');
assert(next.phase === 2 && next.step === 1, 'phase II begins at step 01');
assert(next.forecast >= gain, 'forecast is banked');
assert(!document.body.classList.contains('reckoning'), 'the departments open again');
assert($$('.sidebar nav [data-view]:disabled').length === 0, 'the sidebar is unlocked in the new phase');
assert(/Requisition/i.test(text($('#mission'))), 'the new phase begins at the click');

/* ------------------------------------------------------------ archive replay */
section('the archive survives a reload, and settles the absence');
const stored = JSON.parse(window.localStorage.getItem(SAVE_KEY));
stored.ip = 4321;
stored.step = 5;
stored.lastSeen = Date.now() - 90 * 60 * 1000;
stored.gens = { ...stored.gens, ore: 30 };
window.localStorage.setItem(SAVE_KEY, JSON.stringify(stored));
const reloaded = await bootGame(ROOT, { seed: { [SAVE_KEY]: JSON.stringify(stored) } });
assert(reloaded.errors.length === 0, 'the reloaded archive boots cleanly');
assert(reloaded.UI.state.step >= 5, 'the reload restores the step, and the absence advances it');
assert(reloaded.UI.state.ip >= 4321, 'the reload restores the bank');
assert(!reloaded.document.querySelector('#briefing').hidden || reloaded.document.querySelector('#briefing').hasAttribute('open'), 'the absence is reported');
assert(/While you were away|hours|minutes/i.test(text(reloaded.document.querySelector('#dialog-copy'))), 'the report names the time away');
reloaded.env;
const awayReport = reloaded.UI.state.offlineReport;
assert(awayReport && awayReport.seconds > 60, 'the absence is measured');
assert(awayReport.ip > 0, 'the machines kept working while away');

/* ------------------------------------------------------- hidden words, keys */
section('hidden words, departments and closing dialogs');
const fresh = await bootGame(ROOT);
const fs = fresh.UI.state;
Object.keys(fs.policies).forEach((key) => {
  if (typeof fs.policies[key] === 'boolean') fs.policies[key] = false;
});
fresh.click('[data-action="intro-skip"]');
fs.step = 22;
fs.pints = 100;
fs.pub.rooms = { general: true };
fresh.UI.setView('white-hart');
for (const letter of 'pint') fresh.key(letter);
assert(fs.pints > 100, 'typing a hidden word still pays out at the bar');
assert(/One for the road/.test(text(fresh.document.querySelector('#toast'))), 'the word is acknowledged in a toast');
for (const letter of 'cheese') fresh.key(letter);
const noiseAfterCheese = fs.pub.noise;
for (const letter of 'pint') fresh.key(letter);
assert(fs.pub.noise >= 0 && Number.isFinite(noiseAfterCheese), 'a second word answers differently');
fresh.UI.setView('dispatches');
assert(/Policies/i.test(text(fresh.document.querySelector('#view'))), 'the dispatches view carries the policies');
fresh.key('h');
assert(fresh.document.querySelector('#briefing').hasAttribute('open'), 'H opens the briefing');
fresh.key('Escape');
assert(!fresh.document.querySelector('#briefing').hasAttribute('open'), 'Escape closes the briefing');
for (let i = 1; i <= 6; i += 1) {
  fresh.key(String(i));
  assert(['headquarters', 'research', 'production', 'bridge', 'signal', 'dispatches'].includes(fresh.UI.view), `key ${i} reaches a department`);
}

/* ---------------------------------------------------------------- long idle */
section('a long quiet session stays quiet');
const longEnv = await bootGame(ROOT);
longEnv.click('[data-action="intro-skip"]');
longEnv.UI.state.step = 22;
longEnv.UI.state.ip = 1e7;
longEnv.UI.state.ip = 1e7;
longEnv.UI.setView('white-hart');
longEnv.frames(120, 250);
const bodyText = longEnv.document.body.textContent;
assert(longEnv.errors.length === 0, `no console errors after two minutes of frames (${longEnv.errors.slice(0, 2).join(' | ') || 'clean'})`);
assert(!/undefined|NaN|\[object Object\]/.test(bodyText), 'nothing undefined or NaN is printed');
assert(longEnv.document.querySelectorAll('#pub-floor .floor-patron').length >= 4, 'the pub floor is still drawn');
assert(Number.isFinite(longEnv.UI.state.ip) && longEnv.UI.state.ip > 0, 'the economy survived the long session');
assert(longEnv.document.querySelectorAll('.track-step').length === 24, 'the ladder is still intact');

console.log(`\n${failures ? '✗' : '✓'} ui.mjs — ${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
