/* Absolute Superiority — the live DOM layer.
   The idle engine changes numbers sixty times a second. Rebuilding markup sixty
   times a second is what makes a clicker feel broken: hover states drop, CSS
   animations restart, focus is lost, the page jumps, and every click has to
   land on a node that is about to be thrown away.

   This file is the answer to that: a tiny reconciler. The interface is still
   written as plain HTML strings — that is what keeps the old terminal easy to
   read and edit — but instead of assigning `innerHTML`, the UI hands the new
   markup to `ASLive.patch(root, html)`. The layer walks the new markup against
   the live tree and writes only what actually differs: a text node here, an
   attribute there. Elements keep their identity, so CSS transitions continue,
   the pointer keeps its hover, a focused button keeps focus, and scroll
   position is untouched.

   It is deliberately small and dependency-free: no virtual DOM library, no
   canvas, no WebGL. The game is a text and numbers terminal; drawing it in
   Pixi would mean re-implementing text layout, accessibility and every style
   already written in command.css. Patching the DOM in place gets the same
   result — no visible redraw — with none of that cost.

   API
     ASLive.patch(root, html)   reconcile `root` towards `html`; returns true if
                                anything was written. Skips instantly when the
                                markup is byte-identical to the last patch.
     ASLive.stats               counters, used by the test bench:
                                patches, skipped, text, attributes, replaced,
                                last, total.
     ASLive.resetStats()
     ASLive.paintEvery(ms)      how often the interface may repaint (the engine
                                keeps ticking at full speed regardless).
*/
(() => {
  'use strict';

  const stats = {
    patches: 0,
    skipped: 0,
    text: 0,
    attributes: 0,
    replaced: 0,
    appended: 0,
    removed: 0,
    last: 0,
    total: 0,
  };

  let template = null;
  function getTemplate() {
    if (!template) template = document.createElement('template');
    return template;
  }

  function sameElement(a, b) {
    return a.nodeType === 1
      && a.tagName === b.tagName
      && a.namespaceURI === b.namespaceURI;
  }

  /* Attributes are the expensive part, so only the ones that moved are written.
     `disabled`, `hidden`, `class`, `style`, `title`, `aria-*` and `data-*` all
     arrive here; switching one off never touches the others. */
  function patchAttributes(live, next) {
    const before = live.attributes;
    for (let i = before.length - 1; i >= 0; i -= 1) {
      const name = before[i].name;
      if (!next.hasAttribute(name)) live.removeAttribute(name);
    }
    const after = next.attributes;
    for (let i = 0; i < after.length; i += 1) {
      const { name, value } = after[i];
      if (live.getAttribute(name) !== value) {
        live.setAttribute(name, value);
        stats.attributes += 1;
      }
    }
  }

  function reconcileChildren(live, source) {
    const current = Array.from(live.childNodes);
    const incoming = Array.from(source.childNodes);
    for (let i = 0; i < incoming.length; i += 1) {
      const at = current[i];
      const to = incoming[i];
      if (!at) {
        live.appendChild(to);
        stats.appended += 1;
        continue;
      }
      if (at.nodeType !== to.nodeType) {
        live.replaceChild(to, at);
        stats.replaced += 1;
        continue;
      }
      if (to.nodeType === 3) {
        if (at.nodeValue !== to.nodeValue) {
          at.nodeValue = to.nodeValue;
          stats.text += 1;
        }
        continue;
      }
      if (to.nodeType !== 1) continue;
      if (!sameElement(at, to)) {
        live.replaceChild(to, at);
        stats.replaced += 1;
        continue;
      }
      patchAttributes(at, to);
      reconcileChildren(at, to);
    }
    for (let i = incoming.length; i < current.length; i += 1) {
      live.removeChild(current[i]);
      stats.removed += 1;
    }
  }

  function patch(root, html) {
    if (!root) return false;
    const markup = String(html == null ? '' : html);
    if (root.__liveMarkup === markup) {
      stats.skipped += 1;
      return false;
    }
    const started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const holder = getTemplate();
    holder.innerHTML = markup;
    reconcileChildren(root, holder.content);
    root.__liveMarkup = markup;
    const finished = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    stats.last = finished - started;
    stats.total += stats.last;
    stats.patches += 1;
    return true;
  }

  /* Pure text writes for the few readouts that are cheaper to address directly
     than to re-serialise: the step counter, the page title, the sidebar badges. */
  function text(node, value) {
    if (!node) return false;
    const next = String(value == null ? '' : value);
    if (node.textContent === next) return false;
    node.textContent = next;
    stats.text += 1;
    return true;
  }

  function resetStats() {
    Object.keys(stats).forEach((key) => { stats[key] = 0; });
  }

  /* The interface never repaints faster than this, however fast the machines
     are running. It backs off further when a patch turns out to be expensive,
     so a weak laptop spends its frame time on the game, not the furniture. */
  let paintEvery = 1000 / 12;
  function paintEveryMs(value) {
    if (typeof value === 'number') paintEvery = Math.max(50, Math.min(1000, value));
    return paintEvery;
  }
  function noteCost(ms) {
    if (ms > 32) paintEvery = Math.min(250, paintEvery * 1.5);
    else if (ms < 6 && paintEvery > 1000 / 12) paintEvery = Math.max(1000 / 12, paintEvery * 0.9);
  }

  window.ASLive = { patch, text, stats, resetStats, paintEveryMs, noteCost };
})();
