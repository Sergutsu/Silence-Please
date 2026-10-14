/* Campaign policy, migration, and ending integration checks. */
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";
const KEY = "absolute-superiority-campaign-v1";
const html = fs.readFileSync("index.html", "utf8");
function boot(archive) {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://command.test/",
  });
  const w = dom.window;
  let step;
  w.setInterval = (fn) => {
    step = fn;
  };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  if (archive)
    w.localStorage.setItem(
      KEY,
      typeof archive === "string" ? archive : JSON.stringify(archive),
    );
  for (const f of ["directorate", "campaign-combat", "campaign"])
    w.eval(fs.readFileSync(`src/${f}.js`, "utf8"));
  const click = (q) => {
    const el = w.document.querySelector(q);
    assert.ok(el, q);
    if (el.click) el.click();
    else el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  };
  click('[data-view="headquarters"]');
  return {
    w,
    click,
    state: () => JSON.parse(w.localStorage.getItem(KEY)),
    tick: () => step(),
    close: () => w.close(),
  };
}
const initial = boot();
const fresh = initial.state();
initial.close();
let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`  ok   ${name}`);
}
function fixture(extra = {}) {
  return { ...structuredClone(fresh), ...extra };
}
function deploy(g) {
  g.click('[data-view="bridge"]');
  g.click('[data-action="battle"]');
}
function fight(g) {
  for (let i = 0; i < 60; i++) g.tick();
}
const report = { id: 0, turn: 12, text: "The launcher has ceased to exist." };

test("one sortie per cycle; next cycle restores deployment", () => {
  const g = boot();
  deploy(g);
  g.click('[data-action="retreat"]');
  assert.equal(g.state().sortieTurn, 12);
  g.click('[data-action="battle"]');
  assert.equal(g.state().battle, null);
  g.click("#end-turn");
  g.click('[data-action="battle"]');
  assert.ok(g.state().battle);
  g.close();
});
test("orders persist across reload and reload pauses engagement", () => {
  let g = boot();
  deploy(g);
  g.click('[data-action="formation"][data-id="screen"]');
  g.click('[data-action="target"][data-id="command"]');
  g.tick();
  const saved = g.state();
  g.close();
  g = boot(saved);
  assert.equal(g.state().battle.paused, true);
  assert.equal(g.state().battle.formation, "screen");
  const hp = g.state().battle.ours;
  g.tick();
  assert.equal(g.state().battle.ours, hp);
  g.close();
});
test("strategic changes cannot alter a deployed fleet", () => {
  const g = boot();
  deploy(g);
  g.click('[data-view="production"]');
  assert.equal(g.state().battle.paused, true);
  const before = g.state();
  g.click('[data-action="standardize"]');
  g.click('[data-action="build"]');
  assert.equal(g.state().ip, before.ip);
  assert.equal(g.state().queue, before.queue);
  g.close();
});
test("failure report blocks advancement and survives reload", () => {
  let g = boot(fixture({ tech: [1, 0, 0] }));
  deploy(g);
  g.click('[data-action="weapon"][data-id="0"]');
  fight(g);
  assert.equal(g.state().hearings.length, 1);
  g.click("#end-turn");
  assert.equal(g.state().turn, 12);
  const saved = g.state();
  g.close();
  g = boot(saved);
  assert.ok(g.w.document.querySelector(".hearing"));
  g.click('[data-action="resolve"][data-id="0"]');
  assert.equal(g.state().hearings.length, 0);
  assert.equal(g.state().suspended[0], true);
  assert.equal(g.state().tests[0], 1);
  assert.equal(g.state().halt, 1);
  assert.equal(g.state().ip, saved.ip - 30);
  g.close();
});
test("funded revisions require certification before reuse", () => {
  const g = boot(
    fixture({
      tech: [1, 0, 0],
      suspended: [true, false, false],
      tests: [1, 0, 0],
    }),
  );
  deploy(g);
  g.click('[data-action="weapon"][data-id="0"]');
  assert.equal(g.state().battle.used.length, 0);
  g.click('[data-action="retreat"]');
  g.click('[data-view="research"]');
  g.click('[data-action="test"][data-id="0"]');
  g.click("#close-dialog");
  g.click('[data-action="fix"][data-id="0"]');
  assert.equal(g.state().suspended[0], false);
  assert.equal(g.state().tech[0], 2);
  g.close();
});
test("endorsing four reports triggers military mutiny", () => {
  const g = boot(fixture({ hearings: [report, report, report, report] }));
  for (let i = 0; i < 4; i++) g.click('[data-action="resolve"][data-id="1"]');
  assert.equal(g.state().unrest, 100);
  assert.equal(g.state().ending, "The final letter");
  assert.ok(
    g.w.document
      .querySelector("#dialog-copy")
      .textContent.includes("relieved you"),
  );
  g.close();
});
test("cannot afford revision: free endorsement remains possible", () => {
  const g = boot(fixture({ ip: 0, pc: 5, hearings: [report] }));
  assert.equal(
    g.w.document.querySelector('[data-action="resolve"][data-id="0"]').disabled,
    true,
  );
  g.click('[data-action="resolve"][data-id="1"]');
  assert.equal(g.state().unrest, 25);
  assert.equal(g.state().hearings.length, 0);
  g.close();
});
test("unsafe field withdrawal still causes a pending hysteresis report", () => {
  const g = boot(fixture({ tech: [0, 0, 1] }));
  deploy(g);
  g.click('[data-action="weapon"][data-id="2"]');
  assert.equal(g.state().reliability, 87);
  g.click('[data-action="retreat"]');
  assert.equal(g.state().reliability, 62);
  assert.equal(g.state().hearings[0].id, 2);
  g.close();
});
test("analyzer adaptation is archived and carried into the next sortie", () => {
  const g = boot(fixture({ tech: [0, 1, 0], reliability: 30 }));
  deploy(g);
  g.click('[data-action="weapon"][data-id="1"]');
  for (let i = 0; i < 5; i++) g.tick();
  assert.equal(g.state().adapted, true);
  assert.equal(g.state().hearings[0].id, 1);
  g.click('[data-action="retreat"]');
  g.click('[data-action="resolve"][data-id="1"]');
  g.click("#end-turn");
  g.click('[data-action="battle"]');
  assert.equal(g.state().battle.adapted, true);
  g.close();
});
test("existing v1 campaign archives gain new fields without losing progress", () => {
  const old = fixture({ turn: 16, ip: 380 });
  for (const key of [
    "hearings",
    "unrest",
    "adapted",
    "suspended",
    "sortieTurn",
    "lastBattle",
  ])
    delete old[key];
  const g = boot(old);
  assert.equal(g.state().turn, 16);
  assert.equal(g.state().ip, 380);
  assert.deepEqual(g.state().hearings, []);
  g.close();
});
test("malformed JSON falls back to a new campaign", () => {
  const g = boot("{broken");
  assert.equal(g.state().turn, 12);
  g.close();
});
test("wrong-shaped archive falls back without a runtime error", () => {
  for (const patch of [
    { hearings: null },
    { tech: [1] },
    { ships: -4 },
    { battle: { ours: "invalid" } },
  ]) {
    const g = boot(fixture(patch));
    assert.equal(g.state().turn, 12);
    assert.deepEqual(g.state().tech, [0, 0, 0]);
    g.close();
  }
});
test("archived dispatches are rendered as text, never markup", () => {
  const g = boot(
    fixture({ logs: ['<img src=x onerror="alert(1)">. Report.'] }),
  );
  g.click('[data-view="dispatches"]');
  assert.equal(g.w.document.querySelector(".dispatch img"), null);
  assert.ok(
    g.w.document.querySelector(".dispatch").textContent.includes("<img"),
  );
  g.close();
});
test("victory cannot bypass an unresolved final failure report", () => {
  const g = boot(fixture({ enemy: 2, tech: [1, 0, 0] }));
  deploy(g);
  g.click('[data-action="weapon"][data-id="0"]');
  assert.equal(g.state().enemy, 0);
  assert.equal(g.state().ending, "");
  assert.equal(g.state().hearings.length, 1);
  g.click('[data-action="resolve"][data-id="1"]');
  assert.equal(g.state().ending, "An expensive peace");
  g.close();
});
test("standardization route wins from the initial economy", () => {
  const g = boot();
  g.click('[data-view="research"]');
  g.click('[data-action="fire"]');
  for (let i = 0; i < 8 && !g.state().ending; i++) {
    deploy(g);
    g.click('[data-action="formation"][data-id="screen"]');
    g.click('[data-action="target"][data-id="command"]');
    fight(g);
    if (!g.state().ending) g.click("#end-turn");
  }
  assert.equal(g.state().ending, "Reliability outweighs genius");
  g.close();
});
test("tested-weapon synergy route wins from the initial economy", () => {
  const g = boot();
  g.click('[data-view="research"]');
  g.click('[data-action="research"][data-id="0"]');
  for (let i = 0; i < 2; i++) {
    g.click('[data-action="test"][data-id="0"]');
    g.click("#close-dialog");
  }
  g.click('[data-action="fix"][data-id="0"]');
  for (let i = 0; i < 8 && !g.state().ending; i++) {
    deploy(g);
    g.click('[data-action="formation"][data-id="screen"]');
    g.click('[data-action="weapon"][data-id="0"]');
    fight(g);
    if (!g.state().ending) g.click("#end-turn");
  }
  assert.equal(g.state().ending, "A working theory");
  g.close();
});
console.log(`${checks} campaign policy checks passed.`);

/* Directorate / White Hart contract. */
{
  const D = (() => {
    const dom = new JSDOM("<!doctype html><p>", {
      runScripts: "outside-only",
      url: "https://command.test/",
    });
    const w = dom.window;
    w.eval(fs.readFileSync("src/directorate.js", "utf8"));
    return { w, D: w.ASDirectorate };
  })();
  const pub = () => ({
    gameSeconds: 100,
    stats: { patronsServed: 5 },
    gameOver: false,
    won: false,
    week: 1,
  });
  const arm = (patch = {}) =>
    D.w.localStorage.setItem(
      D.D.KEY,
      JSON.stringify({ ...fresh, campaignId: "c1", tech: [1, 0, 0], ...patch }),
    );
  test("pub check credits a field test once, charges on completion, and refuses stale trials", () => {
    arm();
    const p = pub();
    assert.match(D.D.begin(1, p).error, /Authorize/);
    const { trial } = D.D.begin(0, p);
    assert.equal(JSON.stringify(trial.fee), JSON.stringify({ credit: true, ip: 20, sp: 15 }));
    assert.match(D.D.complete(trial, p).error, /twelve seconds/);
    p.gameSeconds = 112;
    p.stats.patronsServed = 6;
    const r = D.D.complete(trial, p);
    assert.equal(r.report.credit, true);
    const s = D.D.read();
    assert.equal(String([s.tests[0], s.ip, s.sp, s.pubChecks[0]]), String([1, fresh.ip - 20, fresh.sp - 15, 1]));
    assert.match(D.D.complete(trial, p).error, /specification changed/);
    const t2 = D.D.begin(0, p).trial;
    p.gameSeconds += 20;
    p.stats.patronsServed += 1;
    arm({ tests: [2, 0, 0] });
    assert.match(D.D.complete(t2, p).error, /specification changed/);
    arm({ tech: [2, 0, 0], tests: [2, 0, 0] });
    const t3 = D.D.begin(0, p).trial;
    p.gameSeconds += 20;
    p.stats.patronsServed += 1;
    assert.equal(JSON.stringify(t3.fee), JSON.stringify({ credit: false, ip: 5, sp: 0 }));
    assert.equal(D.D.complete(t3, p).report.credit, false);
    assert.equal(D.D.read().tests[0], 2);
    arm({ battle: { ours: 1 } });
    assert.match(D.D.begin(0, p).error, /Recall/);
  });
  test("campaign page absorbs pub reports from another tab", () => {
    const g = boot();
    g.w.localStorage.setItem(
      KEY,
      JSON.stringify({
        ...fresh,
        tech: [1, 0, 0],
        tests: [1, 0, 0],
        pubChecks: [1, 0, 0],
      }),
    );
    g.w.dispatchEvent(new g.w.StorageEvent("storage", { key: KEY }));
    assert.equal(g.state().tests[0], 1);
    g.click('[data-view="research"]');
    assert.ok(
      g.w.document
        .querySelector(".pub-check-link small")
        .textContent.includes("1 pub checks"),
    );
    g.close();
  });
  console.log("Directorate contract checks passed.");
}
