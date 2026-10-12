/* Loads the vendored PixiJS bundle in jsdom and asserts every API the game uses really exists. */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.PIXI = undefined;
try {
  window.eval(fs.readFileSync(`${ROOT}/vendor/pixi.min.js`, 'utf8'));
} catch (error) {
  console.log(`FAIL: the bundle threw while loading: ${error.message}`);
  process.exit(1);
}

const PIXI = window.PIXI;
const problems = [];
const skipped = [];
const ok = (label, condition) => { if (!condition) problems.push(label); };

ok('window.PIXI is defined', Boolean(PIXI));
if (!PIXI) { console.log(problems.join('\n')); process.exit(1); }

['Application', 'Container', 'Graphics', 'Sprite', 'Text', 'Texture', 'Rectangle', 'Ticker'].forEach((name) => {
  ok(`PIXI.${name}`, typeof PIXI[name] === 'function' || typeof PIXI[name] === 'object');
});
ok('PIXI.Texture.WHITE', Boolean(PIXI.Texture && PIXI.Texture.WHITE));
ok('PIXI.Texture.from', typeof PIXI.Texture?.from === 'function');
ok('PIXI.Application.prototype.init', typeof PIXI.Application.prototype.init === 'function');

const graphics = ['moveTo', 'lineTo', 'arc', 'arcTo', 'quadraticCurveTo', 'bezierCurveTo', 'closePath',
  'circle', 'ellipse', 'rect', 'roundRect', 'poly', 'fill', 'stroke', 'clear', 'destroy'];
graphics.forEach((name) => ok(`Graphics#${name}`, typeof PIXI.Graphics.prototype[name] === 'function'));

['addChild', 'addChildAt', 'removeChild', 'removeChildren', 'destroy', 'getGlobalPosition'].forEach((name) => {
  ok(`Container#${name}`, typeof PIXI.Container.prototype[name] === 'function');
});

// tint is an accessor on Container in v8, so it lives on the prototype descriptor.
const tintDesc = Object.getOwnPropertyDescriptor(PIXI.Container.prototype, 'tint')
  || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(PIXI.Container.prototype), 'tint');
ok('Container#tint accessor', Boolean(tintDesc && tintDesc.get));

// Instantiate the things the game builds, with no renderer attached.
try {
  const container = new PIXI.Container();
  const g = new PIXI.Graphics();
  g.roundRect(0, 0, 10, 10, 2).fill({ color: 0x112233, alpha: 0.5 });
  g.moveTo(0, 0).quadraticCurveTo(1, 2, 3, 4).stroke({ color: 0x445566, width: 1, alpha: 1, cap: 'round' });
  g.circle(0, 0, 4).fill(0x778899);
  container.addChild(g);
  container.addChildAt(new PIXI.Graphics(), 0);
  ok('Graphics is a Container', container.children.length === 2);
  const text = new PIXI.Text({ text: 'MOOM', style: { fontFamily: 'Courier New', fontSize: 12, fill: '#ffffff', wordWrapWidth: 40, lineHeight: 14, letterSpacing: 1, align: 'center', fontWeight: 'bold', fontStyle: 'italic' } });
  ok('Text is built from options', text.text === 'MOOM');
  // Measuring text needs a real 2D canvas context, which jsdom does not provide.
  try {
    ok('Text has a width', Number.isFinite(text.width) && text.width > 0);
  } catch (_) {
    skipped.push('Text#width (jsdom has no 2D canvas)');
  }
  text.style.fill = '#ff0000';
  ok('Text style is writable', String(text.style.fill).length > 0);
  const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  sprite.anchor.set(0.5);
  sprite.tint = 0xff0000;
  sprite.blendMode = 'normal';
  const rect = new PIXI.Rectangle(0, 0, 10, 10);
  container.hitArea = rect;
  container.eventMode = 'static';
  ok('eventMode sticks', container.eventMode === 'static');
  ok('Container#tint is settable', (() => { container.tint = 0x123456; return typeof container.tint === 'number'; })());
  g.destroy({ children: true });
} catch (error) {
  problems.push(`building the scene graph threw: ${error.message}`);
}

// The canvas textures the particle system builds.
try {
  const canvas = window.document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const texture = PIXI.Texture.from(canvas);
  ok('Texture.from(canvas)', Boolean(texture && texture.source));
} catch (error) {
  problems.push(`Texture.from(canvas) threw: ${error.message}`);
}

if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`);

if (problems.length) {
  console.log(`${problems.length} API problems:`);
  console.log(problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('Every PixiJS API the game uses exists in the vendored bundle. ✔');
