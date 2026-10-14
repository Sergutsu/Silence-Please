/* The White Hart — the illustrated pub itself: rooms, regulars, machinery and weather. */
(() => {
  'use strict';
  const WH = window.WH;
  const U = WH.util;
  const C = WH.content;

  let app = null;
  let root = null;
  let backdrop = null;
  let cards = null;
  let views = [];
  let clock = 0;
  let dirty = false;
  let layoutKey = '';
  let size = { width: 700, height: 460 };
  let lastPage = -1;

  const G = () => WH.game.state;

  function px(value) { return Math.max(0.5, value); }

  /* --------------------------------------------------------------- helpers */
  function newGraphics() { return new window.PIXI.Graphics(); }

  function fill(g, x, y, w, h, color, alpha = 1, radius = 0, stroke = null, strokeWidth = 1) {
    const shape = radius ? g.roundRect(x, y, w, h, radius) : g.rect(x, y, w, h);
    shape.fill({ color, alpha });
    if (stroke) {
      const outline = newGraphics();
      const outlineShape = radius ? outline.roundRect(x, y, w, h, radius) : outline.rect(x, y, w, h);
      outlineShape.stroke({ color: stroke, width: strokeWidth, alpha: Math.min(1, alpha + 0.15) });
      g.addChild(outline);
    }
  }

  function line(g, x1, y1, x2, y2, color, width = 1, alpha = 1) {
    const path = newGraphics();
    path.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, width, alpha });
    g.addChild(path);
  }

  function circle(g, x, y, r, color, alpha = 1) {
    g.circle(x, y, r).fill({ color, alpha });
  }

  function text(container, value, x, y, style = {}, anchorX = 0, anchorY = 0) {
    const node = new window.PIXI.Text({
      text: String(value),
      style: {
        fontFamily: style.fontFamily || 'Georgia',
        fontSize: style.fontSize || 12,
        fill: style.fill === undefined ? '#e7ddc6' : style.fill,
        fontWeight: style.fontWeight || 'normal',
        fontStyle: style.fontStyle || 'normal',
        letterSpacing: style.letterSpacing || 0,
        align: style.align || 'left',
        wordWrap: Boolean(style.wordWrapWidth),
        wordWrapWidth: style.wordWrapWidth || 0,
        lineHeight: style.lineHeight,
        breakWords: true
      }
    });
    node.anchor.set(anchorX, anchorY);
    node.position.set(x, y);
    node.resolution = 1;
    container.addChild(node);
    return node;
  }

  function glowSprite(x, y, radius, color, alpha = 0.4) {
    const sprite = new window.PIXI.Sprite(WH.fx.tex('dot'));
    sprite.anchor.set(0.5);
    sprite.x = x;
    sprite.y = y;
    sprite.width = radius * 2;
    sprite.height = radius * 2;
    sprite.tint = color;
    sprite.alpha = alpha;
    sprite.eventMode = 'none';
    return sprite;
  }

  function barSprite(x, y, w, h, color, alpha = 1) {
    const sprite = new window.PIXI.Sprite(WH.fx.tex('white') || WH.fx.tex('dot'));
    sprite.x = x;
    sprite.y = y;
    sprite.width = w;
    sprite.height = h;
    sprite.tint = color;
    sprite.alpha = alpha;
    sprite.eventMode = 'none';
    return sprite;
  }

  /* -------------------------------------------------------------- backdrop */
  function drawHart(g, x, y, s) {
    // The white hart of the sign: a stag, lying down, as heraldry insists.
    g.ellipse(x, y + 6 * s, 15 * s, 4 * s).fill({ color: 0x0d140e, alpha: 0.5 });
    g.roundRect(x - 12 * s, y - 2 * s, 24 * s, 9 * s, 4 * s).fill({ color: 0xe6dcc2 });
    g.roundRect(x + 8 * s, y - 12 * s, 8 * s, 12 * s, 3 * s).fill({ color: 0xe6dcc2 });
    g.roundRect(x + 12 * s, y - 19 * s, 7 * s, 9 * s, 2.5 * s).fill({ color: 0xdccfb0 });
    g.circle(x + 15 * s, y - 20 * s, 1 * s).fill({ color: 0x2b2a20 });
    g.moveTo(x + 10 * s, y - 20 * s).lineTo(x + 9 * s, y - 28 * s).lineTo(x + 13 * s, y - 21 * s).fill({ color: 0xd8b96a });
    g.moveTo(x + 14 * s, y - 21 * s).lineTo(x + 17 * s, y - 28 * s).lineTo(x + 18 * s, y - 21 * s).fill({ color: 0xd8b96a });
    g.moveTo(x - 12 * s, y - 1 * s).quadraticCurveTo(x - 18 * s, y + 2 * s, x - 14 * s, y + 8 * s).stroke({ color: 0xe6dcc2, width: 3 * s, cap: 'round' });
    [-8, -3, 2, 7].forEach((offset, i) => {
      g.roundRect(x + offset * s, y + 6 * s, 3 * s, 5 * s, 1.5 * s).fill({ color: 0xd8cbab });
    });
  }

  function buildBackdrop() {
    const g = newGraphics();
    const { width, height } = size;
    const compact = width < 700;
    fill(g, 0, 0, width, height, 0x1b251e);
    fill(g, 0, 0, width, 40, 0x24251d);
    fill(g, 7, 4, width - 14, height - 8, 0x1b241d, 1, 4, 0x72603d, 1.2);
    line(g, 11, 42, width - 11, 42, 0xb39358, 1, 0.6);
    for (let beam = 0; beam < 7; beam++) {
      const x = 14 + beam * (width - 28) / 6;
      line(g, x, 44, x - 6, height - 11, 0x94764a, 1, 0.1);
    }
    for (let row = 0; row < 12; row++) {
      const y = 46 + row * (height - 62) / 12;
      line(g, 11, y, width - 11, y, 0xd4bd85, 1, 0.022);
    }
    // A cobweb in the corner, because this is a pub with a cellar.
    const web = newGraphics();
    line(web, 6, 6, 42, 6, 0xb9b39a, 0.7, 0.22);
    line(web, 6, 6, 6, 38, 0xb9b39a, 0.7, 0.22);
    for (let i = 1; i < 4; i++) {
      web.moveTo(6, 6).quadraticCurveTo(6 + i * 9, 6 + i * 3, 6 + i * 11, 6 + i * 9).stroke({ color: 0xb9b39a, width: 0.6, alpha: 0.16 });
    }
    g.addChild(web);
    backdrop.addChild(g);

    const decor = new window.PIXI.Container();
    backdrop.addChild(decor);

    // Hanging brass lamps, gently swinging.
    const lampXs = compact ? [] : [width * 0.34, width * 0.66];
    backdrop.lamps = lampXs.map((lx, index) => {
      const lamp = new window.PIXI.Container();
      lamp.x = lx;
      lamp.y = 2;
      const lg = newGraphics();
      line(lg, 0, 0, 0, 14, 0x8a6f42, 1.3, 0.9);
      lg.moveTo(-8, 26).lineTo(8, 26).lineTo(5.5, 15).lineTo(-5.5, 15).fill({ color: 0x4c3c26 });
      lg.moveTo(-8, 26).lineTo(8, 26).lineTo(5.5, 15).lineTo(-5.5, 15).stroke({ color: 0xc9a35e, width: 1, alpha: 0.85 });
      lg.roundRect(-4.5, 19, 9, 8, 2).fill({ color: 0xffd68a, alpha: 0.85 });
      lamp.addChild(lg);
      const glow = glowSprite(0, 24, 34, 0xffc46a, 0.28);
      lamp.addChildAt(glow, 0);
      decor.addChild(lamp);
      return { node: lamp, glow, phase: index * 2.1 };
    });

    // The chalkboard: the landlord changes his mind about it regularly.
    const chalkW = compact ? Math.min(130, width * 0.24) : Math.min(180, width * 0.24);
    const chalkH = 52;
    const chalk = new window.PIXI.Container();
    chalk.x = width - chalkW - 12;
    chalk.y = 8;
    const cg = newGraphics();
    fill(cg, 0, 0, chalkW, chalkH, 0x2b2f27, 1, 3, 0x8a6f42, 2);
    fill(cg, 4, 4, chalkW - 8, chalkH - 8, 0x1d241c, 1, 2);
    chalk.addChild(cg);
    const chalkText = text(chalk, G().chalk || C.CHALK_LINES[0], chalkW / 2, 7, {
      fontFamily: 'Georgia', fontSize: compact ? 7.6 : 8.4, fill: '#d9d3ba', align: 'center',
      wordWrapWidth: chalkW - 12, fontStyle: 'italic', lineHeight: compact ? 9.5 : 10.5
    }, 0.5, 0);
    text(chalk, 'THE LANDLORD WRITES', chalkW / 2, chalkH - 6, { fontFamily: 'Courier New', fontSize: 5.6, fill: '#8d8a72' }, 0.5, 0.5);
    backdrop.chalkText = chalkText;
    backdrop.chalk = chalk;
    decor.addChild(chalk);

    if (!compact) {
      // The pub clock. Its hands keep the pub's time, which is not the world's time.
      const clockBox = new window.PIXI.Container();
      clockBox.x = chalk.x - 46;
      clockBox.y = 30;
      const kg = newGraphics();
      fill(kg, -22, -22, 44, 44, 0x4a3a24, 1, 4, 0xc9a35e, 1.5);
      circle(kg, 0, 0, 18, 0xf0e4c4);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        line(kg, Math.cos(a) * 13.5, Math.sin(a) * 13.5, Math.cos(a) * 16, Math.sin(a) * 16, 0x413322, 1.3, 0.85);
      }
      clockBox.addChild(kg);
      const hourHand = newGraphics();
      hourHand.moveTo(0, 2).lineTo(0, -9).stroke({ color: 0x3b2f1e, width: 2.4, cap: 'round' });
      clockBox.addChild(hourHand);
      const minuteHand = newGraphics();
      minuteHand.moveTo(0, 3).lineTo(0, -14).stroke({ color: 0x3b2f1e, width: 1.6, cap: 'round' });
      clockBox.addChild(minuteHand);
      circle(kg, 0, 0, 2, 0x3b2f1e);
      text(clockBox, 'WEDNESDAY', 0, 27, { fontFamily: 'Courier New', fontSize: 5.6, fill: '#a99a72' }, 0.5, 0.5);
      backdrop.hourHand = hourHand;
      backdrop.minuteHand = minuteHand;
      decor.addChild(clockBox);

      // A barometer, because the pub measures everything twice.
      const baro = new window.PIXI.Container();
      baro.x = 112;
      baro.y = 30;
      const bg = newGraphics();
      fill(bg, -22, -22, 44, 44, 0x4a3a24, 1, 4, 0xc9a35e, 1.4);
      circle(bg, 0, 0, 18, 0xe9dcbd);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
        line(bg, Math.cos(a) * 11, Math.sin(a) * 11, Math.cos(a) * 14, Math.sin(a) * 14, i > 5 ? 0xb0402f : 0x4a3f2c, 1.2, 0.85);
      }
      baro.addChild(bg);
      const needle = newGraphics();
      needle.moveTo(0, 3).lineTo(0, -12).stroke({ color: 0x8c2f2c, width: 1.7, cap: 'round' });
      baro.addChild(needle);
      circle(bg, 0, 0, 2, 0x3b2f1e);
      text(baro, 'DECIBELS', 0, 27, { fontFamily: 'Courier New', fontSize: 5.6, fill: '#a99a72' }, 0.5, 0.5);
      backdrop.needle = needle;
      decor.addChild(baro);
    }

    // Fenton's portrait. He does not blink, but you might.
    const portraitW = 38;
    const portrait = new window.PIXI.Container();
    portrait.x = 46;
    portrait.y = 8;
    const pg = newGraphics();
    fill(pg, 0, 0, portraitW, 40, 0x6a4f2c, 1, 2, 0xd0ab6a, 1.6);
    fill(pg, 3, 3, portraitW - 6, 34, 0x33413a, 1, 1);
    circle(pg, portraitW / 2, 21, 9, 0xc4a077);
    pg.roundRect(portraitW / 2 - 7.5, 12, 15, 4.6, 2).fill({ color: 0x2b2a20 });
    pg.roundRect(portraitW / 2 - 3, 20, 6, 8, 2).fill({ color: 0x4a4238 });
    pg.roundRect(portraitW / 2 - 10, 29, 20, 10, 2).fill({ color: 0x22282a });
    line(pg, portraitW / 2 - 4, 20, portraitW / 2 + 4, 20, 0x2b2a20, 2.2, 1);
    portrait.addChild(pg);
    text(portrait, 'H. FENTON, ESQ.', portraitW / 2, 45, { fontFamily: 'Courier New', fontSize: 5.2, fill: '#a99a72' }, 0.5, 0.5);
    portrait.eventMode = 'static';
    portrait.cursor = 'pointer';
    portrait.hitArea = new window.PIXI.Rectangle(0, 0, portraitW, 40);
    portrait.on('pointertap', (event) => { event.stopPropagation(); WH.game.tapPortrait(); });
    decor.addChild(portrait);
    backdrop.portrait = portrait;

    // The swinging sign.
    const sign = new window.PIXI.Container();
    sign.x = width / 2;
    sign.y = 2;
    sign.scale.set(compact ? 0.84 : 1);
    const sg = newGraphics();
    line(sg, 0, 0, 0, 10, 0x8a6f42, 2, 0.9);
    fill(sg, -46, 10, 92, 30, 0x2c3a2c, 1, 3, 0xc9a35e, 1.4);
    fill(sg, -42, 13, 84, 24, 0x22301f, 1, 2);
    drawHart(sg, -26, 25, 0.72);
    sign.addChild(sg);
    text(sign, 'THE WHITE HART', 14, 25, { fontFamily: 'Georgia', fontSize: 9.2, fill: '#ecdcae', fontWeight: 'bold', letterSpacing: 0.6 }, 0.5, 0.5);
    text(sign, 'FLEET STREET', 14, 34, { fontFamily: 'Courier New', fontSize: 5.4, fill: '#a8965f', letterSpacing: 1.1 }, 0.5, 0.5);
    decor.addChild(sign);
    backdrop.sign = sign;

    const title = text(backdrop, '', width / 2, 57, {
      fontFamily: 'Courier New', fontSize: compact ? 7.4 : 9, fill: '#b7a374', fontWeight: 'bold', letterSpacing: compact ? 1 : 1.5
    }, 0.5, 0.5);
    backdrop.title = title;
    backdrop.compact = compact;

    const page = text(backdrop, '', width / 2, height - 5, { fontFamily: 'Courier New', fontSize: 7.4, fill: '#827d65', letterSpacing: 0.8 }, 0.5, 1);
    backdrop.page = page;
  }

  function updateBackdrop(dt) {
    if (!backdrop) return;
    const state = G();
    if (backdrop.lamps) {
      backdrop.lamps.forEach((lamp) => {
        lamp.node.rotation = Math.sin(clock * 0.9 + lamp.phase) * 0.06;
        const flicker = 0.26 + Math.sin(clock * 7 + lamp.phase * 3) * 0.03 + Math.sin(clock * 17.3 + lamp.phase) * 0.02;
        const powerCut = state.powerCutUntil > state.gameSeconds;
        lamp.glow.alpha = powerCut ? 0.04 : flicker;
      });
    }
    if (backdrop.sign) backdrop.sign.rotation = Math.sin(clock * 1.15) * 0.045;
    if (backdrop.chalkText && state.chalk && backdrop.chalkText.text !== state.chalk) backdrop.chalkText.text = state.chalk;
    if (backdrop.hourHand) {
      const minutes = state.dayElapsed || 0;
      backdrop.minuteHand.rotation = (minutes % 60) / 60 * Math.PI * 2;
      backdrop.hourHand.rotation = ((minutes / 60) % 12) / 12 * Math.PI * 2;
    }
    if (backdrop.needle) {
      const loud = WH.game.maxRoomNoise();
      const target = Math.PI * 0.75 + U.clamp(loud / 100, 0, 1) * Math.PI * 1.5;
      backdrop.needle.rotation += (target - backdrop.needle.rotation) * Math.min(1, dt * 2.4);
    }
    if (backdrop.portrait) {
      const pulse = 1 + Math.sin(clock * 2.1) * 0.02;
      backdrop.portrait.scale.set(pulse);
    }
    if (backdrop.page) {
      const pageCount = Math.ceil(C.ROOM_DEFS.length / WH.game.pageSize());
      backdrop.page.text = `${String(state.roomPage + 1).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}  ·  ${WH.game.hasGreenRoom() ? 'THERE IS A DOOR THAT WAS NOT ON THE PLAN  ·  ' : ''}SWIPE OR USE THE ARROWS TO WANDER`;
    }
    if (backdrop.title) {
      const label = `${backdrop.compact ? 'WED' : 'WEDNESDAY'} ${String(state.week).padStart(2, '0')} · ${WH.game.currentSeason()} · ${WH.game.weatherName()}${state.fentonMode ? ' · PRIVATE STOCK' : ''}`;
      if (backdrop.title.text !== label) backdrop.title.text = label;
    }
  }

  /* ------------------------------------------------------------ room decor */
  function drawWindow(g, x, y, w, h, sky = 0x58646a) {
    fill(g, x - 2, y - 2, w + 4, h + 4, 0x674d30, 1, 2, 0xb48e54, 1);
    fill(g, x, y, w, h, 0x172e35, 1);
    // Old leaded windows, a new address: Norden Deep beyond Fleet Street's roofs.
    for (let star = 0; star < 9; star++) {
      circle(g, x + w * (0.08 + ((star * 7) % 9) / 11), y + h * (0.08 + ((star * 3) % 7) / 22), Math.max(0.35, w / 110), 0xe2e4c4, 0.7);
    }
    circle(g, x + w * 0.75, y + h * 0.24, w * 0.11, 0x718f87, 0.7);
    line(g, x + w * 0.55, y + h * 0.31, x + w * 0.96, y + h * 0.16, 0xd0c291, 1, 0.65);
    fill(g, x + 2, y + h * 0.56, w - 4, h * 0.42, 0x263d40, 0.9);
    for (let i = 0; i < 5; i++) {
      const bx = x + 3 + i * (w - 6) / 5;
      const bh = h * (0.12 + ((i * 7) % 4) * 0.05);
      fill(g, bx, y + h * 0.6 - bh, w / 8, bh, 0x273235, 0.9);
      fill(g, bx + w / 13, y + h * 0.6 - bh - 2, w / 20, 3, 0x8a7350, 0.9);
    }
    // A research radar dish above the familiar chimney pots.
    line(g, x + w * 0.3, y + h * 0.51, x + w * 0.3, y + h * 0.32, 0xa2b7a2, 1, 0.8);
    const dish = newGraphics();
    dish.moveTo(x + w * 0.2, y + h * 0.3).quadraticCurveTo(x + w * 0.3, y + h * 0.48, x + w * 0.4, y + h * 0.3).stroke({ color: 0xc6b58d, width: 1, alpha: 0.9 });
    g.addChild(dish);
    line(g, x + w / 2, y, x + w / 2, y + h, 0x9b8255, 2, 0.9);
    line(g, x, y + h * 0.5, x + w, y + h * 0.5, 0x9b8255, 2, 0.9);
    line(g, x + w * 0.12, y + h * 0.79, x + w * 0.86, y + h * 0.81, 0xb7aa77, 1, 0.5);
  }

  function drawGasLamp(g, x, y, s) {
    line(g, x, y, x, y + 8 * s, 0x8a6f42, 1.2 * s, 0.8);
    fill(g, x - 4 * s, y + 8 * s, 8 * s, 10 * s, 0x4c3c26, 1, 1 * s, 0xc9a35e, 0.8);
    fill(g, x - 2.6 * s, y + 10 * s, 5.2 * s, 6 * s, 0xffd68a, 0.9, 1 * s);
  }

  function drawDecor(g, view) {
    const def = view.def;
    const x = view.artX;
    const y = view.artY;
    const w = view.artW;
    const h = view.artH;
    const baseY = y + h;
    const palette = def.palette;
    const state = G();
    const small = w < 290;

    // Walls, dado rail and floorboards.
    fill(g, x, y, w, h * 0.62, palette.wall, 1);
    fill(g, x, y + h * 0.62, w, h * 0.38, palette.floor, 1);
    line(g, x, y + h * 0.62, x + w, y + h * 0.62, palette.accent, 1.4, 0.4);
    for (let plank = 0; plank < 8; plank++) {
      const lx = x + 6 + plank * (w - 12) / 8;
      const lean = plank % 2 ? 5 : -4;
      line(g, lx, y + h * 0.63, lx + lean, baseY, 0x000000, 1, 0.09);
      line(g, lx + 1, y + h * 0.63, lx + 1 + lean, baseY, 0xffffff, 1, 0.03);
    }
    for (let row = 0; row < 3; row++) {
      const ly = y + h * (0.72 + row * 0.1);
      line(g, x, ly, x + w, ly, 0x000000, 1, 0.08);
    }
    // Wallpaper motif.
    for (let ix = 0; ix < 9; ix++) {
      const px2 = x + 6 + (ix % 5) * (w - 12) / 5;
      const py = y + 10 + Math.floor(ix / 5) * 16;
      circle(g, px2, py, 1.3, 0xffffff, 0.05);
      circle(g, px2, py + 5, 0.8, palette.accent, 0.12);
    }

    if (def.id === 'general') {
      // Back bar with bottles, and a pump shelf.
      fill(g, x + 12, y + 12, w * 0.38, h * 0.26, 0x312c22, 0.95, 2, 0x795b37, 1);
      for (let b = 0; b < 6; b++) {
        const bx = x + 18 + b * Math.min(16, w * 0.048);
        const bh = h * (0.07 + (b % 3) * 0.025);
        fill(g, bx, y + h * 0.19 - bh, small ? 5 : 7, bh, [0x75804d, 0x945f39, 0xb69354, 0x6c7f8c][b % 4], 0.9, 1);
        fill(g, bx + 1, y + h * 0.19 - bh - 2, small ? 3 : 5, 3, 0xc6ae70, 0.9, 1);
      }
      line(g, x + 12, y + h * 0.2, x + w * 0.42, y + h * 0.2, 0xaa8954, 2, 0.8);
      fill(g, x + 7, y + h * 0.58, w - 14, h * 0.15, 0x533820, 1, 3, 0xa07a46, 1.2);
      fill(g, x + 7, y + h * 0.57, w - 14, h * 0.04, 0xc09a57, 1, 2);
      for (let i = 0; i < 4; i++) {
        const px2 = x + 16 + i * (w - 36) / 4;
        fill(g, px2, y + h * 0.62, Math.max(3, w * 0.016), h * 0.08, 0x241d15, 0.85, 1);
        fill(g, px2 - 1, y + h * 0.6, Math.max(4, w * 0.02), 3, 0x8d6f43, 0.9, 1);
      }
      drawWindow(g, x + w * 0.63, y + h * 0.06, w * 0.26, h * 0.3, 0x525e66);
      drawGasLamp(g, x + w * 0.52, y + 4, 1);
      if (state.amenities.jukebox) {
        fill(g, x + w * 0.05, y + h * 0.34, w * 0.15, h * 0.24, 0x4a2f2c, 1, 3, 0xd0a05a, 1);
        fill(g, x + w * 0.065, y + h * 0.37, w * 0.12, h * 0.1, 0x8fd0c0, 0.5, 2);
        circle(g, x + w * 0.125, y + h * 0.53, 2, 0xffd27a, 0.9);
      }
      if (state.amenities.dartboard) {
        circle(g, x + w * 0.9, y + h * 0.2, Math.max(7, h * 0.075), 0x2c2118, 1);
        circle(g, x + w * 0.9, y + h * 0.2, Math.max(4, h * 0.042), 0xc9a35e, 1);
        circle(g, x + w * 0.9, y + h * 0.2, Math.max(2, h * 0.018), 0x8c2f2c, 1);
        view.dartboard = { x: x + w * 0.9, y: y + h * 0.2, r: Math.max(8, h * 0.08) };
      }
      if (state.staff.pianist) {
        fill(g, x + w * 0.74, y + h * 0.44, w * 0.2, h * 0.13, 0x241c15, 1, 2, 0xa07a46, 1);
        for (let k = 0; k < 8; k++) fill(g, x + w * 0.752 + k * w * 0.022, y + h * 0.46, w * 0.013, h * 0.05, 0xf0e6cc, 0.9);
      }
      if (state.amenities.neonSign) {
        fill(g, x + w * 0.3, y + h * 0.03, w * 0.3, 8, 0x1a1f1c, 0.9, 3, 0x6fd8c0, 1);
      }
    } else if (def.id === 'saloon') {
      drawWindow(g, x + 10, y + h * 0.05, w * 0.28, h * 0.32, 0x4d626a);
      fill(g, x + w * 0.56, y + h * 0.1, w * 0.32, h * 0.24, 0x333024, 0.95, 2, 0x8c7045, 1);
      line(g, x + w * 0.55, y + h * 0.2, x + w * 0.9, y + h * 0.2, 0xc09c5f, 2, 0.7);
      for (let i = 0; i < 3; i++) {
        const cx = x + w * (0.38 + i * 0.2), cy = y + h * 0.55;
        fill(g, cx - w * 0.05, cy, w * 0.1, h * 0.07, 0x71502f, 1, 3, 0x9b7845, 1);
        line(g, cx - w * 0.04, cy + h * 0.06, cx - w * 0.04, cy + h * 0.17, 0x60472c, 2, 0.9);
        line(g, cx + w * 0.04, cy + h * 0.06, cx + w * 0.04, cy + h * 0.17, 0x60472c, 2, 0.9);
      }
      drawGasLamp(g, x + w * 0.16, y + 3, 1);
      if (state.amenities.gramophone) {
        fill(g, x + w * 0.06, y + h * 0.44, w * 0.16, h * 0.1, 0x4a3524, 1, 2, 0xc9a35e, 1);
        circle(g, x + w * 0.14, y + h * 0.44, Math.max(5, h * 0.045), 0x201a14, 1);
        line(g, x + w * 0.2, y + h * 0.44, x + w * 0.24, y + h * 0.3, 0xc9a35e, 1.6, 1);
        circle(g, x + w * 0.245, y + h * 0.29, 4, 0xd0a05a, 1);
        view.gramophone = { x: x + w * 0.245, y: y + h * 0.29 };
      }
      if (state.amenities.cheeseBoard) {
        fill(g, x + w * 0.84, y + h * 0.5, w * 0.12, h * 0.05, 0xd8b45c, 1, 2, 0xa8873c, 1);
      }
    } else if (def.id === 'snug') {
      drawWindow(g, x + w * 0.34, y + h * 0.035, w * 0.32, h * 0.34, 0x40545b);
      fill(g, x + w * 0.04, y + h * 0.46, w * 0.92, h * 0.06, 0x22282a, 0.95, 1, 0x9b7747, 1);
      fill(g, x + w * 0.1, y + h * 0.53, w * 0.3, h * 0.1, 0x4a3424, 1, 2, 0x9b7747, 1);
      fill(g, x + w * 0.13, y + h * 0.46, 5, h * 0.07, 0x778878, 1, 1);
      fill(g, x + w * 0.22, y + h * 0.42, 6, h * 0.1, 0x8c5642, 1, 1);
      fill(g, x + w * 0.66, y + h * 0.53, w * 0.24, h * 0.09, 0x493624, 1, 2, 0x94764a, 1);
      fill(g, x + w * 0.72, y + h * 0.3, w * 0.13, h * 0.22, 0x566c63, 0.7, 3, 0xc1a568, 1);
      circle(g, x + w * 0.785, y + h * 0.27, Math.max(3, h * 0.035), 0xd2bb7e, 0.9);
      for (let i = 0; i < 5; i++) line(g, x + w * (0.06 + i * 0.03), y + h * 0.48, x + w * (0.05 + i * 0.03), y + h * 0.55, 0xd8d2c0, 1, 0.35);
    } else if (def.id === 'kitchen') {
      fill(g, x + 8, y + h * 0.1, w - 16, h * 0.3, 0x4a3b2c, 1, 2, 0x9b7747, 1);
      fill(g, x + 12, y + h * 0.14, w * 0.3, h * 0.1, 0x2d2a25, 1, 2, 0xc9a35e, 1);
      fill(g, x + w * 0.5, y + h * 0.13, w * 0.2, h * 0.06, 0x8c6a3c, 1, 2);
      // A stove with a pot, and the world's most optimistic extractor fan.
      fill(g, x + w * 0.1, y + h * 0.48, w * 0.34, h * 0.16, 0x33302a, 1, 2, 0xa07a46, 1.2);
      fill(g, x + w * 0.14, y + h * 0.42, w * 0.12, h * 0.08, 0x565049, 1, 3, 0xd0a05a, 1);
      fill(g, x + w * 0.13, y + h * 0.4, w * 0.14, h * 0.02, 0x8a8378, 1, 2);
      fill(g, x + w * 0.62, y + h * 0.48, w * 0.3, h * 0.14, 0x4a3b2c, 1, 2, 0x9b7747, 1);
      for (let i = 0; i < 4; i++) fill(g, x + w * (0.64 + i * 0.06), y + h * 0.5, w * 0.04, h * 0.05, 0xd8c79b, 0.85, 1);
      drawGasLamp(g, x + w * 0.86, y + 3, 1);
      view.stove = { x: x + w * 0.2, y: y + h * 0.42 };
    } else if (def.id === 'cellar') {
      fill(g, x + 6, y + h * 0.06, w - 12, h * 0.5, 0x282a21, 1, 3, 0x604b31, 1);
      for (let i = 0; i < 5; i++) {
        const bx = x + 13 + i * (w - 34) / 5;
        const by = y + h * (0.16 + (i % 2) * 0.04);
        fill(g, bx, by, w * 0.085, h * 0.32, 0x64472d, 1, 7, 0xb0864e, 1.2);
        line(g, bx + 2, by + h * 0.12, bx + w * 0.085 - 2, by + h * 0.12, 0x302318, 1.4, 0.8);
        line(g, bx + 2, by + h * 0.24, bx + w * 0.085 - 2, by + h * 0.24, 0x302318, 1.4, 0.8);
        circle(g, bx + w * 0.042, by + h * 0.18, 2, 0xd0ae69, 0.85);
      }
      fill(g, x + w * 0.32, y + h * 0.62, w * 0.36, h * 0.09, 0x3b3022, 1, 2, 0x997b49, 1);
      for (let i = 0; i < 3; i++) {
        const px2 = x + w * (0.06 + i * 0.045);
        line(g, px2, y + h * 0.06, px2, y + h * 0.5, 0x4a3c28, 2, 0.6);
      }
    } else if (def.id === 'backroom') {
      fill(g, x + 8, y + h * 0.05, w - 16, h * 0.42, 0x542e29, 1, 2, 0xa6764b, 1);
      for (let i = 0; i < 7; i++) {
        const cx = x + 14 + i * (w - 30) / 6;
        line(g, cx, y + h * 0.07, cx + (i % 2 ? -7 : 7), y + h * 0.45, 0x98533e, 2, 0.7);
      }
      fill(g, x + w * 0.36, y + h * 0.24, w * 0.28, h * 0.2, 0x26352c, 0.92, 2, 0xc39f5c, 1);
      line(g, x + w * 0.42, y + h * 0.34, x + w * 0.58, y + h * 0.34, 0xd0b879, 1, 0.8);
      if (state.amenities.dartsTeam) {
        fill(g, x + w * 0.76, y + h * 0.1, w * 0.16, h * 0.26, 0x2c2118, 1, 2, 0xc9a35e, 1);
        circle(g, x + w * 0.84, y + h * 0.22, Math.max(6, h * 0.07), 0x3a2c1c, 1);
        circle(g, x + w * 0.84, y + h * 0.22, Math.max(3, h * 0.035), 0xc9a35e, 1);
      }
      if (state.amenities.fireplace) {
        fill(g, x + w * 0.06, y + h * 0.5, w * 0.22, h * 0.16, 0x2a2119, 1, 2, 0x8a6f42, 1);
        fill(g, x + w * 0.08, y + h * 0.53, w * 0.18, h * 0.1, 0x14100c, 1, 2);
        view.fire = { x: x + w * 0.17, y: y + h * 0.6, w: w * 0.12, h: h * 0.07 };
      }
    } else if (def.id === 'upstairs') {
      for (let side = 0; side < 2; side++) {
        const sx = side ? x + w * 0.72 : x + 8;
        fill(g, sx, y + h * 0.06, w * 0.2, h * 0.46, 0x32291f, 1, 1, 0x9c7947, 1);
        for (let i = 0; i < 4; i++) {
          const sy = y + h * (0.1 + i * 0.09);
          line(g, sx + 2, sy, sx + w * 0.19, sy, 0xb08a52, 1.6, 0.8);
          for (let b = 0; b < 4; b++) {
            fill(g, sx + 4 + b * (w * 0.042), sy - h * 0.05, w * 0.026, h * 0.05, [0x7c473a, 0x546c55, 0x887547, 0x665b83][(i + b) % 4], 1, 1);
          }
        }
      }
      drawWindow(g, x + w * 0.35, y + h * 0.08, w * 0.28, h * 0.32, 0x4d6068);
      fill(g, x + w * 0.4, y + h * 0.48, w * 0.22, h * 0.06, 0x4a3424, 1, 2, 0x9b7747, 1);
      fill(g, x + w * 0.44, y + h * 0.42, w * 0.03, h * 0.06, 0xd8c79b, 0.9, 1);
      drawGasLamp(g, x + w * 0.06, y + 2, 1);
      if (state.amenities.fireplace) {
        fill(g, x + w * 0.68, y + h * 0.5, w * 0.2, h * 0.14, 0x2a2119, 1, 2, 0x8a6f42, 1);
        fill(g, x + w * 0.7, y + h * 0.53, w * 0.16, h * 0.08, 0x14100c, 1, 2);
        view.fire = { x: x + w * 0.78, y: y + h * 0.59, w: w * 0.1, h: h * 0.06 };
      }
    } else if (def.id === 'roof') {
      fill(g, x, y, w, h * 0.42, 0x2f4a52, 1);
      circle(g, x + w * 0.8, y + h * 0.11, Math.max(8, h * 0.06), 0xe8e2c4, 0.85);
      fill(g, x + 6, y + h * 0.3, w - 12, h * 0.28, 0x3b554c, 0.95, 1, 0x8b7448, 1);
      for (let i = 0; i < 8; i++) {
        const bx = x + 10 + i * (w - 26) / 8;
        const bh = h * (0.12 + ((i * 3) % 4) * 0.035);
        fill(g, bx, y + h * 0.3 - bh, w / 13, bh, 0x303a3a, 1, 1);
        if (i % 2 === 0) fill(g, bx + w / 36, y + h * 0.29 - bh + 3, 3, 4, 0xe0b369, 0.85, 1);
      }
      line(g, x + 8, y + h * 0.6, x + w - 8, y + h * 0.6, 0xb58d4f, 2, 0.9);
      fill(g, x + 16, y + h * 0.08, w - 32, h * 0.05, 0x7c4634, 1, 2, 0xc39b5b, 1);
      line(g, x + 20, y + h * 0.13, x + 20, y + h * 0.31, 0x87633c, 1, 0.9);
      line(g, x + w - 20, y + h * 0.13, x + w - 20, y + h * 0.31, 0x87633c, 1, 0.9);
      for (let i = 0; i < 5; i++) {
        fill(g, x + w * (0.1 + i * 0.17), y + h * 0.66, w * 0.1, h * 0.06, 0x4a5f52, 1, 2, 0x8b7448, 1);
      }
    } else if (def.id === 'green') {
      fill(g, x, y, w, h * 0.6, 0x27402f, 1);
      fill(g, x, y + h * 0.6, w, h * 0.4, 0x33422c, 1);
      for (let i = 0; i < 4; i++) circle(g, x + w * (0.12 + i * 0.24), y + h * 0.14, Math.max(5, h * 0.05), 0xf0e2a8, 0.85);
      fill(g, x + w * 0.08, y + h * 0.34, w * 0.3, h * 0.2, 0x3c2a20, 1, 2, 0xd0a05a, 1);
      fill(g, x + w * 0.5, y + h * 0.32, w * 0.42, h * 0.24, 0x22301f, 0.9, 2, 0x9ad07a, 1);
      line(g, x + w * 0.54, y + h * 0.4, x + w * 0.88, y + h * 0.4, 0x9ad07a, 1, 0.5);
      line(g, x + w * 0.54, y + h * 0.47, x + w * 0.8, y + h * 0.47, 0x9ad07a, 1, 0.4);
      fill(g, x + w * 0.62, y + h * 0.62, w * 0.28, h * 0.06, 0x4a5f42, 1, 2, 0x9ad07a, 0.8);
    }

    // A brass threshold and the small marks of wear every public house earns.
    fill(g, x + 4, baseY - h * 0.16, w - 8, h * 0.16, 0x000000, 0.16);
    line(g, x + 4, baseY - h * 0.16, x + w - 4, baseY - h * 0.16, palette.accent, 1.2, 0.35);
  }

  /* --------------------------------------------------------- the apparatus */
  function buildMachine(view, compact = false) {
    const state = G();
    // The full apparatus sits on the cellar floor; elsewhere it is a smaller unit up by the ceiling,
    // where it cannot be confused with a patron.
    const x = compact ? view.artX + view.artW - 46 : view.artX + view.artW * 0.5;
    const y = compact ? view.artY + 34 : view.artY + view.artH * 0.78;
    const s = compact ? 0.72 : U.clamp(view.artW / 300, 0.72, 1.25);
    const node = new window.PIXI.Container();
    node.x = x;
    node.y = y;
    const g = newGraphics();
    // Housing.
    fill(g, -30 * s, -14 * s, 60 * s, 30 * s, 0x29251d, 1, 3, 0xc39c5d, 1.4);
    fill(g, -26 * s, -10 * s, 52 * s, 22 * s, 0x1e2420, 1, 2, 0x8d7a4c, 0.8);
    fill(g, -23 * s, -7 * s, 17 * s, 12 * s, 0x0d251f, 1, 2, 0x9c8356, 0.8);
    const trace = newGraphics();
    trace.moveTo(-21 * s, 0).lineTo(-18 * s, 0).lineTo(-16 * s, -4 * s).lineTo(-13 * s, 3 * s).lineTo(-10 * s, -1 * s).lineTo(-8 * s, -1 * s).stroke({ color: 0xa4d0a9, width: 0.8, alpha: 0.9 });
    g.addChild(trace);
    node.addChild(g);
    // Three tubes.
    const tubes = [];
    for (let i = 0; i < 3; i++) {
      const tube = new window.PIXI.Container();
      tube.x = (-16 + i * 16) * s;
      const tg = newGraphics();
      tg.roundRect(-5 * s, -34 * s, 10 * s, 34 * s, 4 * s).fill({ color: 0x9c7740, alpha: 0.9 });
      tg.roundRect(-5 * s, -34 * s, 10 * s, 34 * s, 4 * s).stroke({ color: 0xd2b875, width: 1, alpha: 0.9 });
      tube.addChild(tg);
      const inner = newGraphics();
      inner.roundRect(-3 * s, -32 * s, 6 * s, 30 * s, 3 * s).fill({ color: 0x8fd0b4, alpha: 0.4 });
      tube.addChild(inner);
      tube.inner = inner;
      tube.glow = glowSprite(0, -18 * s, 20 * s, 0x8fd0b4, 0.2);
      tube.addChildAt(tube.glow, 0);
      node.addChild(tube);
      tubes.push(tube);
    }
    // The gauge.
    const gauge = new window.PIXI.Container();
    gauge.x = 24 * s;
    gauge.y = 2 * s;
    const gg = newGraphics();
    circle(gg, 0, 0, 9 * s, 0xe9dcbd);
    circle(gg, 0, 0, 9 * s, 0x000000, 0);
    gg.circle(0, 0, 9 * s).stroke({ color: 0xc9a35e, width: 1.2, alpha: 0.9 });
    gauge.addChild(gg);
    const needle = newGraphics();
    needle.moveTo(0, 2 * s).lineTo(0, -7 * s).stroke({ color: 0x8c2f2c, width: 1.6 * s, cap: 'round' });
    gauge.addChild(needle);
    node.addChild(gauge);
    const label = text(node, 'FENTON / R.D.', 0, 12 * s, { fontFamily: 'Courier New', fontSize: 6 * s, fill: '#c1a66b', letterSpacing: 0.5 }, 0.5, 0.5);
    node.eventMode = 'static';
    node.cursor = 'pointer';
    node.hitArea = new window.PIXI.Rectangle(-32 * s, -38 * s, 64 * s, 54 * s);
    node.on('pointertap', (event) => { event.stopPropagation(); WH.game.tapMachine(); });

    view.machine = { node, tubes, needle, s, x, y, label, smokeClock: 0, sparkClock: 0 };
    view.container.addChild(node);
    return view.machine;
  }

  function updateMachine(view, dt, ratio) {
    const m = view.machine;
    if (!m) return;
    const state = G();
    const powerCut = state.powerCutUntil > state.gameSeconds;
    const active = WH.game.activeZoneCount() > 0 && !powerCut;
    m.tubes.forEach((tube, i) => {
      const wobble = active ? 0.34 + Math.sin(clock * (3 + i) + i) * 0.1 + ratio * 0.36 : 0.12;
      tube.inner.alpha = powerCut ? 0.05 : wobble;
      tube.glow.alpha = powerCut ? 0.02 : active ? 0.14 + ratio * (0.24 + Math.sin(clock * 6 + i) * 0.05) : 0.05;
      const danger = ratio > 0.85 ? 0xf0a05a : ratio > 0.7 ? 0xe8d08a : 0x8fd0b4;
      tube.glow.tint = danger;
      tube.inner.tint = danger;
    });
    const target = -Math.PI * 0.75 + (Math.PI * 1.5) * ratio;
    m.needle.rotation += (target - m.needle.rotation) * Math.min(1, dt * 3);
    m.smokeClock -= dt;
    m.sparkClock -= dt;
    if (!U.reduceMotion()) {
      if (ratio > 0.7 && m.smokeClock <= 0 && !powerCut) {
        m.smokeClock = U.lerp(0.5, 0.12, (ratio - 0.7) / 0.3);
        WH.fx.smoke(m.x + U.rand(-16, 16), m.y - 34, { tint: ratio > 0.9 ? 0x8a8378 : 0x6f6d5f, alpha: 0.3 });
      }
      if (ratio > 0.9 && m.sparkClock <= 0 && !powerCut) {
        m.sparkClock = U.lerp(0.9, 0.22, (ratio - 0.9) / 0.1);
        WH.fx.spark(m.x + U.rand(-14, 14), m.y - 24, { count: 5, tint: 0xffd27a, speedMax: 70, gravity: 120 });
        WH.fx.shockwave(m.x, m.y - 16, { size: 8, to: 70, tint: 0xf0a05a, alpha: 0.4, life: 0.5 });
      }
    }
  }

  /* -------------------------------------------------------------- patrons */
  function drawPatronBody(g, patron, s, options = {}) {
    const palette = C.PATRONS[patron.type];
    const ghostly = patron.type === 'ghost';
    const alpha = ghostly ? 0.62 : 1;
    g.ellipse(0, 0, 13 * s, 3.2 * s).fill({ color: 0x090e0a, alpha: 0.5 * alpha });
    // Legs and shoes.
    g.roundRect(-7 * s, -9 * s, 5 * s, 9 * s, 2 * s).fill({ color: 0x2e2a22, alpha });
    g.roundRect(2 * s, -9 * s, 5 * s, 9 * s, 2 * s).fill({ color: 0x2e2a22, alpha });
    g.roundRect(-8 * s, -2 * s, 7 * s, 3 * s, 1.4 * s).fill({ color: 0x1b1610, alpha });
    g.roundRect(1 * s, -2 * s, 7 * s, 3 * s, 1.4 * s).fill({ color: 0x1b1610, alpha });
    // Coat and shirt.
    g.roundRect(-10 * s, -29 * s, 20 * s, 22 * s, 5 * s).fill({ color: palette.coat, alpha });
    g.roundRect(-3.6 * s, -28 * s, 7.2 * s, 20 * s, 2 * s).fill({ color: 0xd8cbab, alpha: alpha * 0.92 });
    g.moveTo(-6 * s, -28 * s).lineTo(0, -21 * s).lineTo(6 * s, -28 * s).fill({ color: 0xd8cbab, alpha: alpha * 0.7 });
    // Arms.
    const armSwing = options.armSwing || 0;
    g.moveTo(-8 * s, -25 * s + armSwing).lineTo(-13 * s, -17 * s).stroke({ color: palette.coat, width: 4 * s, cap: 'round', alpha });
    g.moveTo(8 * s, -25 * s + armSwing).lineTo(12 * s, -17 * s).stroke({ color: palette.coat, width: 4 * s, cap: 'round', alpha });
    // Head.
    circle(g, 0, -37 * s, 9 * s, ghostly ? 0xb9c7d8 : 0xc5a77e, alpha);
    circle(g, -3.4 * s, -37 * s, 1.3 * s, 0x271f18, alpha);
    circle(g, 3.4 * s, -37 * s, 1.3 * s, 0x271f18, alpha);
    const path = newGraphics();
    path.moveTo(-2.4 * s, -32.4 * s).lineTo(0.6 * s, -31.4 * s).lineTo(3.4 * s, -32.6 * s).stroke({ color: 0x755248, width: 1.1 * s, alpha: alpha * 0.9 });
    g.addChild(path);
    // Hat.
    g.roundRect(-8.4 * s, -46.5 * s, 16.8 * s, 5 * s, 2 * s).fill({ color: palette.hat, alpha });
    g.ellipse(0, -45.5 * s, 10.4 * s, 3.1 * s).fill({ color: palette.hat, alpha });
    g.roundRect(-7 * s, -52 * s, 14 * s, 7 * s, 2 * s).fill({ color: palette.hat, alpha });
    g.ellipse(0, -45.6 * s, 10.4 * s, 2 * s).fill({ color: 0x000000, alpha: alpha * 0.18 });
  }

  function drawPatronProp(g, patron, s) {
    const type = patron.type;
    if (type === 'scientist') {
      // Directorate passes pinned to tweed, not spacesuits.
      fill(g, -5 * s, -26 * s, 5 * s, 7 * s, 0xd5c89d, 1, 0.5);
      line(g, -4*s, -24*s, -1*s, -24*s, 0x405c50, 0.7, 1);
      const p = newGraphics();
      p.circle(-3.4 * s, -37 * s, 3.1 * s).stroke({ color: 0xb4c0a8, width: 1 * s });
      p.circle(3.4 * s, -37 * s, 3.1 * s).stroke({ color: 0xb4c0a8, width: 1 * s });
      g.addChild(p);
      circle(g, 13.4 * s, -19 * s, 3.2 * s, 0x8fb5a3, 0.9);
      line(g, 13.4 * s, -23 * s, 13.4 * s, -27 * s, 0xd4c382, 1 * s, 1);
    } else if (type === 'journalist') {
      g.roundRect(9.6 * s, -25 * s, 7.4 * s, 10 * s, 1 * s).fill({ color: 0xe2d4ad });
      line(g, 10.6 * s, -22 * s, 15.6 * s, -22 * s, 0x765a37, 0.7 * s, 1);
      line(g, 10.6 * s, -19.4 * s, 14.6 * s, -19.4 * s, 0x765a37, 0.7 * s, 1);
    } else if (type === 'writer') {
      line(g, 8.6 * s, -23 * s, 14.6 * s, -29 * s, 0xd7bd74, 1.5 * s, 1);
      circle(g, 14.6 * s, -29 * s, 1.4 * s, 0xff9a5c, 0.7);
    } else if (type === 'burt') {
      const p = newGraphics();
      p.moveTo(-6 * s, -33 * s).lineTo(0, -30.6 * s).lineTo(6 * s, -33 * s).stroke({ color: 0x443021, width: 2.6 * s, cap: 'round' });
      p.moveTo(0, -41 * s).lineTo(6 * s, -43 * s).stroke({ color: 0x2d271f, width: 1.3 * s });
      g.addChild(p);
      g.ellipse(0, -37 * s, 11 * s, 10 * s).fill({ color: 0x8c4a35, alpha: 0.25 });
    } else if (type === 'harry') {
      g.roundRect(-10.4 * s, -47 * s, 20.8 * s, 8 * s, 3 * s).fill({ color: 0x272f2d, alpha: 0.75 });
      circle(g, 0, -37 * s, 9.6 * s, 0x657069, 0.5);
    } else if (type === 'john') {
      g.roundRect(8.6 * s, -22 * s, 8 * s, 10 * s, 1 * s).fill({ color: 0x5d4a2e });
      g.roundRect(9.4 * s, -21 * s, 6.4 * s, 8 * s, 1 * s).fill({ color: 0xd8cbab });
    } else if (type === 'inspector') {
      g.roundRect(9 * s, -24 * s, 7 * s, 9.4 * s, 1 * s).fill({ color: 0xdad2bb });
      g.roundRect(9.8 * s, -23 * s, 5.4 * s, 2 * s, 0.5 * s).fill({ color: 0x8c8574 });
    } else if (type === 'tourist') {
      g.roundRect(9 * s, -24 * s, 8 * s, 8 * s, 1 * s).fill({ color: 0xe6dcc0 });
      line(g, 9.8 * s, -21 * s, 16 * s, -21 * s, 0xb08a52, 0.6 * s, 1);
      line(g, 9.8 * s, -18.6 * s, 14.6 * s, -18.6 * s, 0xb08a52, 0.6 * s, 1);
    } else if (type === 'choir' || type === 'kendell') {
      g.roundRect(8.6 * s, -26 * s, 8.4 * s, 11 * s, 1 * s).fill({ color: 0xe8e0c8 });
      line(g, 10 * s, -23 * s, 15.6 * s, -23 * s, 0x6b5a3a, 0.7 * s, 1);
      line(g, 10 * s, -21 * s, 15.6 * s, -21 * s, 0x6b5a3a, 0.7 * s, 1);
      line(g, 10 * s, -19 * s, 13.6 * s, -19 * s, 0x6b5a3a, 0.7 * s, 1);
    } else if (type === 'ghost') {
      g.ellipse(0, -6 * s, 12 * s, 16 * s).fill({ color: 0xc8d6e6, alpha: 0.16 });
    } else if (type === 'regular') {
      circle(g, 12.6 * s, -19 * s, 3.4 * s, 0xc9a35e, 0.95);
      g.roundRect(11.6 * s, -21 * s, 2 * s, 3 * s, 1 * s).fill({ color: 0xf0e4c4, alpha: 0.9 });
    }
  }

  function drawPint(s) {
    const g = newGraphics();
    g.moveTo(5 * s, -6 * s).quadraticCurveTo(13 * s, -6 * s, 13 * s, 0).quadraticCurveTo(13 * s, 6 * s, 4.5 * s, 6 * s).stroke({ color: 0xdadde2, width: 1.1 * s, alpha: 0.9 });
    g.moveTo(-5.2 * s, -8 * s).lineTo(5.2 * s, -8 * s).lineTo(4.1 * s, 8 * s).lineTo(-4.1 * s, 8 * s).fill({ color: 0x16181b, alpha: 0.6 });
    g.moveTo(-4.8 * s, -5.4 * s).lineTo(4.8 * s, -5.4 * s).lineTo(4 * s, 7.6 * s).lineTo(-4 * s, 7.6 * s).fill({ color: 0xd39a3c });
    g.moveTo(-5.2 * s, -8 * s).lineTo(5.2 * s, -8 * s).lineTo(4.1 * s, 8 * s).lineTo(-4.1 * s, 8 * s).stroke({ color: 0xe8ebee, width: 0.8 * s, alpha: 0.85 });
    g.roundRect(-5.6 * s, -10.6 * s, 11.2 * s, 4.2 * s, 2 * s).fill({ color: 0xf3e7cd });
    g.circle(-1.7 * s, -10.8 * s, 1.7 * s).fill({ color: 0xfbf3e2 });
    g.circle(2.2 * s, -10.4 * s, 1.4 * s).fill({ color: 0xfbf3e2 });
    g.moveTo(-2.5 * s, -4.4 * s).lineTo(-2.5 * s, 5.2 * s).stroke({ color: 0xffe6b0, width: 0.7 * s, alpha: 0.45 });
    return g;
  }

  function buildPatron(view, patron, x, baseline, scale, slot) {
    const container = new window.PIXI.Container();
    container.position.set(x, baseline);
    container.eventMode = 'static';
    container.cursor = 'pointer';
    const hitW = 26 * scale;
    container.hitArea = new window.PIXI.Rectangle(-hitW / 2, -54 * scale, hitW, 60 * scale);
    const g = newGraphics();
    drawPatronBody(g, patron, scale);
    drawPatronProp(g, patron, scale);
    container.addChild(g);
    const blink = newGraphics();
    blink.ellipse(-3.4 * scale, -37 * scale, 1.6 * scale, 1.5 * scale).fill({ color: 0xc5a77e });
    blink.ellipse(3.4 * scale, -37 * scale, 1.6 * scale, 1.5 * scale).fill({ color: 0xc5a77e });
    blink.visible = false;
    container.addChild(blink);
    const nameText = text(container, patron.name.split(' ')[0].toUpperCase().slice(0, 8), 0, 6 * scale, {
      fontFamily: 'Courier New', fontSize: Math.max(5.5, 6.8 * scale), fill: '#d6ceb4', fontWeight: 'bold', letterSpacing: 0.2
    }, 0.5, 0.5);
    const barWidth = 24 * scale;
    const patienceG = newGraphics();
    container.addChild(patienceG);
    const avatar = {
      container, g, blink, patienceG, nameText, patron,
      baseY: baseline, x, scale, slot,
      phase: (patron.phase || 0) + slot * 0.7,
      blinkAt: U.rand(1.5, 6),
      quipAt: U.rand(6, 26),
      lastPatience: -1,
      lastSelected: null,
      barWidth,
      enterT: 0,
      leaveT: -1
    };
    container.on('pointertap', (event) => { event.stopPropagation(); WH.game.selectPatron(patron.id); });
    container.on('pointerdown', () => { WH.game.startLongPress(patron); });
    container.on('pointerup', () => WH.game.cancelLongPress());
    container.on('pointerupoutside', () => WH.game.cancelLongPress());
    container.on('pointerover', (event) => { event.stopPropagation(); WH.game.showPatronTooltip(patron, event.global); });
    container.on('pointerout', (event) => { event.stopPropagation(); WH.game.hideTooltip(); });
    view.avatarLayer.addChild(container);
    view.avatars.set(patron.id, avatar);
    // Arrival: a small hop and a puff of dust at the door.
    container.alpha = 0;
    WH.fx.dust(x, baseline, 5, 0xcbbb8c);
    return avatar;
  }

  function updatePatron(view, avatar, dt) {
    const patron = avatar.patron;
    const state = G();
    const a = avatar.container;
    // Entrance.
    if (a.alpha < 1) {
      a.alpha = Math.min(1, a.alpha + dt * 3.4);
      a.y = avatar.baseY - (1 - a.alpha) * 16;
    }
    const bob = U.reduceMotion() ? 0 : Math.sin(clock * 1.9 + avatar.phase) * 1.3;
    const gesture = Math.sin(clock * 0.7 + avatar.phase * 2) * 0.5;
    a.y = avatar.baseY + bob + (a.alpha < 1 ? -(1 - a.alpha) * 16 : 0);
    a.rotation = Math.sin(clock * 1.1 + avatar.phase) * 0.016;
    const breathe = 1 + Math.sin(clock * 2.3 + avatar.phase) * 0.012;
    a.scale.set(1, breathe);
    // Blink.
    avatar.blinkAt -= dt;
    if (avatar.blinkAt <= 0) {
      avatar.blink.visible = true;
      if (avatar.blinkAt < -0.09) {
        avatar.blink.visible = false;
        avatar.blinkAt = U.rand(1.6, 6.5);
      }
    }
    // Patience bar.
    const ratio = U.clamp(patron.patience / (patron.patienceMax || 60), 0, 1);
    const stepped = Math.round(ratio * 60);
    if (stepped !== avatar.lastPatience) {
      avatar.lastPatience = stepped;
      const barWidth = avatar.barWidth;
      const y = 11 * avatar.scale;
      const colour = ratio > 0.48 ? 0x77945f : ratio > 0.2 ? 0xc39c4c : 0xd35e49;
      avatar.patienceG.clear();
      avatar.patienceG.roundRect(-barWidth / 2, y, barWidth, 2.6 * avatar.scale, 1.2).fill({ color: 0x151c17, alpha: 0.9 });
      avatar.patienceG.roundRect(-barWidth / 2, y, barWidth * ratio, 2.6 * avatar.scale, 1.2).fill({ color: colour });
      if (ratio < 0.2) {
        avatar.patienceG.roundRect(-barWidth / 2, y, barWidth, 2.6 * avatar.scale, 1.2).stroke({ color: 0xd35e49, width: 0.8, alpha: 0.8 });
      }
    }
    // Selection ring.
    const selected = state.selectedPatron === patron.id;
    if (selected !== avatar.lastSelected) {
      avatar.lastSelected = selected;
      if (avatar.ring) { avatar.ring.destroy(); avatar.ring = null; }
      if (selected) {
        const ring = newGraphics();
        const s = avatar.scale;
        ring.roundRect(-13 * s, -54 * s, 26 * s, 60 * s, 7 * s).stroke({ color: 0xe6c871, width: 1.6, alpha: 0.95 });
        ring.circle(0, -57 * s, 2.4 * s).fill({ color: 0xe6c871 });
        avatar.container.addChild(ring);
        avatar.ring = ring;
      }
    }
    if (avatar.ring) {
      avatar.ring.alpha = 0.6 + Math.sin(clock * 5) * 0.35;
      const ready = state.beerReady;
      avatar.ring.tint = ready ? 0x9ec27d : 0xffffff;
    }
    // A waiting pint, once the beer has been poured.
    const wantPint = selected && state.beerReady;
    if (Boolean(avatar.pint) !== wantPint) {
      if (avatar.pint) { avatar.pint.destroy({ children: true }); avatar.pint = null; }
      avatar.pint = wantPint ? drawPint(avatar.scale) : null;
      if (avatar.pint) {
        avatar.pint.y = -64 * avatar.scale;
        avatar.pint.alpha = 0;
        avatar.container.addChild(avatar.pint);
        if (!U.reduceMotion()) WH.fx.spark(avatar.container.x, avatar.container.y - 64 * avatar.scale, 4, 0xf0d68a);
      }
    }
    if (avatar.pint) {
      avatar.pintT = (avatar.pintT || 0) + dt;
      avatar.pint.alpha = Math.min(1, avatar.pint.alpha + dt * 5);
      avatar.pint.y = -64 * avatar.scale - 6 + Math.sin(avatar.pintT * 3.4) * 1.6;
      avatar.pint.rotation = Math.sin(avatar.pintT * 2.1) * 0.07;
    }
    // Quips: only when the room is not silenced, and only occasionally.
    if (!U.reduceMotion() && !WH.game.zoneIsOn(patron.roomId) && state.powerCutUntil <= state.gameSeconds) {
      avatar.quipAt -= dt * (1 + WH.game.sourceNoise(patron.roomId) / 60);
      if (avatar.quipAt <= 0) {
        avatar.quipAt = U.rand(9, 30);
        WH.scene.patronSay(patron, U.pick(C.PATRONS[patron.type].quips), { life: 2.4 });
      }
    }
    // A jitter for anyone about to lose patience.
    if (ratio < 0.18) a.x = avatar.x + Math.sin(clock * 26 + avatar.phase) * 0.7;
    else a.x = avatar.x + gesture * 0.4;
  }

  /* ------------------------------------------------------------ room cards */
  function buildRoomCard(def, x, y, w, h) {
    const state = G();
    const record = state.rooms[def.id];
    const view = {
      def, id: def.id, x, y, w, h,
      container: new window.PIXI.Container(),
      avatars: new Map(),
      tickers: [],
      lastZone: null,
      lastNoise: -1,
      lastSeats: '',
      zonePulse: 0,
      shakeSeed: Math.random() * 100
    };
    const card = view.container;
    const g = newGraphics();
    card.addChild(g);
    view.g = g;
    card.position.set(0, 0);

    if (!record.unlocked || record.damaged) {
      buildLockedCard(view, g, def, x, y, w, h, record);
      return view;
    }

    const isHome = def.id === state.homeRoom;
    view.artX = x + 7;
    view.artY = y + 34;
    view.artW = w - 14;
    view.artH = h - 96;

    // The room illustration lives on its own layer, underneath the dials and labels.
    const art = newGraphics();
    card.addChildAt(art, 0);
    view.art = art;
    fill(art, x + 3, y + 5, w, h, 0x070d09, 0.45, 7);
    fill(art, x, y, w, h, 0x2d281d, 1, 5, isHome ? 0xd1ae69 : 0x8d7043, isHome ? 1.6 : 1);
    fill(art, x + 4, y + 4, w - 8, h - 8, 0x19231b, 1, 3, 0x5b4a31, 0.8);
    fill(art, view.artX, view.artY, view.artW, view.artH, def.palette.wall, 1);
    drawDecor(art, view);

    const headerH = 26;
    fill(g, x + 6, y + 6, w - 12, headerH, 0x314031, 1, 2, 0x79623d, 0.8);
    line(g, x + 11, y + headerH + 8, x + w - 11, y + headerH + 8, 0x9a7d4c, 1, 0.4);
    // The room's own light.
    view.light = glowSprite(view.artX + view.artW * 0.5, view.artY + view.artH * 0.42, Math.max(view.artW, view.artH) * 0.62, def.palette.light, 0.1);
    card.addChildAt(view.light, 1);

    // Zone field overlay, drawn on top of the art and animated when the field is on.
    const fieldG = newGraphics();
    view.fieldG = fieldG;
    card.addChild(fieldG);

    view.avatarLayer = new window.PIXI.Container();
    card.addChild(view.avatarLayer);

    const fontName = Math.max(9, Math.min(12, w * 0.034));
    text(card, def.name.toUpperCase(), x + 12, y + 6 + headerH / 2, { fontFamily: 'Courier New', fontSize: fontName, fill: '#eed8a2', fontWeight: 'bold', letterSpacing: 0.85 }, 0, 0.5);
    view.seatsText = text(card, '', x + w - 12, y + 6 + headerH / 2, { fontFamily: 'Courier New', fontSize: Math.max(7, Math.min(9, w * 0.026)), fill: '#b7ad8a' }, 1, 0.5);

    const footerY = y + h - 54;
    view.footerY = footerY;
    text(card, 'NOISE', x + 11, footerY + 8, { fontFamily: 'Courier New', fontSize: 7.4, fill: '#b1a987', fontWeight: 'bold', letterSpacing: 1 }, 0, 0.5);
    view.dbText = text(card, '0 dB', x + w - 12, footerY + 8, { fontFamily: 'Courier New', fontSize: 9.4, fill: '#d4bc86', fontWeight: 'bold' }, 1, 0.5);
    fill(g, x + 11, footerY + 14, w - 22, 5.4, 0x101711, 0.95, 2, 0x576047, 0.6);
    view.noiseFill = barSprite(x + 12, footerY + 15, 0, 3.4, 0x83955f, 1);
    card.addChild(view.noiseFill);
    view.stateLine = text(card, '', x + 11, footerY + 25, { fontFamily: 'Courier New', fontSize: Math.max(6.4, Math.min(7.4, w * 0.022)), fill: '#a59a79', letterSpacing: 0.25 }, 0, 0.5);

    const zoneButtonY = y + h - 22;
    view.zoneButtonY = zoneButtonY;
    view.zoneG = newGraphics();
    card.addChild(view.zoneG);
    view.zoneText = text(card, '', x + w / 2, zoneButtonY + 8, { fontFamily: 'Courier New', fontSize: Math.max(7, Math.min(9, w * 0.027)), fill: '#b4a987', fontWeight: 'bold', letterSpacing: 0.55 }, 0.5, 0.5);

    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.hitArea = new window.PIXI.Rectangle(x, y, w, h);
    card.on('pointertap', (event) => { event.stopPropagation(); WH.game.toggleZone(def.id); });
    card.on('pointerover', (event) => WH.game.showRoomTooltip(def.id, event.global));
    card.on('pointerout', () => WH.game.hideTooltip());

    // Clickable fixtures inside the room.
    if (view.dartboard) {
      const dart = new window.PIXI.Container();
      dart.eventMode = 'static';
      dart.cursor = 'pointer';
      dart.hitArea = new window.PIXI.Rectangle(view.dartboard.x - view.dartboard.r, view.dartboard.y - view.dartboard.r, view.dartboard.r * 2, view.dartboard.r * 2);
      dart.on('pointertap', (event) => { event.stopPropagation(); WH.game.throwDart(def.id); });
      dart.on('pointerover', (event) => { event.stopPropagation(); WH.game.showPlainTooltip('The dartboard. The wall has made peace with this.', event.global); });
      dart.on('pointerout', () => WH.game.hideTooltip());
      card.addChild(dart);
    }
    if (def.id === 'general' && state.amenities.jukebox) {
      const juke = new window.PIXI.Container();
      juke.eventMode = 'static';
      juke.cursor = 'pointer';
      juke.hitArea = new window.PIXI.Rectangle(x + w * 0.05, y + 34 + view.artH * 0.34, w * 0.15, view.artH * 0.24);
      juke.on('pointertap', (event) => { event.stopPropagation(); WH.game.tapJukebox(); });
      juke.on('pointerover', (event) => { event.stopPropagation(); WH.game.showPlainTooltip('The jukebox. Give it a moment.', event.global); });
      juke.on('pointerout', () => WH.game.hideTooltip());
      card.addChild(juke);
    }
    if (def.id === 'cellar') buildMachine(view, false);
    else if (isHome) buildMachine(view, true);
    return view;
  }

  function buildLockedCard(view, g, def, x, y, w, h, record) {
    const card = view.container;
    fill(g, x, y, w, h, 0x101711, 0.97, 6, 0x6d5838, 1.3);
    fill(g, x + 5, y + 5, w - 10, 28, 0x2b372b, 1, 3, 0x775e39, 0.9);
    text(card, def.name.toUpperCase(), x + 14, y + 13, { fontFamily: 'Courier New', fontSize: Math.max(9, Math.min(12, w * 0.034)), fill: '#d9c394', fontWeight: 'bold', letterSpacing: 1 }, 0, 0.5);
    text(card, `${def.seats} ${def.seats === 1 ? 'SEAT' : 'SEATS'}`, x + w - 13, y + 14, { fontFamily: 'Courier New', fontSize: 8, fill: '#a49773' }, 1, 0.5);
    fill(g, x + 7, y + 38, w - 14, h - 46, 0x263127, 0.76, 4, 0x5f5639, 0.7);
    for (let i = 0; i < 7; i++) line(g, x + 10, y + 48 + i * 12, x + w - 10, y + 48 + i * 12, 0x8a744b, 1, 0.1);
    const cx = x + w / 2;
    const cy = y + h * 0.52;
    const lg = newGraphics();
    lg.circle(cx, cy - 13, 16).stroke({ color: 0x927547, width: 1.2, alpha: 0.5 });
    lg.roundRect(cx - 8, cy + 6, 16, 19, 3).stroke({ color: 0x927547, width: 1.2, alpha: 0.55 });
    lg.arc(cx, cy - 15, 6, Math.PI, 0).stroke({ color: 0xb39157, width: 2, alpha: 0.6 });
    g.addChild(lg);
    fill(g, cx - 7, cy - 14, 14, 12, 0x57472e, 0.95, 2, 0xc09a5a, 1);
    text(card, record.damaged ? 'THE ROOM HAS BEEN REDUCED TO A FOOTNOTE' : `LOCKED · ${def.cost} PINTS`, cx, y + h - 26, {
      fontFamily: 'Courier New', fontSize: Math.max(8, Math.min(10, w * 0.028)), fill: record.damaged ? '#d89977' : '#d5bd82', fontWeight: 'bold', letterSpacing: 0.6, align: 'center'
    }, 0.5, 0.5);
    text(card, def.special, cx, y + h - 12, { fontFamily: 'Courier New', fontSize: Math.max(7, Math.min(9, w * 0.024)), fill: '#89927c', align: 'center' }, 0.5, 0.5);
    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.hitArea = new window.PIXI.Rectangle(x, y, w, h);
    card.on('pointertap', (event) => { event.stopPropagation(); record.damaged ? WH.game.tryRebuildRoom(def.id) : WH.game.tryUnlockRoom(def.id); });
    card.on('pointerover', (event) => {
      WH.game.showPlainTooltip(record.damaged
        ? `Rebuild ${def.name} for ${Math.max(25, Math.ceil(def.cost * 0.5))} Pints.`
        : `${def.name} · ${def.cost} Pints · ${def.special}`, event.global);
    });
    card.on('pointerout', () => WH.game.hideTooltip());
    view.locked = true;
    if (record.damaged) {
      WH.fx.puff(cx, cy, { count: 5, tint: 0x6f6d5f, speedMax: 16, sizeMax: 14 });
    }
  }

  function updateRoomCard(view, dt) {
    const state = G();
    if (view.locked) return;
    const def = view.def;
    const record = state.rooms[def.id];
    const zoneOn = WH.game.zoneIsOn(def.id);
    const powerCut = state.powerCutUntil > state.gameSeconds;
    const effective = WH.game.roomNoise(def.id);
    const raw = WH.game.sourceNoise(def.id);

    // Room light dims when the machine is off or the lights are out.
    const targetLight = powerCut ? 0.02 : zoneOn ? 0.13 : 0.09;
    view.light.alpha += (targetLight - view.light.alpha) * Math.min(1, dt * 2.5);
    if (!U.reduceMotion()) {
      view.light.alpha += Math.sin(clock * 6.2 + view.shakeSeed) * 0.008;
    }

    // Noise bar.
    const stepped = Math.round(effective);
    if (stepped !== view.lastNoise) {
      view.lastNoise = stepped;
      const colour = effective >= 85 ? 0xd45742 : effective >= 60 ? 0xc88c4e : 0x83955f;
      view.noiseFill.width = Math.max(0, (view.w - 26) * effective / 100);
      view.noiseFill.tint = colour;
      view.dbText.text = `${stepped} dB`;
      view.dbText.style.fill = stepped >= 70 ? '#ed8a68' : zoneOn ? '#9eb17e' : '#d4bc86';
    }
    if (effective >= 95 && !U.reduceMotion()) {
      view.noiseFill.y = view.footerY + 15 + Math.sin(clock * 30) * 0.5;
    }

    // Seats.
    const seats = `${WH.game.activePatrons(def.id).length}/${WH.game.seatLimit(def.id)} SEATS`;
    const seatLabel = def.id === state.homeRoom ? 'HOUSING' : seats;
    const seatFull = def.id !== state.homeRoom && WH.game.activePatrons(def.id).length >= WH.game.seatLimit(def.id);
    if (seatLabel !== view.lastSeats) {
      view.lastSeats = seatLabel;
      view.seatsText.text = seatLabel;
    }
    const seatTint = def.id === state.homeRoom ? '#d8b66e' : seatFull ? '#e0836a' : '#b7ad8a';
    if (view.seatsText.style.fill !== seatTint) view.seatsText.style.fill = seatTint;

    // State line, trimmed so long room bonuses never walk off the card.
    let stateLine = zoneOn ? `FIELD ${raw} dB → ABSORBED` : (def.id === 'backroom' && state.eventUntil <= state.gameSeconds ? 'EVENTS ONLY · CLOSED' : def.special.toUpperCase());
    const lineFont = Math.max(6.4, Math.min(7.4, view.w * 0.022));
    const lineRoom = Math.max(8, Math.floor((view.w - 26) / (lineFont * 0.62)));
    if (stateLine.length > lineRoom) stateLine = `${stateLine.slice(0, Math.max(6, lineRoom - 1))}…`;
    if (view.stateLine.text !== stateLine) view.stateLine.text = stateLine;
    const wantedTint = zoneOn ? '#9aa078' : '#a59a79';
    if (view.stateLine.style.fill !== wantedTint) view.stateLine.style.fill = wantedTint;

    // Zone button.
    if (zoneOn !== view.lastZone || powerCut !== view.lastPower) {
      view.lastZone = zoneOn;
      view.lastPower = powerCut;
      const zg = view.zoneG;
      zg.clear();
      const bx = view.x + 7;
      const by = view.zoneButtonY;
      const bw = view.w - 14;
      const bg = zoneOn ? 0x3f5b3f : 0x242b22;
      const stroke = zoneOn ? 0x97a86a : 0x695d3d;
      zg.roundRect(bx, by, bw, 17, 3).fill({ color: bg, alpha: 1 });
      zg.roundRect(bx, by, bw, 17, 3).stroke({ color: stroke, width: 0.9, alpha: 0.85 });
      view.zoneText.text = powerCut ? '⚡ POWER CUT' : zoneOn ? '🔇  SILENCER ZONE  ·  ON' : '◌  SILENCER ZONE  ·  OFF';
      view.zoneText.style.fill = powerCut ? '#df9271' : zoneOn ? '#d2d59c' : '#b4a987';
    }

    // Zone field: pulsing rings, and a shimmer that rises while absorbing.
    const fg = view.fieldG;
    fg.clear();
    if (zoneOn) {
      view.zonePulse += dt;
      const ax = view.artX;
      const ay = view.artY;
      const aw = view.artW;
      const ah = view.artH;
      fg.roundRect(ax, ay, aw, ah, 2).fill({ color: 0x6f8f7a, alpha: 0.1 });
      const period = U.clamp(2.4 - raw / 60, 0.8, 2.4);
      for (let i = 0; i < 3; i++) {
        const t = ((view.zonePulse / period) + i / 3) % 1;
        const radius = t * Math.max(aw, ah) * 0.62;
        fg.circle(ax + aw * 0.5, ay + ah * 0.5, radius).stroke({ color: 0x9fd0b0, width: 1.4, alpha: (1 - t) * 0.32 });
      }
      if (!U.reduceMotion() && raw > 0 && Math.random() < dt * (2 + raw / 22)) {
        WH.fx.emit({
          x: ax + U.rand(6, aw - 6), y: ay + ah * U.rand(0.5, 0.95),
          vx: U.rand(-4, 4), vy: U.rand(-30, -14), gravity: -4, drag: 0.6,
          life: U.rand(0.8, 1.6), size: U.rand(2, 4.6), tint: 0xa8d8bc, alpha: 0.5, toSize: 1
        });
      }
    } else if (powerCut) {
      fg.roundRect(view.artX, view.artY, view.artW, view.artH, 2).fill({ color: 0x05080a, alpha: 0.45 });
    }

    // A loud room visibly rattles.
    if (effective >= 78 && !U.reduceMotion()) {
      const shakeAmount = (effective - 78) / 22;
      view.container.x = Math.sin(clock * 34 + view.shakeSeed) * shakeAmount * 1.4;
      view.container.y = Math.cos(clock * 29 + view.shakeSeed) * shakeAmount * 0.8;
    } else if (view.container.x !== 0 || view.container.y !== 0) {
      view.container.x *= 0.6;
      view.container.y *= 0.6;
      if (Math.abs(view.container.x) < 0.05) view.container.x = 0;
      if (Math.abs(view.container.y) < 0.05) view.container.y = 0;
    }

    // The apparatus in this room.
    if (view.machine) updateMachine(view, dt, U.clamp(state.energy / WH.game.capacity(), 0, 1));

    // Fire in the grate.
    if (view.fire && !U.reduceMotion()) {
      if (!view.fireNodes) {
        view.fireNodes = [];
        for (let i = 0; i < 5; i++) {
          const flame = newGraphics();
          flame.moveTo(0, 0).lineTo(2.4, -6).lineTo(-2.4, -6).fill({ color: 0xff9a3c, alpha: 0.8 });
          flame.x = view.fire.x + (i - 2) * view.fire.w * 0.16;
          flame.y = view.fire.y;
          view.container.addChild(flame);
          view.fireNodes.push(flame);
        }
      }
      view.fireNodes.forEach((flame, i) => {
        const f = 0.7 + Math.sin(clock * 8 + i * 1.7) * 0.3;
        flame.scale.set(0.8 + f * 0.4, f * 1.3);
        flame.alpha = 0.55 + f * 0.35;
        flame.tint = f > 0.85 ? 0xffd27a : 0xff8a2c;
      });
      if (Math.random() < dt * 6) {
        WH.fx.emit({
          x: view.fire.x + U.rand(-6, 6), y: view.fire.y - 4,
          vx: U.rand(-5, 5), vy: U.rand(-22, -10), gravity: -3, drag: 0.7,
          life: U.rand(0.9, 1.8), size: U.rand(2, 4), toSize: 8, tint: 0xff9a3c, alpha: 0.35
        });
      }
    }
    // Gramophone notes.
    if (view.gramophone && !U.reduceMotion() && Math.random() < dt * 1.4) {
      WH.fx.emit({
        x: view.gramophone.x + U.rand(-4, 4), y: view.gramophone.y,
        vx: U.rand(-8, 8), vy: U.rand(-20, -10), gravity: -2, drag: 0.8,
        life: U.rand(1.1, 1.9), size: U.rand(4, 7), tint: 0xe8d9a8, alpha: 0.55, wobble: 4
      });
    }
    // The kitchen stove breathes steam.
    if (view.stove && !U.reduceMotion() && Math.random() < dt * 2.2) {
      WH.fx.smoke(view.stove.x + U.rand(-4, 4), view.stove.y - 2, { alpha: 0.18, tint: 0xcfc7b4 });
    }
  }

  function layout() {
    const screen = app.screen;
    size = {
      width: Math.max(320, screen.width || 700),
      height: Math.max(380, screen.height || 480)
    };
    const state = G();
    const pageSize = WH.game.pageSize();
    const pageCount = Math.ceil(C.ROOM_DEFS.length / pageSize);
    state.roomPage = U.clamp(state.roomPage, 0, pageCount - 1);
    const margin = size.width < 610 ? 10 : 15;
    const top = size.width < 610 ? 60 : 68;
    const bottom = 16;
    const gapX = size.width < 610 ? 8 : 12;
    const gapY = size.width < 610 ? 8 : 11;
    const columns = pageSize === 2 ? 1 : 2;
    const rows = Math.ceil(pageSize / columns);
    const cardWidth = (size.width - margin * 2 - gapX * (columns - 1)) / columns;
    const cardHeight = (size.height - top - bottom - gapY * (rows - 1)) / rows;
    return { margin, top, bottom, gapX, gapY, columns, rows, cardWidth, cardHeight, pageSize, pageCount };
  }

  function rebuild() {
    if (!app || !G()) return;
    try {
      const L = layout();
      if (backdrop) { root.removeChild(backdrop); backdrop.destroy({ children: true }); backdrop = null; }
      if (cards) { root.removeChild(cards); cards.destroy({ children: true }); cards = null; }
      views = [];
      cards = new window.PIXI.Container();
      backdrop = new window.PIXI.Container();
      root.addChild(backdrop);
      root.addChild(cards);
      buildBackdrop();
      const pageRooms = C.ROOM_DEFS.slice(G().roomPage * L.pageSize, (G().roomPage + 1) * L.pageSize);
      pageRooms.forEach((def, i) => {
        const col = i % L.columns;
        const row = Math.floor(i / L.columns);
        const x = L.margin + col * (L.cardWidth + L.gapX);
        const y = L.top + row * (L.cardHeight + L.gapY);
        const view = buildRoomCard(def, x, y, L.cardWidth, L.cardHeight);
        cards.addChild(view.container);
        views.push(view);
      });
      syncPatrons(true);
      WH.fx.install(root, cards);
      WH.fx.resize(size.width, size.height);
      lastPage = G().roomPage;
      dirty = false;
    } catch (error) {
      console.error('The pub floor plan could not be drawn.', error);
    }
  }

  function syncPatrons(force = false) {
    views.forEach((view) => {
      if (view.locked) return;
      const patrons = WH.game.activePatrons(view.id);
      const ids = new Set(patrons.map((p) => p.id));
      // Remove departed regulars.
      view.avatars.forEach((avatar, id) => {
        if (!ids.has(id)) {
          if (avatar.container.parent) avatar.container.parent.removeChild(avatar.container);
          avatar.container.destroy({ children: true });
          view.avatars.delete(id);
        }
      });
      // Empty rooms show their empty chairs, which is its own kind of commentary.
      if (!patrons.length) {
        if (!view.seatG && WH.game.seatLimit(view.id) > 0) drawEmptySeats(view);
        return;
      }
      if (view.seatG) {
        view.container.removeChild(view.seatG);
        view.seatG.destroy();
        view.seatG = null;
      }
      const seatCount = WH.game.seatLimit(view.id);
      const spacing = Math.min(46, (view.artW - 26) / Math.max(1, patrons.length));
      const start = view.artX + view.artW / 2 - ((patrons.length - 1) * spacing) / 2;
      const scale = U.clamp(Math.min(0.98, spacing / 40), 0.62, 0.98);
      patrons.forEach((patron, slot) => {
        const existing = view.avatars.get(patron.id);
        const x = start + slot * spacing;
        const baseline = view.artY + view.artH - 14;
        if (existing) {
          existing.x = x;
          existing.baseY = baseline;
          existing.slot = slot;
          existing.container.x = x;
          existing.container.y = baseline;
        } else {
          buildPatron(view, patron, x, baseline, scale, slot);
        }
      });
    });
  }

  function drawEmptySeats(view) {
    const g = newGraphics();
    const count = Math.min(WH.game.seatLimit(view.id), 5);
    for (let i = 0; i < count; i++) {
      const sx = view.artX + (i + 1) * view.artW / (count + 1);
      const sy = view.artY + view.artH - 4;
      g.ellipse(sx, sy, 7.5, 2.2).fill({ color: 0x090f0b, alpha: 0.35 });
      g.roundRect(sx - 4, sy - 11, 8, 11, 2).fill({ color: 0x58462d, alpha: 0.6 });
      g.roundRect(sx - 4, sy - 11, 8, 2.4, 1).fill({ color: 0x7a6340, alpha: 0.7 });
    }
    view.container.addChild(g);
    view.seatG = g;
  }

  function update(dt) {
    if (!app || !G()) return;
    clock += dt;
    if (dirty) rebuild();
    updateBackdrop(dt);
    const state = G();
    if (state.roomPage !== lastPage) { rebuild(); return; }
    syncPatrons(false);
    views.forEach((view) => {
      updateRoomCard(view, dt);
      view.avatars.forEach((avatar) => updatePatron(view, avatar, dt));
    });
  }

  function roomCenter(roomId) {
    const view = views.find((entry) => entry.id === roomId);
    if (!view) return { x: size.width / 2, y: size.height / 2 };
    return { x: view.artX + view.artW / 2, y: view.artY + view.artH * 0.55 };
  }

  function patronPoint(patronId) {
    for (const view of views) {
      const avatar = view.avatars.get(patronId);
      if (avatar) return { x: avatar.container.x, y: avatar.container.y - 46 * avatar.scale };
    }
    return roomCenter(G().patrons.find((p) => p.id === patronId)?.roomId || 'general');
  }

  function patronSay(patron, line, options = {}) {
    const point = patronPoint(patron.id);
    WH.fx.bubble(point.x, point.y - 6, line, {
      life: options.life || 2.6,
      size: options.size || 10,
      shake: Boolean(options.shake),
      stroke: options.stroke,
      color: options.color
    });
    if (options.sound) WH.audio.play(options.sound);
  }

  function sayAt(roomId, line, options = {}) {
    const point = roomCenter(roomId);
    WH.fx.bubble(point.x + (options.dx || 0), point.y + (options.dy || 0), line, options);
  }

  function floatAt(roomId, text, options = {}) {
    const point = roomCenter(roomId);
    WH.fx.floatText(point.x + (options.dx || 0), point.y + (options.dy || 0), text, {
      color: options.color === undefined ? '#f2d68f' : options.color,
      size: options.size || 14,
      life: options.life || 1.5,
      rise: options.rise === undefined ? 40 : options.rise
    });
  }

  function floatOnPatron(patronId, text, options = {}) {
    const point = patronPoint(patronId);
    WH.fx.floatText(point.x, point.y - 8, text, {
      color: options.color === undefined ? '#f2d68f' : options.color,
      size: options.size || 14, life: options.life || 1.5, rise: options.rise === undefined ? 40 : options.rise
    });
  }

  function machinePoint() {
    const state = G();
    const cellar = views.find((entry) => entry.id === 'cellar' && entry.machine);
    if (cellar) return { x: cellar.machine.x, y: cellar.machine.y - 34 };
    const view = views.find((entry) => entry.id === state.homeRoom && entry.machine);
    if (view) return { x: view.machine.x, y: view.machine.y - 30 };
    return roomCenter(state.homeRoom);
  }

  /* Big moments. */
  function hatsOff(roomId) {
    const view = views.find((entry) => entry.id === roomId);
    if (!view) return;
    view.avatars.forEach((avatar) => {
      for (let i = 0; i < 1; i++) {
        WH.fx.spawnProp('hat', {
          fromX: avatar.container.x + U.rand(-6, 6),
          toX: avatar.container.x + U.rand(-90, 90),
          y: avatar.container.y - 46 * avatar.scale,
          duration: U.rand(1.6, 2.6),
          scale: avatar.scale,
          maxTaps: 0,
          bob: 0
        });
      }
    });
  }

  function explosion(roomId) {
    const point = roomCenter(roomId);
    hatsOff(roomId);
    WH.fx.shockwave(point.x, point.y, { size: 20, to: Math.max(size.width, size.height) * 1.6, tint: 0xffe0a0, alpha: 0.9, life: 0.9 });
    WH.fx.shockwave(point.x, point.y, { size: 12, to: Math.max(size.width, size.height) * 1.1, tint: 0xff8a4c, alpha: 0.7, life: 0.6 });
    for (let i = 0; i < 60; i++) {
      WH.fx.emit({
        x: point.x + U.rand(-30, 30), y: point.y + U.rand(-24, 24),
        vx: U.rand(-320, 320), vy: U.rand(-320, 200), gravity: 320, drag: 0.6,
        life: U.rand(0.6, 1.9), size: U.rand(3, 12), toSize: 1,
        tint: U.pick([0xffd27a, 0xff8a4c, 0xf0e0c0, 0x8c7a5c]), alpha: 1, texture: 'star',
        spin: U.rand(-12, 12)
      });
    }
    WH.fx.smoke(point.x, point.y, { alpha: 0.5, tint: 0x5c5a50 });
    WH.fx.smoke(point.x + 20, point.y, { alpha: 0.45, tint: 0x6f6d5f });
    WH.fx.smoke(point.x - 18, point.y, { alpha: 0.45, tint: 0x4a4840 });
    WH.fx.shake(2.2);
    WH.fx.flash('#fff3d6', 0.85, 520);
  }

  function celebrate(kind = 'win') {
    const centre = { x: size.width / 2, y: size.height * 0.45 };
    if (kind === 'win') {
      WH.fx.confetti(centre.x, centre.y, 90);
      WH.fx.fireworks(centre.x, centre.y, 5);
      WH.fx.flash('#fff6df', 0.5, 700);
      WH.fx.floatText(centre.x, centre.y, 'THE WHITE HART IS LEGENDARY', { color: '#ffe6a8', size: 20, life: 3.4, rise: 26 });
    } else if (kind === 'egg') {
      WH.fx.confetti(centre.x, centre.y, 34);
      WH.fx.floatText(centre.x, centre.y - 20, '★ EASTER EGG ★', { color: '#ffe6a8', size: 17, life: 2.6, rise: 30 });
      WH.fx.shockwave(centre.x, centre.y, { size: 10, to: 320, tint: 0xffe6a8, alpha: 0.6, life: 0.8 });
    } else if (kind === 'achievement') {
      WH.fx.floatText(centre.x, size.height * 0.2, '★ ACHIEVEMENT ★', { color: '#cfe6a8', size: 15, life: 2.4, rise: 22 });
    } else if (kind === 'boom') {
      WH.fx.shake(1.4);
      WH.fx.flash('#ffd9a0', 0.5, 400);
    }
  }

  function init(pixiApp) {
    app = pixiApp;
    root = new window.PIXI.Container();
    app.stage.addChild(root);
  }

  WH.scene = {
    init, rebuild, update, layout, roomCenter, patronPoint, patronSay, sayAt, floatAt, floatOnPatron,
    machinePoint, explosion, celebrate, hatsOff, syncPatrons,
    markDirty() { dirty = true; },
    get size() { return size; },
    get views() { return views; },
    get clock() { return clock; },
    resetClock() { clock = 0; }
  };
})();
