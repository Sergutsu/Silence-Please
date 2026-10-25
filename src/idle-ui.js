/* Absolute Superiority — the Supreme Command terminal.
   The original interface (sidebar, department views, star map, tactical plot, the White Hart)
   now runs on the idle engine in src/idle.js. Everything is a clicker or an idle machine:
   the campaign advances by orders, not by turns, and the White Hart serves itself. */
(() => {
  'use strict';
  const A = window.ASIdle;
  if (!A) return;
  const U = (window.WH && window.WH.util) || {};
  const fmt = A.fmt;
  const fmtInt = A.fmtInt;
  const fmtRate = A.fmtRate;
  const esc = U.escapeHtml || ((text) => String(text));
  const num = U.formatNumber || ((value, digits = 0) => Number(value || 0).toFixed(digits));
  const roman = U.roman || ((value) => String(value));
  const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
  const pct = (value) => `${clamp(value * 100, 0, 100).toFixed(1)}%`;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const LORE = window.ASLore || { PROLOGUE: [], DIRECTIVES: [], INSPIRATIONS: [], GLOSSARY: [] };

  const TITLES = {
    headquarters: ['Headquarters', 'The Calculus gave this frontier twelve cycles. The machines now spend every second of them.'],
    research: ['Research Directorate', 'Every machine we ship carries three directives. Only two of them were in the specification.'],
    production: ['Fleet & Production', 'Identical hulls, interchangeable bolts, and a key you never have to press twice.'],
    bridge: ['Tactical Bridge', 'One sortie every six seconds. The enemy learns from the last one.'],
    signal: ['The Long Question', 'A machine older than the Empire has been asking one thing for ten thousand years. It is waiting on us.'],
    dispatches: ['Command dispatches', 'For the record. For the war. For the eventual tribunal.'],
    'white-hart': ['The White Hart', 'Fleet Street, Norden Deep. The Research Directorate’s local, and its most honest laboratory.'],
  };
  const VIEW_ORDER = ['headquarters', 'research', 'production', 'bridge', 'signal', 'dispatches', 'white-hart'];

  let s = null;
  let view = 'headquarters';
  let lastFrame = performance.now();
  let saveClock = 0;
  let renderClock = 0;
  let signature = '';
  let lastStep = 1;
  let lastExplosions = 0;
  let heard = new Set();
  let eggBuffer = '';
  let soundOn = false;
  let audio = null;
  let saving = false;
  const ui = {
    mapSelection: 2,
    roomPage: 0,
    room: 'general',
    stepModal: 0,
    toastTimer: 0,
    popTimer: 0,
    modal: null,
  };

  try { soundOn = localStorage.getItem('as-idle-sound') === 'on'; } catch (_) { soundOn = false; }

  /* ------------------------------------------------------------------ sound */
  function beep(freq = 420, duration = 0.06, type = 'triangle', gain = 0.03) {
    if (!soundOn) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audio.currentTime);
      amp.gain.setValueAtTime(gain, audio.currentTime);
      amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      osc.connect(amp).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration);
    } catch (_) { /* sound is a courtesy */ }
  }
  function chime() {
    [523, 659, 784].forEach((freq, index) => {
      setTimeout(() => beep(freq, 0.18, 'sine', 0.04), index * 90);
    });
  }

  /* ------------------------------------------------------------- notification */
  function flash(text, ms = 4200) {
    const node = $('#command-toast');
    if (!node) return;
    node.textContent = text;
    node.classList.add('visible');
    window.clearTimeout(flash.timer);
    flash.timer = window.setTimeout(() => node.classList.remove('visible'), ms);
  }
  function toast(title, body, ms = 7200) {
    const root = $('#toast');
    if (!root) return;
    $('#toast-title').textContent = title;
    $('#toast-body').textContent = body;
    root.hidden = false;
    root.classList.add('show');
    window.clearTimeout(ui.toastTimer);
    ui.toastTimer = window.setTimeout(() => {
      root.classList.remove('show');
      root.hidden = true;
    }, ms);
  }
  function popAchievement(def) {
    const root = $('#achievement-pop');
    if (!root || !def) return;
    $('#achievement-icon').textContent = '★';
    $('#achievement-name').textContent = def.name;
    $('#achievement-desc').textContent = def.note;
    root.hidden = false;
    root.classList.add('show');
    window.clearTimeout(ui.popTimer);
    ui.popTimer = window.setTimeout(() => {
      root.classList.remove('show');
      root.hidden = true;
    }, 6200);
    beep(760, 0.14, 'sine', 0.04);
  }
  function crisis(title, copy) {
    const root = $('#crisis-screen');
    if (!root) return;
    $('#crisis-title').textContent = title;
    $('#crisis-copy').textContent = copy;
    root.hidden = false;
    root.classList.add('show');
    beep(140, 0.4, 'sawtooth', 0.05);
  }
  function closeCrisis() {
    const root = $('#crisis-screen');
    if (root) {
      root.hidden = true;
      root.classList.remove('show');
    }
  }

  /* ---------------------------------------------------------------- dialogs */
  function openBriefing(html, { title = 'Command briefing', lede = '' } = {}) {
    const dialog = $('#briefing');
    if (!dialog) return;
    $('#dialog-title').textContent = title;
    $('#dialog-copy').innerHTML = (lede ? `<p class="brief-sub">${esc(lede)}</p>` : '') + html;
    if (typeof dialog.showModal === 'function') {
      try { dialog.showModal(); } catch (_) { dialog.setAttribute('open', ''); }
    } else {
      dialog.setAttribute('open', '');
    }
  }
  function closeBriefing() {
    const dialog = $('#briefing');
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      try { dialog.close(); } catch (_) { dialog.removeAttribute('open'); }
    } else {
      dialog.removeAttribute('open');
    }
  }
  function briefingOpen() {
    const dialog = $('#briefing');
    return Boolean(dialog && dialog.hasAttribute('open'));
  }
  function openModal(html, { kicker = 'THE WHITE HART', title = '' } = {}) {
    const root = $('#modal-root');
    if (!root) return;
    ui.modal = { title };
    $('#modal-content').innerHTML = `${kicker ? `<p class="modal-kicker">${esc(kicker)}</p>` : ''}${
      title ? `<h2 class="modal-title">${esc(title)}</h2>` : ''
    }${html}`;
    root.hidden = false;
    root.classList.add('show');
    document.body.classList.add('modal-open');
  }
  function closeModal() {
    const root = $('#modal-root');
    if (!root) return;
    root.hidden = true;
    root.classList.remove('show');
    document.body.classList.remove('modal-open');
    ui.modal = null;
  }
  function modalOpen() {
    const root = $('#modal-root');
    return Boolean(root && !root.hidden);
  }

  /* ------------------------------------------------------------------ input */
  function setView(next) {
    if (!TITLES[next]) return;
    if (s && s.step >= 24 && next !== 'headquarters') {
      flash('The reckoning is the only order at step 24. Every other department is closed.');
      next = 'headquarters';
    }
    view = next;
    if (next === 'white-hart') openPub();
    else closePub();
    if (window.location.hash !== `#${next}`) {
      try { history.replaceState(null, '', `#${next}`); } catch (_) { /* file:// is fine */ }
    }
    signature = '';
    renderAll(true);
    const main = $('.workspace > main');
    if (main && typeof main.scrollIntoView === 'function') main.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function openPub() {
    const realm = $('#pub-realm');
    if (!realm) return;
    realm.hidden = false;
    document.body.classList.add('pub-mode');
    const mission = $('#mission');
    if (mission) mission.hidden = true;
    const viewNode = $('#view');
    if (viewNode) viewNode.hidden = true;
    renderPub(true);
  }
  function closePub() {
    const realm = $('#pub-realm');
    if (!realm) return;
    realm.hidden = true;
    document.body.classList.remove('pub-mode');
    const mission = $('#mission');
    if (mission) mission.hidden = false;
    const viewNode = $('#view');
    if (viewNode) viewNode.hidden = false;
  }

  /* ------------------------------------------------------- engine plumbing */
  function apply(result, { silent = false } = {}) {
    if (!result) return result;
    if (!result.ok) {
      if (!silent) flash(result.msg || 'That order cannot be carried out.');
      return result;
    }
    if (result.state) s = result.state;
    signature = '';
    if (!silent && result.msg) flash(result.msg);
    renderAll(true);
    return result;
  }
  function stepChanged() {
    if (s.step !== lastStep) {
      const previous = lastStep;
      lastStep = s.step;
      if (s.step > previous) {
        chime();
        const def = A.stepDef(s.step);
        toast(`STEP ${String(s.step).padStart(2, '0')} · ${def.title}`, def.unlock, 9000);
        if (s.step === 24) {
          closePub();
          view = 'headquarters';
          openBriefing(reckoningIntro(), { title: 'The Reckoning', lede: 'Prestige is the only order left.' });
        }
        if (s.step === 22) openPubBriefing();
      }
      signature = '';
    }
  }
  function achievementCheck() {
    (A.ACHIEVEMENTS || []).forEach((def) => {
      if (s.achievements.includes(def.id) && !heard.has(def.id)) {
        heard.add(def.id);
        popAchievement(def);
      }
    });
  }
  function explosionCheck() {
    if ((s.pub.explosions || 0) > lastExplosions) {
      lastExplosions = s.pub.explosions;
      crisis('FENTON SILENCER EXPLODES', '“We told you so,” say physicists. The landlord has put the good chairs outside and is counting the Silence Energy that is no longer in the cellar.');
    }
  }
  function momentWatch() {
    if (s.event && s.event.id) {
      if (ui.moment !== s.event.id) {
        ui.moment = s.event.id;
        const def = (A.MOMENTS || []).find((moment) => moment.id === s.event.id);
        if (def) {
          toast(def.title, `${def.copy} — attend to it in Headquarters.`, 12000);
        }
      }
    } else {
      ui.moment = '';
    }
  }

  /* ---------------------------------------------------------------- the deck */
  function renderResources() {
    const d = A.derive(s);
    const f = s.fleet;
    const rows = [
      { key: 'ip', label: '▥ INDUSTRIAL POINTS', value: fmt(s.ip), unit: 'IP', rate: `${fmtRate(d.ipPerSec)} / sec`, warn: false },
      { key: 'sp', label: '⚛ SCIENTIFIC POINTS', value: fmt(s.sp), unit: 'SP', rate: `${fmtRate(d.spPerSec)} / sec`, warn: false },
      { key: 'pc', label: '⚑ POLITICAL CAPITAL', value: fmt(s.pc), unit: 'PC', rate: `${fmtRate(d.pcPerSec)} / sec`, warn: f.crisis },
      { key: 'reliability', label: '◇ RELIABILITY', value: Math.round(f.reliability), unit: '%', rate: f.reliability >= 70 ? 'OPERATIONAL' : 'DEGRADING', warn: f.reliability < 50 },
      { key: 'chaos', label: '≋ CHAOS', value: Math.round(f.chaos), unit: '%', rate: f.chaos < 40 ? 'MANAGEABLE' : 'SPECIFICATION DRIFT', warn: f.chaos >= 40 },
      { key: 'capital', label: '⌂ CAPITAL', value: Math.round(f.capital), unit: '%', rate: f.capital >= 60 ? 'HOLDING' : 'UNDER FIRE', warn: f.capital < 50 },
      { key: 'unrest', label: '⚖ UNREST', value: Math.round(f.unrest), unit: '%', rate: f.mutiny ? 'MUTINY' : 'THE ADMIRALS', warn: f.unrest > 60 },
      { key: 'forecast', label: '✦ FORECAST', value: fmt(s.forecast), unit: '', rate: `×${A.forecastMult(s).toFixed(2)} OUTPUT`, warn: false },
    ];
    const node = $('#resources');
    if (!node) return;
    const html = rows.map((row, index) => `<div class="resource ${row.warn ? 'warn' : ''}" style="--i:${index}"><div class="label">${row.label}</div><div class="value">${row.value} <small>${row.unit}</small></div><div class="rate">${row.rate}</div></div>`).join('');
    if (node.dataset.sig !== html) {
      node.innerHTML = html;
      node.dataset.sig = html;
    }
  }
  function renderStepTrack() {
    const node = $('#step-track');
    if (!node) return;
    const html = A.STEP_DEFS.map((def) => {
      const state = def.n < s.step ? 'done' : def.n === s.step ? 'current' : 'locked';
      return `<button type="button" class="track-step ${state}" data-step="${def.n}" title="${esc(def.title)} — ${esc(def.unlock)}" aria-label="Step ${def.n}: ${esc(def.title)}"><span>${String(def.n).padStart(2, '0')}</span><i>${esc(def.title)}</i></button>`;
    }).join('');
    if (node.dataset.sig !== html) {
      node.innerHTML = html;
      node.dataset.sig = html;
    }
  }
  function renderCycle() {
    const cycle = $('#cycle');
    if (cycle) cycle.innerHTML = `STEP ${String(s.step).padStart(3, '0')} <small>/ 024</small>`;
    const phase = $('#phase-label');
    if (phase) phase.textContent = roman(s.phase);
    const titles = TITLES[view] || TITLES.headquarters;
    const pageTitle = $('#page-title');
    const pageSubtitle = $('#page-subtitle');
    if (pageTitle) pageTitle.textContent = titles[0];
    if (pageSubtitle) pageSubtitle.textContent = titles[1];
  }
  function renderBadges() {
    const reckoning = s.step >= 24;
    document.body.classList.toggle('reckoning', reckoning);
    $$('nav [data-view]').forEach((button) => {
      const locked = reckoning && button.dataset.view !== 'headquarters';
      button.disabled = locked;
      button.classList.toggle('locked', locked);
      button.title = locked ? 'The reckoning is the only order at step 24.' : '';
    });
    const researchBadge = $('nav [data-view="research"] b');
    if (researchBadge) researchBadge.textContent = String(s.research.filter((rec) => rec.state === 0).length);
    const dispatchBadge = $('nav [data-view="dispatches"] b');
    if (dispatchBadge) dispatchBadge.textContent = String(Math.min(99, s.hearings.length + Math.min(9, s.log.length)));
    const signalBadge = $('#signal-secret-count');
    if (signalBadge) signalBadge.textContent = `${s.signal.fragments}/3`;
    $$('nav [data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  }
  function renderMission() {
    const node = $('#mission');
    if (!node) return;
    if (view === 'white-hart') {
      node.hidden = true;
      return;
    }
    node.hidden = false;
    const info = A.stepInfo(s);
    const def = info.def;
    const lower = s.step === 7 || s.step === 19;
    const goalLine = s.step === 24
      ? 'READY'
      : !info.goal.target
        ? `${fmt(info.goal.value)} remaining`
        : lower ? `${fmt(info.goal.value)} / max ${fmt(info.goal.target)}` : `${fmt(info.goal.value)} / ${fmt(info.goal.target)}`;
    const order = priority();
    const html = `
      <div class="mission-order">
        <span class="eyebrow">THE ORDER OF STEP ${String(s.step).padStart(2, '0')} · ${esc(def.kicker)}</span>
        <h2>${esc(def.title)}</h2>
        <p class="mission-copy">${esc(def.copy)}</p>
        <div class="mission-goal">
          <div class="goal-row"><span>${esc(info.goal.label)}</span><strong>${goalLine}</strong></div>
          <div class="meter ${info.done ? 'complete' : ''}"><i style="width:${clamp(info.progress * 100, 0, 100).toFixed(1)}%"></i></div>
          <div class="goal-row foot"><span>${info.done ? '✓ order complete — the next step opens' : esc(info.goal.extra || 'keep the machines running')}</span><span>${Math.round(info.progress * 100)}%</span></div>
        </div>
        <p class="mission-tip"><b>FIELD NOTE</b> ${esc(def.tip)}</p>
      </div>
      <div class="mission-order next">
        <span class="eyebrow">COMMAND PRIORITY</span>
        <h3>${esc(order.title)}</h3>
        <p>${esc(order.copy)}</p>
        <button class="primary" type="button" ${order.view ? `data-view="${order.view}"` : `data-action="${order.action}"${order.id ? ` data-id="${order.id}"` : ''}`}>${esc(order.cta)} →</button>
      </div>`;
    if (node.dataset.sig !== html) {
      node.innerHTML = html;
      node.dataset.sig = html;
    }
  }
  function priority() {
    const info = A.stepInfo(s);
    if (s.step >= 24) return { title: 'Recalculate the Calculus', copy: 'Every other card is closed. Take the Forecast, buy a remembrance, and open the next phase.', view: 'headquarters', cta: 'THE RECKONING' };
    if (s.hearings.length) return { title: `${s.hearings.length} failure report${s.hearings.length === 1 ? '' : 's'} awaiting a ruling`, copy: 'The Scientific Council will not wait. Demand revisions or endorse the excuse, in the Research Directorate.', view: 'research', cta: 'RULE ON THE REPORTS' };
    if (s.event && s.event.id) {
      const def = (A.MOMENTS || []).find((moment) => moment.id === s.event.id);
      return { title: def ? def.title : 'Something needs attending to', copy: 'A moment is open. It expires if nobody signs for it.', action: 'dismiss-event', cta: 'ATTEND TO IT' };
    }
    if (info.done) return { title: 'The order is met', copy: 'The Calculus is already drafting the next step. Keep the machines running, or press on.', view: 'headquarters', cta: 'THE LADDER' };
    const map = {
      1: { view: 'headquarters', cta: 'REQUISITION' },
      2: { view: 'production', cta: 'BUY MACHINES' },
      3: { view: 'production', cta: 'THEORY POOLS' },
      4: { view: 'production', cta: 'CONSULATES' },
      5: { view: 'production', cta: 'CRUISER LINES' },
      6: { view: 'production', cta: 'MAINTENANCE' },
      7: { view: 'production', cta: 'BUREAUCRATIC REFORM' },
      8: { view: 'research', cta: 'AUTHORISE' },
      9: { view: 'research', cta: 'RUN A TEST' },
      10: { view: 'research', cta: 'THE COUNCIL' },
      11: { view: 'research', cta: 'CERTIFY' },
      12: { view: 'bridge', cta: 'THE CORRIDOR' },
      13: { view: 'bridge', cta: 'FORMATIONS' },
      14: { view: 'bridge', cta: 'TARGETING' },
      15: { view: 'bridge', cta: 'FIRE THE VOLLEY' },
      16: { view: 'bridge', cta: 'THE FIELD' },
      17: { view: 'bridge', cta: 'KILL THE ANALYZER' },
      18: { view: 'bridge', cta: 'REPAIR THE CAPITAL' },
      19: { view: 'bridge', cta: 'FUND REVISIONS' },
      20: { view: 'bridge', cta: 'DECLARE A DOCTRINE' },
      21: { view: 'signal', cta: 'LISTEN' },
      22: { view: 'white-hart', cta: 'WALK TO THE PUB' },
      23: { view: 'bridge', cta: 'THE ARMADA' },
    };
    const target = map[s.step] || map[1];
    return { title: info.goal.label, copy: info.goal.extra || info.def.tip, ...target };
  }

  /* --------------------------------------------------------------- the map */
  const SYSTEMS = [
    { name: 'SOL INVICTA', x: 130, y: 195, kind: 'friendly', sub: 'Capital of the Orion Marches · Home Fleet · the Calculus models it holding twelve more cycles' },
    { name: 'VEGA', x: 245, y: 90, kind: 'friendly', sub: 'Encyclopaedia Project shipyards · cruiser lines build themselves · every hull identical, on purpose' },
    { name: 'KEPLER VII', x: 340, y: 180, kind: 'contested', sub: 'Frontier system · the corridor · sorties resolve every six seconds' },
    { name: 'TAU CETI', x: 260, y: 285, kind: 'friendly', sub: 'Forward base · prototype storage · a long way from any tribunal' },
    { name: 'RESEARCH DIRECTORATE', x: 405, y: 65, kind: 'friendly', sub: 'Norden Deep · positronic advisory core · all White Hart scientists clock in here' },
    { name: 'VESPER REACH', x: 515, y: 235, kind: 'enemy', sub: 'Hostile territory · six-sun homeworld · night falls once every 2,049 years' },
    { name: 'PROXIMA', x: 598, y: 120, kind: 'enemy', sub: 'Enemy staging ground · a commander the Calculus cannot model' },
    { name: 'THE WHITE HART', x: 470, y: 154, kind: 'friendly', sub: 'Fleet Street, Norden Deep · Directorate local & prototype test annex' },
    { name: 'THE QUIET ARRAY', x: 88, y: 90, kind: 'anomaly', sub: 'Unregistered object · one question, repeated every 101 seconds · no known crew' },
  ];

  function systemInfo(index) {
    const info = { ...SYSTEMS[index] };
    const f = s.fleet;
    if (index === 3 && f.ceded) {
      info.kind = 'enemy';
      info.sub = 'Ceded base · enemy reverse-engineering facility destroyed · the admirals have opinions';
    }
    if (index === 2) {
      info.kind = f.enemy > 0 ? 'contested' : 'friendly';
      info.sub = f.enemy > 0
        ? `Frontier system · ${fmt(f.enemy)} hostile hulls in the corridor · ${fmt(s.fleet.ships)} of ours`
        : 'Frontier system · the corridor is quiet · the armada is not';
    }
    if (index === 5 || index === 6) info.sub = `Hostile territory · enemy adaptation ${pct(f.adapt / 12)} · ${Math.round(f.unrest)}% military unrest`;
    if (index === 4) info.sub = `Norden Deep · ${fmtRate(A.derive(s).spPerSec)} SP / sec · the White Hart next door`;
    if (index === 7) info.sub = `Directorate local · ${s.totals.checks} checks filed · ${Object.keys(s.pub.rooms).length} rooms · claimed deviation 0.000001%`;
    if (index === 0) info.sub = `Capital system · ${Math.round(f.capital)}% integrity · reliability ${Math.round(f.reliability)}%`;
    if (index === 8) {
      info.sub = s.signal.choice
        ? `Unknown source · ${s.signal.choice === 'reply' ? 'a reply was transmitted' : 'radio silence maintained'}`
        : `Unregistered object · ${s.signal.fragments}/3 fragments decoded · no known crew`;
    }
    return info;
  }

  function sectorMap() {
    const stars = Array.from({ length: 118 }, (_, i) => {
      const x = (i * 137 + 23) % 690;
      const y = (i * 83 + 15) % 350;
      const radius = i % 9 === 0 ? 1.25 : i % 3 === 0 ? 0.9 : 0.55;
      const delay = -((i * 17) % 55) / 10;
      return `<circle class="map-star ${i % 9 === 0 ? 'bright' : ''}" cx="${x}" cy="${y}" r="${radius}" style="--star-delay:${delay}s"/>`;
    }).join('');
    const routes = [
      'M130 195L245 90L340 180L260 285L130 195',
      'M130 195L340 180L405 65L245 90',
      'M405 65L470 154L515 235L598 120L405 65',
      'M88 90L130 195L245 90L405 65',
      'M88 90L130 195L260 285',
    ];
    const selected = ui.mapSelection;
    return `<div class="map"><div class="map-label"><span class="live-dot"></span>SECTOR 07 / ORION EXPANSE</div>
      <svg class="star-map" viewBox="0 0 700 350" role="img" aria-label="Orion strategic star map. Select a system or the unidentified signal source for intelligence.">
        <defs>
          <pattern id="star-grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="#62819a" stroke-width=".5" opacity=".18"/></pattern>
          <radialGradient id="map-nebula"><stop stop-color="#537e8d" stop-opacity=".28"/><stop offset=".52" stop-color="#354c72" stop-opacity=".12"/><stop offset="1" stop-color="#172334" stop-opacity="0"/></radialGradient>
          <radialGradient id="map-core"><stop stop-color="#d5f9ff"/><stop offset=".2" stop-color="#78d3e4"/><stop offset="1" stop-color="#6ec4e0" stop-opacity="0"/></radialGradient>
          <clipPath id="map-clip"><rect width="700" height="350" rx="4"/></clipPath>
        </defs>
        <g clip-path="url(#map-clip)">
          <rect width="700" height="350" fill="#07111d"/>
          <rect width="700" height="350" fill="url(#star-grid)"/>
          <ellipse class="nebula-cloud" cx="250" cy="170" rx="290" ry="205" fill="url(#map-nebula)"/>
          <ellipse class="nebula-cloud nebula-cloud-alt" cx="575" cy="110" rx="205" ry="180" fill="url(#map-nebula)"/>
          ${stars}
          <path d="M485 0Q575 75 500 150T525 350H700V0Z" fill="#c46d6220"/>
          <path d="M485 0Q575 75 500 150T525 350" class="border-frontier"/>
          <ellipse cx="340" cy="180" rx="295" ry="156" class="map-orbit"/>
          <ellipse cx="340" cy="180" rx="225" ry="110" class="map-orbit map-orbit-inner" transform="rotate(-18 340 180)"/>
          ${routes.map((route, i) => `<path class="route-line ${i >= 2 ? 'hostile-route' : ''} ${i >= 3 ? 'signal-route' : ''}" d="${route}"/>`).join('')}
          <text x="540" y="315" class="hostile-space-label">HOSTILE SPACE</text>
          <text x="31" y="326" class="map-coordinate-label">GALACTIC PLANE  /  014.8 LY</text>
        </g>
        ${SYSTEMS.map((original, i) => {
          const info = systemInfo(i);
          const color = info.kind === 'enemy' ? '#e98b75' : info.kind === 'contested' ? '#e3c574' : info.kind === 'anomaly' ? '#7de6ef' : '#9ed3b2';
          const signal = i === 8;
          const sublabel = i === 0 ? 'CAPITAL'
            : i === 2 ? (s.fleet.enemy > 0 ? '⚠ CONTESTED' : 'SECURED')
              : i === 1 ? 'SHIPYARDS'
                : i === 4 ? 'NORDEN DEEP'
                  : i === 7 ? 'PUB / TEST ANNEX'
                    : signal ? (s.signal.fragments === 3 ? 'PATTERN RESOLVED' : 'UNKNOWN CARRIER')
                      : i === 3 ? (s.fleet.ceded ? 'CEDED' : 'FORWARD BASE') : '';
          return `<g class="map-node ${signal ? 'map-node-anomaly' : ''} ${i === selected ? 'selected' : ''}" data-system="${i}" role="button" tabindex="0" aria-label="${esc(info.name)}: ${esc(info.sub)}">
            <circle class="node-orbit" cx="${info.x}" cy="${info.y}" r="${i === selected ? 25 : 17}" style="--node-color:${color}"/>
            ${signal ? `<circle class="anomaly-ring anomaly-ring-a" cx="${info.x}" cy="${info.y}" r="11"/><circle class="anomaly-ring anomaly-ring-b" cx="${info.x}" cy="${info.y}" r="16"/><circle class="anomaly-core" cx="${info.x}" cy="${info.y}" r="7"/>` : `<circle class="node-core" cx="${info.x}" cy="${info.y}" r="${i === 0 || i === 7 ? 5 : 3.8}" style="--node-color:${color}"/>`}
            ${i === selected ? `<circle class="node-selection" cx="${info.x}" cy="${info.y}" r="30"/>` : ''}
            <text x="${info.x}" y="${info.y + 38}" class="node-label" text-anchor="middle" style="--node-color:${color}">${esc(info.name)}</text>
            <text x="${info.x}" y="${info.y + 50}" class="node-sublabel" text-anchor="middle">${esc(sublabel)}</text>
          </g>`;
        }).join('')}
        <g transform="translate(196 183)" class="fleet-marker"><path d="M0 0L-6 12L0 9L6 12Z"/><path d="M-13 10L-17 18L-13 16L-9 18Z"/><path d="M13 10L9 18L13 16L17 18Z"/></g>
      </svg>
      <div class="map-coordinate">X 034.77 / Y 092.18 <span>·</span> NAV SOLUTION LOCKED</div>
    </div>
    <div class="map-legend"><span><i></i> IMPERIAL SYSTEM</span><span><i class="contested"></i> CONTESTED</span><span><i class="enemy"></i> ENEMY CONTROL</span><span><i class="anomaly"></i> UNIDENTIFIED SIGNAL</span></div>`;
  }

  function alertCard() {
    const norden = s.fleet.doctrine !== 'voss';
    return `<section class="alert-card"><div class="eyebrow">RESEARCH DIRECTORATE</div><span class="stamp">${s.hearings.length ? 'URGENT' : 'NOTICE'}</span>
      <h3>${norden ? '“A minor adjustment to the laws of physics.”' : 'Standardization is now doctrine.'}</h3>
      <p>${norden ? 'Professor Norden requests authorisation for the Sphere. Assembly-line interruption is considered “negligible.” The machines will do the interrupting.' : 'The Directorate has been reassigned. Veteran engineers have returned to the assembly floor, and the fleet agrees with its own drawings again.'}</p>
      <div class="quote">${norden ? '“We cannot allow the inconvenience of a war to impede scientific progress. The directives are a drafting matter.”' : '“The bolts fit the nuts again, and every machine obeys the first directive. We regard this as a breakthrough.”'}</div>
      <div class="author">— ${norden ? 'PROF. E. NORDEN' : 'CHIEF ENGINEER VOSS'}</div>
      <button class="outline wide" data-view="research" type="button">${s.hearings.length ? 'Rule on the reports' : 'Review the projects'} <span>→</span></button>
      <button class="outline wide" data-view="white-hart" type="button">Check a prototype at The White Hart <span>→</span></button>
    </section>`;
  }

  function balanceCard() {
    const f = s.fleet;
    const d = A.derive(s);
    return `<section class="panel"><div class="panel-head"><h2>The balance of power</h2><span>⌁</span></div><div class="status-body">
      <div class="meter-row"><span>Our operational vessels</span><strong>${fmt(f.ships)}</strong></div>
      <div class="meter"><i style="width:${clamp((f.ships / Math.max(1, f.ships + f.enemy)) * 100, 0, 100)}%"></i></div>
      <div class="meter-row"><span>Enemy strength in the corridor</span><strong>${fmt(f.enemy)}</strong></div>
      <div class="meter red"><i style="width:${clamp((f.enemy / Math.max(1, f.ships + f.enemy)) * 100, 0, 100)}%"></i></div>
      <div class="meter-row"><span>Firepower / enemy power</span><strong>${fmt(d.combatPower)} / ${fmt(d.enemyPower)}</strong></div>
      <div class="meter-row"><span>Military unrest</span><strong>${Math.round(f.unrest)}%</strong></div>
      <div class="meter red"><i style="width:${clamp(f.unrest, 0, 100)}%"></i></div>
      <p class="status-note">“Their ships are inferior in every measurable way. Except quantity, and the fact that they build without being asked.”</p>
    </div></section>`;
  }

  function assemblyLine() {
    const d = A.derive(s);
    const cost = Math.ceil(400 * Math.pow(1.85, s.lines));
    return `<section class="panel"><div class="panel-head"><h2>Assembly line</h2><span class="tag">${s.lines >= 8 ? 'AT CAPACITY' : 'IN PRODUCTION'}</span></div>
      <div class="production-body"><div class="ship-art">${SHIP}</div><div>
        <h3>Standard Cruiser Mk. IV</h3>
        <p>${s.lines} / 8 CRUISER LINES · ${fmtRate(d.shipPerSec)} HULLS / SEC · ${fmt(d.shipIpCost)} IP PER HULL</p>
        <div class="meter"><i style="width:${(s.lines / 8) * 100}%"></i></div>
        <span class="mini-status">${s.lines ? 'Reliable. Reproducible. Remarkably unfashionable.' : 'AWAITING REQUISITION'}</span>
        <button class="primary wide" type="button" data-action="line" ${s.ip < cost || s.lines >= 8 ? 'disabled' : ''}>Open a cruiser line · ${fmt(cost)} IP</button>
      </div></div></section>`;
  }
  const SHIP = '<svg viewBox="0 0 120 70" fill="none" stroke="#6d8063" stroke-width="1"><path d="M7 39L25 30H63L78 22H98L113 34L100 42H32L22 48H8Z M33 30V42M63 30V42M78 22V42M8 36H26M12 33V45M18 33V45M46 30V23H58V30M52 23V15M69 31H101M68 37H94M32 48H90"/><path d="M2 55H118M2 12V58M117 12V58" stroke-dasharray="2 3" opacity=".3"/></svg>';

  function dispatchesPanel(limit = 3) {
    const entries = (s.log || []).slice(0, limit);
    const rows = entries.length
      ? entries.map((entry, index) => {
        const text = typeof entry === 'string' ? entry : entry.text;
        const head = text.split('.')[0];
        return `<div class="dispatch"><span class="dispatch-icon">${index % 2 ? '▥' : '⌁'}</span><div><strong>${esc(head)}.</strong><p>${esc(text.split('.').slice(1).join('.'))}</p></div><time>${index === 0 ? 'LATEST' : 'ARCHIVE'}</time></div>`;
      }).join('')
      : '<div class="dispatch"><span class="dispatch-icon">⌁</span><div><strong>No dispatches.</strong><p>The log will fill itself.</p></div><time>—</time></div>';
    return `<section class="panel"><div class="panel-head"><h2>Incoming dispatches</h2><button class="text-button" data-view="dispatches" type="button">All dispatches ↗</button></div>${rows}</section>`;
  }

  function signalBrief() {
    const decoded = s.signal.fragments >= 3;
    const status = s.signal.choice
      ? (s.signal.choice === 'reply' ? 'REPLY TRANSMITTED' : 'ARRAY HELD SILENT')
      : `${s.signal.fragments} / 3 FRAGMENTS`;
    return `<section class="signal-brief panel ${decoded ? 'decoded' : ''}" aria-labelledby="signal-brief-title">
      <div class="signal-brief-orbit" aria-hidden="true"><span class="signal-brief-core">◉</span><i></i><b></b></div>
      <div class="signal-brief-copy"><span class="eyebrow">THE QUIET ARRAY / UNREGISTERED TRANSMISSION</span><h2 id="signal-brief-title">${decoded ? 'A question, left for us.' : 'Something out there is asking.'}</h2>
        <p>${decoded ? 'A machine older than the Empire has asked one question for ten thousand years. The answer is now yours to file.' : 'A pattern repeats beyond the mapped lanes. It is older than our charts, it is shaped like a question, and it is getting louder.'}</p></div>
      <div class="signal-brief-status"><span>${status}</span><button class="outline" data-view="signal" type="button">${decoded ? 'Choose our answer ↗' : 'Investigate the signal ↗'}</button></div>
    </section>`;
  }

  function pubDispatch() {
    return `<section class="pub-dispatch panel"><div><span class="eyebrow">NORDEN DEEP / FLEET STREET</span><h2>A short walk from theory to the bar.</h2>
      <p>The Research Directorate is next door. Every prototype can be checked at The White Hart, which has been doing it since before the war and has never once filed the paperwork. Claimed statistical deviation: <strong>0.000001%</strong>. ${s.totals.checks} pub checks filed, ${Object.keys(s.pub.rooms).length} rooms open.</p></div>
      <button class="outline" data-view="white-hart" type="button">Walk over to The White Hart →</button></section>`;
  }

  /* ------------------------------------------------------------- the forecast */
  function forecastPanel() {
    const upgrades = A.PRESTIGE_UPGRADES.map((def) => {
      const level = s.forecastUp[def.id] || 0;
      const cost = A.prestigeUpgradeCost(s, def);
      const maxed = level >= def.max;
      return `<div class="shop-item ${maxed ? 'purchased' : ''}">
        <div class="shop-item-heading"><span class="shop-item-icon">✦</span><div><strong>${esc(def.name)}</strong><span class="item-sub">${esc(def.note)}</span></div></div>
        <div class="shop-item-foot"><span class="item-cost">${maxed ? 'REMEMBERED' : `${cost} FORECAST`}</span>
        ${maxed ? '<span class="item-status">' + level + '/' + def.max + '</span>' : `<button class="primary" type="button" data-action="prestige-upgrade" data-id="${def.id}" ${s.forecast < cost ? 'disabled' : ''}>REMEMBER · ${level}/${def.max}</button>`}</div>
      </div>`;
    }).join('');
    const reckoning = s.step >= 24;
    return `<section class="panel forecast-panel">
      <div class="panel-head"><div><span class="eyebrow">THE LONG FORECAST / REMEMBRANCE</span><h2>What the Calculus keeps</h2></div><span class="tag">PHASE ${roman(s.phase)}</span></div>
      <p>Forecast is what survives a phase. Holding it grants <strong>+1% output each</strong>; spending it on remembrance grants far more, once. Deep Memory and Remembered Clock are permanent; the rest are inherited.</p>
      <div class="forecast-stats">
        <div><span>RESERVE</span><strong>${fmt(s.forecast)}</strong></div>
        <div><span>OUTPUT MULTIPLIER</span><strong>×${A.forecastMult(s).toFixed(2)}</strong></div>
        <div><span>SPEED</span><strong>×${A.gameSpeed(s).toFixed(2)}</strong></div>
        <div><span>PRESTIGES</span><strong>${s.prestiges}</strong></div>
        <div><span>ON OFFER</span><strong>+${A.prestigeGain(s)}</strong></div>
      </div>
      <div class="shop-grid">${upgrades}</div>
      ${reckoning ? `<div class="recalculation">
        <span class="eyebrow">STEP 24 · THE RECKONING</span>
        <h3>Recalculate the Calculus</h3>
        <p>${esc(A.ending(s).copy)}</p>
        <div class="ending-line">ENDING · <strong>${esc(A.ending(s).title.toUpperCase())}</strong></div>
        <ul class="gain-list">${A.prestigeBreakdown(s).map((row) => `<li><span>${esc(row.label)}</span><strong>+${row.value}</strong></li>`).join('')}</ul>
        <button class="primary wide" type="button" data-action="prestige">RECALCULATE THE CALCULUS ✦ +${A.prestigeGain(s)} FORECAST</button>
        <p class="fine">Everything else resets: machines, research, fleet, the pub, the array. Forecast and remembrance do not.</p>
      </div>` : `<div class="recalculation locked"><span class="eyebrow">THE RECKONING · STEP 24</span><h3>Not yet.</h3><p>The Calculus will recalculate when the corridor is won and the twenty-four steps are done. Until then it is content to watch the numbers move.</p></div>`}
    </section>`;
  }

  /* ------------------------------------------------------------- headquarters */
  function headquartersView() {
    const info = systemInfo(ui.mapSelection);
    const quick = ui.mapSelection === 7 ? '<button class="text-button" data-view="white-hart" type="button">Enter the pub →</button>'
      : ui.mapSelection === 4 ? '<button class="text-button" data-view="research" type="button">Enter Directorate ↗</button>'
        : ui.mapSelection === 8 ? '<button class="text-button" data-view="signal" type="button">Open signal archive ↗</button>'
          : ui.mapSelection === 2 ? '<button class="text-button" data-view="bridge" type="button">Go to the bridge ↗</button>'
            : '<button class="text-button" data-action="scan" type="button">Request intelligence ↗</button>';
    return `<div class="grid">
      <section class="panel"><div class="panel-head"><div><span class="eyebrow">NAVIGATION CHART / SECTOR 07</span><h2>Strategic theatre</h2></div><span class="tag live-tag">● LIVE INTELLIGENCE</span></div>
        ${sectorMap()}
        <div class="system-detail"><div><strong>${esc(info.name)}</strong><p>${esc(info.sub)}</p></div>${quick}</div>
      </section>
      <aside class="right-column">${alertCard()}${balanceCard()}</aside>
    </div>
    ${signalBrief()}
    ${pubDispatch()}
    <div class="bottom-grid">${assemblyLine()}${dispatchesPanel(3)}</div>
    ${forecastPanel()}`;
  }

  /* --------------------------------------------------------------- research */
  function researchView() {
    const d = A.derive(s);
    const cards = A.PROJECTS.map((project, index) => {
      const rec = s.research[index];
      const label = rec.state === 0 ? 'AWAITING APPROVAL' : rec.state === 1 ? 'DRAFTING' : rec.state === 2 ? 'EXPERIMENTAL' : 'FIELD CERTIFIED';
      const draftLeft = rec.state === 1 ? Math.max(0, 20 - rec.progress) : 0;
      const canCertify = rec.state === 2 && rec.tests >= 2 && !s.hearings.length && s.ip >= 600 && s.pc >= 10;
      return `<article class="panel research-card">
        <span class="eyebrow">PROJECT 0${index + 1} / ${label}</span>
        <div class="research-icon">${project.icon}</div>
        <h2>${esc(project.name)}</h2>
        <p>${esc(project.desc)}</p>
        ${rec.tests ? `<p class="report-line"><b>Field report:</b> ${esc(project.flaw)}</p>` : '<p class="quote">“No significant limitations in the theoretical model. The machine will, of course, obey its directives.”</p>'}
        <p class="fine">${rec.tests}/2 tests · ${rec.fails} failure${rec.fails === 1 ? '' : 's'} · ${esc(project.bonus)}</p>
        <button class="primary wide" type="button" data-action="research" data-id="${index}" ${rec.state !== 0 || s.ip < project.ip || s.sp < project.sp ? 'disabled' : ''}>Authorise · ${project.ip} IP / ${project.sp} SP</button>
        ${rec.state === 1 ? `<div class="meter"><i style="width:${clamp((rec.progress / 20) * 100, 0, 100)}%"></i></div><p class="fine">Drafting on the Directorate’s paper · ${draftLeft.toFixed(0)}s remaining</p>` : ''}
        <button class="outline wide" type="button" data-action="test" data-id="${index}" ${rec.state !== 2 || rec.tests >= 2 || s.step < 9 || s.sp < 15 ? 'disabled' : ''}>Run field test ${rec.tests}/2 · 15 SP</button>
        <button class="outline wide" type="button" data-action="certify" data-id="${index}" ${canCertify ? '' : 'disabled'}>Engineer safeguards · 600 IP / 10 PC</button>
        <button class="pub-check-link" type="button" data-action="pub-check" data-id="${index}">Check at The White Hart →<small>${s.totals.checks} checks filed · claimed deviation 0.000001%</small></button>
      </article>`;
    }).join('');
    const hearings = s.hearings.length
      ? `<section class="hearing panel" aria-label="Unresolved failure report">
          <div class="hearing-heading"><div><span class="eyebrow">SCIENTIFIC COUNCIL / ${s.hearings.length} REPORT${s.hearings.length === 1 ? '' : 'S'} PENDING</span><h2>${esc(s.hearings[0].name)}: a question of responsibility</h2></div><span class="stamp">RULING REQUIRED</span></div>
          <p>${esc(HEARING_COPY[s.hearings[0].id] || '')}</p>
          <blockquote>${esc(HEARING_QUOTE[s.hearings[0].id] || '')}</blockquote>
          <div class="hearing-bottom"><span>MILITARY UNREST <strong>${Math.round(s.fleet.unrest)}%</strong> / MUTINY AT 100%</span><span>${s.hearings[0].reason === 'failure' ? 'FAILURE REPORT' : 'SPECIFICATION OMISSION'}</span></div>
          <div class="toolbar">
            <button class="primary" type="button" data-action="hearing" data-id="0:revise" ${s.ip < 30 || s.pc < 5 ? 'disabled' : ''}>Order revisions · 30 IP / 5 PC</button>
            <button class="outline" type="button" data-action="hearing" data-id="0:endorse">Endorse justification · +9 unrest</button>
          </div>
          <p class="hearing-help">Revisions suspend the prototype until certified and reduce unrest. Endorsement pays IP and adds chaos. Nothing advances the ladder while a report is open, but the machines keep running.</p>
        </section>`
      : '';
    return `${hearings}
      <div class="cards">${cards}</div>
      <section class="panel report"><div class="panel-head"><div><span class="eyebrow">PERSONNEL &amp; DOCTRINE</span><h2>Machines do the tests now.</h2></div><span class="tag">${fmtRate(d.spPerSec)} SP / SEC</span></div>
        <p>Every authorised project drafts itself in twenty seconds and tests itself twice. Tests cost 15 SP and fail 40% of the time under an unsafe specification; failures file a hearing, and passing both tests files a <em>specification-omission</em> hearing, because the tests have proved what the specification left out. Certification costs 600 IP and 10 PC and grants the project’s permanent bonus.</p>
        <div class="toolbar">
          <button class="outline" type="button" data-action="policy" data-id="autoResearch">Research autopilot: ${s.policies.autoResearch ? 'ON' : 'OFF'}</button>
          <button class="outline" type="button" data-action="policy" data-id="autoHearing">Hearing policy: ${s.policies.autoHearing === 'revise' ? 'REVISE' : 'ENDORSE'}</button>
          <button class="outline" type="button" data-view="white-hart">Run a check at the pub →</button>
        </div>
      </section>`;
  }
  const HEARING_COPY = [
    '“The launch assembly performed exactly as specified. No directive in the specification concerned the presence of a crew within the blast radius, and the machine is not permitted to invent one.”',
    '“The analyzer obeyed every instruction it was given. It has since concluded, in writing, that it is the true source of the fleet’s power. Directive one was not consulted.”',
    '“Hysteresis is not a defect. It is the third directive: a machine must preserve its own calibration. The admirals were never told the field remembers.”',
  ];
  const HEARING_QUOTE = [
    '“A drafting matter,” says Norden. “A funeral,” says the admiral.',
    '“It is only a support ship,” says the Directorate. “It was only a crew,” says the list.',
    '“The field is off,” says the bridge. “The field remembers,” says the bridge.',
  ];

  /* ------------------------------------------------------------- production */
  function machineCard(def, store, amountHint = 1) {
    const owned = Number(s[store][def.id] || 0);
    const cost = Math.ceil(def.cost * Math.pow(def.growth, owned));
    const affordable = s.ip >= cost;
    const bulk = (count) => {
      let total = 0;
      for (let i = 0; i < count; i += 1) total += Math.ceil(def.cost * Math.pow(def.growth, owned + i));
      return total;
    };
    const tenCost = bulk(10);
    let maxCount = 0;
    let maxCost = 0;
    while (maxCount < 500) {
      const next = Math.ceil(def.cost * Math.pow(def.growth, owned + maxCount));
      if (maxCost + next > s.ip) break;
      maxCost += next;
      maxCount += 1;
    }
    return `<div class="shop-item ${owned ? 'purchased' : ''}">
      <div class="shop-item-heading"><span class="shop-item-icon">${def.icon}</span><div><strong>${esc(def.name)} <em>×${owned}</em></strong><span class="item-sub">${esc(def.note || '')} · +${fmtRate(def.base)} ${store === 'labs' ? 'SP' : store === 'cons' ? 'PC' : 'IP'} / sec each</span></div></div>
      <div class="shop-item-foot">
        <span class="item-cost">${fmt(cost)} IP</span>
        <div class="buy-row">
          <button class="primary" type="button" data-buy="${def.id}" data-amount="1" ${affordable ? '' : 'disabled'}>×1</button>
          <button class="outline" type="button" data-buy="${def.id}" data-amount="10" ${s.ip >= tenCost ? '' : 'disabled'}>×10 · ${fmt(tenCost)}</button>
          <button class="outline" type="button" data-buy="${def.id}" data-amount="max" ${maxCount ? '' : 'disabled'}>MAX · ${maxCount || 0}</button>
        </div>
      </div>
    </div>`;
  }
  function productionView() {
    const machines = (list, store, title, note) => `<section class="panel shop-section">
      <div class="panel-head"><div><span class="eyebrow">${title.eyebrow}</span><h2>${title.name}</h2></div><span class="tag">${note}</span></div>
      <p class="fine">${title.copy}</p>
      <div class="shop-grid">${list.filter((def) => def.step <= Math.max(s.step, 24) && def.step <= s.step + 1).map((def) => machineCard(def, store)).join('')}</div>
    </section>`;
    const reforms = A.UPGRADES.filter((def) => def.step <= s.step).map((def) => {
      const level = A.upgradeLevel(s, def.id);
      const cost = A.upgradeCost(def, level);
      const maxed = level >= def.max;
      return `<div class="shop-item ${maxed ? 'purchased' : ''}">
        <div class="shop-item-heading"><span class="shop-item-icon">⚙</span><div><strong>${esc(def.name)} <em>${level}/${def.max}</em></strong><span class="item-sub">${esc(def.note)}</span></div></div>
        <div class="shop-item-foot"><span class="item-cost">${maxed ? 'COMPLETE' : `${fmt(cost)} IP`}</span>
        ${maxed ? '<span class="item-status">✓</span>' : `<button class="primary" type="button" data-action="upgrade" data-id="${def.id}" ${s.ip < cost ? 'disabled' : ''}>BUY</button>`}</div>
      </div>`;
    }).join('');
    const d = A.derive(s);
    return `${assemblyLine()}
      ${machines(A.GENS, 'gens', { eyebrow: '▥ INDUSTRY', name: 'Machines that bank IP', copy: 'Every machine here adds output per second, whether or not anyone is watching. Costs rise as the yard fills.' }, `${fmtRate(d.ipPerSec)} IP / SEC`)}
      ${machines(A.LABS, 'labs', { eyebrow: '⚛ SCIENCE', name: 'Chalkboards with a measurable output', copy: 'Science pays for research, tests and listening passes. It is never spent on a battleship.' }, `${fmtRate(d.spPerSec)} SP / SEC`)}
      ${machines(A.CONS, 'cons', { eyebrow: '⚑ AUTHORITY', name: 'Offices that turn patience into capital', copy: 'Political capital pays for safeguards, hearings and doctrine. An empty treasury is how commanders become memos.' }, `${fmtRate(d.pcPerSec)} PC / SEC`)}
      <section class="panel shop-section"><div class="panel-head"><div><span class="eyebrow">⚙ PERMANENT REFORMS</span><h2>One-time improvements</h2></div><span class="tag">${A.UPGRADES.filter((def) => def.step <= s.step).length} AVAILABLE</span></div>
        <p class="fine">Reforms are bought once and stay bought until the Calculus recalculates. Each level multiplies output or repairs the machinery of the state.</p>
        <div class="shop-grid">${reforms || '<p class="fine">Nothing yet. The ladder opens them one step at a time.</p>'}</div>
      </section>
      <section class="panel report"><div class="panel-head"><div><span class="eyebrow">NAVAL PROCUREMENT / WORKS</span><h2>The unglamorous orders</h2></div><span class="tag">${Math.round(s.fleet.reliability)}% RELIABLE</span></div>
        <p>Reliability decays with every hull the fleet gains; maintenance bays and standardisation push it back. Chaos eats output and must be reformed away. The capital is repaired by crews you never meet, and unrest is paid off with revisions.</p>
        <div class="toolbar">
          <button class="outline" type="button" data-action="overhaul">Overhaul the fleet · +reliability</button>
          <button class="outline" type="button" data-action="reform">Bureaucratic reform · −chaos</button>
          <button class="outline" type="button" data-action="repair">Repair the capital · IP</button>
          <button class="outline" type="button" data-action="revision">Fund revisions · IP / PC</button>
          <button class="outline" type="button" data-action="cede" ${s.fleet.ceded ? 'disabled' : ''}>${s.fleet.ceded ? 'Tau Ceti ceded' : 'Leave a poisoned gift · 10 PC'}</button>
        </div>
        <p class="fine">Ceding an outpost destroys up to eight enemy hulls and raises unrest by fifteen. It is a legitimate strategy with an illegitimate smell.</p>
      </section>`;
  }

  /* ----------------------------------------------------------------- bridge */
  function tacticalPlot() {
    const f = s.fleet;
    const ours = Math.max(0, f.ships);
    const foes = Math.max(0, f.enemy);
    const glyph = (x, y, hostile, index) => `<g class="tactical-ship ${hostile ? 'hostile' : ''}" transform="translate(${x} ${y}) rotate(${hostile ? 180 : 0})" style="--ship-delay:${(index * 0.17).toFixed(2)}s"><path class="ship-hull" d="${hostile ? 'M16 -8L-15 0L16 8L9 0Z' : 'M16 0L-12 -9L-6 0L-12 9Z'}"/><path class="ship-detail" d="M-6 -4L5 0L-6 4"/></g>`;
    let units = '';
    const ourCount = Math.min(16, Math.ceil(ours / 30) || 0);
    for (let i = 0; i < ourCount; i += 1) units += glyph(190 + Math.floor(i / 4) * 65, 95 + (i % 4) * 55, false, i);
    const foeCount = Math.min(16, Math.ceil(foes / 18) || 0);
    for (let i = 0; i < foeCount; i += 1) units += glyph(555 - Math.floor(i / 4) * 65, 95 + (i % 4) * 55, true, i + 4);
    return `<div class="tactical-plot"><svg viewBox="0 0 760 350" role="img" aria-label="Fleet tactical display: ${ourCount} imperial groups, ${foeCount} hostile groups.">
      <defs><pattern id="tac-grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="#74917b" stroke-opacity=".14"/></pattern></defs>
      <rect width="760" height="350" fill="url(#tac-grid)"/>
      <circle cx="380" cy="175" r="128" fill="none" stroke="#78967c" stroke-opacity=".13"/>
      <circle cx="380" cy="175" r="75" fill="none" stroke="#78967c" stroke-opacity=".13"/>
      <path d="M380 35V315" stroke="#78967c" stroke-dasharray="3 7" stroke-opacity=".3"/>
      <text x="28" y="30">IMPERIAL TASK FORCE</text><text x="530" y="30">HOSTILE CONTACTS</text>
      ${units}
      ${f.field ? '<ellipse cx="190" cy="95" rx="44" ry="36" fill="#a5c7d015" stroke="#a5c7d0" stroke-dasharray="4 3"/>' : ''}
      ${f.analyzer ? `<g transform="translate(75 180)" class="analyzer-marker"><rect x="-18" y="-12" width="36" height="24"/><path d="M-25 0H25M0-20V20"/><text x="-32" y="38">ANALYZER</text><text x="-24" y="52">${Math.ceil(f.analyzerHp)} HULL</text></g>` : ''}
      ${f.blackout > 0 ? '<path class="torpedo-trace" d="M280 155L470 130M275 213L478 240"/>' : ''}
      <text x="28" y="328">${f.blackout > 0 ? 'WARNING: COMMAND LINK LOST' : f.adapt > 3 ? 'ENEMY DOCTRINE: SUPPORT INTERDICTION' : 'PASSIVE RADAR / TRACKING CONTACTS'}</text>
    </svg></div>`;
  }
  function orderButton(action, id, label, hint, selected, disabled = false) {
    return `<button class="order-button ${selected ? 'selected' : ''}" type="button" data-action="${action}" data-id="${id}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''}><strong>${esc(label)}</strong><small>${esc(hint)}</small></button>`;
  }
  function bridgeView() {
    const f = s.fleet;
    const d = A.derive(s);
    const volleyReady = f.volley >= 1;
    const last = (s.log || []).slice(0, 4).map((entry) => `<p>${esc(typeof entry === 'string' ? entry : entry.text)}</p>`).join('');
    return `<div class="bridge-layout">
      <section class="panel"><div class="panel-head"><h2>Kepler corridor / Fleet engagement</h2><span class="tag">${f.blackout > 0 ? 'LINK LOST' : s.step >= 23 ? 'TOTAL MOBILISATION' : 'AUTO-SORTIES'}</span></div>
        ${tacticalPlot()}
        <div class="battle-stats"><span>IMPERIAL HULL ${fmt(f.ships)}</span><span>${s.step >= 12 ? 'SORTIE EVERY 6s' : 'SORTIES AT STEP 12'}</span><span>HOSTILE HULL ${fmt(f.enemy)}</span></div>
        <div class="battle-lines">
          <span>FIREPOWER <strong>${fmt(d.combatPower)}</strong></span><span>ENEMY POWER <strong>${fmt(d.enemyPower)}</strong></span>
          <span>RELIABILITY <strong>${Math.round(f.reliability)}%</strong></span><span>CAPITAL <strong>${Math.round(f.capital)}%</strong></span>
          <span>UNREST <strong>${Math.round(f.unrest)}%</strong>${f.mutiny ? ' · MUTINY' : ''}</span><span>FIELD HEAT <strong>${Math.round(f.heat)}%</strong></span>
        </div>
        <div class="bridge-tools">
          <button class="primary" type="button" data-action="volley" ${volleyReady && s.step >= 15 && f.enemy > 0 ? '' : 'disabled'}>${volleyReady ? 'FIRE THE WONDER WEAPON' : `CHARGING ${Math.round(f.volley * 100)}%`}</button>
          <button class="outline" type="button" data-action="field" ${s.step < 16 ? 'disabled' : ''}>${f.field ? 'DEACTIVATE FIELD' : 'ENGAGE FIELD'}</button>
          <button class="outline" type="button" data-action="repair" ${s.step < 12 ? 'disabled' : ''}>REPAIR CAPITAL</button>
          <button class="outline" type="button" data-action="revision" ${s.step < 19 ? 'disabled' : ''}>FUND REVISIONS</button>
          <button class="outline" type="button" data-action="emergency" ${f.crisis ? '' : 'disabled'}>EMERGENCY POWERS</button>
          <button class="outline" type="button" data-action="cede" ${s.step < 18 || f.ceded ? 'disabled' : ''}>${f.ceded ? 'TAU CETI CEDED' : 'CEDE OUTPOST FOUR'}</button>
        </div>
        ${f.analyzer ? `<p class="fine">ANALYZER IN THE CORRIDOR · ${Math.ceil(f.analyzerHp)} HULL · support fire is the only priority that kills it. Its death resets part of the enemy’s adaptation.</p>` : ''}
        ${f.blackout > 0 ? `<p class="fine warn">Hysteresis: the command link is dark for ${f.blackout.toFixed(1)}s.</p>` : ''}
      </section>
      <aside class="panel orders-panel"><div class="panel-head"><h2>Fleet orders</h2><span class="tag">${f.blackout > 0 ? 'OFFLINE' : 'COMMAND'}</span></div>
        <div class="orders-body">
          <span class="eyebrow">FORMATION</span>
          ${orderButton('formation', 'line', 'Line ahead', 'Balanced fire and protection.', f.formation === 'line', s.step < 13)}
          ${orderButton('formation', 'escort', 'Escort screen', '−25% firepower; halved capital damage.', f.formation === 'escort', s.step < 13)}
          ${orderButton('formation', 'breakthrough', 'Breakthrough', '+30% firepower, and +30% incoming.', f.formation === 'breakthrough', s.step < 13)}
          <span class="eyebrow">TARGET PRIORITY</span>
          ${orderButton('target', 'screen', 'Enemy screen', 'Full torpedo damage against the squadron.', f.target === 'screen')}
          ${orderButton('target', 'support', 'Support ships', 'The only priority that kills an analyzer.', f.target === 'support')}
          ${orderButton('target', 'command', 'Command vessels', 'Halves raid damage; disrupts coordination.', f.target === 'command')}
          <span class="eyebrow">STRATEGIC MAP</span>
          ${orderButton('focus', 'corridor', 'Kepler corridor', '+18% firepower while watched.', f.focus === 'corridor', s.step < 5)}
          ${orderButton('focus', 'yards', 'Vega yards', '+25% cruiser construction.', f.focus === 'yards', s.step < 5)}
          ${orderButton('focus', 'vesper', 'Vesper Reach', '+25% science. Six suns, and a night.', f.focus === 'vesper', s.step < 5)}
        </div>
      </aside>
    </div>
    <div class="weapon-rack">${A.PROJECTS.map((project, index) => {
      const rec = s.research[index];
      const ready = rec.state === 3;
      return `<button class="weapon-button" type="button" data-action="volley" ${ready && s.step >= 15 && f.volley >= 1 && f.enemy > 0 ? '' : 'disabled'}><span>${project.icon}</span><div><strong>${esc(project.name)}</strong><small>${rec.state === 0 ? 'NOT AUTHORISED' : rec.state === 1 ? 'DRAFTING' : rec.state === 2 ? 'EXPERIMENTAL / RISK UNKNOWN' : rec.tests >= 2 ? 'FIELD CERTIFIED' : 'TESTED ONCE'}</small></div></button>`;
    }).join('')}</div>
    <section class="panel report signal-log"><span class="eyebrow">BRIDGE SIGNALS</span>${last || '<p>Torpedo crews ready. Awaiting contact.</p>'}</section>`;
  }

  /* ----------------------------------------------------------------- signal */
  const FRAGMENT_TEXT = [
    'The carrier is a sequence of prime intervals, and it is shaped like a question rather than a statement. It has repeated without drift for longer than our observatories have existed.',
    'Translated, the question is about endings. Something is asking whether the dark can be undone — and asking politely, the way a machine asks when it has no one left to ask.',
    'The last coordinate is this receiver. We are not the audience for the question. We are the intended answer.',
  ];
  const FRAGMENT_TITLE = ['A question, not a message', 'The question is about endings', 'A coordinate aimed at us'];
  function signalView() {
    const found = s.signal.fragments;
    const decoded = found >= 3;
    const choice = s.signal.choice;
    const fragments = FRAGMENT_TEXT.map((text, index) => {
      const state = index < found ? 'recovered' : index === found ? 'active' : 'locked';
      return `<article class="signal-fragment ${state}"><span class="fragment-index">0${index + 1}</span><span class="fragment-status">${index < found ? 'RECOVERED' : index === found ? 'READY TO LISTEN' : 'ENCRYPTED'}</span><h3>${index < found ? FRAGMENT_TITLE[index] : 'Unresolved interval'}</h3><p>${index < found ? esc(text) : 'The analyzer has not isolated this layer yet. The pauses may be carrying as much as the pulses.'}</p></article>`;
    }).join('');
    const choiceMarkup = !decoded
      ? `<div class="signal-choice-locked"><span class="choice-lock">⌁</span><div><strong>Response protocol locked</strong><p>Recover all three fragments to choose whether to answer the signal.</p></div></div>`
      : choice
        ? `<div class="signal-response-filed ${choice}"><span class="response-check">${choice === 'reply' ? '↗' : '◌'}</span><div><span class="eyebrow">RESPONSE FILED</span><h3>${choice === 'reply' ? 'An answer, sent into the dark.' : 'We chose to listen.'}</h3><p>${choice === 'reply' ? 'Our reply has left the array. Nothing answers yet. On the console, the log begins to fill with a single repeating word that is not a number.' : 'The array has gone quiet. For the first time in weeks, the enemy’s long-range tracking has lost our capital’s outline, and the question waits without us.'}</p></div></div>`
        : `<div class="signal-choice-grid">
            <button class="signal-choice reply" type="button" data-action="answer" data-id="reply" ${s.pc < 12 ? 'disabled' : ''}><span class="choice-icon">↗</span><span class="eyebrow">OPTION A · FIRST CONTACT</span><strong>Answer the question</strong><small>Spend 12 PC. Gain 25 SP. Tell a ten-thousand-year-old machine that somebody is still here.</small></button>
            <button class="signal-choice silence" type="button" data-action="answer" data-id="silence"><span class="choice-icon">◌</span><span class="eyebrow">OPTION B · STRATEGIC CAUTION</span><strong>Keep the array silent</strong><small>Reduce enemy strength by 10% and restore 8% fleet reliability. The channel may not wait forever.</small></button>
          </div>`;
    return `<div class="signal-page">
      <section class="signal-hero panel ${decoded ? 'decoded' : ''}">
        <div class="signal-art" aria-hidden="true">
          <svg viewBox="0 0 360 260" role="presentation">
            <defs><radialGradient id="signal-star-glow"><stop stop-color="#d7fbff"/><stop offset=".18" stop-color="#83e3ef"/><stop offset="1" stop-color="#83e3ef" stop-opacity="0"/></radialGradient><linearGradient id="signal-beam" x1="0" x2="1"><stop stop-color="#8ce7ef" stop-opacity="0"/><stop offset=".5" stop-color="#8ce7ef" stop-opacity=".65"/><stop offset="1" stop-color="#8ce7ef" stop-opacity="0"/></linearGradient></defs>
            <path class="signal-gridline" d="M0 40H360M0 90H360M0 140H360M0 190H360M40 0V260M100 0V260M160 0V260M220 0V260M280 0V260M340 0V260"/>
            <ellipse class="signal-orbit orbit-one" cx="184" cy="127" rx="126" ry="62"/>
            <ellipse class="signal-orbit orbit-two" cx="184" cy="127" rx="85" ry="112" transform="rotate(42 184 127)"/>
            <path class="signal-vector" d="M18 198C70 198 93 185 128 155S177 100 207 113 248 175 272 154 307 75 344 67"/>
            <path class="signal-beam" d="M0 127H360"/>
            <circle class="signal-pulse pulse-one" cx="184" cy="127" r="41"/><circle class="signal-pulse pulse-two" cx="184" cy="127" r="41"/>
            <circle class="signal-star-core" cx="184" cy="127" r="32"/>
            <text x="18" y="24">BAND 9 / CARRIER LOCKED</text><text x="239" y="242">101 SEC / CYCLE</text>
          </svg>
          <button class="signal-easter-star ${s.signal.starFound ? 'found' : ''}" type="button" data-action="egg" data-id="silence" aria-label="Inspect the faint star in the signal chart" title="A dim point outside the plotted field"><span>${s.signal.starFound ? '✦' : '·'}</span></button>
          <span class="signal-art-caption">UNREGISTERED SOURCE · DISTANCE UNKNOWN</span>
        </div>
        <div class="signal-hero-copy"><span class="eyebrow"><i class="live-dot"></i> THE LONG QUESTION / DEEP-SKY LISTENER</span><h2>Somebody is still asking.</h2><p>At the edge of the mapped lanes a transmission repeats through the static every 101 seconds. Analysis suggests a machine that has outlived its makers and kept the channel open, asking one question, patiently, for ten thousand years.</p>
          <div class="signal-meta"><span><strong>101s</strong> repeat interval</span><span><strong>${found}/3</strong> fragments recovered</span><span><strong>${choice ? 'FILED' : 'OPEN'}</strong> response protocol</span></div></div>
      </section>
      <div class="signal-dashboard">
        <section class="panel signal-transcript"><div class="panel-head"><div><span class="eyebrow">LISTENING POST / AUTOMATIC TRANSCRIPT</span><h2>Three intervals. One question.</h2></div><span class="tag ${decoded ? 'tag-resolved' : ''}">${decoded ? 'PATTERN RESOLVED' : `${found} / 3 DECODED`}</span></div>
          <div class="signal-fragments">${fragments}</div>
          <div class="signal-scan-row"><div><span class="eyebrow">NEXT ANALYSIS PASS</span><strong>${decoded ? 'No further pass required' : `${Math.max(0, 20 - s.signal.timer).toFixed(0)}s · or listen by hand`}</strong></div>
            <button class="primary" type="button" data-action="listen" ${decoded || s.step < 21 ? 'disabled' : ''}>${decoded ? 'Signal parsed' : `Listen to next interval  ${found + 1}/3 →`}</button></div>
        </section>
        <aside class="panel signal-console"><span class="eyebrow">ARRAY STATUS</span>
          <div class="console-readout"><span class="console-dot ${decoded ? 'resolved' : ''}"></span><strong>${decoded ? 'PATTERN RESOLVED' : 'RECEIVING'}</strong><small>${decoded ? 'Awaiting command authorisation' : 'Carrier stability 99.8%'}</small></div>
          <div class="console-wave" aria-hidden="true">${'<i></i>'.repeat(34)}</div>
          <div class="console-meter"><span>DECODING</span><strong>${Math.round((found / 3) * 100)}%</strong><div><i style="width:${(found / 3) * 100}%"></i></div></div>
          <p class="console-note">“It is not a voice. It is a machine that was told to find an answer and was never told to stop looking.”<small>— Dr. Imani Vale, Robo-psychology / Night Shift</small></p>
        </aside>
      </div>
      <section class="panel signal-response-panel"><div class="panel-head"><div><span class="eyebrow">COMMAND AUTHORITY / RESPONSE PROTOCOL</span><h2>What should we send back?</h2></div><span class="tag">${choice ? 'DECISION ARCHIVED' : decoded ? 'AWAITING YOUR ORDER' : 'LOCKED'}</span></div>${choiceMarkup}</section>
      <p class="signal-secret-hint"><span>✦</span> The night archivist insists the old listener has one more message in it. Some words are keys.</p>
      <section class="signal-gag panel"><span class="gag-badge">FIELD NOTE</span><p>${found ? 'The analyzer’s first draft classified the source as “a colleague with a very long commute and no intention of leaving.” A revised report is pending.' : 'A junior analyst asked whether the signal could be turned down. The robo-psychologist has requested a different junior analyst.'}</p><span class="gag-signature">NIGHT SHIFT / UNOFFICIAL</span></section>
    </div>`;
  }

  /* ------------------------------------------------------------- dispatches */
  function achievementsGrid() {
    const list = (A.ACHIEVEMENTS || []).map((def) => `<span class="achievement ${s.achievements.includes(def.id) ? 'on' : ''}" title="${esc(def.note)}">${esc(def.name)}</span>`).join('');
    return `<div class="achievement-grid">${list}</div><p class="fine">${s.achievements.length} / ${(A.ACHIEVEMENTS || []).length} earned this archive. The pub still answers to a few old words: type them anywhere on this terminal, once per phase.</p>`;
  }
  function policiesPanel() {
    const rows = [
      ['autopilot', 'Autopilot', 'Buys machines, lines, reforms and repairs every half second.'],
      ['autoResearch', 'Research autopilot', 'Authorises, tests and certifies prototypes when affordable.'],
      ['autoHearing', 'Hearing policy', s.policies.autoHearing === 'revise' ? 'Revisions by default: calm, expensive.' : 'Endorsements by default: cheap, loud.'],
      ['autoFire', 'Auto-fire volleys', 'Fires the wonder weapon the moment it is charged.'],
      ['autoField', 'Field autopilot', 'Keeps the exponential field up and lets it cool before blackout.'],
      ['autoRepair', 'Auto-repair', 'Repairs the capital and funds revisions without asking.'],
      ['autoVent', 'Auto-vent the pub', 'Vents the Silencer at 75% of capacity.'],
      ['autoCheck', 'Annex checks', 'Keeps filing prototype checks at The White Hart.'],
      ['autoDoctrine', 'Auto-doctrine', 'Declares Voss if no doctrine has been chosen.'],
    ];
    return `<div class="policy-list">${rows.map(([id, name, note]) => {
      const on = s.policies[id];
      const value = typeof on === 'boolean' ? (on ? 'ON' : 'OFF') : String(on).toUpperCase();
      return `<div class="policy-row"><div><strong>${esc(name)}</strong><span>${esc(note)}</span></div><button class="${on ? 'primary' : 'outline'}" type="button" data-action="policy" data-id="${id}">${value}</button></div>`;
    }).join('')}</div>`;
  }
  function dossier() {
    const sources = (LORE.INSPIRATIONS || []).map((entry) => `<article class="dossier-entry"><h3>${esc(entry.name)}</h3><span class="dossier-from">${esc(entry.from)}</span><p>${esc(entry.here)}</p></article>`).join('');
    const directives = (LORE.DIRECTIVES || []).map((d) => `<li><strong>${esc(d.n)}.</strong> ${esc(d.text)} <small>${esc(d.game)}</small></li>`).join('');
    return `<section class="panel dossier" aria-labelledby="dossier-title">
      <div class="panel-head"><div><span class="eyebrow">COMMAND ARCHIVE / BACKGROUND FILE</span><h2 id="dossier-title">What this war is made of</h2></div><span class="tag">ASIMOV-INSPIRED</span></div>
      <p>The Orion Campaign is an original story built from the furniture of Isaac Asimov’s fiction: an empire whose fall has become arithmetic, machines that cannot disobey their own ethics, a computer that has been asking one question since before we had charts, and a world where night arrives once every two thousand years. Nothing here is copied; everything here is in debt.</p>
      <div class="dossier-grid">${sources}</div>
      <h3 class="dossier-sub">The three directives, as printed on every Directorate machine</h3>
      <ol class="dossier-directives">${directives}</ol>
      <div class="toolbar"><button class="outline" type="button" data-action="intro">Replay the introduction</button><button class="outline" type="button" data-action="restart">Start a new forecast</button></div>
    </section>`;
  }
  function dispatchesView() {
    const entries = (s.log || []).map((entry, index) => {
      const text = typeof entry === 'string' ? entry : entry.text;
      const head = text.split('.')[0];
      return `<div class="dispatch"><span class="dispatch-icon">${index % 2 ? '▥' : '⌁'}</span><div><strong>${esc(head)}.</strong><p>${esc(text.split('.').slice(1).join('.'))}</p></div><time>${index === 0 ? 'LATEST' : 'ARCHIVE'}</time></div>`;
    }).join('');
    return `<section class="panel"><div class="panel-head"><h2>Classified correspondence</h2><span class="tag">${(s.log || []).length} RECORDS</span></div>${entries || '<p class="fine">Nothing has happened yet. It will.</p>'}
      <div class="toolbar"><button class="outline" type="button" data-action="intro">Replay the introduction</button><button class="outline" type="button" data-action="restart">Start a new forecast</button><button class="outline" type="button" data-view="white-hart">Walk over to The White Hart →</button></div>
    </section>
    <section class="panel"><div class="panel-head"><div><span class="eyebrow">COMMAND OS v.7.00 / AUTOMATION</span><h2>Policies</h2></div><span class="tag">${s.policies.autopilot ? 'AUTOPILOT ON' : 'MANUAL'}</span></div>${policiesPanel()}</section>
    <section class="panel"><div class="panel-head"><h2>Achievements</h2><span class="tag">${s.achievements.length} FOUND</span></div>${achievementsGrid()}</section>
    <section class="panel"><div class="panel-head"><h2>The twenty-four steps</h2><span class="tag">STEP ${s.step} / 24</span></div>
      <ol class="help-steps">${A.STEP_DEFS.map((def) => `<li class="${def.n < s.step ? 'done' : def.n === s.step ? 'current' : ''}"><strong>${String(def.n).padStart(2, '0')} · ${esc(def.title)}</strong><span>${esc(def.unlock)}</span></li>`).join('')}</ol>
    </section>
    ${dossier()}`;
  }

  const VIEWS = {
    headquarters: headquartersView,
    research: researchView,
    production: productionView,
    bridge: bridgeView,
    signal: signalView,
    dispatches: dispatchesView,
  };

  /* ------------------------------------------------------------- the pub */
  function roomDef(id) {
    const defs = (window.WH && window.WH.content && window.WH.content.ROOM_DEFS) || [];
    return defs.find((room) => room.id === id) || defs[0] || { id: 'general', name: 'General Bar', short: 'GENERAL', seats: 4, special: '', blurb: '' };
  }
  function patronLabel(index) {
    const table = (window.WH && window.WH.content && window.WH.content.PATRONS) || {};
    const keys = Object.keys(table).filter((key) => key !== 'ghost');
    const key = keys[index % Math.max(1, keys.length)];
    const entry = table[key] || { label: 'Regular', names: ['A Regular'] };
    const names = entry.names || ['A Regular'];
    return { label: entry.label, name: names[index % names.length] };
  }
  function pubFloor() {
    const d = A.derive(s);
    const pub = s.pub;
    const room = roomDef(ui.room);
    const open = Boolean(pub.rooms[room.id]);
    const roomCount = Object.keys(pub.rooms).length;
    const seats = open ? room.seats : 0;
    const crowd = Math.min(seats, Math.max(0, Math.round(d.patrons / Math.max(1, roomCount))));
    const pips = Array.from({ length: seats }, (_, index) => {
      const filled = index < crowd;
      const patron = patronLabel(index + roomCount);
      return `<span class="floor-patron ${filled ? 'seated' : ''}" title="${esc(filled ? patron.name : 'An empty chair')}"><i>${filled ? esc(patron.label.slice(0, 1)) : '·'}</i><b>${filled ? esc(patron.label.toUpperCase()) : 'EMPTY'}</b></span>`;
    }).join('');
    const machine = ui.room === 'general'
      ? `<div class="floor-machine ${d.absorption > 0 ? 'listening' : ''}"><span class="machine-lamp"></span><strong>THE FENTON SILENCER</strong><small>TIER ${roman(pub.tier)} · ${fmtRate(d.absorption)} dB / SEC</small><i class="machine-vent" style="width:${clamp(pub.noise, 0, 100)}%"></i></div>`
      : `<div class="floor-machine quiet"><span class="machine-lamp"></span><strong>THE APPARATUS HUMS THROUGH THE WALL</strong><small>HOUSED IN THE GENERAL BAR · ${Math.round(pub.noise)} dB IN THE CELLAR</small></div>`;
    return `<div class="floor-scene" data-room="${esc(room.id)}">
      <div class="floor-backdrop" aria-hidden="true"><span class="floor-lamp"></span><span class="floor-lamp"></span><span class="floor-rim"></span></div>
      <div class="floor-sign"><span>${esc(room.name.toUpperCase())}</span><small>${esc(open ? `${room.seats} SEATS · ${room.special}` : 'CLOSED — OPEN IT FROM THE ROOMS DOCK')}</small></div>
      <div class="floor-patrons">${pips || '<span class="floor-empty">The room is empty. Nothing here to absorb.</span>'}</div>
      ${machine}
      <div class="floor-counter" aria-hidden="true"><span class="floor-pump">🍺</span><span class="floor-counter-label">THE BAR · ${Math.round(d.pintsPerSec)} PINTS / SEC</span><span class="floor-taps">${'<i></i>'.repeat(5)}</span></div>
      ${crowd ? `<span class="floor-murmur">${esc(crowd)} patron${crowd === 1 ? '' : 's'} · ${fmtRate(d.noisePerSec)} dB incoming</span>` : ''}
    </div>`;
  }
  function renderRoomTabs() {
    const node = $('#room-tabs');
    if (!node) return;
    const open = Object.keys(s.pub.rooms);
    const perPage = 4;
    const pages = Math.max(1, Math.ceil(open.length / perPage));
    ui.roomPage = clamp(ui.roomPage, 0, pages - 1);
    const slice = open.slice(ui.roomPage * perPage, ui.roomPage * perPage + perPage);
    node.innerHTML = slice.map((id) => {
      const room = roomDef(id);
      return `<button class="room-page-tab ${id === ui.room ? 'selected' : ''}" type="button" data-room="${id}" title="${esc(room.special)}">${esc(room.short || room.name)}</button>`;
    }).join('') || '<span class="fine">No rooms open.</span>';
    const prev = $('#room-prev');
    const next = $('#room-next');
    if (prev) prev.disabled = ui.roomPage <= 0;
    if (next) next.disabled = ui.roomPage >= pages - 1;
  }
  function renderTourCard() {
    const orders = [
      { done: Boolean(s.pub.rooms.saloon), text: 'Open a second room — the Saloon Bar, 20 pints.' },
      { done: (s.pub.staff && Object.keys(s.pub.staff).length > 0), text: 'Hire someone. The barmaid pours when you are not looking.' },
      { done: s.totals.checks >= 1, text: 'File a prototype check: twelve seconds, one control pint.' },
      { done: (s.pub.upgrades && Object.keys(s.pub.upgrades).length > 0), text: 'Install something in the Silencer with Silence Energy.' },
      { done: s.pub.tier > 1, text: 'Improve the apparatus itself. Higher tiers absorb more.' },
    ];
    const done = orders.filter((order) => order.done).length;
    const count = $('#pub-tour-count');
    if (count) count.textContent = `${done} / ${orders.length}`;
    const list = $('#pub-tour-steps');
    if (list) {
      list.innerHTML = orders.map((order) => `<li class="${order.done ? 'done' : ''}"><span class="tour-tick">${order.done ? '✓' : '·'}</span>${esc(order.text)}</li>`).join('');
    }
    const eyebrow = $('#pub-tour-eyebrow');
    if (eyebrow) eyebrow.innerHTML = `${done === orders.length ? 'THE ANNEX IS RUNNING ITSELF' : 'THE ANNEX ORDERS'} <span class="heading-rule"></span>`;
    const title = $('#pub-tour-title');
    if (title) title.textContent = done === orders.length ? 'Nothing needs you.' : 'How an annex is run.';
  }
  function renderAnnexChecks() {
    const cost = { ip: Math.ceil(30 * Math.pow(1.4, s.totals.checks)), sp: Math.ceil(20 * Math.pow(1.3, s.totals.checks)) };
    const container = $('#annex-projects');
    if (container) {
      container.innerHTML = A.PROJECTS.map((project, index) => {
        const rec = s.research[index];
        const status = rec.state === 3 ? 'CERTIFIED' : rec.state === 2 ? 'ON THE BENCH' : rec.state === 1 ? 'BEING DRAWN' : 'NOT AUTHORISED';
        return `<article class="annex-project"><div class="annex-project-status">${status}</div><h3>${project.icon} ${esc(project.name)}</h3><p>${esc(project.flaw)}</p><span class="fine">${rec.tests}/2 field tests · ${esc(project.bonus)}</span></article>`;
      }).join('');
    }
    const running = $('#annex-running');
    if (running) {
      running.hidden = !s.pub.checking;
      if (s.pub.checking) {
        const name = $('#annex-trial-name');
        if (name) name.textContent = `PROTOTYPE CHECK ${s.pub.checks}`;
        const left = Math.max(0, 12 - s.pub.checkTimer);
        const seconds = $('#annex-seconds');
        if (seconds) seconds.textContent = `${left.toFixed(1)} / 12 seconds`;
        const bar = $('#annex-progress');
        if (bar) bar.value = clamp((s.pub.checkTimer / 12) * 100, 0, 100);
        const pint = $('#annex-pint');
        if (pint) pint.textContent = 'control pint poured and witnessed';
      }
    }
    const trial = $('#annex-stage-trial');
    if (trial) {
      trial.hidden = !s.pub.checking;
      const label = $('#annex-stage-label');
      if (label) label.textContent = s.pub.checking ? `CHECK ${s.pub.checks} · ${Math.max(0, 12 - s.pub.checkTimer).toFixed(1)}s` : '';
    }
    const link = $('#annex-link-state');
    if (link) link.textContent = `A check costs ${fmt(cost.ip)} IP and ${fmt(cost.sp)} SP · ${s.totals.checks} filed · the landlord witnesses everything.`;
    const message = $('#annex-message');
    if (message) {
      message.innerHTML = s.pub.checking
        ? 'The apparatus is taking readings. Nobody is to use the fruit machine.'
        : `<button class="primary" type="button" data-action="pub-check" ${s.ip < cost.ip || s.sp < cost.sp || s.step < 22 ? 'disabled' : ''}>FILE A PROTOTYPE CHECK · ${fmt(cost.ip)} IP / ${fmt(cost.sp)} SP</button>`;
    }
  }
  function renderPub(force = false) {
    if (!s) return;
    const d = A.derive(s);
    const pub = s.pub;
    const setText = (selector, value) => {
      const node = $(selector);
      if (node && node.textContent !== String(value)) node.textContent = value;
    };
    setText('#pub-pints', fmt(s.pints));
    setText('#pub-rate-pints', `+${fmtRate(d.pintsPerSec)} / sec`);
    setText('#pub-patrons', Math.round(d.patrons));
    setText('#pub-rate-patrons', `${Object.keys(pub.rooms).length} ROOMS`);
    setText('#pub-noise', Math.round(pub.noise));
    setText('#pub-rate-noise', `${fmtRate(d.noisePerSec)} dB / sec`);
    setText('#pub-se', fmt(s.se));
    setText('#pub-rate-se', `+${fmtRate(d.sePerSec)} / sec`);
    setText('#pub-checks', s.totals.checks);
    setText('#pub-rate-checks', s.pub.checking ? 'CHECK RUNNING' : 'ON THE BENCH');
    setText('#pub-staff-count', Object.keys(pub.staff || {}).length);
    setText('#pub-rate-tier', `TIER ${roman(pub.tier)}`);

    /* The meter: room noise, the thing that explodes. */
    const noisePct = clamp((pub.noise / Math.max(1, d.capacity)) * 100, 0, 100);
    setText('#energy-readout', Math.round(pub.noise));
    setText('#energy-capacity', Math.round(d.capacity));
    const percent = $('#energy-percent');
    if (percent) percent.innerHTML = `${Math.floor(noisePct)}<span>%</span>`;
    const fill = $('#energy-fill');
    if (fill) fill.style.width = `${noisePct}%`;
    const flow = $('#energy-flow');
    if (flow) {
      const net = d.noisePerSec - d.absorption * 0.8;
      flow.textContent = `${net >= 0 ? '+' : '−'}${fmtRate(Math.abs(net))} / sec · absorbing ${fmtRate(d.absorption)}`;
    }
    const track = $('.energy-track');
    if (track) track.setAttribute('aria-valuenow', String(Math.floor(noisePct)));
    const meter = $('#energy-card');
    if (meter) {
      meter.classList.remove('energy-70', 'energy-85', 'energy-95');
      if (noisePct >= 95) meter.classList.add('energy-95');
      else if (noisePct >= 85) meter.classList.add('energy-85');
      else if (noisePct >= 70) meter.classList.add('energy-70');
    }
    document.body.classList.toggle('energy-alert', noisePct >= 85);
    const status = $('#energy-status');
    if (status) {
      const copy = noisePct >= 95 ? ['⚠', 'TICK. TICK. TICK. VENT SOMETHING.']
        : noisePct >= 85 ? ['⚠', 'Smoke from the tubes. Someone asks if it is normal.']
          : noisePct >= 70 ? ['⚠', 'The tubes flicker. A faint, distinctly smug hum.']
            : !d.absorption ? ['◌', 'The Silencer is off. The noise is not being stored.']
              : ['✦', 'Comfortably below catastrophe.'];
      status.innerHTML = `<span class="warning-icon">${copy[0]}</span><span>${copy[1]}</span>`;
    }
    setText('#silencer-tier', `TIER ${roman(pub.tier)}`);
    setText('#silencer-name', `The ${d.tier.name}`);
    const absorption = $('#absorption-value');
    if (absorption) absorption.innerHTML = `${fmtRate(d.absorption)} <small>dB / sec</small>`;
    const ventRate = $('#vent-rate-value');
    if (ventRate) ventRate.innerHTML = `${fmtRate(pub.noise * 0.75 * d.ventPower)} <small>SE on vent</small>`;
    setText('#home-room', roomDef('general').name.toUpperCase());
    setText('#active-zones', `${Object.keys(pub.rooms).length} ACTIVE`);
    setText('#meter-tier-cap', `${fmt(d.capacity)} dB`);
    setText('#explosion-count', pub.explosions);
    const ventButton = $('#vent-button');
    if (ventButton) ventButton.disabled = pub.noise < 1;
    const dockVent = $('#dock-vent-button');
    if (dockVent) dockVent.disabled = pub.noise < 1;
    const dockCopy = $('#dock-vent-copy');
    if (dockCopy) dockCopy.textContent = `VENT ${Math.round(pub.noise)} dB`;

    /* Standing and the press. */
    const standing = clamp(pub.reputation, 0, 100);
    setText('#reputation-value', Math.round(standing));
    const repFill = $('#reputation-fill');
    if (repFill) {
      repFill.style.width = `${standing}%`;
      repFill.style.background = standing < 25 ? 'linear-gradient(90deg,#a63d35,#e06149)'
        : standing < 55 ? 'linear-gradient(90deg,#b27b43,#d1a34f)' : 'linear-gradient(90deg,#61794f,#bdad63)';
    }
    setText('#standing-copy', standing > 75 ? 'Beloved, if occasionally loud.'
      : standing > 45 ? 'The regulars have begun to compare notes.'
        : standing > 20 ? 'The neighbours have started a committee.' : 'The last regular has brought a suitcase.');
    setText('#press-tag', `THE WEATHER · ${d.weather.name}`);
    setText('#press-headline', `“${d.weather.note.replace(/\.$/, '')}.”`);
    setText('#press-copy', `Pints ×${d.weather.pints}, noise ×${d.weather.noise}, absorption ×${d.weather.se}. The weather turns every two and a half minutes, and the Silencer takes it personally. ${Object.keys(pub.staff || {}).length} staff on shift, ${Object.keys(pub.amenities || {}).length} amenities installed, ${fmt(s.pints)} pints behind the bar.`);
    setText('#scene-note', pub.noise >= d.capacity * 0.95 ? 'THE CELLAR IS SCREAMING' : d.absorption ? 'THE SILENCER IS LISTENING' : 'THE ROOM IS UNFILTERED');
    const open = s.step >= 22;
    setText('#open-status', !open ? 'SHUT · OPENS AT STEP 22'
      : pub.tier >= 4 ? 'OPEN, AND SLIGHTLY FAMOUS' : 'OPEN FOR THE EVENING');
    setText('#season-label', d.weather.name);
    setText('#weather-label', d.weather.name);
    setText('#door-status', open ? 'DOOR OPEN' : 'DOOR BARRED');
    const realm = $('#pub-realm');
    if (realm) realm.classList.toggle('not-yet-open', !open);
    const serve = $('#serve-button');
    if (serve) serve.title = open ? 'Pull a pint by hand' : 'The landlord is not serving until step 22.';
    const serveLabel = $('#serve-button-label');
    if (serveLabel) serveLabel.textContent = open ? 'PULL A PINT' : 'NOT SERVING YET';

    const deck = $('#pub-floor');
    if (deck) {
      const html = pubFloor();
      if (deck.dataset.sig !== html) {
        deck.innerHTML = html;
        deck.dataset.sig = html;
      }
    }
    renderRoomTabs();
    renderTourCard();
    renderAnnexChecks();
    const caption = $('#scene-caption');
    if (caption) {
      const line = !open ? 'The White Hart does not open until step 22. The landlord keeps the lamps low and the Silencer unplugged.'
        : pub.noise > d.capacity * 0.85 ? 'The apparatus has begun to hum in a key nobody likes. The landlord is watching the ceiling.'
        : s.pub.checking ? 'A prototype check is running. The landlord is timing it with a beer mat and a raised eyebrow.'
          : d.absorption > 0 ? 'The Silencer is listening. Somewhere under the floor, a valve turns by itself.'
            : 'The room is unfiltered and cheerful. The pipes are not doing anything, which somebody should fix.';
      if (caption.textContent !== line) caption.textContent = line;
    }
  }
  function pubShopTab(tab) {
    const titles = { rooms: 'Rooms', staff: 'Staff', amenities: 'Amenities', upgrades: 'The Silencer' };
    let body = '';
    if (tab === 'rooms') {
      const defs = (window.WH.content.ROOM_DEFS || []).filter((room) => !room.secret);
      body = defs.map((room) => {
        const open = Boolean(s.pub.rooms[room.id]);
        const cost = Math.ceil(room.cost * 0.4);
        return `<div class="shop-item ${open ? 'purchased' : ''}"><div class="shop-item-heading"><span class="shop-item-icon">🚪</span><div><strong>${esc(room.name)}</strong><span class="item-sub">${esc(room.special)} · ${room.seats} seats · ${esc(room.blurb || '')}</span></div></div>
          <div class="shop-item-foot"><span class="item-cost">${open ? 'OPEN' : `${fmt(cost)} PINTS`}</span>${open ? '<span class="item-status">✓</span>' : `<button class="primary" type="button" data-action="pub-room" data-id="${room.id}" ${s.pints < cost ? 'disabled' : ''}>OPEN THE ROOM</button>`}</div></div>`;
      }).join('');
    } else if (tab === 'staff' || tab === 'amenities') {
      const list = tab === 'staff' ? A.PUB_STAFF : A.PUB_AMENITIES;
      const owned = tab === 'staff' ? (s.pub.staff || {}) : (s.pub.amenities || {});
      const action = tab === 'staff' ? 'pub-staff' : 'pub-amenity';
      body = list.map((item) => {
        const has = Boolean(owned[item.id]);
        return `<div class="shop-item ${has ? 'purchased' : ''}"><div class="shop-item-heading"><span class="shop-item-icon">${tab === 'staff' ? '🎩' : '🪑'}</span><div><strong>${esc(item.name)}</strong><span class="item-sub">${esc(item.note)}</span></div></div>
          <div class="shop-item-foot"><span class="item-cost">${has ? 'ENGAGED' : `${fmt(item.cost)} PINTS`}</span>${has ? '<span class="item-status">✓</span>' : `<button class="primary" type="button" data-action="${action}" data-id="${item.id}" ${s.pints < item.cost ? 'disabled' : ''}>${tab === 'staff' ? 'HIRE' : 'INSTALL'}</button>`}</div></div>`;
      }).join('');
    } else {
      const nextTier = A.PUB_TIERS.find((tier) => tier.tier === s.pub.tier + 1);
      const tierCard = nextTier
        ? `<div class="shop-item"><div class="shop-item-heading"><span class="shop-item-icon">🔇</span><div><strong>Rebuild the Silencer · ${esc(nextTier.name)}</strong><span class="item-sub">${esc(nextTier.note)} · absorbs ${nextTier.absorption} dB / sec into a ${nextTier.capacity} dB shell</span></div></div>
            <div class="shop-item-foot"><span class="item-cost">${fmt(nextTier.pints)} PINTS + ${fmt(nextTier.se)} SE</span><button class="primary" type="button" data-action="pub-tier" ${s.pints < nextTier.pints || s.se < nextTier.se ? 'disabled' : ''}>REBUILD</button></div></div>`
        : '<div class="shop-item purchased"><div class="shop-item-heading"><span class="shop-item-icon">🔇</span><div><strong>Kendell-Proof</strong><span class="item-sub">There is nothing left to improve, which has never stopped the Directorate.</span></div></div></div>';
      const items = A.PUB_UPGRADES.map((item) => {
        const level = A.seUpgradeLevel(s, item.id);
        const cost = Math.ceil(item.cost * Math.pow(1.75, level));
        const maxed = level >= item.max;
        return `<div class="shop-item ${maxed ? 'purchased' : ''}"><div class="shop-item-heading"><span class="shop-item-icon">⚙</span><div><strong>${esc(item.name)} <em>${level}/${item.max}</em></strong><span class="item-sub">${esc(item.note)}</span></div></div>
          <div class="shop-item-foot"><span class="item-cost">${maxed ? 'INSTALLED' : `${fmt(cost)} SE`}</span>${maxed ? '<span class="item-status">✓</span>' : `<button class="primary" type="button" data-action="pub-upgrade" data-id="${item.id}" ${s.se < cost ? 'disabled' : ''}>INSTALL</button>`}</div></div>`;
      }).join('');
      body = tierCard + items;
    }
    openModal(`<div class="modal-tabs">${['rooms', 'staff', 'amenities', 'upgrades'].map((id) => `<button class="modal-tab ${id === tab ? 'selected' : ''}" type="button" data-tab="${id}">${titles[id]}</button>`).join('')}</div>
      <p class="modal-lede">${fmt(s.pints)} pints behind the bar · ${fmt(s.se)} Silence Energy in the cellar. Rooms open in pints; the machine itself is improved with Silence Energy.</p>
      <div class="shop-grid">${body}</div>
      <div class="modal-actions"><button class="text-button" type="button" data-action="close-modal">Back to the bar →</button></div>`,
    { kicker: 'THE WHITE HART / MANAGEMENT', title: titles[tab] });
  }

  /* ------------------------------------------------------------- dialogs */
  function helpModal() {
    openBriefing(`<h3>How to play</h3>
      <ul class="brief-list">
        <li><strong>Requisition.</strong> Press <kbd>Space</kbd> or the Requisition button. A quick run builds a cadence bonus.</li>
        <li><strong>Idle.</strong> Buy machines in Fleet &amp; Production. They bank industrial points every second, whether or not the terminal has your attention.</li>
        <li><strong>Twenty-four steps.</strong> The ladder on the left is the campaign. Each step completes the moment its order is met; nothing has to be claimed.</li>
        <li><strong>Research.</strong> Authorise the three prototypes; they draft and test themselves. Failures file hearings, and hearings are ruled by you or by policy.</li>
        <li><strong>Combat.</strong> Sorties run every six seconds. Formations, targeting and the field change the arithmetic; the wonder weapon waits for your hand or the autopilot.</li>
        <li><strong>The White Hart.</strong> Idle annex. Pints from patrons, noise from patrons, Silence Energy from noise. Spend it on rooms, staff, amenities and the machine itself.</li>
        <li><strong>Step 24</strong> is prestige only: take the Forecast, buy a remembrance, and open the next phase.</li>
        <li><strong>Offline.</strong> The archive settles up when you return, at 60% efficiency for up to eight hours.</li>
      </ul>
      <h3>The twenty-four steps</h3>
      <ol class="brief-steps">${A.STEP_DEFS.map((def) => `<li class="${def.n < s.step ? 'done' : def.n === s.step ? 'current' : ''}"><strong>${String(def.n).padStart(2, '0')} · ${esc(def.title)}</strong> <span>${esc(def.unlock)}</span></li>`).join('')}</ol>
      <p class="fine">Keys: <kbd>Space</kbd> requisition · <kbd>1</kbd>–<kbd>7</kbd> departments · <kbd>H</kbd> this briefing · <kbd>Esc</kbd> close. Some words still open the cellar.</p>`,
    { title: 'Command briefing', lede: 'Every mechanic in this war is a clicker or an idle machine.' });
  }
  function stepBriefing(stepNumber) {
    const def = A.stepDef(stepNumber);
    const state = stepNumber < s.step ? 'COMPLETE' : stepNumber === s.step ? 'CURRENT ORDER' : 'NOT YET OPEN';
    openBriefing(`<p class="modal-kicker">STEP ${String(stepNumber).padStart(2, '0')} · ${esc(def.kicker)}</p>
      <p><strong>${state}</strong></p>
      <p>${esc(def.copy)}</p>
      <p><b>${esc(def.unlock)}</b></p>
      <p class="fine">${esc(def.tip)}</p>`, { title: def.title });
  }
  function restartDialog() {
    openBriefing(`<p>Start a new forecast? The machines, the fleet, the research, the pub and the array are all abandoned. Forecast and remembrance survive, because that is what forecast is for.</p>
      <div class="toolbar"><button class="primary" type="button" data-action="restart-confirm">START A NEW FORECAST</button><button class="outline" type="button" data-action="close-dialog">KEEP THIS ONE</button></div>
      <p class="fine">Archive key: ${A.SAVE_KEY}</p>`, { title: 'Start a new forecast', lede: 'This cannot be undone, except by the Calculus, which keeps everything.' });
  }
  function prestigeDialog() {
    openBriefing(`<p>The corridor is won. Begin phase ${roman(s.phase + 1)} with <strong>+${A.prestigeGain(s)} Forecast</strong> and nothing else.</p>
      <ul class="gain-list">${A.prestigeBreakdown(s).map((row) => `<li><span>${esc(row.label)}</span><strong>+${row.value}</strong></li>`).join('')}</ul>
      <p class="fine">ENDING · ${esc(A.ending(s).title)} — ${esc(A.ending(s).copy)}</p>
      <div class="toolbar"><button class="primary" type="button" data-action="prestige-confirm">RECALCULATE THE CALCULUS ✦</button><button class="outline" type="button" data-action="close-dialog">NOT YET</button></div>`,
    { title: 'Recalculate the Calculus', lede: 'Prestige is the only order at step 24.' });
  }
  function reckoningIntro() {
    return `<p>Step 24 is the reckoning, and it is the only order left. Every other department is closed: no machines, no research, no war, no pub. The Calculus is asking for an estimate of you.</p>
      <p>Take the Forecast, and spend it on remembrance — or hold it, and let it work. Then begin again at step 01 with everything you have learned.</p>
      <p class="fine">Forecast is paid for the phase, the industrial total, the hulls destroyed, the silence collected, the checks filed, the certifications, the rooms opened, the doctrine and the answer you gave the array.</p>
      <div class="toolbar"><button class="primary" type="button" data-action="close-dialog">SEE THE RECKONING</button></div>`;
  }
  function offlineDialog() {
    const report = s.offlineReport;
    if (!report) return;
    const hours = report.seconds / 3600;
    openBriefing(`<p>The archive was left alone for <strong>${hours >= 1 ? `${hours.toFixed(1)} hours` : `${Math.round(report.seconds / 60)} minutes`}</strong>. The machines kept working at ${Math.round(report.efficiency * 100)}% efficiency, which is the rate the Calculus charges for optimism.</p>
      <ul class="gain-list">
        <li><span>industrial points</span><strong>+${fmt(report.ip)}</strong></li>
        <li><span>science</span><strong>+${fmt(report.sp)}</strong></li>
        <li><span>hulls destroyed</span><strong>+${fmtInt(report.kills || 0)}</strong></li>
        <li><span>annex checks</span><strong>+${fmtInt(report.checks || 0)}</strong></li>
      </ul>
      <p class="fine">Sleeping Forecast raises the efficiency and the cap. The archive is local to this browser.</p>
      <div class="toolbar"><button class="primary" type="button" data-action="close-dialog">BACK TO THE TERMINAL</button></div>`,
    { title: 'While you were away', lede: 'The Long Forecast filed a report.' });
  }
  function openPubBriefing() {
    const intro = $('#pub-intro');
    if (!intro) return;
    intro.innerHTML = `<div class="pub-intro-inner"><p class="pub-intro-kicker">THE RESEARCH DIRECTORATE'S LOCAL SINCE BEFORE THE WAR</p>
      <h2>The White Hart is an idle department now.</h2>
      <p>Patrons arrive by themselves and are served by themselves. The room gets louder; the Silencer takes the noise and turns it into <strong>Silence Energy</strong>. Vent before the cellar fills, spend SE on the machine, spend pints on rooms, staff and amenities.</p>
      <p>Prototype checks still happen here — twelve seconds, one control pint, witnessed by the landlord.</p>
      <div class="pub-intro-actions"><button class="primary" type="button" data-action="close-pub-intro">WALK IN →</button></div></div>`;
    intro.hidden = false;
  }
  function showPrologue(page = 0) {
    const pages = LORE.PROLOGUE || [];
    const root = $('#prologue');
    if (!root) return;
    if (!pages.length) { closePrologue(); return; }
    const index = clamp(page, 0, pages.length - 1);
    ui.introPage = index;
    const entry = pages[index];
    root.innerHTML = `<div class="prologue-inner">
      <p class="prologue-kicker"><span>${esc(entry.kicker)}</span><span class="prologue-count">${index + 1} / ${pages.length}</span></p>
      <h2 class="prologue-title">${esc(entry.title)}</h2>
      ${(entry.body || []).map((para) => `<p class="prologue-line">${esc(para)}</p>`).join('')}
      <p class="prologue-sign">— ${esc(entry.sign)}</p>
      <div class="prologue-actions">
        <button class="primary" type="button" data-action="intro-next">${index >= pages.length - 1 ? 'BEGIN THE FORECAST →' : 'NEXT PAGE →'}</button>
        <button class="ghost-link" type="button" data-action="intro-skip">SKIP THE BRIEFING</button>
      </div>
      <div class="prologue-dots">${pages.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</div>
    </div>`;
    root.hidden = false;
  }
  function closePrologue() {
    const root = $('#prologue');
    if (root) {
      root.hidden = true;
      root.innerHTML = '';
    }
    if (s) {
      s.seen.intro = true;
      A.save(s);
    }
  }

  /* ------------------------------------------------------------- actions */
  function handleAction(action, id, amount) {
    if (!action) return;
    switch (action) {
      case 'help': return helpModal();
      case 'close-dialog': return closeBriefing();
      case 'close-modal': return closeModal();
      case 'sound': return toggleSound();
      case 'fullscreen': return toggleFullscreen();
      case 'intro': return showPrologue(0);
      case 'intro-next': {
        const pages = LORE.PROLOGUE || [];
        if (ui.introPage + 1 >= pages.length) return closePrologue();
        return showPrologue(ui.introPage + 1);
      }
      case 'intro-skip': return closePrologue();
      case 'close-pub-intro': {
        const intro = $('#pub-intro');
        if (intro) intro.hidden = true;
        return undefined;
      }
      case 'restart': return restartDialog();
      case 'restart-confirm': {
        A.reset();
        s = A.newGame();
        heard = new Set();
        lastStep = s.step;
        lastExplosions = 0;
        closeBriefing();
        closeModal();
        setView('headquarters');
        flash('A new forecast begins. The Calculus has kept your remembrance.');
        showPrologue(0);
        return undefined;
      }
      case 'prestige': return prestigeDialog();
      case 'prestige-confirm': {
        const result = A.act(s, 'prestige');
        if (!result.ok) { closeBriefing(); flash(result.msg); return undefined; }
        s = result.state;
        heard = new Set();
        lastStep = s.step;
        closeBriefing();
        signature = '';
        setView('headquarters');
        chime();
        toast(`PHASE ${roman(s.phase)} BEGINS`, result.msg, 9000);
        return undefined;
      }
      case 'replay-intro':
      case 'intro-replay': return showPrologue(0);
      case 'dismiss-event': break;
      default: break;
    }
    let payload = id;
    if (action === 'hearing') {
      const [index, choice] = String(id || '0:revise').split(':');
      payload = { index: Number(index), choice };
    }
    if (action === 'buy') {
      const result = A.act(s, 'buy', id, amount);
      apply(result);
      return;
    }
    const result = A.act(s, action, payload);
    apply(result);
    if (result && result.ok) {
      if (action === 'volley') beep(300, 0.18, 'sawtooth', 0.05);
      if (action === 'pour') beep(520, 0.05, 'triangle', 0.02);
      if (action === 'egg') {
        const words = A.EGGS || [];
        const egg = words.find((entry) => entry.word === id);
        if (egg) toast(egg.title, egg.line, 8000);
      }
    }
  }
  function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem('as-idle-sound', soundOn ? 'on' : 'off'); } catch (_) { /* ignore */ }
    const button = $('#sound-button');
    const icon = $('#sound-icon');
    if (button) button.classList.toggle('active', soundOn);
    if (icon) icon.textContent = soundOn ? '♫' : '◖';
    if (soundOn) beep(660, 0.08, 'sine', 0.04);
    flash(soundOn ? 'Sound on. The terminal has opinions about it.' : 'Sound off.');
  }
  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    } catch (_) { flash('Fullscreen is not available in this browser.'); }
  }

  /* ----------------------------------------------------------------- input */
  function bind() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const closer = target.closest('[data-close-modal]');
      if (closer) { closeModal(); return; }
      if (target.closest('#modal-close')) { closeModal(); return; }
      if (target.closest('#close-dialog')) { closeBriefing(); return; }
      if (target.closest('#toast-close')) {
        const root = $('#toast');
        if (root) { root.classList.remove('show'); root.hidden = true; }
        return;
      }
      if (target.closest('#crisis-button') || target.closest('#crisis-screen')) { closeCrisis(); return; }

      const tab = target.closest('[data-tab]');
      if (tab) { pubShopTab(tab.dataset.tab); return; }
      const room = target.closest('[data-room]');
      if (room) {
        ui.room = room.dataset.room;
        if (!s.pub.rooms[ui.room]) ui.room = Object.keys(s.pub.rooms)[0] || 'general';
        renderPub(true);
        return;
      }
      if (target.closest('#room-prev')) {
        ui.roomPage = Math.max(0, ui.roomPage - 1);
        renderRoomTabs();
        return;
      }
      if (target.closest('#room-next')) {
        ui.roomPage += 1;
        renderRoomTabs();
        return;
      }
      const stepBtn = target.closest('[data-step]');
      if (stepBtn) { stepBriefing(Number(stepBtn.dataset.step)); return; }
      const viewButton = target.closest('[data-view]');
      if (viewButton) { setView(viewButton.dataset.view); return; }
      const system = target.closest('[data-system]');
      if (system) {
        ui.mapSelection = Number(system.dataset.system);
        signature = '';
        renderAll(true);
        return;
      }
      const buy = target.closest('[data-buy]');
      if (buy) { handleAction('buy', buy.dataset.buy, buy.dataset.amount || '1'); return; }
      const actionEl = target.closest('[data-action]');
      if (actionEl) {
        if (actionEl.disabled) return;
        handleAction(actionEl.dataset.action, actionEl.dataset.id, actionEl.dataset.amount);
        return;
      }
      if (target.closest('#requisition')) { handleAction('click'); return; }
      if (target.closest('#serve-button')) { handleAction('pour'); return; }
      if (target.closest('#vent-button') || target.closest('#dock-vent-button')) { handleAction('pub-vent'); return; }
      if (target.closest('#upgrade-button')) { pubShopTab('upgrades'); return; }
      if (target.closest('#shop-button')) { pubShopTab('rooms'); return; }
      if (target.closest('#staff-button')) { pubShopTab('staff'); return; }
      if (target.closest('#amenities-button')) { pubShopTab('amenities'); return; }
      if (target.closest('[data-annex-jump]')) { pubShopTab('upgrades'); return; }
      if (target.closest('#help-button') || target.closest('#help')) { handleAction('help'); return; }
      if (target.closest('#restart-button') || target.closest('#restart-menu')) { handleAction('restart'); return; }
      if (target.closest('#sound-button')) { handleAction('sound'); return; }
      if (target.closest('#fullscreen-toggle')) { handleAction('fullscreen'); return; }
      if (target.closest('#journal-button')) { setView('dispatches'); return; }
    });

    document.addEventListener('keydown', (event) => {
      const tag = event.target && event.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (event.key === 'Escape') {
        if (modalOpen()) { closeModal(); return; }
        if (briefingOpen()) { closeBriefing(); return; }
        const intro = $('#pub-intro');
        if (intro && !intro.hidden) { intro.hidden = true; return; }
        return;
      }
      if (briefingOpen() || modalOpen() || !$('#prologue').hidden) return;
      if (event.code === 'Space') {
        event.preventDefault();
        handleAction('click');
        return;
      }
      if (/^[1-7]$/.test(event.key)) {
        setView(VIEW_ORDER[Number(event.key) - 1]);
        return;
      }
      if (event.key === 'h' || event.key === 'H' || event.key === '?') {
        helpModal();
        return;
      }
      if (/^[a-z0-9]$/i.test(event.key)) {
        eggBuffer = (eggBuffer + event.key.toLowerCase()).slice(-24);
        const hit = (A.EGGS || []).find((egg) => eggBuffer.endsWith(egg.word));
        if (hit) {
          eggBuffer = '';
          const result = A.act(s, 'egg', hit.word);
          if (result.ok) {
            toast(hit.title, hit.line, 9000);
            beep(680, 0.12, 'sine', 0.03);
            renderAll(true);
          }
        }
      }
    });

    window.addEventListener('beforeunload', () => { if (s) A.save(s); });
    document.addEventListener('visibilitychange', () => { if (s && document.hidden) A.save(s); });
    window.addEventListener('resize', () => { signature = ''; renderAll(true); });
  }

  /* ------------------------------------------------------------- rendering */
  function renderCampaign(force = false) {
    const node = $('#view');
    if (!node) return;
    const build = VIEWS[view] || VIEWS.headquarters;
    const sig = `${view}|${s.step}|${Math.round(Math.log10(1 + s.ip) * 6)}|${Math.round(Math.log10(1 + s.sp) * 6)}|${Math.round(Math.log10(1 + s.pc) * 6)}|${Math.floor(s.fleet.ships)}|${Math.floor(s.fleet.enemy)}|${Math.round(s.fleet.reliability)}|${Math.round(s.fleet.chaos)}|${Math.round(s.fleet.capital)}|${Math.round(s.fleet.unrest)}|${s.lines}|${s.research.map((rec) => rec.state + (rec.tests || 0)).join('')}|${s.hearings.length}|${s.signal.fragments}${s.signal.choice}|${Object.keys(s.pub.rooms).length}|${s.pub.tier}|${s.policies.autopilot ? 1 : 0}|${s.policies.autoResearch ? 1 : 0}|${s.policies.autoHearing}|${ui.mapSelection}|${s.forecast}|${s.up && Object.keys(s.up).length}|${s.achievements.length}|${(s.log || []).length}|${s.fleet.field ? 1 : 0}${s.fleet.analyzer}|${s.fleet.focus}|${s.fleet.doctrine}|${s.event.id}|${Math.floor(s.up ? Object.values(s.up).reduce((a, b) => a + b, 0) : 0)}|${s.prestiges}|${s.fleet.ceded ? 1 : 0}`;
    if (!force && sig === signature) return;
    signature = sig;
    const active = document.activeElement;
    const focus = active && node.contains(active) ? { action: active.dataset.action, id: active.dataset.id, buy: active.dataset.buy } : null;
    node.innerHTML = build();
    if (focus && (focus.action || focus.buy)) {
      const selector = focus.buy
        ? `[data-buy="${focus.buy}"]`
        : `[data-action="${focus.action}"]${focus.id !== undefined ? `[data-id="${focus.id}"]` : ''}`;
      const again = node.querySelector(selector);
      if (again) again.focus({ preventScroll: true });
    }
  }
  function renderAll(force = false) {
    if (!s) return;
    renderCycle();
    renderResources();
    renderStepTrack();
    renderBadges();
    renderMission();
    if (view === 'white-hart') renderPub(force);
    else renderCampaign(force);
    const saveLabel = $('#save-status');
    if (saveLabel) saveLabel.textContent = 'LOCAL ARCHIVE ACTIVE';
  }

  /* ------------------------------------------------------------------ loop */
  function frame(now) {
    window.requestAnimationFrame(frame);
    if (!s) return;
    const raw = Math.max(0, (now - lastFrame) / 1000);
    lastFrame = now;
    if (raw > 0) {
      if (raw > 3) {
        let remaining = Math.min(raw, 300);
        while (remaining > 0) {
          const chunk = Math.min(1, remaining);
          A.tick(s, chunk);
          remaining -= chunk;
        }
      } else {
        A.tick(s, raw);
      }
    }
    stepChanged();
    achievementCheck();
    explosionCheck();
    momentWatch();
    renderAll(false);
    saveClock += raw;
    if (saveClock >= 5) {
      saveClock = 0;
      A.save(s);
    }
  }

  /* ------------------------------------------------------------------ boot */
  function boot() {
    s = A.load() || A.newGame();
    heard = new Set(s.achievements || []);
    lastStep = s.step;
    lastExplosions = s.pub.explosions || 0;
    const hash = (window.location.hash || '').replace('#', '');
    if (TITLES[hash]) view = hash;
    if (s.step >= 24) view = 'headquarters';
    if (view === 'white-hart') openPub();
    const soundButton = $('#sound-button');
    const soundIcon = $('#sound-icon');
    if (soundButton) soundButton.classList.toggle('active', soundOn);
    if (soundIcon) soundIcon.textContent = soundOn ? '♫' : '◖';
    bind();
    renderAll(true);
    window.requestAnimationFrame((time) => {
      lastFrame = time;
      window.requestAnimationFrame(frame);
    });
    if (s.offlineReport) {
      offlineDialog();
    } else if (!s.seen.intro) {
      showPrologue(0);
    }
    if (s.step >= 22 && !s.seen.pubIntro) {
      s.seen.pubIntro = true;
      openPubBriefing();
    }
    A.save(s);
  }

  window.ASIdleUI = {
    get state() { return s; },
    get view() { return view; },
    render: () => renderAll(true),
    renderPub,
    setView,
    handleAction,
    pubShopTab,
    openModal,
    closeModal,
    openBriefing,
    closeBriefing,
    showPrologue,
    boot,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
