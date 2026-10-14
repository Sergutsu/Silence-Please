/* Numeric layout inspection: catches overlaps and overflow the eye would catch in a browser. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootGame } from './harness.mjs';

const ROOT = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTHS = [
  { w: 900, h: 620, label: 'desktop' },
  { w: 760, h: 560, label: 'laptop' },
  { w: 660, h: 560, label: 'compact' },
  { w: 380, h: 620, label: 'phone' }
];

const problems = [];
const note = (label, message) => problems.push(`${label}: ${message}`);

function collect(node, out = [], tx = 0, ty = 0, scale = 1) {
  const x = tx + (node.x || 0);
  const y = ty + (node.y || 0);
  const s = scale * (node.scale?.x ?? 1);
  out.push({ node, x, y, s });
  (node.children || []).forEach((child) => collect(child, out, x, y, s));
  return out;
}

async function inspect({ w, h, label }) {
  const { WH, app, step, errors } = await bootGame(ROOT, { width: w, height: h });
  if (!WH) { note(label, 'boot failed'); return; }
  const st = () => WH.game.state;
  st().resources = { pints: 9000, scoops: 90, manuscripts: 90, research: 900, loyalty: 200 };
  WH.content.ROOM_DEFS.forEach((room) => { st().rooms[room.id].unlocked = true; st().rooms[room.id].damaged = false; });
  Object.keys(st().amenities).forEach((key) => { st().amenities[key] = true; });
  st().tier = 4;
  for (let i = 0; i < 24; i++) WH.game.spawnPatron();
  WH.scene.markDirty();
  step(10);

  const size = WH.scene.size;
  const pages = Math.ceil(WH.content.ROOM_DEFS.length / WH.game.pageSize());
  for (let page = 0; page < pages; page++) {
    st().roomPage = page;
    WH.scene.markDirty();
    step(6);
    const views = WH.scene.views;
    if (!views.length) { note(label, `page ${page}: no views`); continue; }
    for (const view of views) {
      if (view.locked) continue;
      const { x, y, w: cw, h: ch } = view;
      const tag = `${label} p${page} ${view.id}`;
      if (x < 0 || y < 0 || x + cw > size.width + 0.6 || y + ch > size.height + 0.6) note(tag, `card outside stage: ${JSON.stringify([x, y, cw, ch])} vs ${JSON.stringify(size)}`);
      if (view.artX < x || view.artX + view.artW > x + cw + 0.6) note(tag, 'art wider than card');
      if (view.footerY + 26 > y + ch) note(tag, 'footer overflows card');
      if (view.zoneButtonY + 17 > y + ch + 0.6) note(tag, 'zone button overflows card');
      // Patrons inside the illustration.
      view.avatars.forEach((avatar) => {
        const headTop = avatar.baseY - 52 * avatar.scale;
        const footBottom = avatar.baseY + 11 * avatar.scale + 3;
        if (headTop < view.artY - 1) note(tag, `patron head above art by ${(view.artY - headTop).toFixed(1)}`);
        if (footBottom > view.artY + view.artH + 1) note(tag, `patron feet below art by ${(footBottom - view.artY - view.artH).toFixed(1)}`);
        if (avatar.x < view.artX + 2 || avatar.x > view.artX + view.artW - 2) note(tag, `patron outside art horizontally at ${avatar.x.toFixed(1)}`);
      });
      // Machine inside the illustration.
      if (view.machine) {
        const m = view.machine;
        const top = m.y - 38 * m.s;
        const bottom = m.y + 16 * m.s;
        if (top < view.artY - 1) note(tag, `machine above art by ${(view.artY - top).toFixed(1)}`);
        if (bottom > view.artY + view.artH + 1) note(tag, `machine below art by ${(bottom - view.artY - view.artH).toFixed(1)}`);
        if (m.x - 32 * m.s < view.artX - 1 || m.x + 32 * m.s > view.artX + view.artW + 1) note(tag, 'machine outside art horizontally');
      }
      // Text inside the card.
      const nodes = collect(view.container);
      nodes.forEach(({ node, x: nx, y: ny, s }) => {
        if (node.text === undefined || !node.text) return;
        const anchorX = node.anchor?.x ?? 0;
        const width = String(node.text).length * (node.style.fontSize || 12) * 0.6 * s;
        const left = nx - anchorX * width;
        const right = left + width;
        if (left < x - 2) note(tag, `text "${String(node.text).slice(0, 18)}" left of card by ${(x - left).toFixed(1)}`);
        if (right > x + cw + 2) note(tag, `text "${String(node.text).slice(0, 18)}" right of card by ${(right - x - cw).toFixed(1)}`);
        if (ny < y - 2 || ny > y + ch + 2) note(tag, `text "${String(node.text).slice(0, 18)}" vertically outside card`);
      });
    }
    // Backdrop clutter must stay above the cards.
    const top = WH.scene.views[0].y;
    const backdrop = WH.scene.views[0].container.parent.parent.children[0];
    const bnodes = collect(backdrop);
    bnodes.forEach(({ node, y: ny }) => {
      if (node.text === undefined) return;
      if (ny > top - 2) note(`${label} backdrop`, `text "${String(node.text).slice(0, 20)}" at y=${ny.toFixed(0)} overlaps cards (top ${top})`);
    });
  }
  // A poured pint should hover over the selected patron.
  st().roomPage = 0;
  WH.scene.markDirty();
  step(6);
  const first = WH.scene.views.find((v) => !v.locked && v.avatars.size);
  if (first) {
    const entry = first.avatars.values().next().value;
    WH.game.selectPatron(entry.patron.id);
    st().beerReady = true;
    step(20);
    const avatar = first.avatars.get(entry.patron.id);
    if (!avatar || !avatar.pint) note(label, 'no pint appears over the selected patron');
    st().beerReady = false;
    step(4);
    const after = first.avatars.get(entry.patron.id);
    if (after && after.pint) note(label, 'pint lingers after the beer is taken away');
  } else {
    note(label, 'no unlocked room had a patron to select');
  }

  if (errors.length) note(label, `runtime errors: ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
}

for (const size of WIDTHS) {
  await inspect(size);
}

if (problems.length) {
  console.log(`${problems.length} layout problems:`);
  console.log(problems.slice(0, 60).map((p) => `  - ${p}`).join('\n'));
} else {
  console.log('Layout clean at every size. ✔');
}
