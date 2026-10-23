/* Checks for the moving interface: the star that was removed, one distinct motion
   per department (no effect pasted across the terminal), and reduced-motion cover
   for every animation that ships. */
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";

const KEY = "absolute-superiority-campaign-v1";
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("command.css", "utf8");

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

/* Split the sheet into everything before the reduced-motion block, and the block.
   Comments are stripped so selectors compare cleanly. */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "");
const reducedAt = css.lastIndexOf("@media (prefers-reduced-motion: reduce)");
const mainCss = stripComments(css.slice(0, reducedAt));
const reducedCss = stripComments(css.slice(reducedAt));

test("the floating star is gone from the sidebar", () => {
  const g = boot();
  assert.equal(g.w.document.querySelector(".seal"), null);
  assert.equal(g.w.document.querySelector(".sidebar-bottom .seal"), null);
  assert.ok(g.text(".sidebar-bottom").includes("SUPERIORITY IS A THEORY"));
  assert.ok(!css.includes(".seal {"));
  g.close();
});

test("the ambient layer ships and nothing is pasted across the interface", () => {
  const g = boot();
  assert.ok(g.w.document.querySelector(".workspace > .ambient"));
  // The one-size-fits-all sweep is gone for good.
  assert.equal((css.match(/sheen/g) || []).length, 0, "a sheen crept back in");
  assert.ok(!css.includes(".workspace .panel::after"), "every panel is sheened again");
  assert.ok(!css.includes(".workspace .primary::after,\n.workspace .outline::after"));
  g.close();
});

test("each department has its own signature motion", () => {
  const signatures = {
    refreshFall: "the glass refreshes",
    railSweep: "the sidebar rail",
    topbarTrace: "the top bar trace",
    arrowNudge: "the end-turn arrow",
    radarSpin: "the map radar",
    buildLaser: "the shipyard build laser",
    conveyor: "the production queue",
    cardScan: "the research cards",
    phasePass: "the loop lighting itself in order",
    chargeBar: "the current-order button",
    fragmentDecode: "the signal fragments",
    dossierUncover: "the dossier",
    stampKnock: "the hearing stamp",
    hazardFlicker: "the chaos readout",
    needleSway: "the reliability needle",
  };
  for (const [keyframe, what] of Object.entries(signatures)) {
    assert.ok(css.includes(`@keyframes ${keyframe}`), `missing keyframe for ${what}`);
    // Used once, by its own department — never reused somewhere else.
    const uses = (mainCss.match(new RegExp(`animation:[^;]*\\b${keyframe}\\b`, "g")) || []).length;
    assert.equal(uses, 1, `${keyframe} (${what}) is used ${uses} times; effects must be individual`);
  }
});

test("every animation that ships is switched off for reduced motion", () => {
  const missing = [];
  // Find every selector that starts an animation outside the reduced-motion block.
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = rule.exec(mainCss))) {
    const [, selector, body] = match;
    if (!/animation:\s*(?!none)/.test(body)) continue;
    for (const one of selector.split(",")) {
      const clean = one.trim().replace(/\s+/g, " ");
      if (!clean || clean.startsWith("@")) continue;
      if (!reducedCss.includes(clean)) missing.push(clean);
    }
  }
  assert.deepEqual(missing, [], `not calmed down: ${missing.join(" | ")}`);
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

console.log(
  `${checks} motion checks passed: star removed, per-department motion, reduced-motion cover, flashing meters, mission pulse.`,
);
