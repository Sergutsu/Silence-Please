/* The White Hart — the paperwork: dials, ledgers, newspapers, and everything you can click. */
(() => {
  'use strict';
  const WH = window.WH;
  const U = WH.util;
  const C = WH.content;

  const esc = U.escapeHtml;
  const game = () => WH.game;
  const state = () => WH.game.state;

  let modalMode = null;
  let renderedTabsKey = '';
  let toastTimer = null;
  let achievementTimer = null;
  let amenityRoom = '';
  let tooltipTimer = null;

  const $ = U.$;

  /* ----------------------------------------------------------------- toast */
  function toast(title, body, duration = 6800) {
    const root = $('#toast');
    if (!root) return;
    $('#toast-title').textContent = title;
    $('#toast-body').textContent = body;
    root.hidden = false;
    root.classList.remove('pop');
    void root.offsetWidth;
    root.classList.add('pop');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.hidden = true; }, duration);
  }
  function dismissToast() {
    const root = $('#toast');
    if (root) root.hidden = true;
    clearTimeout(toastTimer);
  }

  function achievementToast(def) {
    const root = $('#achievement-pop');
    if (!root || !def) return;
    $('#achievement-icon').textContent = def.icon || '★';
    $('#achievement-name').textContent = def.name;
    $('#achievement-desc').textContent = def.desc;
    root.hidden = false;
    root.classList.remove('pop');
    void root.offsetWidth;
    root.classList.add('pop');
    clearTimeout(achievementTimer);
    achievementTimer = setTimeout(() => { root.hidden = true; }, 4600);
  }

  function latestClipping(clipping) {
    if (!clipping) return;
    const tag = $('#press-tag');
    if (!tag) return;
    tag.textContent = clipping.tag;
    $('#press-headline').textContent = clipping.headline;
    $('#press-copy').textContent = clipping.copy;
  }

  /* -------------------------------------------------------------- tooltip */
  function tooltipAt(text, point, width = 240, height = 70, stageCoords = false) {
    const node = $('#tooltip');
    if (!node || !point) return;
    let x = point.x;
    let y = point.y;
    if (!stageCoords && WH.scene) {
      const canvas = document.getElementById('pub-canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      const size = WH.scene.size;
      if (rect && size.width) {
        x = rect.left + point.x * rect.width / size.width;
        y = rect.top + point.y * rect.height / size.height;
      }
    }
    node.textContent = text;
    node.style.left = `${U.clamp(x + 11, 7, window.innerWidth - width)}px`;
    node.style.top = `${U.clamp(y - 10, 6, window.innerHeight - height)}px`;
    node.hidden = false;
    clearTimeout(tooltipTimer);
  }
  function hideTooltip() {
    const node = $('#tooltip');
    if (node) node.hidden = true;
  }

  /* ------------------------------------------------------------- crisis UI */
  function crisisNodes() {
    const root = $('#crisis-screen');
    if (!root) return null;
    return {
      root,
      kicker: $('#crisis-kicker'),
      title: $('#crisis-title'),
      copy: $('#crisis-copy'),
      button: $('#crisis-button')
    };
  }

  /* ------------------------------------------------------------- shop cards */
  function itemCard({ icon = '✦', title, sub = '', body, cost, action, id, purchased = false, disabled = false, buttonText = 'BUY', status = '', selectedRoom = '', tag = '' }) {
    const affordable = !cost || WH.game.canAfford(cost);
    const missing = Boolean(cost && !affordable);
    return `<article class="shop-item ${purchased ? 'purchased' : ''} ${missing ? 'unaffordable' : ''}">
      ${tag ? `<span class="shop-tag">${esc(tag)}</span>` : ''}
      <div class="shop-item-heading"><span class="shop-item-icon">${esc(icon)}</span><div><h3>${esc(title)}</h3><span class="item-sub">${esc(sub || '')}</span></div></div>
      <p>${esc(body)}</p>
      <div class="shop-item-foot">${purchased ? `<span class="item-status">${esc(status || 'FITTED')}</span>` : `<span class="item-cost ${missing ? 'missing' : ''}">${esc(cost ? WH.game.formatCost(cost) : '')}</span>
      <button class="item-buy" type="button" data-action="${esc(action || '')}" data-id="${esc(id || '')}" ${selectedRoom ? `data-room="${esc(selectedRoom)}"` : ''} ${disabled || !affordable ? 'disabled' : ''}>${esc(buttonText)}</button>`}</div>
    </article>`;
  }

  function roomShopMarkup() {
    const s = state();
    const route = C.ROOM_DEFS.map((room) => {
      const record = s.rooms[room.id];
      if (room.secret && !record.unlocked) return '';
      const current = C.ROOM_DEFS.findIndex((entry) => !s.rooms[entry.id].unlocked || s.rooms[entry.id].damaged);
      const isCurrent = C.ROOM_DEFS.findIndex((entry) => entry.id === room.id) === current;
      return `<div class="route-stop ${record.unlocked && !record.damaged ? 'open' : ''} ${isCurrent ? 'current' : ''}"><b>${esc(room.short)}</b><span>${record.damaged ? 'REBUILD' : record.unlocked ? 'OPEN' : `${room.cost} P`}</span></div>`;
    }).join('');
    const cards = C.ROOM_DEFS.map((room, index) => {
      const record = s.rooms[room.id];
      const previous = C.ROOM_DEFS[index - 1];
      const canReach = !previous || (s.rooms[previous.id].unlocked && !s.rooms[previous.id].damaged);
      if (room.secret && !record.unlocked) {
        return itemCard({ icon: '⌘', title: 'A door that is not on the plan', sub: 'NOT ON ANY FLOOR PLAN', body: 'The landlord insists there is nothing behind the cellar. The landlord is a terrible liar.', purchased: true, status: 'MYSTERY' });
      }
      if (record.damaged) {
        const repair = Math.max(25, Math.ceil(room.cost * 0.5));
        return itemCard({ icon: '⚒', title: room.name, sub: 'DAMAGED · REBUILD REQUIRED', body: `${room.special}. Reopening costs half the original build, at least 25 Pints.`, cost: { pints: repair }, action: 'rebuild-room', id: room.id, buttonText: 'REBUILD' });
      }
      if (record.unlocked) return itemCard({ icon: room.id === 'cellar' ? '⌖' : '✦', title: room.name, sub: `${room.seats} PATRON ${room.seats === 1 ? 'SEAT' : 'SEATS'}`, body: room.special, purchased: true, status: room.id === 'cellar' && s.homeRoom === 'cellar' ? 'SILENCER HOUSING' : 'OPEN' });
      if (!canReach) return itemCard({ icon: '▧', title: room.name, sub: 'OPEN THE PREVIOUS ROOM FIRST', body: room.special, cost: { pints: room.cost }, action: 'unlock-room', id: room.id, buttonText: 'LOCKED', disabled: true });
      return itemCard({ icon: '▧', title: room.name, sub: 'NEXT ON THE FLOOR PLAN', body: room.special, cost: { pints: room.cost }, action: 'unlock-room', id: room.id, buttonText: 'OPEN ROOM' });
    }).join('');
    return `<p class="modal-kicker">THE PUB EXPANDS ONE DOOR AT A TIME</p><h2 class="modal-title" id="modal-title">Rooms &amp; improvements</h2>
      <p class="modal-lede">Every new room brings more seats, more opportunities, and a fresh set of things to apologise for.</p>
      <div class="modal-notice"><span>✦</span><span>Every room on the plan must be open and undamaged for the White Hart to become legendary.</span></div>
      <div class="room-route">${route}</div><div class="shop-grid">${cards}</div>`;
  }

  function silencerShopMarkup() {
    const s = state();
    const tierCards = C.SILENCER_TIERS.map((tier) => {
      if (tier.tier <= s.tier) return itemCard({ icon: '◉', title: `Tier ${U.roman(tier.tier)} · ${tier.name}`, sub: `${U.formatNumber(tier.capacity)} SE CAPACITY`, body: `${tier.note} ${tier.absorption} dB/sec absorption · ${tier.vent} SE/sec vent rate.`, purchased: true, status: 'INSTALLED' });
      const next = tier.tier === s.tier + 1;
      return itemCard({ icon: '◉', title: `Tier ${U.roman(tier.tier)} · ${tier.name}`, sub: `${U.formatNumber(tier.capacity)} SE CAPACITY`, body: `${tier.note} ${tier.absorption} dB/sec absorption · ${tier.vent} SE/sec vent rate.`, cost: tier.cost, action: 'tier', id: tier.tier, buttonText: next ? 'RESEARCH' : 'LOCKED', disabled: !next });
    }).join('');
    const seCards = C.SE_UPGRADES.map((upgrade) => {
      const count = WH.game.upgradeCount(upgrade.id);
      const done = count >= upgrade.max;
      return itemCard({
        icon: upgrade.icon, title: upgrade.name, sub: `INSTALLED ${count} / ${upgrade.max}`,
        body: `${upgrade.body} ${upgrade.effect}.`, cost: { energy: upgrade.cost }, action: 'se-upgrade', id: upgrade.id,
        buttonText: upgrade.id === 'dump' ? 'DUMP 50%' : 'FIT', purchased: done, disabled: done
      });
    }).join('');
    return `<p class="modal-kicker">THE SCIENCE OF NOT HEARING SOMETHING</p><h2 class="modal-title" id="modal-title">Fenton Silencer</h2>
      <p class="modal-lede">Absorption makes the room quiet; the resulting Silence Energy is less quiet about being stored.</p>
      <div class="modal-notice ${s.energy / WH.game.capacity() >= 0.7 ? 'warn' : ''}"><span>🔇</span><span>Current store: <b>${U.formatNumber(s.energy, 1)} / ${U.formatNumber(WH.game.capacity())} SE</b> · Spend SE to fit equipment, or vent it safely.</span></div>
      <h3 class="modal-kicker section-kicker">RESEARCH TIERS</h3><div class="shop-grid">${tierCards}</div>
      <h3 class="modal-kicker section-kicker">SILENCE ENERGY UPGRADES</h3><div class="shop-grid">${seCards}</div>`;
  }

  function staffShopMarkup() {
    const s = state();
    const cards = C.STAFF_DEFS.map((staff) => itemCard({
      icon: staff.icon, title: staff.name, sub: s.staff[staff.id] ? 'ON THE PAYROLL' : 'A ONE-TIME HIRE', body: staff.effect,
      cost: staff.cost, action: 'staff', id: staff.id, buttonText: 'HIRE', purchased: Boolean(s.staff[staff.id])
    })).join('');
    return `<p class="modal-kicker">HELP WANTED · MUST BE CALM NEAR MACHINERY</p><h2 class="modal-title" id="modal-title">The staff room</h2>
      <p class="modal-lede">A reliable employee is worth two emergency notices. Possibly three if they can read.</p><div class="shop-grid">${cards}</div>`;
  }

  function amenityShopMarkup() {
    const s = state();
    const available = C.ROOM_DEFS.filter((room) => room.seats > 0 && WH.game.isOperational(room.id));
    if (!available.some((room) => room.id === amenityRoom)) amenityRoom = available[0]?.id || '';
    const soundproofed = s.soundproofedRooms.includes(amenityRoom);
    const options = available.map((room) => `<option value="${esc(room.id)}" ${room.id === amenityRoom ? 'selected' : ''}>${esc(room.name)}</option>`).join('');
    const cards = C.AMENITY_DEFS.map((amenity) => {
      const purchased = amenity.id === 'soundproofing' ? soundproofed : s.amenities[amenity.id];
      return itemCard({
        icon: amenity.icon, title: amenity.name, sub: purchased ? 'INSTALLED' : 'A ONE-TIME PURCHASE', body: amenity.effect,
        cost: amenity.cost, action: 'amenity', id: amenity.id, selectedRoom: amenity.id === 'soundproofing' ? amenityRoom : '',
        buttonText: 'INSTALL', purchased: Boolean(purchased)
      });
    }).join('');
    return `<p class="modal-kicker">THE PUB IS ONLY AS GOOD AS ITS FURNITURE</p><h2 class="modal-title" id="modal-title">Amenities</h2>
      <p class="modal-lede">Some of these reduce noise. Several of them do the opposite, but the regulars like them.</p>
      <div class="room-select-row"><label for="amenity-room-select">Soundproofing room</label>
        <select id="amenity-room-select" ${available.length ? '' : 'disabled'}>${options || '<option>No open rooms</option>'}</select></div>
      <div class="shop-grid">${cards}</div>`;
  }

  /* -------------------------------------------------------------- journal */
  function clippingsMarkup() {
    const items = state().clippings.map((clipping) => `<article class="clipping">
      <p class="clipping-tag">${esc(clipping.tag)} <span>${esc(clipping.time || '')}</span></p>
      <h3>${esc(clipping.headline)}</h3>
      <p>${esc(clipping.copy)}</p>
    </article>`).join('');
    return `<p class="modal-kicker">THE PUB’S OWN PRESS CUTTINGS</p><h2 class="modal-title" id="modal-title">The Journal</h2>
      <p class="modal-lede">Everything that has happened, as reported by somebody who was definitely there.</p><div class="clipping-list">${items}</div>`;
  }

  function diaryMarkup() {
    const pages = C.DIARY_PAGES.map((page) => {
      const found = state().diaryPages.includes(page.id);
      return `<article class="diary-page ${found ? '' : 'locked'}">
        <h3>${esc(found ? page.title : 'A page you have not found')}</h3>
        <p class="diary-unlock">${esc(found ? `Unlocked: ${page.unlock}` : 'Locked')}</p>
        <p>${esc(found ? page.copy : 'The notebook has a gap here. Somebody has folded the corner down, which is not hopeful.')}</p>
      </article>`;
    }).join('');
    return `<p class="modal-kicker">FENTON’S NOTEBOOK, SUCH AS IT IS</p><h2 class="modal-title" id="modal-title">The Diary</h2>
      <p class="modal-lede">${state().diaryPages.length} of ${C.DIARY_PAGES.length} pages recovered.</p><div class="diary-grid">${pages}</div>`;
  }

  function achievementsMarkup() {
    const found = state().achievements;
    const cards = C.ACHIEVEMENTS.map((entry) => {
      const unlocked = found.includes(entry.id);
      const hidden = entry.hidden && !unlocked;
      return `<article class="achievement ${unlocked ? 'unlocked' : ''}">
        <span class="achievement-badge">${esc(unlocked || !hidden ? entry.icon : '?')}</span>
        <div><h3>${esc(hidden ? 'A hidden achievement' : entry.name)}</h3><p>${esc(hidden ? 'The pub is not saying. Yet.' : entry.desc)}</p></div>
      </article>`;
    }).join('');
    return `<p class="modal-kicker">THE LANDLORD KEEPS SCORE</p><h2 class="modal-title" id="modal-title">Achievements</h2>
      <p class="modal-lede">${found.length} of ${C.ACHIEVEMENTS.length} acquired.</p><div class="achievement-grid">${cards}</div>`;
  }

  function statsMarkup() {
    const s = state();
    const rows = [
      ['Pints served', U.formatNumber(s.stats.pintsServed)],
      ['Patrons served', U.formatNumber(s.stats.patronsServed)],
      ['Patrons lost', U.formatNumber(s.stats.patronsLost)],
      ['Pints earned', U.formatNumber(Math.floor(s.stats.pintsEarned))],
      ['Explosions', U.formatNumber(s.explosions)],
      ['Loudest room', `${s.stats.maxNoise} dB`],
      ['Silence Energy vented', U.formatNumber(Math.floor(s.stats.seVented))],
      ['Zones switched', U.formatNumber(s.stats.zoneToggles)],
      ['Gags witnessed', U.formatNumber(s.stats.gags)],
      ['Cat strokes', U.formatNumber(s.stats.catPets)],
      ['Darts thrown', U.formatNumber(s.stats.dartsThrown)],
      ['Best run of Wednesdays', U.formatNumber(s.stats.weeksBest)],
      ['Wednesdays survived', U.formatNumber(s.weeksSurvived)]
    ];
    const body = rows.map(([label, value]) => `<div class="stat-line"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
    return `<p class="modal-kicker">THE LEDGER, TALLIED</p><h2 class="modal-title" id="modal-title">Statistics</h2>
      <p class="modal-lede">Everything the pub has counted, whether or not anybody asked it to.</p><div class="stat-list">${body}</div>`;
  }

  function goalsMarkup() {
    const s = state();
    const rooms = C.ROOM_DEFS.filter((room) => !room.secret);
    const goals = [
      { label: 'Tier V Silencer or better', done: s.tier >= 5, detail: `Currently Tier ${U.roman(s.tier)}` },
      { label: 'Ten Wednesdays in a row', done: s.weeksSurvived >= 10, detail: `${s.weeksSurvived} survived` },
      { label: '1,000 Pints in hand', done: s.resources.pints >= 1000, detail: U.formatNumber(Math.floor(s.resources.pints)) },
      { label: '50 Scoops in hand', done: s.resources.scoops >= 50, detail: U.formatNumber(Math.floor(s.resources.scoops)) },
      { label: '50 Manuscripts in hand', done: s.resources.manuscripts >= 50, detail: U.formatNumber(Math.floor(s.resources.manuscripts)) },
      { label: '100 Research in hand', done: s.resources.research >= 100, detail: U.formatNumber(Math.floor(s.resources.research)) },
      { label: '100 Loyalty in hand', done: s.resources.loyalty >= 100, detail: U.formatNumber(Math.floor(s.resources.loyalty)) },
      { label: 'Every room open and undamaged', done: rooms.every((room) => s.rooms[room.id].unlocked && !s.rooms[room.id].damaged), detail: `${rooms.filter((room) => s.rooms[room.id].unlocked && !s.rooms[room.id].damaged).length} / ${rooms.length}` }
    ];
    const body = goals.map((goal) => `<div class="goal-line ${goal.done ? 'done' : ''}"><span class="goal-mark">${goal.done ? '✔' : '○'}</span><span class="goal-label">${esc(goal.label)}</span><strong>${esc(goal.detail)}</strong></div>`).join('');
    return `<p class="modal-kicker">WHAT THE LANDLORD CALLS AMBITION</p><h2 class="modal-title" id="modal-title">The Plan</h2>
      <p class="modal-lede">Meet all of these at once and the White Hart becomes legendary. Fenton has written it on the back of a beer mat.</p>
      <div class="goal-list">${body}</div>`;
  }

  function secretsMarkup() {
    const s = state();
    const words = Object.keys(C.EGG_WORDS).map((word) => {
      const egg = C.EGG_WORDS[word];
      const found = s.eggs.includes(egg.id);
      return `<div class="secret-chip ${found ? 'found' : ''}"><b>${esc(found ? word : '· '.repeat(Math.max(2, word.length)).trim())}</b><span>${esc(found ? egg.title : 'unsaid')}</span></div>`;
    }).join('');
    const others = [
      { id: 'konami', name: 'The old code', hint: 'An arrangement of arrow keys, known to every small boy since 1986.' },
      { id: 'portrait', name: 'The portrait', hint: 'Somebody in a frame on the wall. Look at him long enough.' },
      { id: 'machine', name: 'The apparatus', hint: 'It is in the housing. Knock a particular number of times.' }
    ].map((entry) => {
      const found = s.eggs.includes(entry.id);
      return `<div class="secret-chip ${found ? 'found' : ''}"><b>${esc(found ? entry.name : '???')}</b><span>${esc(found ? 'Found' : entry.hint)}</span></div>`;
    }).join('');
    return `<p class="modal-kicker">THINGS THE PUB WILL NOT DISCUSS</p><h2 class="modal-title" id="modal-title">Secrets</h2>
      <p class="modal-lede">${s.eggs.length} of ${WH.game.eggTotal} found. Some of them respond to being typed.</p>
      <h3 class="modal-kicker section-kicker">WORDS THE APPARATUS LISTENS FOR</h3><div class="secret-grid">${words}</div>
      <h3 class="modal-kicker section-kicker">AND THE REST</h3><div class="secret-grid">${others}</div>`;
  }

  function helpMarkup() {
    return `<p class="modal-kicker">HOW TO RUN A PUBLIC HOUSE</p><h2 class="modal-title" id="modal-title">How to play</h2>
      <p class="modal-lede">The White Hart is open. The apparatus is listening. The rest is housekeeping.</p>
      <div class="help-grid">
        <article class="help-card"><h3>1 · Serve the regulars</h3><p>Tap a patron in the illustrated room, pull their pint at the bar, then tap that same patron again. Serve them before their patience runs out or they will leave a remark behind.</p></article>
        <article class="help-card"><h3>2 · Silence the rooms</h3><p>Tap any open room to switch its Silencer Zone on or off. A silenced room reads 0 dB, and everything it would have said is stored as Silence Energy.</p></article>
        <article class="help-card"><h3>3 · Mind the meter</h3><p>At 70% the tubes flicker. At 85% they smoke. At 95% they begin to tick. At 100% the Silencer explodes, resets to Tier I, and destroys the room it lives in.</p></article>
        <article class="help-card"><h3>4 · Spend the silence</h3><p>Silence Energy buys filters, microphones, vents and casing. Fit a vent, then open it to bleed energy off slowly. The Emergency Dump is for emergencies, which is to say Wednesdays.</p></article>
        <article class="help-card"><h3>5 · Grow the pub</h3><p>Open rooms in order, hire staff, install amenities, and research better Silencers. Ten Wednesdays in a row with everything in hand makes the pub legendary.</p></article>
        <article class="help-card"><h3>6 · Poke around</h3><p>There is a chalkboard, a portrait, a dartboard, a jukebox that has never made a sound, and an apparatus that responds to being tapped. Also: the pub listens to what you type.</p></article>
      </div>
      <div class="modal-notice"><span>✦</span><span>Keys: <b>Space</b> pauses · <b>←</b> and <b>→</b> move between room pages · <b>Tab</b> picks the next patron · <b>Enter</b> or <b>B</b> pulls a pint · <b>Z</b> toggles that patron’s zone · <b>V</b> vents · <b>J</b> opens this journal · <b>?</b> opens this help · <b>Esc</b> closes.</span></div>`;
  }

  function restartMarkup() {
    return `<p class="modal-kicker">A FRESH WEDNESDAY</p><h2 class="modal-title" id="modal-title">Start a new game?</h2>
      <p class="modal-lede">The ledger in this browser will be wiped. The regulars will not remember a thing, which is probably for the best.</p>
      <div class="modal-actions">
        <button class="action-button ghost" type="button" data-action="cancel">KEEP THIS WEDNESDAY</button>
        <button class="action-button" type="button" data-action="confirm-restart">START A NEW WEDNESDAY ↻</button>
      </div>
      <p class="modal-kicker" style="margin-top:18px">OR, WITHOUT THE WIPE</p>
      <p class="modal-lede">The ledger stays exactly as it is. Only the teaching starts again.</p>
      <div class="modal-actions">
        <button class="action-button ghost" type="button" data-action="replay-briefing">REPLAY THE BRIEFING</button>
        <button class="action-button ghost" type="button" data-action="restart-orders">RUN THE ORDERS AGAIN</button>
      </div>`;
  }

  /* ------------------------------------------------------------- the modal */
  const TABS = {
    shop: [
      { id: 'rooms', label: 'ROOMS', markup: roomShopMarkup },
      { id: 'silencer', label: 'SILENCER', markup: silencerShopMarkup },
      { id: 'staff', label: 'STAFF', markup: staffShopMarkup },
      { id: 'amenities', label: 'AMENITIES', markup: amenityShopMarkup }
    ],
    journal: [
      { id: 'clippings', label: 'CLIPPINGS', markup: clippingsMarkup },
      { id: 'goals', label: 'THE PLAN', markup: goalsMarkup },
      { id: 'diary', label: 'DIARY', markup: diaryMarkup },
      { id: 'achievements', label: 'AWARDS', markup: achievementsMarkup },
      { id: 'stats', label: 'LEDGER', markup: statsMarkup },
      { id: 'secrets', label: 'SECRETS', markup: secretsMarkup }
    ]
  };

  function renderModal() {
    const content = $('#modal-content');
    if (!content || !modalMode) return;
    const tabs = TABS[modalMode.mode];
    if (!tabs) {
      content.innerHTML = modalMode.mode === 'help' ? helpMarkup() : restartMarkup();
      return;
    }
    const active = tabs.find((tab) => tab.id === modalMode.tab) || tabs[0];
    const bar = `<div class="modal-tabs" role="tablist">${tabs.map((tab) => `<button type="button" role="tab" class="modal-tab ${tab.id === active.id ? 'selected' : ''}" data-tab="${esc(tab.id)}" aria-selected="${tab.id === active.id}">${esc(tab.label)}</button>`).join('')}</div>`;
    content.innerHTML = bar + active.markup();
    content.scrollTop = 0;
  }

  function openModal(mode, tab = null) {
    if (mode === 'shop' && game().tourMark) game().tourMark('desk');
    modalMode = { mode, tab: tab || (TABS[mode] ? TABS[mode][0].id : null) };
    renderModal();
    const root = $('#modal-root');
    root.hidden = false;
    root.classList.remove('open');
    void root.offsetWidth;
    root.classList.add('open');
    setTimeout(() => { const close = $('#modal-close'); if (close) close.focus(); }, 0);
    WH.audio.play('click');
  }

  function closeModal() {
    modalMode = null;
    const root = $('#modal-root');
    if (root) root.hidden = true;
    const help = $('#help-button');
    if (help) help.focus();
  }

  function handleModalClick(event) {
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) {
      modalMode.tab = tabButton.dataset.tab;
      renderModal();
      WH.audio.play('click');
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'cancel') { closeModal(); return; }
    if (action === 'confirm-restart') { closeModal(); WH.game.startNewGame(); return; }
    if (action === 'replay-briefing') { closeModal(); showIntro(0); return; }
    if (action === 'restart-orders') {
      closeModal();
      WH.game.tourReset();
      toast('The evening\u2019s orders', 'Six things to do, in order, and the card on the right will tick them off as you do them.', 6000);
      return;
    }
    WH.audio.play('click');
    if (action === 'unlock-room') WH.game.tryUnlockRoom(button.dataset.id);
    else if (action === 'rebuild-room') WH.game.tryRebuildRoom(button.dataset.id);
    else if (action === 'tier') WH.game.buyTier(Number(button.dataset.id));
    else if (action === 'se-upgrade') WH.game.buySEUpgrade(button.dataset.id);
    else if (action === 'staff') WH.game.buyStaff(button.dataset.id);
    else if (action === 'amenity') WH.game.buyAmenity(button.dataset.id, button.dataset.room || '');
    renderModal();
    render();
  }

  /* ----------------------------------------------------------- room tabs */
  function renderRoomTabs() {
    const s = state();
    const size = WH.game.pageSize();
    const pageCount = Math.ceil(C.ROOM_DEFS.length / size);
    s.roomPage = U.clamp(s.roomPage, 0, pageCount - 1);
    const container = $('#room-tabs');
    if (!container) return;
    const key = `${pageCount}:${s.roomPage}:${size}`;
    if (key !== renderedTabsKey) {
      renderedTabsKey = key;
      container.innerHTML = '';
      for (let page = 0; page < pageCount; page++) {
        const button = document.createElement('button');
        const entries = C.ROOM_DEFS.slice(page * size, (page + 1) * size);
        button.type = 'button';
        button.className = `room-page-tab ${page === s.roomPage ? 'selected' : ''}`;
        button.textContent = String(page + 1);
        button.title = entries.map((room) => room.name).join(' · ');
        button.setAttribute('aria-label', `Room page ${page + 1}: ${button.title}`);
        if (page === s.roomPage) button.setAttribute('aria-current', 'page');
        button.addEventListener('click', () => {
          s.roomPage = page;
          WH.scene.markDirty();
          renderRoomTabs();
        });
        container.appendChild(button);
      }
    }
    const prev = $('#room-prev');
    const next = $('#room-next');
    if (prev) prev.disabled = s.roomPage <= 0;
    if (next) next.disabled = s.roomPage >= pageCount - 1;
  }

  /* ---------------------------------------------------------------- render */
  function render() {
    const s = state();
    if (!s) return;
    const resources = s.resources;
    $('#res-pints').textContent = U.formatNumber(Math.floor(resources.pints));
    $('#res-scoops').textContent = U.formatNumber(Math.floor(resources.scoops));
    $('#res-manuscripts').textContent = U.formatNumber(Math.floor(resources.manuscripts));
    $('#res-research').textContent = U.formatNumber(Math.floor(resources.research));
    $('#res-loyalty').textContent = U.formatNumber(Math.floor(resources.loyalty));
    $('#res-energy-top').textContent = U.formatNumber(s.energy, s.energy < 100 ? 1 : 0);

    const rates = WH.game.resourceRates();
    ['pints', 'scoops', 'manuscripts', 'research', 'loyalty'].forEach((key) => {
      const node = $(`#rate-${key}`);
      if (node) node.textContent = rates[key] > 0 ? `+${U.formatRate(rates[key])} / sec` : '—';
    });

    const cap = WH.game.capacity();
    const pct = U.clamp(s.energy / cap * 100, 0, 100);
    const energyRate = WH.game.totalEnergyRate();
    const netRate = energyRate - (s.venting ? WH.game.ventRate() : 0);
    $('#energy-readout').textContent = U.formatNumber(s.energy, s.energy < 100 ? 1 : 0);
    $('#energy-capacity').textContent = U.formatNumber(cap);
    $('#energy-percent').innerHTML = `${Math.floor(pct)}<span>%</span>`;
    $('#energy-fill').style.width = `${pct}%`;
    $('#energy-flow').textContent = `${netRate >= 0 ? '+' : '−'}${U.formatNumber(Math.abs(netRate), 1)} / sec`;
    $('#rate-energy-top').textContent = `${netRate >= 0 ? '+' : '−'}${U.formatNumber(Math.abs(netRate), 1)} / sec`;
    const track = $('.energy-track');
    if (track) track.setAttribute('aria-valuenow', String(Math.floor(pct)));
    $('#meter-tier-cap').textContent = `${U.formatNumber(cap)} SE`;
    $('#active-zones').textContent = `${WH.game.activeZoneCount()} ACTIVE`;

    const warning = $('#energy-status');
    const meter = $('#energy-card');
    meter.classList.remove('energy-70', 'energy-85', 'energy-95');
    document.body.classList.toggle('energy-alert', pct >= 85);
    if (pct >= 95) {
      meter.classList.add('energy-95');
      warning.innerHTML = '<span class="warning-icon">⚠</span><span>TICK. TICK. TICK. DO SOMETHING.</span>';
    } else if (pct >= 85) {
      meter.classList.add('energy-85');
      warning.innerHTML = '<span class="warning-icon">⚠</span><span>Smoke from the tubes. Someone asks if it is normal.</span>';
    } else if (pct >= 70) {
      meter.classList.add('energy-70');
      warning.innerHTML = '<span class="warning-icon">⚠</span><span>The tubes flicker. A faint, distinctly smug hum.</span>';
    } else if (s.venting && WH.game.ventRate() > 0) {
      warning.innerHTML = `<span class="warning-icon">↧</span><span>Venting at ${U.formatNumber(WH.game.ventRate(), 1)} SE/sec. The machine exhales.</span>`;
    } else if (!WH.game.activeZoneCount()) {
      warning.innerHTML = '<span class="warning-icon">◌</span><span>Zones off. The noise is not being stored.</span>';
    } else {
      warning.innerHTML = '<span class="warning-icon">✦</span><span>Comfortably below catastrophe.</span>';
    }

    $('#silencer-tier').textContent = `TIER ${U.roman(s.tier)}`;
    $('#silencer-name').textContent = `The ${WH.game.tierDef().name}`;
    $('#absorption-value').innerHTML = `${U.formatNumber(WH.game.absorption(), 1)} <small>dB / sec</small>`;
    $('#vent-rate-value').innerHTML = `${U.formatNumber(WH.game.ventRate(), 1)} <small>SE / sec</small>`;
    $('#home-room').textContent = WH.game.roomDef(s.homeRoom).name.toUpperCase();
    $('#silencer-card').classList.toggle('is-active', WH.game.activeZoneCount() > 0);
    $('#machine-glow').style.opacity = WH.game.activeZoneCount() ? String(0.25 + pct / 150) : '0.13';

    const ventButton = $('#vent-button');
    const canVent = WH.game.ventRate() > 0 && s.energy > 0;
    ventButton.disabled = !canVent;
    ventButton.classList.toggle('active', s.venting);
    $('#vent-button-label').textContent = s.venting ? 'VENTING' : 'VENT';
    const dockVent = $('#dock-vent-button');
    dockVent.classList.toggle('active', s.venting);
    $('#dock-vent-copy').textContent = WH.game.ventRate() > 0 ? (s.venting ? 'Stop venting' : `${U.formatNumber(WH.game.ventRate(), 1)} SE / sec`) : 'Needs a vent system';
    dockVent.disabled = !canVent;

    const selected = s.patrons.find((patron) => patron.id === s.selectedPatron);
    $('#serve-title').textContent = selected ? (s.beerReady ? `Ready for ${selected.name}.` : `${selected.name} is waiting.`) : 'An honest pint.';
    $('#serve-detail').textContent = selected
      ? (s.beerReady
        ? 'The pint is poured. Tap the same patron in the room to hand it over.'
        : `${C.PATRONS[selected.type].label} · ${C.PATRONS[selected.type].noise} dB · ${Math.ceil(selected.patience)} sec of patience. Pour their pint, then tap them once more.`)
      : 'Tap a patron in the room, pour their beer, then tap them once more. The method is older than the pub.';
    $('#serve-button').disabled = !selected || s.beerReady;
    $('#serve-button-label').textContent = !selected ? 'SELECT A PATRON' : s.beerReady ? 'PINT READY · TAP PATRON' : `PULL A PINT FOR ${selected.name.toUpperCase()}`;
    $('#serve-cancel').hidden = !selected;

    $('#reputation-value').textContent = U.formatNumber(s.reputation, s.reputation % 1 ? 1 : 0);
    $('#reputation-fill').style.width = `${U.clamp(s.reputation, 0, 100)}%`;
    $('#reputation-fill').style.background = s.reputation < 25
      ? 'linear-gradient(90deg,#a63d35,#e06149)'
      : s.reputation < 55 ? 'linear-gradient(90deg,#b27b43,#d1a34f)' : 'linear-gradient(90deg,#61794f,#bdad63)';
    $('#standing-copy').textContent = s.reputation > 75
      ? 'Beloved, if occasionally loud.'
      : s.reputation > 45 ? 'The regulars are beginning to compare notes.'
        : s.reputation > 20 ? 'The neighbours have started a committee.' : 'The last regular has brought a suitcase.';
    $('#explosion-count').textContent = String(s.explosions);

    $('#night-count').textContent = String(s.week).padStart(2, '0');
    $('#night-progress').style.width = `${U.clamp(s.dayElapsed / WH.game.nightLength * 100, 0, 100)}%`;
    $('#clock-label').textContent = WH.game.getClockLabel();
    $('#streak-label').textContent = `${s.weeksSurvived} survived in a row`;
    $('#season-label').textContent = WH.game.currentSeason();
    $('#weather-label').textContent = WH.game.weatherName();
    $('#open-status').textContent = s.paused ? 'SERVICE PAUSED' : 'OPEN FOR THE EVENING';
    $('#door-status').textContent = s.paused ? 'DOOR HELD OPEN' : 'DOOR OPEN';
    $('#pause-icon').textContent = s.paused ? '▶' : 'Ⅱ';
    $('#pause-button').classList.toggle('active', s.paused);
    $('#pause-button').setAttribute('aria-label', s.paused ? 'Resume game' : 'Pause game');
    document.body.classList.toggle('is-paused', s.paused);
    $('#scene-note').textContent = s.powerCutUntil > s.gameSeconds
      ? 'POWER CUT · 30 SECONDS'
      : s.shushUntil > s.gameSeconds ? 'EVERYBODY IS SHUSHING'
        : WH.game.activeZoneCount() ? 'THE SILENCER IS LISTENING' : 'THE ROOM IS UNFILTERED';
    $('#sound-icon').textContent = WH.audio.enabled ? '♫' : '◖';
    $('#sound-button').classList.toggle('active', WH.audio.enabled);
    $('#sound-button').setAttribute('aria-label', WH.audio.enabled ? 'Turn sound off' : 'Turn sound on');
    $('#secret-count').textContent = String(s.eggs.length);
    $('#secret-total').textContent = `/${WH.game.eggTotal}`;

    // The evening draws in as the night goes on.
    const dusk = $('#stage-dusk');
    if (dusk) {
      const progress = U.clamp(s.dayElapsed / WH.game.nightLength, 0, 1);
      const cut = s.powerCutUntil > s.gameSeconds;
      const target = cut ? 0.94 : 0.12 + progress * 0.38;
      const rounded = Math.round(target * 50) / 50;
      if (dusk.dataset.level !== String(rounded)) {
        dusk.dataset.level = String(rounded);
        dusk.style.opacity = String(rounded);
      }
      dusk.classList.toggle('is-cut', cut);
      dusk.classList.toggle('is-fenton', Boolean(s.fentonMode) && !cut);
    }

    WH.audio.update({
      energyRatio: pct / 100,
      zones: WH.game.activeZoneCount(),
      paused: s.paused,
      pending: Boolean(s.pendingExplosion),
      opera: s.currentEvent === 'Opera Night',
      weather: s.weather
    });
    renderRoomTabs();
    renderTour();
  }

  /* ------------------------------------------------ the evening's orders */
  const PUB_INTRO = [
    {
      kicker: 'OPENING TIME',
      title: 'The quietest pub on Fleet Street',
      lines: [
        'Nine rooms, fourteen kinds of regular, and one machine in the General Bar that eats noise for a living.',
        'Service is three taps: tap a patron, pull their pint at the bar, then tap that same patron again to hand it over. Patience is short and the ghost pays in damp shillings.'
      ],
      sign: 'THE LANDLORD'
    },
    {
      kicker: 'THE APPARATUS',
      title: 'Mr Fenton\u2019s Silencer, and its three directives',
      lines: [
        'It is positronic, it is temperamental, and it was built to three directives: it may not be loud; it must store the noise it can; it must keep the pub standing. Every rule in this game comes out of that list.',
        'A silenced room reads 0 dB, and everything it would have said is stored as Silence Energy. At 70% the tubes flicker. At 95% they tick. At 100% the housing is destroyed, the room goes dark, and the night becomes very difficult to recover from. Three of those and the pub closes.'
      ],
      sign: 'THE DIRECTORATE, NEXT DOOR'
    },
    {
      kicker: 'THE EVENING\u2019S ORDERS',
      title: 'Serve, silence, vent, spend, grow',
      lines: [
        'That is the whole loop, and it repeats every Wednesday. Silence Energy buys filters, microphones, vents and casing from the Landlord\u2019s Desk; the Desk also sells rooms, staff and amenities.',
        'Survive ten Wednesdays with Silencer Tier V, all nine rooms open and the pantry stocked, and the pub becomes legendary. Zero reputation, three explosions, or a full minute above 95 dB closes it for good.'
      ],
      sign: 'THE LANDLORD'
    }
  ];
  let introPage = 0;

  function renderTour() {
    const s = state();
    const card = $('#pub-tour');
    if (!s || !s.tutorial || !card) return;
    const steps = game().TOUR_STEPS || [];
    const done = s.tutorial.marks.filter((mark) => steps.some((step) => step.mark === mark)).length;
    const complete = done >= steps.length;
    card.classList.toggle('is-complete', complete);
    $('#pub-tour-eyebrow').innerHTML = `${complete ? 'THE METHOD' : 'FIRST WEDNESDAY'} <span class="heading-rule"></span>`;
    $('#pub-tour-count').textContent = `${done} / ${steps.length}`;
    $('#pub-tour-title').textContent = complete ? 'The method is now the pub\u2019s method.' : 'How an evening is run.';
    $('#pub-tour-steps').innerHTML = steps.map((step) => {
      const hit = s.tutorial.marks.includes(step.mark);
      return `<li class="${hit ? 'done' : ''}"><span class="tour-tick" aria-hidden="true">${hit ? '✓' : '◌'}</span><span>${esc(step.text)}</span></li>`;
    }).join('');
    const again = $('#pub-tour-again');
    if (again) again.hidden = !complete;
  }

  function showIntro(page = 0) {
    const root = $('#pub-intro');
    if (!root) return;
    introPage = Math.max(0, Math.min(page, PUB_INTRO.length - 1));
    const entry = PUB_INTRO[introPage];
    const last = introPage >= PUB_INTRO.length - 1;
    root.innerHTML = `<div class="pub-intro-inner" role="document">
      <p class="pub-intro-kicker">✦ ${esc(entry.kicker)} <span>${introPage + 1} / ${PUB_INTRO.length}</span></p>
      <h2>${esc(entry.title)}</h2>
      ${entry.lines.map((line) => `<p>${esc(line)}</p>`).join('')}
      <p class="pub-intro-sign">— ${esc(entry.sign)}</p>
      <div class="pub-intro-actions">
        <button class="action-button primary" id="pub-intro-next" type="button">${last ? 'Open the pub →' : 'Continue →'}</button>
        <button class="text-button" id="pub-intro-skip" type="button">Skip the briefing</button>
      </div>
      <div class="pub-intro-dots" aria-hidden="true">${PUB_INTRO.map((_, i) => `<i class="${i === introPage ? 'on' : ''}"></i>`).join('')}</div>
    </div>`;
    root.hidden = false;
    $('#pub-intro-next').addEventListener('click', () => (last ? closeIntro() : showIntro(introPage + 1)));
    $('#pub-intro-skip').addEventListener('click', closeIntro);
  }

  function closeIntro() {
    const root = $('#pub-intro');
    if (root) root.hidden = true;
    const s = state();
    if (s && s.tutorial) {
      s.tutorial.intro = true;
      game().saveState();
    }
    renderTour();
    toast('Wednesday, 7:00 PM', 'The White Hart is open. The evening\u2019s orders are on the right, and the cat is somewhere.', 8000);
  }

  /* ----------------------------------------------------------------- bind */
  function bind() {
    $('#serve-button').addEventListener('click', () => WH.game.pourSelectedPint());
    $('#serve-cancel').addEventListener('click', () => {
      state().selectedPatron = null;
      state().beerReady = false;
      render();
    });
    $('#vent-button').addEventListener('click', () => WH.game.toggleVenting());
    $('#dock-vent-button').addEventListener('click', () => WH.game.toggleVenting());
    $('#upgrade-button').addEventListener('click', () => openModal('shop', 'silencer'));
    $('#shop-button').addEventListener('click', () => { game().tourMark('desk'); openModal('shop', 'rooms'); });
    $('#staff-button').addEventListener('click', () => openModal('shop', 'staff'));
    $('#amenities-button').addEventListener('click', () => openModal('shop', 'amenities'));
    $('#journal-button').addEventListener('click', () => openModal('journal', 'clippings'));
    $('#help-button').addEventListener('click', () => openModal('help'));
    $('#pause-button').addEventListener('click', () => WH.game.togglePause());
    $('#sound-button').addEventListener('click', () => {
      WH.audio.toggle();
      toast(WH.audio.enabled ? 'The pub makes a noise' : 'The pub goes quiet',
        WH.audio.enabled ? 'Soft room tone, a little Silencer hum, and no actual singing.' : 'Sound is off. The Silencer has not been consulted.', 3600);
      render();
    });
    $('#restart-button').addEventListener('click', () => openModal('restart'));
    $('#room-prev').addEventListener('click', () => WH.game.setPage(-1));
    $('#room-next').addEventListener('click', () => WH.game.setPage(1));
    $('#toast-close').addEventListener('click', dismissToast);
    $('#pub-crest').addEventListener('click', () => {
      WH.audio.play('click');
      const stage = WH.scene.size;
      WH.fx.confetti(stage.width / 2, stage.height * 0.4, 22);
      const lines = [
        'The crest of the house. A white hart, couchant, on a field of minor structural damage.',
        'Somebody has scratched “WIBBLE” into the brass. It has been there for years.',
        'The crest has been polished so often that the hart is beginning to look surprised.'
      ];
      setCaption(lines[Math.floor(Math.random() * lines.length)]);
    });
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-root').addEventListener('click', (event) => {
      if (event.target.dataset.closeModal) closeModal();
    });
    $('#modal-content').addEventListener('click', handleModalClick);
    $('#modal-content').addEventListener('change', (event) => {
      if (event.target.id === 'amenity-room-select') {
        amenityRoom = event.target.value;
        renderModal();
      }
    });
    const crisisButton = $('#crisis-button');
    if (crisisButton) crisisButton.addEventListener('click', () => WH.game.closeCrisis());
  }

  function setCaption(text) {
    const node = $('#scene-caption');
    if (node) node.textContent = text;
  }

  function isModalOpen() {
    const root = $('#modal-root');
    return Boolean(root && !root.hidden);
  }

  WH.ui = {
    bind, render, renderModal, renderRoomTabs, openModal, closeModal, isModalOpen,
    toast, dismissToast, achievementToast, latestClipping, tooltipAt, hideTooltip,
    crisisNodes, setCaption, renderTour, showIntro, closeIntro,
    get modalMode() { return modalMode; },
    setTabsDirty() { renderedTabsKey = ''; }
  };
})();
