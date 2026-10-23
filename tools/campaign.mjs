/* DOM-level integration tests for the offline campaign. */
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";
const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
  runScripts: "outside-only",
  url: "https://command.test/",
});
const w = dom.window;
let tick;
w.setInterval = (fn) => {
  tick = fn;
};
w.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
w.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
w.eval(fs.readFileSync("src/lore.js", "utf8"));
w.eval(fs.readFileSync("src/directorate.js", "utf8"));
w.eval(fs.readFileSync("src/campaign-combat.js", "utf8"));
w.eval(fs.readFileSync("src/campaign.js", "utf8"));
const click = (q) => {
  const el = w.document.querySelector(q);
  assert.ok(el, q);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const state = () =>
  JSON.parse(w.localStorage.getItem("absolute-superiority-campaign-v1"));
click('[data-view="research"]');
click('[data-action="research"][data-id="0"]');
assert.equal(state().halt, 2);
assert.equal(state().sp, 40);
click('[data-action="test"][data-id="0"]');
click("#close-dialog");
click('[data-action="test"][data-id="0"]');
click("#close-dialog");
click('[data-action="fix"][data-id="0"]');
assert.equal(state().tech[0], 2);
click('[data-view="bridge"]');
click('[data-action="battle"]');
assert.equal(w.document.querySelector("#end-turn").disabled, true);
click('[data-action="battle"]');
const paused = state().battle.tick;
tick();
assert.equal(state().battle.tick, paused);
click('[data-action="battle"]');
click('[data-action="weapon"][data-id="0"]');
assert.equal(state().reliability, 87);
assert.equal(state().certifiedUsed, true);
for (let i = 0; i < 60; i++) tick();
assert.equal(state().battle, null);
assert.equal(state().enemy, 16);
click("#end-turn");
assert.equal(state().turn, 13);
assert.equal(state().halt, 1);
click("#end-turn");
assert.equal(state().halt, 0);
click("#end-turn");
assert.equal(state().ships, 10);
click('[data-view="production"]');
click('[data-action="standardize"]');
assert.equal(state().reliability, 100);
click('[data-view="headquarters"]');
click('[data-system="0"]');
assert.ok(
  w.document
    .querySelector(".system-detail")
    .textContent.includes("SOL INVICTA"),
);
click('[data-view="dispatches"]');
click('[data-action="reset"]');
click("#confirm-reset");
assert.equal(state().turn, 12);
assert.equal(state().ships, 8);
assert.ok(w.document.querySelector('nav [data-view="white-hart"]'));
dom.window.close();
console.log(
  "Campaign integration checks passed: research, safeguards, battle, pause, production, map, reset.",
);
