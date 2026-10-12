/* The White Hart — small utilities shared by every part of the pub. */
window.WH = window.WH || {};
(() => {
  'use strict';
  const WH = window.WH;

  const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const chance = (p) => Math.random() < p;
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const easeIn = (t) => t * t;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));

  function formatNumber(value, digits = 0) {
    const n = Number.isFinite(value) ? value : 0;
    return n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function formatRate(value) {
    const digits = value < 0.01 ? 3 : value < 1 ? 2 : value < 10 ? 1 : 0;
    return formatNumber(value, digits);
  }
  function formatClock(minutes) {
    const total = Math.max(0, Math.floor(minutes));
    const hour24 = 19 + Math.floor(total / 60);
    const hour = ((hour24 + 11) % 12) + 1;
    const suffix = hour24 >= 24 ? 'AM' : 'PM';
    return `${hour}:${String(total % 60).padStart(2, '0')} ${suffix}`;
  }
  function plural(count, word, pluralWord = `${word}s`) {
    return `${count} ${count === 1 ? word : pluralWord}`;
  }
  function roman(value) {
    return ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][value] || String(value);
  }

  /* A tiny deterministic noise source, so the pub's wobble stays coherent frame to frame. */
  function noise1(x) {
    const s = Math.sin(x * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  WH.util = {
    clamp, lerp, rand, randInt, chance, pick, shuffle, smoothstep, easeOut, easeIn,
    $, $$, escapeHtml, formatNumber, formatRate, formatClock, plural, roman, noise1,
    reduceMotion() {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
    }
  };
})();
