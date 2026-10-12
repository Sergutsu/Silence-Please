/* Headless smoke test for The White Hart: jsdom + a stub PIXI, driving the real game code. */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/* ------------------------------------------------------------ PIXI stub */
function makePixi(window) {
  class Rectangle {
    constructor(x = 0, y = 0, width = 0, height = 0) { Object.assign(this, { x, y, width, height }); }
  }
  class Container {
    constructor() {
      this.children = [];
      this.parent = null;
      this._x = 0; this._y = 0;
      this.alpha = 1; this.visible = true; this.rotation = 0;
      this.width = 10; this.height = 10;
      this.tint = 0xffffff; this.blendMode = 'normal';
      this.eventMode = 'auto'; this.cursor = null; this.hitArea = null;
      this.destroyed = false;
      this._events = Object.create(null);
      const self = this;
      const scale = { x: 1, y: 1, set(a, b) { scale.x = a; scale.y = (b === undefined ? a : b); } };
      const anchor = { x: 0, y: 0, set(a, b) { anchor.x = a; anchor.y = (b === undefined ? a : b); } };
      this.scale = scale;
      this.anchor = anchor;
      this.position = {
        set(a, b) { self._x = a; self._y = (b === undefined ? a : b); },
        get x() { return self._x; }, set x(v) { self._x = v; },
        get y() { return self._y; }, set y(v) { self._y = v; }
      };
    }
    get x() { return this._x; } set x(v) { this._x = v; }
    get y() { return this._y; } set y(v) { this._y = v; }
    addChild(...kids) { for (const k of kids) { if (!k) throw new Error('addChild(undefined)'); if (k.parent) k.parent.removeChild(k); k.parent = this; this.children.push(k); } return kids[0]; }
    addChildAt(k, i) { if (!k) throw new Error('addChildAt(undefined)'); if (k.parent) k.parent.removeChild(k); k.parent = this; this.children.splice(i, 0, k); return k; }
    removeChild(k) { const i = this.children.indexOf(k); if (i >= 0) { this.children.splice(i, 1); k.parent = null; } return k; }
    removeChildren() { const out = this.children.slice(); out.forEach((k) => { k.parent = null; }); this.children = []; return out; }
    getChildIndex(k) { const i = this.children.indexOf(k); if (i < 0) throw new Error('child not found'); return i; }
    destroy() {
      if (this.destroyed) throw new Error('double destroy');
      this.destroyed = true;
      this.children.slice().forEach((c) => c.destroy && !c.destroyed && c.destroy());
      this.children = [];
      if (this.parent) this.parent.removeChild(this);
    }
    on(type, fn) { (this._events[type] = this._events[type] || []).push(fn); return this; }
    emit(type, event = {}) { (this._events[type] || []).slice().forEach((fn) => fn(event)); }
  }
  class Graphics extends Container {
    constructor() { super(); this.ops = 0; }
  }
  const CHAIN = ['rect', 'roundRect', 'circle', 'ellipse', 'poly', 'moveTo', 'lineTo', 'arc', 'arcTo',
    'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'beginPath', 'fill', 'stroke', 'clear', 'save', 'restore', 'setStrokeStyle', 'setFillStyle'];
  CHAIN.forEach((name) => {
    Graphics.prototype[name] = function chained(...args) {
      args.forEach((a) => {
        if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${name}() got ${a}`);
      });
      this.ops += 1;
      return this;
    };
  });
  class Text extends Container {
    constructor(options = {}) {
      super();
      this.text = String(options.text ?? '');
      this.style = Object.assign({}, options.style || {});
      this.resolution = 1;
      Object.defineProperty(this, 'width', { get() { return String(this.text).length * 6; }, set() {}, configurable: true });
      Object.defineProperty(this, 'height', { get() { return 14; }, set() {}, configurable: true });
    }
  }
  class Sprite extends Container {
    constructor(texture = null) { super(); this.texture = texture; }
  }
  class Application {
    constructor() {
      window.__appInstances = window.__appInstances || [];
      window.__appInstances.push(this);
      this.stage = new Container();
      this.screen = { width: 760, height: 520 };
      const self = this;
      this.renderer = {
        resize(w, h) { self.screen.width = w; self.screen.height = h; }
      };
      this._fns = [];
      this.ticker = { maxFPS: 0, add(fn) { self._fns.push(fn); }, start() {}, stop() {} };
    }
    async init() {
      this.canvas = window.document.createElement('canvas');
      this.canvas.width = this.screen.width;
      this.canvas.height = this.screen.height;
      return this;
    }
    frame(ms) { this._fns.forEach((fn) => fn({ deltaMS: ms })); }
  }
  return {
    Container, Graphics, Text, Sprite, Rectangle, Application,
    Texture: { WHITE: { id: 'white' }, from: (source) => ({ id: 'tex', source }) }
  };
}

/* -------------------------------------------------------------- harness */
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => {
  if (/HTMLCanvasElement.prototype.getContext/.test(error.message)) return; // expected without the canvas package
  errors.push(`jsdomError: ${error.message}`);
});
virtualConsole.on('error', (...args) => errors.push(`console.error: ${args.join(' ')}`));
virtualConsole.on('warn', () => {});
virtualConsole.on('log', () => {});

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole, url: 'https://whitehart.test/', pretendToBeVisual: true });
const { window } = dom;
window.PIXI = makePixi(window);
window.performance = window.performance || { now: () => Date.now() };

const FILES = ['src/util.js', 'src/content.js', 'src/audio.js', 'src/fx.js', 'src/scene.js', 'src/game.js', 'src/ui.js', 'src/main.js'];
const originalError = window.console.error;
window.console.error = (...args) => { errors.push(`console.error: ${args.map(String).join(' ')}`); originalError.apply(window.console, args); };
window.console.warn = () => {};

for (const file of FILES) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  try { window.eval(code); } catch (error) { errors.push(`load ${file}: ${error.stack}`); }
}

window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await new Promise((resolve) => setTimeout(resolve, 60));

const WH = window.WH;

if (!WH || !WH.game || !WH.game.state) {
  console.error('FATAL: the game did not boot.');
  console.error(errors.join('\n'));
  process.exit(1);
}

const st = () => WH.game.state;
const state = st(); // kept for the pre-restart checks below
const stage = window.document.getElementById('stage-inner');
const canvasInStage = stage.querySelector('canvas');
if (!canvasInStage) errors.push('FATAL: no canvas was inserted into the stage.');

/* Drive frames. */
let appRef = window.__appInstances && window.__appInstances[0];
function step(frames = 1, ms = 16) {
  for (let i = 0; i < frames; i++) {
    if (appRef) appRef.frame(ms);
  }
}
if (!appRef) errors.push('FATAL: no Application instance was created.');

/* --- exercises --- */
const results = [];
function check(name, fn) {
  try { fn(); results.push(`  ok   ${name}`); }
  catch (error) { results.push(`  FAIL ${name}: ${error.message}`); errors.push(`${name}: ${error.stack}`); }
}

check('stage built', () => {
  if (!WH.scene.views.length) throw new Error('no room views');
});
check('backdrop built', () => {
  const root = WH.scene.views[0].container.parent;
  if (!root || root.children.length < 3) throw new Error('scene tree too small');
});
check('frames run', () => { step(30); });
check('resources grow', () => {
  const before = state.resources.pints;
  step(80);
  if (state.resources.pints < before) throw new Error('pints went backwards');
});
check('toggle a zone', () => {
  const view = WH.scene.views.find((v) => v.id === 'general');
  const before = state.rooms.general.zone;
  view.container.emit('pointertap', { stopPropagation() {} });
  if (state.rooms.general.zone === before) throw new Error('zone did not toggle');
  view.container.emit('pointertap', { stopPropagation() {} });
});
check('select and serve a patron', () => {
  const view = WH.scene.views.find((v) => v.avatars.size);
  if (!view) throw new Error('no patrons anywhere');
  const avatar = [...view.avatars.values()][0];
  avatar.container.emit('pointertap', { stopPropagation() {} });
  if (state.selectedPatron !== avatar.patron.id) throw new Error('patron not selected');
  window.document.getElementById('serve-button').click();
  if (!state.beerReady) throw new Error('pint not poured');
  const served = state.stats.patronsServed;
  avatar.container.emit('pointertap', { stopPropagation() {} });
  if (state.stats.patronsServed !== served + 1) throw new Error('patron not served');
});
check('unlock a room', () => {
  state.resources.pints += 5000;
  const saloon = WH.scene.views.find((v) => v.id === 'saloon');
  if (!saloon) throw new Error('saloon not on this page');
  if (!WH.game.tryUnlockRoom('saloon')) throw new Error('unlock failed');
  step(4);
  if (!state.rooms.saloon.unlocked) throw new Error('still locked');
});
check('page navigation', () => {
  WH.game.setPage(1);
  step(4);
  if (state.roomPage !== 1) throw new Error('page did not change');
  WH.game.setPage(-1);
  step(4);
});
check('shop: buy staff', () => {
  state.resources.pints += 900;
  if (!WH.game.buyStaff('barmaid')) throw new Error('hire failed');
  step(20);
});
check('shop: buy amenity', () => {
  if (!WH.game.buyAmenity('jukebox')) throw new Error('amenity failed');
  if (!WH.game.buyAmenity('soundproofing', 'general')) throw new Error('soundproofing failed');
  step(10);
});
check('shop: silencer tier and upgrades', () => {
  state.resources.research += 5000;
  state.resources.manuscripts += 50;
  state.resources.scoops += 50;
  state.resources.loyalty += 50;
  if (!WH.game.buyTier(2)) throw new Error('tier 2 failed');
  state.energy = 400;
  if (!WH.game.buySEUpgrade('filters')) throw new Error('filters failed');
  if (!WH.game.buySEUpgrade('dump')) throw new Error('dump failed');
  step(10);
});
check('modal: shop tabs', () => {
  WH.ui.openModal('shop', 'rooms');
  ['rooms', 'silencer', 'staff', 'amenities'].forEach((tab) => {
    WH.ui.openModal('shop', tab);
    const content = window.document.getElementById('modal-content');
    if (!content.innerHTML.length) throw new Error(`empty ${tab}`);
  });
  WH.ui.closeModal();
});
check('modal: journal tabs', () => {
  ['clippings', 'goals', 'diary', 'achievements', 'stats', 'secrets'].forEach((tab) => {
    WH.ui.openModal('journal', tab);
    const content = window.document.getElementById('modal-content');
    if (!content.innerHTML.length) throw new Error(`empty ${tab}`);
  });
  WH.ui.openModal('help');
  WH.ui.closeModal();
});
check('every typed word', () => {
  Object.keys(WH.content.EGG_WORDS).forEach((word) => {
    WH.game.checkWord(word);
    step(2);
  });
});
check('typing a word fires its egg', () => {
  const original = WH.game.checkWord;
  const seen = [];
  WH.game.checkWord = (word) => { seen.push(word); return original(word); };
  try {
    Object.keys(WH.content.EGG_WORDS).forEach((word) => {
      seen.length = 0;
      String(word).split('').forEach((ch) => {
        window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: ch, bubbles: true }));
      });
      if (!seen.includes(word)) throw new Error(`typing "${word}" did not fire`);
    });
  } finally {
    WH.game.checkWord = original;
  }
});
check('typing a word does not fire its shortcuts', () => {
  const state = WH.game.state;
  state.venting = false;
  'purvis'.split('').forEach((ch) => {
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: ch, bubbles: true }));
  });
  if (state.venting) throw new Error('vent toggled while typing "purvis"');
  const book = WH.ui.modalMode;
  'wednesday'.split('').forEach((ch) => {
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: ch, bubbles: true }));
  });
  if (WH.ui.modalMode !== book) throw new Error('journal opened while typing "wednesday"');
});
check('single-key shortcuts work', () => {
  const state = WH.game.state;
  const press = (key, init = {}) => window.document.dispatchEvent(new window.KeyboardEvent('keydown', Object.assign({ key, bubbles: true }, init)));
  state.venting = false;
  press('v');
  if (!state.venting) throw new Error('v did not vent');
  press('v');
  if (state.venting) throw new Error('v did not stop venting');
  press('j');
  if (WH.ui.modalMode?.mode !== 'journal') throw new Error('j did not open the journal');
  press('Escape');
  if (WH.ui.modalMode) throw new Error('escape did not close the journal');
  press('tab', { shiftKey: true });
  press('tab');
  press('Enter');
  press('?');
  if (WH.ui.modalMode?.mode !== 'help') throw new Error('? did not open help');
  press('Escape');
  const home = state.homeRoom;
  const wasOn = WH.game.zoneIsOn(home);
  press('z');
  if (WH.game.zoneIsOn(home) === wasOn) throw new Error('z did not toggle the zone');
  press('z');
});
check('konami', () => {
  const state = WH.game.state;
  ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'].forEach((key) => {
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
  });
  step(4);
  if (!state.fentonMode) throw new Error('konami did not work');
  WH.game.konami();
  step(4);
});
check('portrait and machine taps', () => {
  for (let i = 0; i < 5; i++) WH.game.tapPortrait();
  for (let i = 0; i < 8; i++) WH.game.tapMachine();
  step(4);
});
check('every gag moment', () => {
  WH.content.GAGS.forEach((gag) => {
    if (gag.kind === 'moment') WH.game.runGag(gag);
  });
  step(10);
});
check('every prop spawn and tap', () => {
  ['cat', 'mouse', 'ufo', 'teapot', 'ghost', 'pigeon', 'cab', 'hat'].forEach((kind) => {
    const entry = WH.fx.spawnProp(kind, { duration: 1, onTap: () => {} });
    if (!entry) throw new Error(`no prop: ${kind}`);
    entry.container.emit('pointertap', { stopPropagation() {} });
  });
  step(30);
});
check('every random event', () => {
  WH.content.EVENT_DEFS.forEach((def) => { WH.game.runEvent(def.id); step(2); });
});
check('dartboard and jukebox', () => {
  WH.game.throwDart('general');
  WH.game.tapJukebox();
  step(6);
});
check('weather cycle', () => {
  WH.content.WEATHER.forEach((w) => { WH.fx.setWeather(w.id); step(4); });
  WH.game.rollWeather();
  step(4);
});
check('venting', () => {
  state.energy = 60;
  state.seUpgrades.venting = 2;
  WH.game.toggleVenting();
  step(20);
  if (!state.venting) throw new Error('vent not open');
  WH.game.toggleVenting();
});
check('pause', () => {
  WH.game.togglePause();
  step(5);
  if (!state.paused) throw new Error('not paused');
  WH.game.togglePause();
});
check('tutorial explosion', () => {
  WH.game.beginExplosion(true);
  step(2, 1000);
  step(10);
  WH.game.closeCrisis();
});
check('real explosion and rebuild', () => {
  WH.game.beginExplosion(false);
  step(2, 1000);
  step(10);
  WH.game.closeCrisis();
  state.resources.pints += 4000;
  const home = state.homeRoom;
  WH.game.tryRebuildRoom(home);
  step(6);
});
check('spawn every patron type', () => {
  Object.keys(WH.content.PATRONS).forEach((type) => {
    state.rooms.snug.unlocked = true;
    state.rooms.upstairs.unlocked = true;
    state.rooms.green.unlocked = true;
    state.rooms.backroom.unlocked = true;
    state.rooms.roof.unlocked = true;
    state.rooms.kitchen.unlocked = true;
    state.rooms.cellar.unlocked = true;
    state.eventUntil = state.gameSeconds + 60;
    WH.game.spawnPatron(type);
    step(2);
  });
  step(40);
});
check('serve the whole pub', () => {
  let guard = 0;
  while (state.patrons.length && guard++ < 60) {
    const patron = state.patrons[0];
    WH.game.selectPatron(patron.id);
    WH.game.pourSelectedPint();
    WH.game.servePatron(patron);
    step(2);
  }
});
check('win condition', () => {
  state.tier = 5;
  state.weeksSurvived = 12;
  state.resources = { pints: 2000, scoops: 80, manuscripts: 80, research: 200, loyalty: 200 };
  WH.content.ROOM_DEFS.forEach((room) => { state.rooms[room.id].unlocked = true; state.rooms[room.id].damaged = false; });
  WH.game.checkWinCondition();
  step(6);
  if (!state.won) throw new Error('did not win');
  WH.game.closeCrisis();
  step(6);
});
check('new game', () => {
  WH.game.startNewGame();
  step(20);
  if (st().week !== 1) throw new Error('week not reset');
});
check('save and reload', () => {
  WH.game.saveState();
  step(5);
  const raw = window.localStorage.getItem('silence-please-white-hart-v2');
  if (!raw) throw new Error('nothing saved');
  JSON.parse(raw);
});
check('long run without exploding', () => {
  st().resources.pints = 500;
  for (let i = 0; i < 900; i++) {
    step(1, 60);
    if (st().gameOver) break;
  }
});
check('game over path', () => {
  st().won = false;
  st().gameOver = false;
  st().reputation = 0;
  WH.game.checkLossCondition('Test.');
  step(5);
  if (!st().gameOver) throw new Error('no game over');
  WH.game.closeCrisis();
  step(10);
});
check('final ui render', () => { WH.ui.render(); step(20); });

/* --- report --- */
console.log(results.join('\n'));
console.log('');
if (errors.length) {
  console.log(`ERRORS (${errors.length}):`);
  console.log([...new Set(errors)].slice(0, 25).join('\n\n'));
  process.exit(1);
} else {
  console.log('No runtime errors. ✔');
}
