/* The White Hart — opening time: boots the pub, listens to the keyboard, keeps the clocks. */
(() => {
  'use strict';
  const WH = window.WH;
  const U = WH.util;

  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  let app = null;
  let lastFrameAt = performance.now();
  let uiClock = 0;
  let saveClock = 0;
  let typingBuffer = '';
  let konamiProgress = 0;
  let swipeStart = null;
  let resizeObserver = null;

  const dom = {};

  const WORD_KEYS = Object.keys(WH.content.EGG_WORDS);

  function isViable(buffer) {
    return WORD_KEYS.some((word) => word.startsWith(buffer));
  }

  /* Push a letter into the secret-word buffer. Returns true when the key is free to be
     used as a shortcut, i.e. it neither completed a word nor kept one alive. */
  function typeLetter(letter) {
    typingBuffer = (typingBuffer + letter).toLowerCase();
    const keys = WORD_KEYS;
    for (const key of keys) {
      if (typingBuffer.endsWith(key)) {
        typingBuffer = '';
        WH.game.checkWord(key);
        return false;
      }
    }
    if (typingBuffer.length > 24) typingBuffer = typingBuffer.slice(-12);
    return !isViable(typingBuffer);
  }

  function visiblePatrons() {
    const list = [];
    (WH.scene.views || []).forEach((view) => {
      if (view.locked) return;
      view.avatars.forEach((avatar) => list.push(avatar.patron));
    });
    return list;
  }

  function cycleSelection(step) {
    const list = visiblePatrons();
    if (!list.length) return;
    const selected = WH.game.state.selectedPatron;
    const at = list.findIndex((patron) => patron.id === selected);
    const next = (at + step + list.length * 2) % list.length;
    WH.game.selectPatron(list[next].id);
  }

  function handleKey(event) {
    if (event.target?.closest?.('[data-annex-controls]')) return;
    if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    const key = event.key;
    const code = event.code || key;
    // The old code.
    const expected = KONAMI[konamiProgress];
    const pressed = code.startsWith('Arrow') ? code : key.toLowerCase();
    if (pressed === expected) {
      konamiProgress += 1;
      if (konamiProgress >= KONAMI.length) {
        konamiProgress = 0;
        WH.game.konami();
      }
    } else {
      konamiProgress = (pressed === KONAMI[0]) ? 1 : 0;
    }

    if (key === 'Escape') {
      if (!dom.modalRoot.hidden) WH.ui.closeModal();
      else if (!dom.crisis.hidden && WH.game.state.explosionFreeze <= 0) WH.game.closeCrisis();
      return;
    }
    if (!dom.modalRoot.hidden) return;

    if (key === ' ') {
      event.preventDefault();
      WH.game.togglePause();
      return;
    }
    if (key === 'ArrowLeft') { WH.game.setPage(-1); return; }
    if (key === 'ArrowRight') { WH.game.setPage(1); return; }
    if (key === 'Enter') { WH.game.pourSelectedPint(); return; }
    if (key === 'Tab') { event.preventDefault(); cycleSelection(event.shiftKey ? -1 : 1); return; }
    if (key === '?') { WH.ui.openModal('help'); return; }

    if (/^[a-zA-Z0-9]$/.test(key)) {
      if (!typeLetter(key.toLowerCase())) return;
      switch (key.toLowerCase()) {
        case 'b': WH.game.pourSelectedPint(); break;
        case 'v': WH.game.toggleVenting(); break;
        case 'j': WH.ui.openModal('journal', 'clippings'); break;
        case 'z': toggleSelectedZone(); break;
        default: break;
      }
    }
  }

  function toggleSelectedZone() {
    const state = WH.game.state;
    const patron = state.patrons.find((entry) => entry.id === state.selectedPatron);
    const roomId = patron ? patron.roomId : state.homeRoom;
    WH.game.toggleZone(roomId);
  }

  function bindStagePointer() {
    const stage = dom.stageInner;
    stage.addEventListener('pointerdown', (event) => { swipeStart = { x: event.clientX, y: event.clientY }; });
    stage.addEventListener('pointerup', (event) => {
      if (!swipeStart) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.2) WH.game.setPage(dx < 0 ? 1 : -1);
      swipeStart = null;
    });
    stage.addEventListener('pointercancel', () => { swipeStart = null; });
    stage.addEventListener('pointerleave', () => { swipeStart = null; WH.ui.hideTooltip(); });
  }

  function syncPageSize() {
    const width = dom.stageInner.clientWidth || 700;
    WH.game.setPageSize(width < 610 ? 2 : 4);
  }

  function resizeRenderer() {
    if (!app?.renderer) return;
    const width = dom.stageInner.clientWidth;
    const height = dom.stageInner.clientHeight;
    if (!width || !height) return;
    if (app.screen.width !== width || app.screen.height !== height) {
      app.renderer.resize(width, height);
    }
    syncPageSize();
    WH.ui.setTabsDirty();
    WH.scene.markDirty();
    WH.ui.render();
  }

  function loop(ticker) {
    const now = performance.now();
    let dt = (now - lastFrameAt) / 1000;
    lastFrameAt = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.1);

    const state = WH.game.state;
    if (state && state.crisisDismissAt && WH.game.realClock >= state.crisisDismissAt && !dom.crisis.hidden && !state.gameOver && !state.won) {
      WH.game.closeCrisis();
      state.crisisDismissAt = 0;
    }

    WH.game.tick(dt);
    WH.scene.update(dt);
    WH.fx.update(dt);

    uiClock += dt;
    if (uiClock >= 0.2) { uiClock = 0; WH.ui.render(); }
    saveClock += dt;
    if (saveClock >= 8) { saveClock = 0; WH.game.saveState(); }
  }

  async function boot() {
    dom.stageInner = U.$('#stage-inner');
    dom.loading = U.$('#stage-loading');
    dom.canvas = U.$('#pub-canvas');
    dom.modalRoot = U.$('#modal-root');
    dom.crisis = U.$('#crisis-screen');

    if (!window.PIXI) {
      if (dom.loading) dom.loading.innerHTML = '<span class="loading-mark">!</span><span>The pub cannot find its illustrator. Please refresh the page.</span>';
      return;
    }

    const state = WH.game.boot();
    WH.ui.bind();

    // Restore the latest headline before the first render.
    if (state.clippings?.length) WH.ui.latestClipping(state.clippings[0]);
    WH.ui.render();

    try {
      app = new window.PIXI.Application();
      await app.init({
        backgroundColor: 0x1b251e,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        resizeTo: dom.stageInner,
        preference: 'webgl',
        powerPreference: 'low-power'
      });
      if (dom.canvas) dom.canvas.remove();
      app.canvas.id = 'pub-canvas';
      app.canvas.setAttribute('aria-label', 'Interactive illustrated pub. Tap a patron to serve them, or tap a room to toggle its Silencer Zone.');
      app.canvas.setAttribute('role', 'img');
      dom.stageInner.insertBefore(app.canvas, dom.loading);

      syncPageSize();
      WH.fx.init(app, {
        stageEl: dom.stageInner,
        flashEl: U.$('#stage-flash'),
        frameEl: U.$('#stage-frame')
      });
      WH.scene.init(app);
      WH.scene.markDirty();
      WH.scene.rebuild();
      WH.ui.render();

      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(() => resizeRenderer());
        resizeObserver.observe(dom.stageInner);
      }
      window.addEventListener('resize', () => {
        clearTimeout(window._whiteHartResize);
        window._whiteHartResize = setTimeout(resizeRenderer, 120);
      });
      window.addEventListener('beforeunload', () => WH.game.saveState());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) WH.game.saveState();
      });
      document.addEventListener('keydown', handleKey);
      bindStagePointer();
      document.addEventListener('pointerdown', () => WH.audio.warmUp(), { once: true });

      dom.loading.classList.add('ready');
      setTimeout(() => { dom.loading.hidden = true; }, 450);

      app.ticker.maxFPS = 60;
      app.ticker.add(loop);

      if (state.gameOver) {
        const crisis = WH.ui.crisisNodes();
        if (crisis) {
          crisis.root.hidden = false;
          crisis.root.classList.add('is-loss');
          crisis.kicker.textContent = 'NOTICE OF CLOSURE';
          crisis.title.textContent = 'The White Hart closed today.';
          crisis.copy.textContent = 'The silence was deafening.';
          crisis.button.hidden = false;
          crisis.button.textContent = 'START A NEW WEDNESDAY  ↻';
        }
      } else if (state.won) {
        const crisis = WH.ui.crisisNodes();
        if (crisis) {
          crisis.root.hidden = false;
          crisis.root.classList.add('is-win');
          crisis.kicker.textContent = 'A VERY RARE FINAL EDITION';
          crisis.title.textContent = 'The White Hart is legendary.';
          crisis.copy.textContent = 'Purvis reveals its true potential. Fenton’s ghost buys a round.';
          crisis.button.hidden = false;
          crisis.button.textContent = 'RETURN TO THE WHITE HART  →';
        }
      } else if (!localStorage.getItem('silence-please-white-hart-v2') && !localStorage.getItem('silence-please-white-hart-v1')) {
        WH.ui.setCaption('Three regulars have arrived. One of them has brought a notebook and an opinion.');
        WH.ui.toast('Wednesday, 7:00 PM', 'Serve a patron, pull a pint, then tap them again. The Silencer is already on in the General Bar. There is a cat somewhere. There is usually a cat.', 9600);
      } else {
        WH.ui.toast('The White Hart is open again', 'Your ledger has been restored. The Directorate scientists are back from next door. One of them has brought a prototype.', 5500);
      }
      WH.game.saveState();
    } catch (error) {
      console.error('PixiJS could not open the pub.', error);
      dom.loading.classList.remove('ready');
      dom.loading.hidden = false;
      dom.loading.innerHTML = '<span class="loading-mark">W H</span><span>The White Hart is having a technical moment. Please refresh.</span>';
    }
  }

  window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
