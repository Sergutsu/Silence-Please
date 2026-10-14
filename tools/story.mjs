/* Integration checks for the original Clarke-inspired Deep Signal chapter. */
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
  w.setInterval = () => 0;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  if (archive) w.localStorage.setItem(KEY, JSON.stringify(archive));
  for (const file of ["directorate", "campaign-combat", "campaign"])
    w.eval(fs.readFileSync(`src/${file}.js`, "utf8"));
  const click = (selector) => {
    const el = w.document.querySelector(selector);
    assert.ok(el, selector);
    el.click();
  };
  return {
    w,
    click,
    state: () => JSON.parse(w.localStorage.getItem(KEY)),
    close: () => w.close(),
  };
}

const game = boot();
assert.equal(game.state().signal.fragments, 0);
assert.equal(game.state().signal.choice, "");
game.click('[data-view="headquarters"]');
assert.ok(game.w.document.querySelector('[data-system="8"]'));
game.click('[data-view="signal"]');
assert.ok(game.w.document.querySelector(".signal-hero"));
assert.equal(game.w.document.querySelectorAll(".signal-fragment").length, 3);

game.click('[data-action="signal-scan"]');
assert.equal(game.state().signal.fragments, 1);
assert.equal(game.state().ip, 225);
assert.equal(game.state().sp, 77);
game.click('[data-action="signal-scan"]');
game.click('[data-action="signal-scan"]');
assert.equal(game.state().signal.fragments, 3);
assert.equal(game.state().sp, 50);
assert.ok(game.w.document.querySelector('[data-action="signal-choice"][data-id="reply"]'));
game.click('[data-action="signal-choice"][data-id="reply"]');
assert.equal(game.state().signal.choice, "reply");
assert.equal(game.state().pc, 48);
assert.equal(game.state().sp, 65);
assert.ok(game.w.document.querySelector(".signal-response-filed.reply"));

game.click('[data-action="signal-star"]');
assert.equal(game.state().signal.starFound, true);
assert.equal(game.state().ip, 190);
for (const letter of "lighthouse")
  game.w.document.dispatchEvent(new game.w.KeyboardEvent("keydown", { key: letter, bubbles: true }));
assert.equal(game.state().signal.eggFound, true);
assert.equal(game.state().sp, 73);
assert.equal(game.w.document.getElementById("signal-secret-count").textContent, "2/2");

// Old v1 archives (before the signal chapter) are migrated in place.
const migrated = game.state();
delete migrated.signal;
delete migrated.gagsSeen;
game.w.localStorage.setItem(KEY, JSON.stringify(migrated));
game.w.ASCampaign.sync();
game.click('[data-view="signal"]');
assert.equal(game.state().signal.fragments, 0);
assert.deepEqual(game.state().gagsSeen, []);
game.close();

const silence = boot();
silence.click('[data-view="signal"]');
for (let i = 0; i < 3; i++) silence.click('[data-action="signal-scan"]');
silence.click('[data-action="signal-choice"][data-id="silence"]');
assert.equal(silence.state().signal.choice, "silence");
assert.equal(silence.state().enemy, 20);
assert.equal(silence.state().reliability, 95);
const firstContactArchive = silence.state();
firstContactArchive.signal.fragments = 3;
firstContactArchive.signal.choice = "reply";
firstContactArchive.enemy = 0;
silence.close();

const firstContact = boot(firstContactArchive);
firstContact.click("#end-turn");
assert.equal(firstContact.state().ending, "A greeting in the dark");
assert.ok(firstContact.w.document.getElementById("dialog-copy").textContent.includes("welcome"));
assert.deepEqual(firstContact.state().gagsSeen, [13]);
firstContact.close();
console.log("Deep Signal integration checks passed: decoding, branching endings, Easter eggs, campaign gags, and v1 migration.");
