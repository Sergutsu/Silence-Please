/* Plays the pub with a simple policy to see whether the economy actually holds together. */
import path from 'node:path';
import { bootGame } from './harness.mjs';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WEEKS = Number(process.argv[3] || 14);

const { window, WH, step, errors } = await bootGame(ROOT, { width: 900, height: 620 });

// main.js derives dt from performance.now(), so give it a virtual clock: a week of
// Wednesday service then costs a few hundred frames instead of thirty real seconds.
let virtualNow = 1000;
window.performance.now = () => virtualNow;
const st = () => WH.game.state;
const C = WH.content;

let explosions = 0;
let lastWeek = st().week;
let lastExplosions = st().explosions;
const log = [];

function serveSomeone() {
  const state = st();
  const selected = state.patrons.find((p) => p.id === state.selectedPatron);
  if (state.beerReady && selected) {
    WH.game.selectPatron(selected.id);   // the second tap serves
    return;
  }
  const waiting = state.patrons
    .filter((p) => !p.leaving)
    .sort((a, b) => a.patience - b.patience)[0];
  if (!waiting) return;
  WH.game.selectPatron(waiting.id);
  WH.game.pourSelectedPint();
}

function manageZones() {
  const state = st();
  const ratio = state.energy / WH.game.capacity();
  const open = C.ROOM_DEFS.filter((room) => state.rooms[room.id].unlocked && !state.rooms[room.id].damaged);
  if (ratio > 0.9) {
    // Turn off the quietest active zone to let the machine breathe.
    const on = open.filter((room) => WH.game.zoneIsOn(room.id)).sort((a, b) => WH.game.roomNoise(a.id) - WH.game.roomNoise(b.id));
    if (on.length > 1) WH.game.toggleZone(on[0].id);
    else if (on.length === 1 && ratio > 0.96) WH.game.toggleZone(on[0].id);
  } else if (ratio < 0.72) {
    open.forEach((room) => { if (!WH.game.zoneIsOn(room.id)) WH.game.toggleZone(room.id); });
  }
  if (state.venting !== (ratio > 0.8)) WH.game.toggleVenting();
}

function spend() {
  const state = st();
  const locked = C.ROOM_DEFS.find((room) => !state.rooms[room.id].unlocked && room.id !== 'green');
  C.ROOM_DEFS.forEach((room) => { if (state.rooms[room.id].damaged) WH.game.tryRebuildRoom(room.id); });
  if (WH.game.buyTier(state.tier + 1)) return;
  if (locked) {
    if (WH.game.tryUnlockRoom(locked.id)) return;
    // Save up for the next room rather than spending the takings on trinkets.
    if (state.resources.pints < locked.cost + 400) return;
  }
  C.SE_UPGRADES.forEach((entry) => { if (entry.id !== 'dump') WH.game.buySEUpgrade(entry.id); });
  C.STAFF_DEFS.forEach((entry) => {
    if (WH.game.upgradeCount(entry.id) < (entry.max || 99) && state.resources.pints > 400) WH.game.buyStaff(entry.id);
  });
  C.AMENITY_DEFS.forEach((entry) => {
    if (state.resources.pints > 500 && WH.game.upgradeCount(entry.id) < (entry.max || 99)) WH.game.buyAmenity(entry.id);
  });
}

const dt = 1 / 20;
let decisionClock = 0;
let spendClock = 0;
const startedAt = Date.now();
let frames = 0;

while (!st().won && !st().gameOver && st().week <= WEEKS) {
  virtualNow += dt * 1000;
  step(1, dt * 1000);
  frames += 1;
  if (frames > 200000) { log.push('  (frame cap reached)'); break; }
  decisionClock += dt;
  spendClock += dt;
  if (decisionClock >= 0.35) { decisionClock = 0; serveSomeone(); manageZones(); }
  if (spendClock >= 2) { spendClock = 0; spend(); }
  if (st().week !== lastWeek) {
    lastWeek = st().week;
    const s = st();
    log.push(`  week ${String(s.week).padStart(2, '0')} · tier ${s.tier} · rep ${s.reputation.toFixed(0)} · pints ${Math.floor(s.resources.pints)} · research ${Math.floor(s.resources.research)} · rooms ${C.ROOM_DEFS.filter((r) => s.rooms[r.id].unlocked).length} · explosions ${s.explosions}`);
  }
  if (st().explosions !== lastExplosions) { lastExplosions = st().explosions; explosions += 1; }
}

const s = st();
console.log(log.join('\n'));
console.log(`\nweeks played: ${s.week} · won: ${Boolean(s.won)} · game over: ${Boolean(s.gameOver)}`);
console.log(`tier ${s.tier} · reputation ${s.reputation.toFixed(1)} · explosions ${s.explosions} · weeks survived ${s.weeksSurvived}`);
console.log(`resources: pints ${Math.floor(s.resources.pints)} · scoops ${Math.floor(s.resources.scoops)} · manuscripts ${Math.floor(s.resources.manuscripts)} · research ${Math.floor(s.resources.research)} · loyalty ${Math.floor(s.resources.loyalty)}`);
console.log(`achievements ${s.achievements.length}/${C.ACHIEVEMENTS.length} · eggs ${s.eggs.length} · served ${s.stats.patronsServed} patrons for ${Math.floor(s.stats.pintsServed)} pints · lost ${s.stats.patronsLost}`);
console.log(`${frames} frames (${(frames * dt).toFixed(0)} game seconds) in ${(Date.now() - startedAt) / 1000}s of wall clock; ${errors.length} runtime errors`);
if (errors.length) console.log([...new Set(errors)].slice(0, 5).join('\n'));
