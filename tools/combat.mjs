/* Pure deterministic combat tests; no npm dependencies needed. */
import vm from "node:vm";
import fs from "node:fs";
import assert from "node:assert/strict";
const context = { window: {} };
vm.runInNewContext(fs.readFileSync("src/campaign-combat.js", "utf8"), context);
const C = context.window.ASCombat;
let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`  ok   ${name}`);
}

test("pause freezes time, shields, and damage", () => {
  const b = C.create(8, 24);
  C.weapon(b, 2, false);
  b.paused = true;
  const before = JSON.stringify(b);
  C.step(b, 87);
  assert.equal(JSON.stringify(b), before);
});
test("formations exchange firepower for protection", () => {
  const line = C.create(8, 24),
    screen = C.create(8, 24),
    assault = C.create(8, 24);
  C.order(screen, "formation", "screen");
  C.order(assault, "formation", "assault");
  [line, screen, assault].forEach((b) => C.step(b, 100));
  assert.ok(screen.ours > line.ours && assault.ours < line.ours);
  assert.ok(screen.foes > line.foes && assault.foes < line.foes);
});
test("command targeting suppresses enemy fire at a damage cost", () => {
  const a = C.create(8, 24),
    b = C.create(8, 24);
  C.order(b, "target", "command");
  C.step(a, 100);
  C.step(b, 100);
  assert.ok(b.ours > a.ours && b.foes > a.foes);
});
test("unsafe sphere consumes launcher; certified drones do not", () => {
  const a = C.create(8, 24),
    b = C.create(8, 24);
  C.weapon(a, 0, false);
  C.weapon(b, 0, true);
  assert.equal(a.ours, 185);
  assert.equal(b.ours, 240);
  assert.equal(a.foes, b.foes);
  assert.equal(a.events[0].id, 0);
  assert.equal(b.events.length, 0);
  assert.equal(C.weapon(a, 0, false), false);
});
test("enemy learns to attack analyzer and retains doctrine next battle", () => {
  const b = C.create(8, 24);
  C.weapon(b, 1, false);
  for (let i = 0; i < 5; i++) C.step(b, 30);
  assert.equal(b.adapted, true);
  assert.equal(b.analyzer.hp, 0);
  assert.ok(b.events.some((e) => e.type === "adaptation"));
  assert.ok(b.events.some((e) => e.id === 1));
  const next = C.create(8, 24, true);
  C.weapon(next, 1, false);
  C.step(next, 30);
  assert.equal(next.analyzer.hp, 16);
});
test("escort screen protects a fragile analyzer", () => {
  const b = C.create(8, 24);
  C.order(b, "formation", "screen");
  C.weapon(b, 1, false);
  for (let i = 0; i < 5; i++) C.step(b, 30);
  assert.ok(b.analyzer.hp > 0);
  assert.ok(!b.events.some((e) => e.type === "failure"));
});
test("certified analyzer safely evacuates its crew", () => {
  const b = C.create(8, 24, true);
  C.weapon(b, 1, true);
  for (let i = 0; i < 7; i++) C.step(b, 1);
  assert.equal(b.analyzer.hp, 0);
  assert.equal(b.events.length, 0);
  assert.ok(b.signals.some((x) => x.includes("evacuation")));
});
test("field protects flagship only, then induces six seconds of hysteresis", () => {
  const b = C.create(8, 24);
  C.weapon(b, 2, false);
  C.step(b, 30);
  assert.ok(b.ours < 240, "Escorts must still take damage");
  assert.equal(b.events.length, 0);
  for (let i = 0; i < 7; i++) C.step(b, 30);
  assert.equal(b.blackout, 6);
  assert.equal(b.events[0].id, 2);
  assert.equal(C.order(b, "formation", "screen"), false);
  assert.equal(C.weapon(b, 0, true), false);
  for (let i = 0; i < 6; i++) C.step(b, 30);
  assert.equal(b.blackout, 0);
  assert.equal(C.order(b, "formation", "screen"), true);
});
test("deactivating during withdrawal cannot bypass hysteresis", () => {
  const b = C.create(8, 24);
  C.weapon(b, 2, false);
  C.deactivate(b);
  assert.equal(b.events[0].id, 2);
  C.deactivate(b);
  assert.equal(b.events.length, 1);
  const safe = C.create(8, 24);
  C.weapon(safe, 2, true);
  C.deactivate(safe);
  assert.equal(safe.events.length, 0);
  assert.equal(safe.blackout, 0);
});
test("single flagship is invulnerable while field is active", () => {
  const b = C.create(1, 24);
  C.weapon(b, 2, true);
  C.step(b, 100);
  assert.equal(b.ours, 30);
});
test("restored legacy battles gain order defaults and pause", () => {
  const b = C.restore({
    ours: 240,
    foes: 144,
    initialShips: 8,
    count: 8,
    tick: 4,
    used: [],
    shield: 0,
  });
  assert.equal(b.formation, "line");
  assert.equal(b.paused, true);
  assert.equal(b.blackout, 0);
});
test("destroyed enemies cannot fire a final volley", () => {
  const b = C.create(8, 1);
  b.foes = 1;
  C.step(b, 100);
  assert.equal(b.ours, 240);
  assert.equal(C.result(b), true);
});
console.log(`${checks} deterministic combat checks passed.`);
