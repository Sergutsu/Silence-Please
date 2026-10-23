/* Checks for the moving interface: the star that was removed, the ambient layer,
   the numbers that flash when they change, and the mission panel that pulses when
   the order changes. */
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";

const KEY = "absolute-superiority-campaign-v1";
const html = fs.readFileSync("index.html", "utf8");

function boot() {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://command.test/",
  });
  const w = dom.window;
  w.setInterval = () => 0;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  for (const file of ["lore", "directorate", "campaign-combat", "campaign"])
    w.eval(fs.readFileSync(`src/${file}.js`, "utf8"));
  const click = (selector) => {
    const el = w.document.querySelector(selector);
    assert.ok(el, `missing element ${selector}`);
    if (el.click) el.click();
    else el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  };
  return {
    w,
    click,
    text: (selector) => w.document.querySelector(selector).textContent,
    state: () => JSON.parse(w.localStorage.getItem(KEY)),
    close: () => w.close(),
  };
}

let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`  ok   ${name}`);
}

test("the floating star is gone from the sidebar", () => {
  const g = boot();
  assert.equal(g.w.document.querySelector(".seal"), null);
  assert.equal(g.w.document.querySelector(".sidebar-bottom .seal"), null);
  assert.ok(g.text(".sidebar-bottom").includes("SUPERIORITY IS A THEORY"));
  assert.ok(!fs.readFileSync("command.css", "utf8").includes(".seal {"));
  g.close();
});

test("the command terminal carries an ambient scanner layer", () => {
  const g = boot();
  assert.ok(g.w.document.querySelector(".workspace > .ambient"));
  const css = fs.readFileSync("command.css", "utf8");
  for (const key of [
    "@keyframes ambientSweep",
    "@keyframes railSweep",
    "@keyframes topbarTrace",
    "@keyframes radarSpin",
    "@keyframes panelSheen",
    "@keyframes valueBump",
    "@keyframes ctaBreath",
  ])
    assert.ok(css.includes(key), `missing ${key}`);
  // and every one of them is switched off for people who ask for less motion
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  for (const selector of [
    ".ambient::before",
    ".sidebar::after",
    ".topbar::after",
    ".workspace .map::after",
    ".mission::after",
    ".workspace .resource.bump .value",
  ])
    assert.ok(reduced.includes(selector), `${selector} is not calmed down`);
  g.close();
});

test("resources are staggered and flash only when they move", () => {
  const g = boot();
  g.click("#prologue-skip");
  const cells = [...g.w.document.querySelectorAll("#resources .resource")];
  assert.equal(cells.length, 5);
  cells.forEach((cell, i) =>
    assert.equal(cell.getAttribute("style"), `--i:${i}`, `cell ${i} has no stagger index`),
  );
  assert.equal(g.w.document.querySelectorAll("#resources .resource.bump").length, 0);

  // 80 IP leaves the account: the first meter flashes, the others stay still.
  g.click('[data-view="production"]');
  g.click('[data-action="build"]');
  assert.equal(g.state().ip, 160);
  const after = [...g.w.document.querySelectorAll("#resources .resource")];
  assert.ok(after[0].classList.contains("bump"), "the IP meter did not flash");
  assert.equal(after[1].classList.contains("bump"), false, "the SP meter flashed for nothing");
  assert.equal(after[2].classList.contains("bump"), false);
  g.close();
});

test("the mission panel pulses when the next order changes", () => {
  const g = boot();
  g.click("#prologue-skip");
  g.click("#coach-skip");
  g.click('[data-view="headquarters"]');
  assert.equal(g.w.document.querySelector("#mission").classList.contains("flash"), false);
  assert.equal(g.text(".mission-order h2"), "Deploy the fleet");

  g.click('[data-view="bridge"]');
  g.click('[data-action="battle"]');
  assert.equal(g.w.document.querySelector("#mission").classList.contains("flash"), true);
  g.click('[data-action="retreat"]');
  assert.equal(g.text(".mission-order h2"), "Authorize a prototype");
  g.close();
});

console.log(`${checks} motion checks passed: star removed, ambient layer, flashing meters, mission pulse.`);
