/* Shared headless harness for the idle terminal: jsdom, the real game files, and a manual frame clock. */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const FILES = ['src/util.js', 'src/content.js', 'src/lore.js', 'src/live.js', 'src/idle.js', 'src/idle-ui.js'];

export async function bootGame(rootDir, { seed = null, quiet = true } = {}) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(`jsdomError: ${error.message}`));
  virtualConsole.on('error', (...args) => errors.push(`console.error: ${args.join(' ')}`));
  if (quiet) {
    virtualConsole.on('warn', () => {});
    virtualConsole.on('log', () => {});
  }
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    virtualConsole,
    url: 'https://long-forecast.test/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  if (seed) for (const [key, value] of Object.entries(seed)) window.localStorage.setItem(key, value);

  // A manual frame clock: tests decide how much time the terminal has lived through.
  let clock = 1000;
  const queue = [];
  window.requestAnimationFrame = (fn) => { queue.push(fn); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.performance.now = () => clock;

  for (const file of FILES) {
    const code = fs.readFileSync(path.join(rootDir, file), 'utf8');
    try { window.eval(code); } catch (error) { errors.push(`load ${file}: ${error.stack}`); }
  }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((resolve) => setTimeout(resolve, 30));

  const frame = (ms = 100) => {
    clock += ms;
    const callbacks = queue.splice(0);
    callbacks.forEach((fn) => { try { fn(clock); } catch (error) { errors.push(`frame: ${error.stack}`); } });
  };
  const frames = (count = 1, ms = 100) => { for (let i = 0; i < count; i++) frame(ms); };
  const click = (selector) => {
    const node = window.document.querySelector(selector);
    if (!node) throw new Error(`missing selector: ${selector}`);
    node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    return node;
  };
  const text = (selector) => {
    const node = window.document.querySelector(selector);
    return node ? node.textContent.trim() : null;
  };
  const key = (keyName) => {
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: keyName, code: keyName === ' ' ? 'Space' : keyName, bubbles: true }));
  };
  return { dom, window, document: window.document, ASIdle: window.ASIdle, UI: window.ASIdleUI, frame, frames, click, text, key, errors, setClock: (value) => { clock = value; } };
}

export function closeGame(env) {
  try { env.window.close(); } catch (_) { /* ignore */ }
}
