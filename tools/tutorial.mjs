/* Integration checks for the campaign briefing: introduction, tutorial coach,
   the mission panel and the end-of-cycle report. */
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";

const KEY = "absolute-superiority-campaign-v1";
const html = fs.readFileSync("index.html", "utf8");

function boot(archive = null) {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://command.test/",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  let step;
  w.setInterval = (fn) => {
    step = fn;
    return 0;
  };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  if (archive) w.localStorage.setItem(KEY, JSON.stringify(archive));
  for (const file of ["lore", "directorate", "campaign-combat", "campaign"])
    w.eval(fs.readFileSync(`src/${file}.js`, "utf8"));
  const click = (selector) => {
    const el = w.document.querySelector(selector);
    assert.ok(el, `missing element ${selector}`);
    // SVG map nodes have no click() in jsdom; dispatch a real bubbling event.
    if (el.click) el.click();
    else el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  };
  const text = (selector) => {
    const el = w.document.querySelector(selector);
    assert.ok(el, `missing element ${selector}`);
    return el.textContent;
  };
  return {
    w,
    click,
    text,
    hidden: (selector) => w.document.querySelector(selector).hidden,
    state: () => JSON.parse(w.localStorage.getItem(KEY)),
    tick: () => step(),
    close: () => w.close(),
  };
}

let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`  ok   ${name}`);
}

test("the introduction plays through five pages and hands over to the coach", () => {
  const g = boot();
  assert.equal(g.hidden("#prologue"), false);
  assert.ok(g.text("#prologue").includes("Twelve thousand years of order"));
  assert.ok(g.text("#prologue").includes("1 / 5"));
  // The mission panel is already live underneath the introduction.
  assert.equal(g.w.document.querySelectorAll("#mission .phase").length, 6);
  for (let i = 0; i < 4; i++) g.click("#prologue-next");
  assert.ok(g.text("#prologue").includes("5 / 5"));
  assert.ok(g.text("#prologue-next").includes("Take command"));
  g.click("#prologue-next");
  assert.equal(g.hidden("#prologue"), true);
  assert.equal(g.state().tour.intro, true);
  assert.equal(g.hidden("#tour-coach"), false);
  assert.ok(g.text(".coach-title").includes("Read the board"));
  assert.ok(g.text(".coach-eyebrow").includes("STEP 1 OF 11"));
  g.close();
});

test("skipping the introduction still offers the tutorial, and skipping that closes it", () => {
  const g = boot();
  g.click("#prologue-skip");
  assert.equal(g.hidden("#prologue"), true);
  assert.equal(g.state().tour.intro, true);
  assert.equal(g.hidden("#tour-coach"), false);
  g.click("#coach-skip");
  assert.equal(g.hidden("#tour-coach"), true);
  assert.equal(g.state().tour.done, true);
  g.close();
});

test("the coach walks the whole loop and records every mark", () => {
  const g = boot();
  g.click("#prologue-skip");
  // 1. read the board
  g.click('[data-view="headquarters"]');
  g.click('[data-system="0"]');
  assert.ok(g.state().tour.marks.includes("map"));
  assert.ok(g.text(".coach-title").includes("Three currencies"));
  // 2. explanation step advances on its own call to action
  g.click("#coach-cta");
  assert.ok(g.text(".coach-title").includes("Build before you theorize"));
  // 3. build
  g.click('[data-view="production"]');
  g.click('[data-action="build"]');
  assert.ok(g.state().tour.marks.includes("build"));
  assert.ok(g.text(".coach-title").includes("Authorize a prototype"));
  // 4. research
  g.click('[data-view="research"]');
  g.click('[data-action="research"][data-id="0"]');
  assert.ok(g.text(".coach-title").includes("Test it twice"));
  // 5. two tests, then safeguards
  g.click('[data-action="test"][data-id="0"]');
  g.click("#close-dialog");
  g.click('[data-action="test"][data-id="0"]');
  g.click("#close-dialog");
  assert.ok(g.text(".coach-title").includes("Test it twice"));
  g.click('[data-action="fix"][data-id="0"]');
  assert.ok(g.state().tour.marks.includes("fix"));
  assert.ok(g.text(".coach-title").includes("One sortie per cycle"));
  // 6. fight one sortie to completion
  g.click('[data-view="bridge"]');
  g.click('[data-action="battle"]');
  assert.equal(g.hidden("#tour-coach"), true, "the coach stands down mid-engagement");
  g.click('[data-action="battle"]'); // tactical pause
  const paused = g.state().battle.tick;
  g.tick();
  assert.equal(g.state().battle.tick, paused);
  g.click('[data-action="battle"]'); // resume
  for (let i = 0; i < 60; i++) g.tick();
  assert.ok(g.state().tour.marks.includes("battle"));
  // 7. end the cycle (a hearing, if the weapon filed one, is ruled on first)
  if (g.state().hearings.length) {
    assert.ok(g.text(".coach-title").includes("failure report"));
    g.click('[data-view="headquarters"]');
    g.click('[data-action="resolve"][data-id="0"]');
    assert.ok(g.state().tour.marks.includes("hearing"));
  }
  assert.ok(g.text(".coach-title").includes("End the cycle"));
  g.click("#end-turn");
  assert.equal(g.state().turn, 13);
  assert.ok(g.state().tour.marks.includes("end-turn"));
  g.click("#close-dialog");
  // 8. listen to the array
  g.click('[data-view="signal"]');
  g.click('[data-action="signal-scan"]');
  assert.ok(g.state().tour.marks.includes("signal-scan"));
  // 9. the pub, via the coach's own button
  g.click("#coach-cta");
  assert.ok(g.state().tour.marks.includes("pub"));
  assert.equal(g.text("#page-title"), "The White Hart");
  // 10. finish
  assert.ok(g.text(".coach-title").includes("That is the loop"));
  g.click("#coach-cta");
  assert.equal(g.state().tour.done, true);
  assert.equal(g.hidden("#tour-coach"), true);
  g.close();
});

test("the mission panel names the next order and jumps to it", () => {
  const g = boot();
  g.click("#prologue-skip");
  g.click("#coach-skip");
  g.click('[data-view="headquarters"]');
  assert.ok(g.text(".mission-order h2").trim().length > 0);
  assert.ok(g.text(".mission-goal").includes("ENEMY VESSELS"));
  assert.ok(g.text(".mission-goal").includes("CYCLES LEFT"));
  g.click('[data-order-go="bridge"]');
  assert.equal(g.text("#page-title"), "Tactical Bridge");
  g.click('[data-phase="production"]');
  assert.equal(g.text("#page-title"), "Fleet & Production");
  g.click('[data-phase="end-turn"]');
  assert.equal(g.text("#page-title"), "Headquarters");
  assert.equal(g.state().turn, 13);
  g.close();
});

test("the next order follows the rules of the loop", () => {
  const g = boot();
  g.click("#prologue-skip");
  g.click("#coach-skip");
  // Nothing is pending at the start of a cycle: the fleet should be deployed.
  assert.equal(g.text(".mission-order h2"), "Deploy the fleet");
  g.click('[data-view="bridge"]');
  g.click('[data-action="battle"]');
  assert.ok(g.text(".mission-order h2").includes("engagement is live"));
  g.click('[data-action="retreat"]');
  // With nothing authorized, the Directorate comes before the yards.
  assert.equal(g.text(".mission-order h2"), "Authorize a prototype");
  g.close();

  // Without Norden there is no research: the assembly queue is the next order.
  const plain = boot().state();
  const h2 = boot({ ...plain, norden: false });
  h2.click("#prologue-skip");
  h2.click("#coach-skip");
  h2.click('[data-view="bridge"]');
  h2.click('[data-action="battle"]');
  h2.click('[data-action="retreat"]');
  h2.click("#close-dialog");
  assert.equal(h2.text(".mission-order h2"), "Listen to the Quiet Array");
  // The starting queue completes on the first advance, and then the yards are next.
  h2.click('[data-phase="end-turn"]');
  assert.equal(h2.state().turn, 13);
  assert.equal(h2.state().queue, 0);
  h2.click("#close-dialog");
  // A new cycle means a new sortie outranks the yards...
  assert.equal(h2.text(".mission-order h2"), "Deploy the fleet");
  h2.click('[data-view="bridge"]');
  h2.click('[data-action="battle"]');
  h2.click('[data-action="retreat"]');
  // ...and once it is spent, the empty queue is the next order.
  assert.equal(h2.text(".mission-order h2"), "Keep the yards busy");
  h2.close();
});

test("a failure report outranks every other order", () => {
  const fresh = boot().state();
  const g = boot({
    ...fresh,
    hearings: [{ id: 0, turn: 12, text: "The launcher has ceased to exist." }],
    unrest: 25,
  });
  assert.ok(g.text(".mission-order h2").includes("failure report"));
  assert.ok(g.w.document.querySelector('[data-phase="bridge"]').classList.contains("locked"));
  g.close();
});

test("ending the cycle files a report of exactly what it cost", () => {
  const g = boot();
  g.click("#prologue-skip");
  g.click("#coach-skip");
  g.click("#end-turn");
  assert.equal(g.text("#dialog-title"), "Cycle 013 / 024");
  const copy = g.text("#dialog-copy");
  assert.ok(copy.includes("+40 IP"), copy);
  // The cycle-13 field gag pays 8 SP, so the report shows the combined 23.
  assert.ok(copy.includes("Scientific points+23 SP"), copy);
  assert.ok(copy.includes("Capital integrity\u22126%"), copy);
  assert.ok(copy.includes("Next order"), copy);
  g.close();
});

test("an archive from before the briefing is not dragged through it", () => {
  const old = boot().state();
  delete old.tour;
  old.turn = 16;
  const g = boot(old);
  assert.equal(g.hidden("#prologue"), true);
  assert.equal(g.hidden("#tour-coach"), true);
  assert.equal(g.state().tour.done, true);
  assert.equal(g.state().tour.intro, true);
  assert.equal(g.state().turn, 16);
  g.close();
});

test("a malformed tour object is rejected with the rest of the archive", () => {
  const broken = boot().state();
  broken.tour = { step: "nope" };
  const g = boot(broken);
  assert.equal(g.state().turn, 12);
  assert.deepEqual(g.state().tour.marks, []);
  g.close();
});

test("the topbar restart menu replays the introduction, the tutorial, or the campaign", () => {
  const g = boot();
  g.click("#prologue-skip");
  g.click('[data-system="0"]');
  g.click("#coach-cta");
  assert.ok(g.state().tour.step >= 1);
  const turn = g.state().turn;

  g.click("#restart-menu");
  const menu = g.text("#dialog-copy");
  assert.ok(menu.includes("Replay the introduction"));
  assert.ok(menu.includes("Restart the tutorial"));
  assert.ok(menu.includes("Start a new campaign"));

  // Restarting the tutorial clears the coach but leaves the campaign alone.
  g.click('[data-action="restart-tour"]');
  assert.equal(g.state().tour.step, 0);
  assert.deepEqual(g.state().tour.marks, []);
  assert.equal(g.state().tour.done, false);
  assert.equal(g.hidden("#tour-coach"), false);
  assert.equal(g.state().turn, turn);

  // The introduction replays from page one.
  g.click("#restart-menu");
  g.click('[data-action="replay-intro"]');
  assert.equal(g.hidden("#prologue"), false);
  assert.ok(g.text("#prologue").includes("1 / 5"));
  g.click("#prologue-skip");

  // A new campaign starts again at cycle 012, introduction included.
  g.click('[data-view="dispatches"]');
  g.click('[data-action="reset"]');
  g.click("#confirm-reset");
  assert.equal(g.state().turn, 12);
  assert.equal(g.state().tour.intro, false);
  assert.equal(g.hidden("#prologue"), false);
  g.close();
});

console.log(`${checks} briefing checks passed: introduction, tutorial, mission panel, cycle report, restart menu, migration.`);
