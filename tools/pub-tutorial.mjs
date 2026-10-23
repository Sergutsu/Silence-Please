/* The White Hart's own briefing: the landlord's introduction and the evening's orders. */
import assert from 'node:assert/strict';
import { bootGame } from './harness.mjs';

let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`  ok   ${name}`);
}

const boot = () => bootGame('.', { width: 760, height: 520 });
const $ = (w, sel) => w.document.querySelector(sel);
let ledger = '';
const count = (w) => $(w, '#pub-tour-count').textContent.trim();
const steps = (w) => [...w.document.querySelectorAll('#pub-tour-steps li')];

{
  const { window: w, WH, errors } = await boot();
  assert.deepEqual(errors, [], errors.join('\n'));

  test('a first Wednesday opens with the landlord’s briefing', () => {
    const intro = $(w, '#pub-intro');
    assert.equal(intro.hidden, false);
    assert.ok(intro.textContent.includes('The quietest pub on Fleet Street'));
    assert.ok(intro.textContent.includes('1 / 3'));
  });

  test('the briefing walks three pages and then opens the pub', () => {
    $(w, '#pub-intro-next').click();
    assert.ok($(w, '#pub-intro').textContent.includes('2 / 3'));
    assert.ok($(w, '#pub-intro').textContent.includes('three directives'));
    $(w, '#pub-intro-next').click();
    assert.ok($(w, '#pub-intro-next').textContent.includes('Open the pub'));
    $(w, '#pub-intro-next').click();
    assert.equal($(w, '#pub-intro').hidden, true);
    assert.equal(WH.game.state.tutorial.intro, true);
  });

  test('the evening’s orders list the whole loop', () => {
    assert.equal(steps(w).length, 6);
    assert.equal(count(w), '0 / 6');
    assert.ok($(w, '#pub-tour-loop').textContent.includes('serve → silence → vent → spend → grow'));
    assert.ok($(w, '#pub-tour-title').textContent.includes('How an evening is run'));
  });

  test('serving a patron ticks the first three orders', () => {
    const patron = WH.game.state.patrons[0];
    WH.game.selectPatron(patron.id);
    assert.equal(count(w), '1 / 6');
    assert.ok(steps(w)[0].classList.contains('done'));
    WH.game.pourSelectedPint();
    assert.equal(count(w), '2 / 6');
    WH.game.servePatron(WH.game.state.patrons.find((p) => p.id === patron.id));
    assert.equal(count(w), '3 / 6');
  });

  test('the zones, the vent and the desk finish the checklist', () => {
    WH.game.toggleZone('general');
    assert.equal(count(w), '4 / 6');
    WH.game.toggleVenting();
    assert.ok(WH.game.state.tutorial.marks.includes('vent'));
    WH.ui.openModal('shop', 'rooms');
    assert.equal(count(w), '6 / 6');
    assert.ok($(w, '#pub-tour').classList.contains('is-complete'));
    assert.equal($(w, '#pub-tour-again').hidden, false);
    assert.ok($(w, '#pub-tour-title').textContent.includes('method'));
    WH.ui.closeModal();
  });

  test('the checklist is written to the ledger', () => {
    const saved = w.localStorage.getItem('silence-please-white-hart-v2');
    assert.ok(saved.includes('"marks"'));
    assert.ok(saved.includes('"intro":true'));
    ledger = saved;
    w.close();
  });
}

{
  // Second visit: the same ledger, so no second briefing and an intact checklist.
  const { window: w, WH, errors } = await bootGame('.', { width: 760, height: 520, seed: { 'silence-please-white-hart-v2': ledger } });
  assert.deepEqual(errors, [], errors.join('\n'));
  test('a returning landlord is not briefed twice', () => {
    assert.equal($(w, '#pub-intro').hidden, true);
    assert.equal(WH.game.state.tutorial.intro, true);
    assert.equal(count(w), '6 / 6');
    assert.ok($(w, '#pub-tour').classList.contains('is-complete'));
    WH.game.tourReset();
    assert.equal(count(w), '0 / 6');
    assert.equal($(w, '#pub-tour-again').hidden, true);
  });
  w.close();
}

console.log(`${checks} pub briefing checks passed: landlord's introduction, evening's orders, persistence.`);
