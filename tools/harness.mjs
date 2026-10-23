/* Shared headless harness: jsdom + a stub PIXI that can record draw calls. */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const FILES = ['src/util.js', 'src/content.js', 'src/audio.js', 'src/fx.js', 'src/scene.js', 'src/game.js', 'src/ui.js', 'src/main.js'];

export function makePixi(window, { record = false } = {}) {
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
    constructor() { super(); this._ops = []; }
  }
  const CHAIN = ['rect', 'roundRect', 'circle', 'ellipse', 'poly', 'moveTo', 'lineTo', 'arc', 'arcTo',
    'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'beginPath', 'fill', 'stroke', 'clear', 'save', 'restore'];
  CHAIN.forEach((name) => {
    Graphics.prototype[name] = function chained(...args) {
      args.forEach((a) => {
        if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${name}() got ${a}`);
      });
      if (record) this._ops.push([name, args]);
      return this;
    };
  });
  class Text extends Container {
    constructor(options = {}) {
      super();
      this.text = String(options.text ?? '');
      this.style = Object.assign({}, options.style || {});
      this.resolution = 1;
      Object.defineProperty(this, 'width', { get() { return String(this.text).length * ((this.style.fontSize || 12) * 0.6); }, set() {}, configurable: true });
      Object.defineProperty(this, 'height', { get() { return (this.style.fontSize || 12) * 1.2; }, set() {}, configurable: true });
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
      this.renderer = { resize(w, h) { self.screen.width = w; self.screen.height = h; } };
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

export async function bootGame(rootDir, { record = false, width = 760, height = 520, seed = null } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    if (/Not implemented: HTMLCanvasElement(?:'s)? getContext\(\) method/.test(error.message)) return;
    errors.push(`jsdomError: ${error.message}`);
  });
  virtualConsole.on('error', (...args) => errors.push(`console.error: ${args.join(' ')}`));
  virtualConsole.on('warn', () => {});
  virtualConsole.on('log', () => {});

  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole, url: 'https://whitehart.test/', pretendToBeVisual: true });
  const { window } = dom;
  // A returning landlord: hand the browser a ledger before the pub opens.
  if (seed) for (const [key, value] of Object.entries(seed)) window.localStorage.setItem(key, value);
  // The pub is a department of the command page; the harness stands inside it, as a player would.
  window.document.getElementById('pub-realm').hidden = false;
  window.PIXI = makePixi(window, { record });
  // jsdom provides the browser's read-only performance object.

  for (const file of FILES) {
    const code = fs.readFileSync(path.join(rootDir, file), 'utf8');
    try { window.eval(code); } catch (error) { errors.push(`load ${file}: ${error.stack}`); }
  }
  // jsdom reports 0 for clientWidth; the game uses it to pick the room page size.
  const stageEl = window.document.getElementById('stage-inner');
  if (stageEl) {
    Object.defineProperty(stageEl, 'clientWidth', { value: width, configurable: true });
    Object.defineProperty(stageEl, 'clientHeight', { value: height, configurable: true });
  }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((resolve) => setTimeout(resolve, 60));

  const app = window.__appInstances && window.__appInstances[0];
  if (app) { app.screen.width = width; app.screen.height = height; }
  const step = (frames = 1, ms = 16) => { for (let i = 0; i < frames; i++) if (app) app.frame(ms); };
  return { window, dom, WH: window.WH, app, step, errors };
}
