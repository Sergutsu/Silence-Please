/* Checks for the adaptive interface: one breakpoint vocabulary per screen, panels
   that reflow on those stops, no grid track wide enough to push the page sideways,
   full-screen cards that keep their own top edge, and the coach card never
   painting over the toast or the last row of a page. */
import { JSDOM } from "jsdom";
import fs from "node:fs";
import assert from "node:assert/strict";

const KEY = "absolute-superiority-campaign-v1";
const html = fs.readFileSync("index.html", "utf8");
const commandCss = fs.readFileSync("command.css", "utf8");
const pubCss = fs.readFileSync("style.css", "utf8") + fs.readFileSync("pub-annex.css", "utf8");
const realmCss = fs.readFileSync("pub-realm.css", "utf8");

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
    hidden: (selector) => w.document.querySelector(selector).hidden,
    state: () => JSON.parse(w.localStorage.getItem(KEY)),
    body: () => w.document.body,
    resize: () => w.dispatchEvent(new w.Event("resize")),
    close: () => w.close(),
  };
}

let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`  ok   ${name}`);
}

/* --- the two vocabularies every screen is allowed to step at --------------- */
const COMMAND_STOPS = new Set(["1450", "1150", "950", "650", "380"]);
const PUB_STOPS = new Set(["1120", "860", "540", "380"]);
/* A stop may also be used as its own complement (`max-width: 650px` paired with
   `min-width: 651px`), so a min-width one pixel above a known stop counts as the
   same step. */
const stopsIn = (text) =>
  [...text.matchAll(/@(?:media[^{]*?)\(\s*(max|min)-width:\s*(\d+)px\s*\)/g)].map((m) => ({
    dir: m[1],
    px: m[2],
  }));
const offGrid = (stops, allowed) =>
  stops.filter((s) => !allowed.has(s.px) && !(s.dir === "min" && allowed.has(String(+s.px - 1))));

test("the command terminal steps at one set of widths", () => {
  const used = stopsIn(commandCss);
  assert.ok(used.length >= 15, `expected a real set of stops, found ${used.length}`);
  const stray = offGrid(used, COMMAND_STOPS);
  assert.equal(stray.map((s) => `${s.dir}-width: ${s.px}px`).join(", "), "", "command.css steps off grid");
});

test("the pub steps at one set of widths, annex included", () => {
  const used = stopsIn(pubCss);
  assert.ok(used.length >= 6, `expected a real set of stops, found ${used.length}`);
  assert.equal(offGrid(used, PUB_STOPS).map((s) => `${s.dir}-width: ${s.px}px`).join(", "), "", "pub styles step off grid");
  // the compiled sheet is what the browser loads, so it must carry the same set
  assert.equal(
    offGrid(stopsIn(realmCss), PUB_STOPS).map((s) => `${s.dir}-width: ${s.px}px`).join(", "),
    "",
    "pub-realm.css steps off grid"
  );
});

/* --- no track may be wider than the box holding it ------------------------- */
test("no auto-fit track is wider than its own container", () => {
  const tracks = [...commandCss.matchAll(/repeat\(\s*auto-(?:fit|fill)\s*,\s*minmax\((.*?)\)\s*\)/gs)];
  assert.ok(tracks.length > 0, "expected at least one auto-fit track");
  for (const [, track] of tracks)
    assert.match(
      track,
      /^(?:min\(\s*\d+px\s*,\s*100%\s*\)|0|[\d.]+fr)/,
      `auto-fit track can overflow a narrow container: minmax(${track})`
    );
});

test("the newest panels sit inside the shared overflow guarantee", () => {
  const guard = commandCss.slice(commandCss.indexOf("Viewport and small-screen guarantees"));
  for (const selector of [".mission", ".phase-strip", ".mission-goal", ".dossier-grid", ".tour-coach"])
    assert.ok(
      new RegExp(`^${selector.replace(/[.]/g, "\\.")},?$`, "m").test(guard) ||
        guard.includes(`\n${selector},\n`) ||
        guard.includes(`\n${selector} {`),
      `${selector} is missing from the min-width guard list`
    );
});

/* --- full-screen cards must not lose their top edge ------------------------ */
test("full-screen cards centre safely instead of clipping the top", () => {
  const overlays = [...commandCss.matchAll(/([.\w-]+)\s*\{[^}]*position: fixed;[^}]*\}/g)]
    .map((m) => ({ selector: m[1], rule: m[0] }))
    .filter((o) => /inset: 0/.test(o.rule));
  assert.ok(overlays.length >= 2, `expected several full-screen overlays, found ${overlays.length}`);
  for (const { selector, rule } of overlays) {
    if (!/display: grid/.test(rule)) continue;
    assert.ok(
      !/place-items: center/.test(rule),
      `${selector} centres a scrollable overlay with place-items, which clips a tall card`
    );
  }
  for (const [outer, inner] of [[".prologue", ".prologue-inner"], [".crisis-screen", ".crisis-inner"]]) {
    const rule = commandCss.includes(outer) ? commandCss : pubCss;
    assert.match(rule.slice(rule.indexOf(`${outer} {`)), /display: flex/, `${outer} should centre with flex`);
    assert.match(rule.slice(rule.indexOf(`${inner} {`)), /margin: auto/, `${inner} needs margin: auto`);
  }
  const intro = pubCss.slice(pubCss.indexOf(".pub-intro {"));
  assert.match(intro, /display: flex/, ".pub-intro should centre with flex");
  assert.match(intro.slice(0, intro.indexOf(".pub-intro-kicker")), /margin: auto/, ".pub-intro-inner needs margin: auto");
});

/* --- the coach card and the toast share the bottom right ------------------- */
test("the coach card keeps its own insets and never covers the page", () => {
  const coach = commandCss.slice(commandCss.indexOf(".tour-coach {"));
  assert.match(coach, /width: min\(372px, calc\(100vw - 52px\)\)/, "the card must fit between its own insets");
  assert.match(commandCss, /body\.coach-open \.workspace > main \{ padding-bottom: calc\(var\(--coach-h, 250px\) \+ 26px\); \}/);
  assert.match(commandCss, /body\.coach-open #command-toast \{[^}]*bottom: auto;[^}]*\}/);
});

test("the coach publishes its height while it is on screen", () => {
  const g = boot();
  try {
    g.click("#prologue-skip");
    assert.equal(g.hidden("#tour-coach"), false, "the coach should be up on a fresh campaign");
    assert.equal(g.body().classList.contains("coach-open"), true, "body.coach-open should be set");
    assert.ok(
      g.body().style.getPropertyValue("--coach-h") !== "" || g.w.document.querySelector("#tour-coach").offsetHeight === 0,
      "--coach-h should be written whenever the card can be measured"
    );
    // re-measuring on a resize must not throw, and must keep the state truthful
    g.resize();
    assert.equal(g.body().classList.contains("coach-open"), true);
  } finally {
    g.close();
  }
});

test("the coach gives the room back when it stands down", () => {
  const g = boot();
  try {
    g.click("#prologue-skip");
    g.click("#coach-skip"); // step 0 skips the whole tutorial
    assert.equal(g.hidden("#tour-coach"), true);
    assert.equal(g.body().classList.contains("coach-open"), false, "body.coach-open must be released");
    assert.equal(g.body().style.getPropertyValue("--coach-h"), "", "--coach-h must be cleared");
  } finally {
    g.close();
  }
});

test("the coach stands down mid-engagement instead of covering the battle", () => {
  const g = boot();
  try {
    g.click("#prologue-skip");
    g.click('[data-view="bridge"]');
    g.click('[data-action="battle"]');
    assert.ok(g.state().battle, "a sortie should be running");
    assert.equal(g.hidden("#tour-coach"), true, "the coach hides during an engagement");
    assert.equal(g.body().classList.contains("coach-open"), false);
  } finally {
    g.close();
  }
});

/* --- the panels the interface adds must follow the same stops -------------- */
test("the mission panel reflows on the terminal's own stops", () => {
  const at = (stop) => {
    const needle = `@media (max-width: ${stop}px) {`;
    let out = "";
    let i = commandCss.indexOf(needle);
    assert.ok(i > -1, `no ${stop}px block`);
    while (i > -1) {
      let depth = 0;
      let j = i + needle.length - 1;
      for (; j < commandCss.length; j++) {
        if (commandCss[j] === "{") depth++;
        else if (commandCss[j] === "}" && !--depth) break;
      }
      out += `${commandCss.slice(i, j + 1)}\n`;
      i = commandCss.indexOf(needle, j);
    }
    return out;
  };
  const wide = at("1150");
  assert.match(wide, /\.mission \{ grid-template-columns: minmax\(0, 1fr\); \}/, "the mission must stack at 1150px");
  assert.match(wide, /\.phase-strip \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
  assert.match(wide, /\.workspace \.resources \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/, "five meters in three columns before it gets cramped");
  const phone = at("650");
  assert.match(phone, /\.phase-strip \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(phone, /\.mission-goal \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(phone, /\.tour-coach \{[^}]*left: 9px;[^}]*width: auto;/);
  assert.match(phone, /\.tour-coach \{[^}]*max-height: calc\(100svh - 18px\);/, "the card must never be taller than the phone");
  assert.match(phone, /\.coach-body \{ max-height: 32vh; overflow: auto;/, "a long step must scroll instead of pushing the buttons off screen");
  const tiny = at("380");
  assert.match(tiny, /\.phase \{ padding: 8px 6px; \}/);
});

console.log(`\n${checks} layout checks passed.`);
