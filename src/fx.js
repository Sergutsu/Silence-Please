/* The White Hart — dust, smoke, foam, confetti, small animals and other special effects. */
(() => {
  'use strict';
  const WH = window.WH;
  const U = WH.util;

  const MAX_PARTICLES = 460;

  let app = null;
  let stageEl = null;
  let flashEl = null;
  let frameEl = null;
  const layers = { under: null, over: null, props: null, ui: null };
  const pool = [];
  const live = [];
  const props = [];
  const bubbles = [];
  const floats = [];
  const waves = [];
  let textures = null;
  let width = 700;
  let height = 460;
  let clock = 0;
  let weather = 'clear';
  let weatherDrops = [];
  let shakeTimer = null;
  let flashTimer = null;

  /* ------------------------------------------------------------- textures */
  function makeCanvas(size, draw) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      draw(ctx, size);
      return canvas;
    } catch (_) { return null; }
  }

  function buildTextures() {
    if (textures) return textures;
    const dotCanvas = makeCanvas(64, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.72)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });
    const ringCanvas = makeCanvas(96, (ctx, s) => {
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.4, 0, Math.PI * 2);
      ctx.stroke();
    });
    const sparkCanvas = makeCanvas(48, (ctx, s) => {
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.moveTo(s * 0.5, 0);
      ctx.lineTo(s * 0.62, s * 0.5);
      ctx.lineTo(s * 0.5, s);
      ctx.lineTo(s * 0.38, s * 0.5);
      ctx.closePath();
      ctx.fill();
    });
    const starCanvas = makeCanvas(48, (ctx, s) => {
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.translate(s / 2, s / 2);
      for (let i = 0; i < 5; i++) {
        ctx.rotate(Math.PI * 2 / 5);
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.46);
        ctx.lineTo(s * 0.09, -s * 0.09);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
      }
    });
    const safe = (canvas) => {
      try { return canvas && window.PIXI ? window.PIXI.Texture.from(canvas) : null; } catch (_) { return null; }
    };
    textures = {
      dot: safe(dotCanvas), ring: safe(ringCanvas), spark: safe(sparkCanvas), star: safe(starCanvas),
      white: (() => { try { return window.PIXI?.Texture?.WHITE || null; } catch (_) { return null; } })()
    };
    return textures;
  }

  function tex(name) {
    const t = buildTextures();
    return t[name] || t.white || t.dot || null;
  }

  /* ------------------------------------------------------------- particles */
  function obtainSprite() {
    const sprite = pool.pop();
    if (sprite) { sprite.visible = true; sprite.alpha = 1; sprite.rotation = 0; sprite.scale.set(1); return sprite; }
    const node = new window.PIXI.Sprite(tex('dot'));
    node.anchor.set(0.5);
    return node;
  }

  function emit(options) {
    if (!layers.over || live.length >= MAX_PARTICLES) return null;
    const o = options || {};
    const sprite = obtainSprite();
    sprite.texture = tex(o.texture || 'dot');
    sprite.tint = o.tint === undefined ? 0xffffff : o.tint;
    sprite.blendMode = o.blendMode || 'normal';
    sprite.rotation = o.rotation || 0;
    sprite.alpha = o.alpha === undefined ? 1 : o.alpha;
    sprite.x = o.x || 0;
    sprite.y = o.y || 0;
    const size = o.size === undefined ? 6 : o.size;
    sprite.width = size;
    sprite.height = o.sizeY === undefined ? size : o.sizeY;
    const p = {
      sprite,
      x: sprite.x, y: sprite.y,
      vx: o.vx || 0, vy: o.vy || 0,
      gravity: o.gravity === undefined ? 0 : o.gravity,
      drag: o.drag === undefined ? 0.6 : o.drag,
      spin: o.spin || 0,
      life: 0,
      maxLife: o.life || 1,
      fromAlpha: sprite.alpha,
      toAlpha: o.toAlpha === undefined ? 0 : o.toAlpha,
      fromSize: size,
      toSize: o.toSize === undefined ? size : o.toSize,
      fromSizeY: o.sizeY === undefined ? size : o.sizeY,
      toSizeY: o.toSizeY === undefined ? (o.toSize === undefined ? (o.sizeY === undefined ? size : o.sizeY) : o.toSize) : o.toSizeY,
      wobble: o.wobble || 0,
      phase: Math.random() * Math.PI * 2,
      onHalf: o.onHalf || null,
      halved: false
    };
    layers.over.addChild(sprite);
    live.push(p);
    return p;
  }

  function recycle(p) {
    p.sprite.visible = false;
    if (p.sprite.parent) p.sprite.parent.removeChild(p.sprite);
    if (pool.length < 220) pool.push(p.sprite);
  }

  function updateParticles(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) { recycle(p); live.splice(i, 1); continue; }
      if (!p.halved && t >= 0.5 && p.onHalf) { p.halved = true; p.onHalf(p); }
      p.vy += p.gravity * dt;
      const damp = Math.max(0, 1 - p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.sprite.x = p.x + (p.wobble ? Math.sin(p.life * 4 + p.phase) * p.wobble : 0);
      p.sprite.y = p.y;
      p.sprite.rotation += p.spin * dt;
      p.sprite.alpha = U.lerp(p.fromAlpha, p.toAlpha, U.easeIn(t));
      const grow = U.lerp(p.fromSize, p.toSize, t);
      p.sprite.width = Math.max(0.2, grow);
      p.sprite.height = Math.max(0.2, U.lerp(p.fromSizeY, p.toSizeY, t));
    }
  }

  /* ---------------------------------------------------------- conveniences */
  function puff(x, y, options = {}) {
    const count = options.count || 8;
    for (let i = 0; i < count; i++) {
      const angle = options.angle === undefined ? U.rand(0, Math.PI * 2) : options.angle + U.rand(-0.7, 0.7);
      const speed = U.rand(options.speedMin || 8, options.speedMax || 34);
      emit({
        x: x + U.rand(-3, 3), y: y + U.rand(-3, 3),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (options.rise || 6),
        gravity: options.gravity === undefined ? -6 : options.gravity,
        life: U.rand(options.lifeMin || 0.5, options.lifeMax || 1.3),
        size: U.rand(options.sizeMin || 5, options.sizeMax || 15),
        toSize: (options.sizeMax || 15) * 2.1,
        tint: options.tint === undefined ? 0xd9cba6 : options.tint,
        alpha: options.alpha === undefined ? 0.5 : options.alpha,
        drag: 1.1, wobble: options.wobble === undefined ? 2 : options.wobble,
        texture: 'dot'
      });
    }
  }

  function smoke(x, y, options = {}) {
    emit({
      x, y, vx: U.rand(-6, 6), vy: U.rand(-26, -12), gravity: -3, drag: 0.5,
      life: U.rand(1.2, 2.4), size: U.rand(6, 12), toSize: U.rand(22, 38),
      tint: options.tint === undefined ? 0x6f6d5f : options.tint, alpha: options.alpha === undefined ? 0.34 : options.alpha,
      wobble: 3, texture: 'dot'
    });
  }

  function spark(x, y, options = {}) {
    const count = options.count || 10;
    for (let i = 0; i < count; i++) {
      const angle = options.angle === undefined ? U.rand(0, Math.PI * 2) : options.angle + U.rand(-0.9, 0.9);
      const speed = U.rand(options.speedMin || 40, options.speedMax || 150);
      emit({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        gravity: options.gravity === undefined ? 180 : options.gravity, drag: 0.9,
        life: U.rand(0.3, 0.85), size: U.rand(3, 8), sizeY: U.rand(1.2, 2.6),
        toSize: 0.6, tint: options.tint === undefined ? 0xffd27a : options.tint,
        alpha: 1, texture: 'spark',
        rotation: angle, spin: 0
      });
    }
  }

  function dust(x, y, count = 6, tint = 0xd8c79b) {
    for (let i = 0; i < count; i++) {
      emit({
        x: x + U.rand(-6, 6), y: y + U.rand(-4, 4),
        vx: U.rand(-14, 14), vy: U.rand(-10, 4), gravity: 6, drag: 1.4,
        life: U.rand(0.5, 1.1), size: U.rand(2, 5), toSize: 1,
        tint, alpha: 0.55, texture: 'dot'
      });
    }
  }

  function confetti(x, y, count = 46) {
    const tints = [0xe0b45c, 0xc6d17a, 0xd2694f, 0x8fb0c9, 0xe8dcc0, 0xa4c48a];
    for (let i = 0; i < count; i++) {
      emit({
        x: x + U.rand(-40, 40), y: y + U.rand(-24, 10),
        vx: U.rand(-110, 110), vy: U.rand(-190, -60), gravity: 210, drag: 0.5,
        life: U.rand(1.4, 2.8), size: U.rand(6, 11), sizeY: U.rand(4, 8),
        toSize: 2, tint: U.pick(tints), alpha: 1, texture: 'star',
        spin: U.rand(-8, 8), rotation: U.rand(0, 6.28)
      });
    }
  }

  function fireworks(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      const cx = x + U.rand(-width * 0.35, width * 0.35);
      const cy = y + U.rand(-height * 0.3, height * 0.1);
      setTimeout(() => {
        spark(cx, cy, { count: 26, tint: U.pick([0xffd27a, 0x9ad0f5, 0xf5a6c0, 0xcdb4ff]), speedMin: 60, speedMax: 210, gravity: 90, life: undefined });
        WH.audio.play('zap');
      }, i * 320);
    }
  }

  function shockwave(x, y, options = {}) {
    if (!layers.over || U.reduceMotion()) return;
    const sprite = new window.PIXI.Sprite(tex('ring'));
    sprite.anchor.set(0.5);
    sprite.x = x; sprite.y = y;
    sprite.tint = options.tint === undefined ? 0xf0d69a : options.tint;
    sprite.alpha = options.alpha === undefined ? 0.8 : options.alpha;
    const size = options.size === undefined ? 24 : options.size;
    sprite.width = size; sprite.height = size;
    layers.over.addChild(sprite);
    waves.push({ sprite, life: 0, maxLife: options.life || 0.85, from: size, to: options.to === undefined ? Math.max(width, height) * 1.4 : options.to });
  }

  function updateWaves(dt) {
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.life += dt;
      const t = w.life / w.maxLife;
      if (t >= 1) {
        if (w.sprite.parent) w.sprite.parent.removeChild(w.sprite);
        w.sprite.destroy();
        waves.splice(i, 1);
        continue;
      }
      const size = U.lerp(w.from, w.to, U.easeOut(t));
      w.sprite.width = size;
      w.sprite.height = size;
      w.sprite.alpha = (1 - t) * 0.85;
    }
  }

  /* ------------------------------------------------------------ float text */
  function floatText(x, y, text, options = {}) {
    if (!layers.ui) return null;
    const node = new window.PIXI.Text({
      text: String(text),
      style: {
        fontFamily: options.fontFamily || 'Courier New',
        fontSize: options.size || 13,
        fontWeight: options.weight || 'bold',
        fill: options.color === undefined ? '#f2d68f' : options.color,
        letterSpacing: options.letterSpacing === undefined ? 0.5 : options.letterSpacing,
        stroke: { color: 'rgba(8,12,8,0.85)', width: 3 },
        align: 'center'
      }
    });
    node.anchor.set(0.5, 1);
    node.x = x;
    node.y = y;
    layers.ui.addChild(node);
    const entry = {
      node, life: 0, maxLife: options.life || 1.5, x, y,
      rise: options.rise === undefined ? 34 : options.rise,
      vx: options.vx || 0
    };
    floats.push(entry);
    return entry;
  }

  function updateFloats(dt) {
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life += dt;
      const t = f.life / f.maxLife;
      if (t >= 1) {
        if (f.node.parent) f.node.parent.removeChild(f.node);
        f.node.destroy();
        floats.splice(i, 1);
        continue;
      }
      f.node.y = f.y - U.easeOut(t) * f.rise;
      f.node.x = f.x + f.vx * t;
      f.node.alpha = t < 0.15 ? t / 0.15 : 1 - U.easeIn((t - 0.15) / 0.85);
      f.node.scale.set(0.7 + U.easeOut(Math.min(1, t * 4)) * 0.3);
    }
  }

  /* --------------------------------------------------------- speech bubbles */
  function bubble(x, y, text, options = {}) {
    if (!layers.ui) return null;
    const container = new window.PIXI.Container();
    const padding = 7;
    const label = new window.PIXI.Text({
      text: String(text),
      style: {
        fontFamily: options.fontFamily || 'Georgia',
        fontSize: options.size || 10.5,
        fontStyle: options.italic ? 'italic' : 'normal',
        fill: options.color === undefined ? '#f4ecd6' : options.color,
        wordWrap: true,
        wordWrapWidth: options.wrap || 118,
        lineHeight: options.size ? options.size * 1.25 : 13,
        align: 'center'
      }
    });
    const w = Math.min(options.wrap || 118, label.width) + padding * 2;
    const h = label.height + padding * 1.6;
    const g = new window.PIXI.Graphics();
    g.roundRect(-w / 2, -h - 6, w, h, 6).fill({ color: 0x141c16, alpha: 0.94 });
    g.roundRect(-w / 2, -h - 6, w, h, 6).stroke({ color: options.stroke || 0xc8a765, width: 1, alpha: 0.8 });
    g.moveTo(-5, -6).lineTo(0, 0).lineTo(5, -6).fill({ color: 0x141c16, alpha: 0.94 });
    container.addChild(g);
    label.anchor.set(0.5, 0);
    label.position.set(0, -h - 3);
    container.addChild(label);
    container.x = x;
    container.y = y;
    container.alpha = 0;
    layers.ui.addChild(container);
    const entry = {
      container, life: 0, maxLife: options.life || 2.6, x, y,
      rise: options.rise === undefined ? 10 : options.rise,
      shake: Boolean(options.shake), phase: Math.random() * 6.28
    };
    bubbles.push(entry);
    return entry;
  }

  function updateBubbles(dt) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.life += dt;
      const t = b.life / b.maxLife;
      if (t >= 1) {
        if (b.container.parent) b.container.parent.removeChild(b.container);
        b.container.destroy({ children: true });
        bubbles.splice(i, 1);
        continue;
      }
      b.container.alpha = t < 0.12 ? t / 0.12 : 1 - U.easeIn(Math.max(0, (t - 0.7) / 0.3));
      b.container.y = b.y - U.easeOut(t) * b.rise;
      const wob = b.shake ? Math.sin(b.life * 22 + b.phase) * 1.6 : 0;
      b.container.x = b.x + wob;
      const pop = t < 0.18 ? 0.6 + (t / 0.18) * 0.5 : 1;
      b.container.scale.set(pop);
    }
  }

  /* ------------------------------------------------------------- screen fx */
  function shake(power = 1) {
    if (!frameEl || U.reduceMotion()) return;
    frameEl.classList.remove('is-shaking');
    // Force a reflow so the animation can restart.
    void frameEl.offsetWidth;
    frameEl.style.setProperty('--shake-power', String(Math.min(2.2, power)));
    frameEl.classList.add('is-shaking');
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => frameEl.classList.remove('is-shaking'), 1250);
  }

  function flash(color = '#fff6df', alpha = 0.7, duration = 420) {
    if (!flashEl) return;
    flashEl.style.background = color;
    flashEl.style.opacity = String(alpha);
    flashEl.style.transition = 'none';
    void flashEl.offsetWidth;
    flashEl.style.transition = `opacity ${duration}ms ease-out`;
    flashEl.style.opacity = '0';
    clearTimeout(flashTimer);
  }

  /* ---------------------------------------------------------------- props */
  const PROP_ART = {
    cat(g, s) {
      g.ellipse(0, 2 * s, 13 * s, 3.4 * s).fill({ color: 0x0a0f0a, alpha: 0.45 });
      g.roundRect(-13 * s, -12 * s, 21 * s, 12 * s, 6 * s).fill({ color: 0x2f2a24 });
      g.circle(11 * s, -12 * s, 6.4 * s).fill({ color: 0x36302a });
      g.moveTo(7 * s, -16.5 * s).lineTo(6 * s, -21 * s).lineTo(10 * s, -17 * s).fill({ color: 0x36302a });
      g.moveTo(13 * s, -17 * s).lineTo(15 * s, -21 * s).lineTo(16 * s, -16.5 * s).fill({ color: 0x36302a });
      g.circle(9 * s, -13 * s, 1.1 * s).fill({ color: 0xd8e06a });
      g.circle(14 * s, -13 * s, 1.1 * s).fill({ color: 0xd8e06a });
      g.moveTo(-13 * s, -10 * s).quadraticCurveTo(-22 * s, -14 * s, -18 * s, -22 * s).stroke({ color: 0x2f2a24, width: 3 * s, cap: 'round' });
      g.roundRect(-11 * s, -1 * s, 4 * s, 3 * s, 1 * s).fill({ color: 0x2f2a24 });
      g.roundRect(-2 * s, -1 * s, 4 * s, 3 * s, 1 * s).fill({ color: 0x2f2a24 });
      g.roundRect(4 * s, -1 * s, 4 * s, 3 * s, 1 * s).fill({ color: 0x2f2a24 });
    },
    mouse(g, s) {
      g.ellipse(0, 2 * s, 8 * s, 2.2 * s).fill({ color: 0x0a0f0a, alpha: 0.4 });
      g.ellipse(0, -4 * s, 9 * s, 5 * s).fill({ color: 0x6b6257 });
      g.circle(8 * s, -6 * s, 4 * s).fill({ color: 0x776d61 });
      g.circle(6 * s, -7 * s, 2.6 * s).fill({ color: 0xd7b7a8 });
      g.circle(11.4 * s, -7 * s, 1 * s).fill({ color: 0x1c1712 });
      g.moveTo(-8 * s, -5 * s).quadraticCurveTo(-16 * s, -8 * s, -13 * s, -14 * s).stroke({ color: 0xc8a08c, width: 1.6 * s, cap: 'round' });
    },
    ufo(g, s) {
      g.ellipse(0, 0, 20 * s, 6 * s).fill({ color: 0x9fb0bd });
      g.ellipse(0, -4 * s, 11 * s, 8 * s).fill({ color: 0xc7d6de, alpha: 0.92 });
      g.ellipse(-5 * s, 1 * s, 3 * s, 1.6 * s).fill({ color: 0xffe08a });
      g.ellipse(0, 2 * s, 3 * s, 1.6 * s).fill({ color: 0xffe08a });
      g.ellipse(5 * s, 1 * s, 3 * s, 1.6 * s).fill({ color: 0xffe08a });
      g.ellipse(0, -12 * s, 22 * s, 16 * s).fill({ color: 0x8fd8ff, alpha: 0.12 });
    },
    teapot(g, s) {
      g.ellipse(0, 0, 12 * s, 9 * s).fill({ color: 0xc9d6d0 });
      g.ellipse(0, -4 * s, 12 * s, 6 * s).fill({ color: 0xe4efe9 });
      g.moveTo(-11 * s, -3 * s).quadraticCurveTo(-18 * s, -7 * s, -14 * s, -12 * s).stroke({ color: 0xc9d6d0, width: 2.6 * s, cap: 'round' });
      g.moveTo(10 * s, -4 * s).quadraticCurveTo(17 * s, -3 * s, 15 * s, 3 * s).stroke({ color: 0xc9d6d0, width: 2.6 * s, cap: 'round' });
      g.ellipse(0, -12 * s, 4 * s, 2.4 * s).fill({ color: 0xbcc9c3 });
      g.circle(0, -15 * s, 2 * s).fill({ color: 0xdce7e1 });
    },
    ghost(g, s) {
      g.ellipse(0, 3 * s, 14 * s, 4 * s).fill({ color: 0x0a0f0a, alpha: 0.2 });
      g.moveTo(-12 * s, 2 * s).lineTo(-12 * s, -18 * s).quadraticCurveTo(-12 * s, -30 * s, 0, -30 * s)
        .quadraticCurveTo(12 * s, -30 * s, 12 * s, -18 * s).lineTo(12 * s, 2 * s)
        .lineTo(6 * s, -3 * s).lineTo(1 * s, 2 * s).lineTo(-5 * s, -3 * s).lineTo(-12 * s, 2 * s)
        .fill({ color: 0xc8d6e6, alpha: 0.5 });
      g.circle(-4 * s, -18 * s, 1.6 * s).fill({ color: 0x2b3542, alpha: 0.75 });
      g.circle(4 * s, -18 * s, 1.6 * s).fill({ color: 0x2b3542, alpha: 0.75 });
      g.ellipse(0, -10 * s, 3 * s, 2 * s).fill({ color: 0x2b3542, alpha: 0.5 });
    },
    pigeon(g, s) {
      g.ellipse(0, 2 * s, 10 * s, 2.6 * s).fill({ color: 0x0a0f0a, alpha: 0.35 });
      g.ellipse(0, -6 * s, 10 * s, 6 * s).fill({ color: 0x77828c });
      g.circle(8 * s, -12 * s, 4.4 * s).fill({ color: 0x8b96a0 });
      g.moveTo(12 * s, -12 * s).lineTo(16 * s, -11 * s).lineTo(12 * s, -10 * s).fill({ color: 0xd8b25c });
      g.circle(9 * s, -13 * s, 1.1 * s).fill({ color: 0x1d232a });
      g.ellipse(-4 * s, -10 * s, 8 * s, 4 * s).fill({ color: 0x5f6a74 });
    },
    cab(g, s) {
      g.ellipse(0, 4 * s, 22 * s, 4 * s).fill({ color: 0x0a0f0a, alpha: 0.35 });
      g.roundRect(-20 * s, -18 * s, 30 * s, 18 * s, 3 * s).fill({ color: 0x2a2119 });
      g.roundRect(-14 * s, -16 * s, 10 * s, 8 * s, 2 * s).fill({ color: 0xd7bd77 });
      g.roundRect(-2 * s, -16 * s, 10 * s, 8 * s, 2 * s).fill({ color: 0xd7bd77 });
      g.circle(-13 * s, 3 * s, 6 * s).fill({ color: 0x1a1512 });
      g.circle(9 * s, 3 * s, 6 * s).fill({ color: 0x1a1512 });
      g.roundRect(10 * s, -20 * s, 14 * s, 12 * s, 3 * s).fill({ color: 0x4a3a2a });
      g.roundRect(24 * s, -16 * s, 8 * s, 6 * s, 2 * s).fill({ color: 0x4a3a2a });
    },
    hat(g, s) {
      g.ellipse(0, 0, 10 * s, 3.4 * s).fill({ color: 0x3a2c1c });
      g.roundRect(-6 * s, -7 * s, 12 * s, 7 * s, 2 * s).fill({ color: 0x4a3a28 });
      g.ellipse(0, -7 * s, 7 * s, 2 * s).fill({ color: 0x5c4a33 });
    }
  };

  function drawProp(kind, scale = 1) {
    const container = new window.PIXI.Container();
    const g = new window.PIXI.Graphics();
    const draw = PROP_ART[kind] || PROP_ART.cat;
    try { draw(g, scale); } catch (error) { console.warn('A prop could not be drawn.', error); }
    container.addChild(g);
    return { container, g };
  }

  function spawnProp(kind, options = {}) {
    if (!layers.props) return null;
    const scale = options.scale || 1;
    const { container, g } = drawProp(kind, scale);
    const fromX = options.fromX === undefined ? -40 : options.fromX;
    const toX = options.toX === undefined ? width + 40 : options.toX;
    const y = options.y === undefined ? height * 0.62 : options.y;
    const duration = options.duration || 9;
    container.x = fromX;
    container.y = y;
    container.alpha = 0;
    layers.props.addChild(container);
    const entry = {
      container, g, kind, life: 0, maxLife: duration, fromX, toX, y,
      bob: options.bob === undefined ? 3 : options.bob,
      phase: Math.random() * 6.28,
      taps: 0,
      maxTaps: options.maxTaps === undefined ? 4 : options.maxTaps,
      onTap: options.onTap || null,
      glow: options.glow || null,
      fadeIn: options.fadeIn === undefined ? 0.6 : options.fadeIn,
      gone: false
    };
    if (options.onTap) {
      container.eventMode = 'static';
      container.cursor = 'pointer';
      const bounds = options.hit || { x: -22 * scale, y: -32 * scale, w: 44 * scale, h: 40 * scale };
      container.hitArea = new window.PIXI.Rectangle(bounds.x, bounds.y, bounds.w, bounds.h);
      container.on('pointertap', (event) => {
        event.stopPropagation();
        if (entry.gone || entry.taps >= entry.maxTaps) return;
        entry.taps += 1;
        puff(container.x, container.y, { count: 6, tint: 0xe0cba0, speedMax: 24, sizeMax: 9 });
        try { entry.onTap(entry.taps); } catch (error) { console.warn('A prop objected.', error); }
      });
    }
    props.push(entry);
    return entry;
  }

  function updateProps(dt) {
    for (let i = props.length - 1; i >= 0; i--) {
      const p = props[i];
      p.life += dt;
      const t = p.life / p.maxLife;
      if (t >= 1) {
        if (p.container.parent) p.container.parent.removeChild(p.container);
        p.container.destroy({ children: true });
        props.splice(i, 1);
        continue;
      }
      p.container.x = U.lerp(p.fromX, p.toX, t);
      p.container.y = p.y + Math.sin(p.life * 2.4 + p.phase) * p.bob;
      const fade = Math.min(1, p.life / p.fadeIn) * (t > 0.88 ? (1 - t) / 0.12 : 1);
      p.container.alpha = Math.max(0, fade);
      if (p.glow && p.glow.alpha !== undefined) p.glow.alpha = 0.6 + Math.sin(clock * 4) * 0.2;
    }
  }

  function clearProps() {
    props.forEach((p) => {
      if (p.container.parent) p.container.parent.removeChild(p.container);
      p.container.destroy({ children: true });
    });
    props.length = 0;
  }

  /* -------------------------------------------------------------- weather */
  function setWeather(id) {
    weather = id || 'clear';
    weatherDrops.forEach((drop) => {
      if (drop.sprite.parent) drop.sprite.parent.removeChild(drop.sprite);
      if (pool.length < 220) pool.push(drop.sprite);
    });
    weatherDrops = [];
    if (!layers.under || U.reduceMotion()) return;
    if (weather === 'rain' || weather === 'storm') buildWeather(70, 0x9fc4d8, 1.9, 0.5);
    else if (weather === 'drizzle') buildWeather(34, 0x9fc4d8, 1.3, 0.32);
    else if (weather === 'snow') buildWeather(46, 0xeaf2ff, 0.7, 1.6);
    else if (weather === 'fog') buildWeather(18, 0xc8cfc4, 0.35, 2.6);
  }

  function buildWeather(count, tint, size, wobble) {
    for (let i = 0; i < count; i++) {
      const sprite = obtainSprite();
      sprite.texture = tex('dot');
      sprite.tint = tint;
      sprite.width = size * U.rand(1.6, 5);
      sprite.height = size * U.rand(6, 16);
      sprite.x = U.rand(0, width);
      sprite.y = U.rand(0, height);
      sprite.alpha = U.rand(0.1, 0.4);
      layers.under.addChild(sprite);
      weatherDrops.push({
        sprite,
        vy: U.rand(90, 260) * (weather === 'snow' ? 0.24 : 1),
        vx: U.rand(-30, 30),
        wobble: wobble * U.rand(0.4, 1.4),
        phase: U.rand(0, 6.28),
        drift: weather === 'snow' ? U.rand(-1, 1) : 0
      });
    }
  }

  function updateWeather(dt) {
    if (!weatherDrops.length) return;
    const wind = weather === 'storm' ? 60 : 18;
    weatherDrops.forEach((drop) => {
      drop.sprite.y += drop.vy * dt;
      drop.sprite.x += (drop.vx + (weather === 'snow' || weather === 'fog' ? Math.sin(clock * 0.8 + drop.phase) * drop.wobble * 12 : wind)) * dt;
      if (drop.sprite.y > height + 20) {
        drop.sprite.y = -20;
        drop.sprite.x = U.rand(-40, width + 40);
      }
      if (drop.sprite.x > width + 40) drop.sprite.x = -20;
      if (drop.sprite.x < -40) drop.sprite.x = width + 20;
    });
  }

  /* ----------------------------------------------------------------- setup */
  function init(pixiApp, refs = {}) {
    app = pixiApp;
    stageEl = refs.stageEl || U.$('#stage-inner');
    flashEl = refs.flashEl || U.$('#stage-flash');
    frameEl = refs.frameEl || U.$('#stage-frame');
    buildTextures();
    ['under', 'over', 'props', 'ui'].forEach((key) => {
      if (!layers[key]) layers[key] = new window.PIXI.Container();
      layers[key].eventMode = key === 'props' ? 'static' : 'none';
    });
    layers.ui.eventMode = 'none';
    layers.under.eventMode = 'none';
    layers.over.eventMode = 'none';
  }

  function install(stage, cardsLayer) {
    ['under', 'over', 'props', 'ui'].forEach((key) => {
      if (layers[key].parent !== stage) stage.addChild(layers[key]);
    });
    if (cardsLayer && layers.under.parent === stage) {
      const index = stage.getChildIndex(cardsLayer);
      if (stage.getChildIndex(layers.under) > index) {
        stage.removeChild(layers.under);
        stage.addChildAt(layers.under, index);
      }
    }
  }

  function resize(w, h) {
    width = w;
    height = h;
    setWeather(weather);
  }

  function update(dt) {
    clock += dt;
    updateParticles(dt);
    updateWaves(dt);
    updateBubbles(dt);
    updateFloats(dt);
    updateProps(dt);
    updateWeather(dt);
  }

  function clearAll() {
    live.forEach(recycle);
    live.length = 0;
    waves.forEach((w) => { if (w.sprite.parent) w.sprite.parent.removeChild(w.sprite); w.sprite.destroy(); });
    waves.length = 0;
    bubbles.forEach((b) => { if (b.container.parent) b.container.parent.removeChild(b.container); b.container.destroy({ children: true }); });
    bubbles.length = 0;
    floats.forEach((f) => { if (f.node.parent) f.node.parent.removeChild(f.node); f.node.destroy(); });
    floats.length = 0;
    clearProps();
  }

  WH.fx = {
    init, install, resize, update, clearAll, clearProps,
    emit, puff, smoke, spark, dust, confetti, fireworks, shockwave, floatText, bubble, shake, flash,
    spawnProp, drawProp, setWeather, tex,
    get weather() { return weather; },
    get layers() { return layers; },
    get size() { return { width, height }; },
    get counts() { return { live: live.length, props: props.length, bubbles: bubbles.length, floats: floats.length }; }
  };
})();
