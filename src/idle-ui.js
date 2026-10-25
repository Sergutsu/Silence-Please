/* Absolute Superiority — the idle terminal.
   Rendering, input and the presentation of the twenty-four steps. */
(() => {
  'use strict';
  const A = window.ASIdle;
  if (!A) return;
  const fmt = A.fmt;
  const fmtInt = A.fmtInt;
  const fmtRate = A.fmtRate;
  const esc = (text) => String(text).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const roman = (n) => ROMAN[n] || String(n);

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  let s = null;
  let lastFrame = performance.now();
  let saveClock = 0;
  let renderAt = 0;
  let audio = null;
  let soundOn = false;
  let ui = { open: {}, floatTimer: 0 };
  let eggBuffer = '';
  const cardHtml = new WeakMap();

  try { soundOn = localStorage.getItem('as-idle-sound') === 'on'; } catch (_) { soundOn = false; }

  /* ---------------------------------------------------------------- sound */
  function beep(freq = 420, duration = 0.06, type = 'triangle', gain = 0.035) {
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
    [523, 659, 784].forEach((freq, i) => {
      setTimeout(() => beep(freq, 0.16, 'sine', 0.04), i * 90);
    });
  }

  /* --------------------------------------------------------------- helpers */
  function btn(action, id, label, opts = {}) {
    const { cls = '', amount = '', disabled = false, title = '', focus = '' } = opts;
    const key = focus || `${action}:${id || ''}:${amount}`;
    return `<button type="button" class="btn ${cls}" data-action="${action}"${
      id !== undefined && id !== null && id !== '' ? ` data-id="${esc(id)}"` : ''
    }${amount !== '' ? ` data-amount="${esc(amount)}"` : ''}${disabled ? ' disabled' : ''} data-focus="${esc(key)}"${
      title ? ` title="${esc(title)}"` : ''
    }>${label}</button>`;
  }

  function meter(value, max, cls = '') {
    const width = clampPercent((value / (max || 1)) * 100);
    return `<span class="meter ${cls}"><i style="width:${width}%"></i></span>`;
  }
  function clampPercent(value) {
    return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  }

  function cardHead(kicker, title, note = '') {
    return `<div class="card-head"><div><p class="eyebrow">${kicker}</p><h2>${title}</h2>${note ? `<p class="card-note">${note}</p>` : ''}</div></div>`;
  }

  function setHTML(node, html) {
    if (!node) return;
    if (cardHtml.get(node) === html) return;
    cardHtml.set(node, html);
    const active = document.activeElement;
    const focusKey = active && active.dataset ? active.dataset.focus : null;
    node.innerHTML = html;
    if (focusKey) {
      const next = node.querySelector(`[data-focus="${focusKey.replace(/"/g, '\\"')}"]`);
      if (next) next.focus({ preventScroll: true });
    }
  }

  function stepOf() { return A.stepDef(s.step); }

  function showCard(id, visible) {
    const node = document.getElementById(id);
    if (node) node.hidden = !visible;
  }

  /* ---------------------------------------------------------------- render */
  function renderResources() {
    const d = A.derive(s);
    const chips = [
      { id: 'ip', label: 'INDUSTRIAL', value: s.ip, rate: d.ipPerSec, unit: 'IP', icon: '▥' },
      { id: 'sp', label: 'SCIENTIFIC', value: s.sp, rate: d.spPerSec, unit: 'SP', icon: '⚛' },
      { id: 'pc', label: 'POLITICAL', value: s.pc, rate: d.pcPerSec, unit: 'PC', icon: '⚑' },
    ];
    if (s.step >= 22) {
      chips.push({ id: 'se', label: 'SILENCE', value: s.se, rate: d.sePerSec, unit: 'SE', icon: '🔇' });
      chips.push({ id: 'pints', label: 'PINTS', value: s.pints, rate: d.pintsPerSec, unit: 'PT', icon: '🍺' });
    }
    chips.push({ id: 'forecast', label: 'FORECAST', value: s.forecast, rate: null, unit: '', icon: '✦' });
    const html = chips.map((chip) => `
      <div class="chip chip-${chip.id}" title="${chip.label}">
        <span class="chip-icon" aria-hidden="true">${chip.icon}</span>
        <div><span class="chip-label">${chip.label}</span><strong>${fmt(chip.value)}<small> ${chip.unit}</small></strong></div>
        ${chip.rate !== null ? `<span class="chip-rate">+${fmtRate(chip.rate)}/s</span>` : `<span class="chip-rate">×${(A.forecastMult(s)).toFixed(2)}</span>`}
      </div>`).join('');
    setHTML($('#resources'), html);
    const railForecast = $('#rail-forecast');
    if (railForecast) railForecast.textContent = fmt(s.forecast);
    const phase = $('#phase-label');
    if (phase) phase.textContent = roman(s.phase);
  }

  function renderRail() {
    const html = A.STEP_DEFS.map((def) => {
      const done = def.n < s.step;
      const current = def.n === s.step;
      const info = current ? A.stepInfo(s) : null;
      return `<li class="rail-step ${done ? 'done' : ''} ${current ? 'current' : ''} ${def.n > s.step ? 'locked' : ''}">
        <span class="rail-num">${done ? '✓' : String(def.n).padStart(2, '0')}</span>
        <span class="rail-title">${esc(def.title)}</span>
        ${current ? `<span class="rail-progress">${Math.round(info.progress * 100)}%</span>` : ''}
      </li>`;
    }).join('');
    setHTML($('#step-rail'), html);
  }

  function renderMoment() {
    const node = $('#moment');
    if (!node) return;
    const def = A.MOMENTS.find((moment) => moment.id === s.event.id);
    if (!def) { node.hidden = true; node.innerHTML = ''; return; }
    node.hidden = false;
    const left = Math.max(0, Math.ceil(s.event.until - s.runSeconds));
    setHTML(node, `<div class="moment-copy"><span class="eyebrow">A MOMENT IN THE FORECAST · ${left}s</span><strong>${esc(def.title)}</strong><p>${esc(def.copy)}</p></div>${btn('dismiss-event', '', `✧ ${esc(def.cta)}`, { cls: 'primary', focus: 'moment' })}`);
  }

  function renderStep() {
    const info = A.stepInfo(s);
    const def = info.def;
    const next = A.stepDef(Math.min(24, s.step + 1));
    const done = info.done;
    const goalLine = `${fmt(info.goal.value)}${info.goal.target ? ` / ${fmt(info.goal.target)}` : ''}`;
    const html = `
      <div class="step-top">
        <div class="step-kicker">
          <span class="step-count">STEP ${String(s.step).padStart(2, '0')} <small>/ 24</small></span>
          <span class="eyebrow">${esc(def.kicker)}</span>
        </div>
        <div class="step-phase">PHASE ${roman(s.phase)} · ${esc(def.title.toUpperCase())}</div>
      </div>
      <h2 class="step-title">${esc(def.title)}</h2>
      <p class="step-copy">${esc(def.copy)}</p>
      <div class="step-unlock"><span class="unlock-icon" aria-hidden="true">✧</span><p>${esc(def.unlock)}</p></div>
      <div class="step-goal">
        <div class="goal-head"><span class="eyebrow">THE ORDER OF THIS STEP</span><strong>${esc(info.goal.label)}</strong><span class="goal-numbers">${goalLine}</span></div>
        <div class="goal-track${done ? ' complete' : ''}"><i style="width:${clampPercent(info.progress * 100)}%"></i></div>
        <div class="goal-foot"><span>${done ? '✓ order complete — the next step opens' : esc(info.goal.extra || 'keep the machines running')}</span><span>${Math.round(info.progress * 100)}%</span></div>
      </div>
      <div class="step-tip"><span>FIELD NOTE</span><p>${esc(def.tip)}</p></div>
      ${s.step < 24 ? `<p class="step-next">NEXT: <strong>${String(s.step + 1).padStart(2, '0')} · ${esc(next.title)}</strong> — ${esc(next.unlock)}</p>` : '<p class="step-next reckoning">THE RECKONING IS THE ONLY ORDER.</p>'}
    `;
    setHTML($('#step-card'), html);
  }

  function renderAction() {
    const info = A.stepInfo(s);
    const d = info.d;
    const combo = Math.min(3, 1 + 0.06 * s.click.streak);
    const last = s.runSeconds - s.click.lastAt < 1.25 ? combo : 1;
    const showStudy = s.step >= 3;
    const showLobby = s.step >= 4;
    const html = `
      ${cardHead('THE WORKING KEY', 'Requisition', 'Industrial points are the only language the frontier respects.')}
      <div class="click-zone">
        <button type="button" class="click-button" data-action="click" data-focus="click-zone" aria-label="Requisition industrial points">
          <span class="click-glyph" aria-hidden="true">⛭</span>
          <span class="click-label">REQUISITION</span>
          <span class="click-power">+${fmt(d.clickPower)} <small>IP</small></span>
          <span class="click-hint">SPACE</span>
        </button>
        <div class="click-side">
          <div class="combo ${last > 1.5 ? 'hot' : ''}">
            <span class="eyebrow">CADENCE</span>
            <strong>×${last.toFixed(2)}</strong>
            <span class="combo-track"><i style="width:${clampPercent(((last - 1) / 2) * 100)}%"></i></span>
            <small>${last > 2.5 ? 'THE CLERK IS IMPRESSED' : last > 1.5 ? 'KEEP THE RHYTHM' : 'CLICK TO BUILD CADENCE'}</small>
          </div>
          <div class="click-facts">
            <div><span>TOTAL IMPRESSIONS</span><strong>${fmtInt(s.totals.clicks)}</strong></div>
            <div><span>AUTOMATIC</span><strong>${fmtRate(d.autoClicks)}/s</strong></div>
          </div>
          ${showStudy || showLobby ? `<div class="manual-actions">
            ${showStudy ? btn('study', '', `<span>⚛</span> COMMISSION STUDY`, { cls: 'ghost', focus: 'study' }) : ''}
            ${showLobby ? btn('lobby', '', `<span>⚑</span> LOBBY (15 IP)`, { cls: 'ghost', focus: 'lobby' }) : ''}
          </div>` : ''}
        </div>
      </div>`;
    setHTML($('#action-card'), html);
  }

  function machineRow(def, owned, store, unlocked) {
    const cost = A.bulkCost(def, owned, 1);
    const canOne = s.ip >= cost;
    const canMax = s.ip >= A.bulkCost(def, owned, 1);
    const maxCount = A.maxAffordable(def, owned, s.ip);
    return `<div class="machine ${canOne ? '' : 'poor'}">
      <div class="machine-icon" aria-hidden="true">${def.icon}</div>
      <div class="machine-main">
        <div class="machine-title"><strong>${esc(def.name)}</strong><span class="owned">×${fmtInt(owned)}</span></div>
        <p>${esc(def.note)}</p>
        <div class="machine-facts"><span>+${fmtRate(def.base)} ${store === 'gens' ? 'IP' : store === 'labs' ? 'SP' : 'PC'}/s each</span><span class="machine-cost">${fmt(cost)} IP</span></div>
      </div>
      <div class="machine-buy">
        ${btn('buy', def.id, '×1', { amount: '1', cls: 'buy', disabled: !canOne, focus: `buy:${def.id}:1` })}
        ${btn('buy', def.id, '×10', { amount: '10', cls: 'buy small', disabled: s.ip < A.bulkCost(def, owned, 10), focus: `buy:${def.id}:10` })}
        ${btn('buy', def.id, maxCount > 0 ? `MAX ${maxCount}` : 'MAX', { amount: 'max', cls: 'buy small', disabled: !canMax, focus: `buy:${def.id}:max` })}
      </div>
      ${unlocked ? '' : '<span class="locked-tag">LOCKED</span>'}
    </div>`;
  }

  function renderBuild() {
    const groups = [
      { key: 'gens', title: 'INDUSTRY', note: 'Machines that bank industrial points every second.', list: A.GENS, icon: '▥' },
      { key: 'labs', title: 'SCIENCE', note: 'Chalkboards with a measurable output. Costs industrial points.', list: A.LABS, icon: '⚛' },
      { key: 'cons', title: 'AUTHORITY', note: 'Offices that turn patience into political capital.', list: A.CONS, icon: '⚑' },
    ];
    const machines = groups.map((group) => {
      const rows = group.list.map((def) => {
        const owned = s[group.key][def.id] || 0;
        if (s.step < def.step && owned === 0) return '';
        return machineRow(def, owned, group.key, true);
      }).join('');
      if (!rows) return '';
      return `<div class="machine-group"><div class="group-head"><span class="eyebrow">${group.icon} ${group.title}</span><span>${esc(group.note)}</span></div>${rows}</div>`;
    }).join('');

    const upgrades = A.UPGRADES.filter((def) => s.step >= def.step).map((def) => {
      const level = A.upgradeLevel(s, def.id);
      const maxed = level >= def.max;
      const cost = A.upgradeCost(def, level);
      return `<div class="upgrade ${maxed ? 'maxed' : ''}">
        <div class="upgrade-main"><strong>${esc(def.name)}</strong><span>${esc(def.note)}</span></div>
        <span class="upgrade-level">${level}/${def.max}</span>
        ${maxed ? '<span class="done-tag">INSTALLED</span>' : btn('upgrade', def.id, `${fmt(cost)} IP`, { cls: 'buy small', disabled: s.ip < cost, focus: `upgrade:${def.id}` })}
      </div>`;
    }).join('');

    const html = `
      ${cardHead('THE BUILD QUEUE', 'Machines & Reforms', 'Everything here runs while you are not looking. That is the point of it.')}
      ${machines || '<p class="empty">No machines yet. Press the key until the clerk notices.</p>'}
      ${upgrades ? `<div class="upgrade-block"><div class="group-head"><span class="eyebrow">⚙ PERMANENT REFORMS</span><span>One purchase, forever within the phase.</span></div>${upgrades}</div>` : ''}
    `;
    setHTML($('#build-card'), html);
  }

  function stat(label, value, note = '', cls = '') {
    return `<div class="stat ${cls}"><span>${label}</span><strong>${value}</strong>${note ? `<small>${note}</small>` : ''}</div>`;
  }

  function renderFleet() {
    const d = A.derive(s);
    const f = s.fleet;
    const lineCost = Math.ceil(400 * Math.pow(1.85, s.lines));
    const html = `
      ${cardHead('THE ORION MARCHES', 'The Fleet', 'Identical hulls, interchangeable bolts, no interesting decisions.')}
      <div class="stat-grid">
        ${stat('CRUISERS', Math.floor(f.ships).toLocaleString('en-GB'), `${fmtRate(d.shipPerSec)} built / sec`)}
        ${stat('RELIABILITY', `${f.reliability.toFixed(0)}%`, f.reliability < 50 ? 'DEGRADING' : 'OPERATIONAL', f.reliability < 50 ? 'warn' : '')}
        ${stat('CHAOS', `${f.chaos.toFixed(0)}%`, f.chaos > 30 ? 'SPECIFICATION DRIFT' : 'MANAGEABLE', f.chaos > 30 ? 'warn' : '')}
        ${stat('CAPITAL', `${f.capital.toFixed(0)}%`, f.crisis ? 'EMERGENCY' : f.capital < 60 ? 'BREACHED' : 'HOLDING', f.crisis || f.capital < 60 ? 'warn' : '')}
        ${stat('UNREST', `${f.unrest.toFixed(0)}%`, f.mutiny ? 'MUTINY' : 'THE ADMIRALS', f.mutiny || f.unrest > 60 ? 'warn' : '')}
        ${stat('ENEMY HULLS', Math.max(0, Math.floor(f.enemy)).toLocaleString('en-GB'), f.enemy > 0 ? 'IN THE CORRIDOR' : 'CORRIDOR CLEAR')}
        ${stat('CRUISER LINES', `${s.lines} / 8`, `${fmtRate(d.shipPerSec)} ships / sec`, '')}
        ${stat('FIREPOWER', fmt(d.combatPower), `ENEMY ${fmt(d.enemyPower)}`, '')}
      </div>
      <div class="control-block">
        <span class="eyebrow">SECTOR ASSESSMENT · THE STRATEGIC MAP</span>
        <div class="segmented">
          ${btn('focus', 'corridor', 'KEPLER CORRIDOR · +18% FIREPOWER', { cls: `seg ${f.focus === 'corridor' ? 'active' : ''}`, focus: 'focus:corridor' })}
          ${btn('focus', 'yards', 'VEGA YARDS · +25% SHIPBUILDING', { cls: `seg ${f.focus === 'yards' ? 'active' : ''}`, focus: 'focus:yards' })}
          ${btn('focus', 'vesper', 'VESPER REACH · +25% SCIENCE', { cls: `seg ${f.focus === 'vesper' ? 'active' : ''}`, focus: 'focus:vesper' })}
        </div>
        <p class="fine">The map is an idle instrument now: watch one sector and its arithmetic changes. The corridor is a gun, the yards a hull, Vesper Reach a warning.</p>
      </div>
      <div class="action-row">
        ${btn('line', '', `OPEN CRUISER LINE · ${fmt(lineCost)} IP`, { cls: 'primary', disabled: s.ip < lineCost || s.lines >= 8, focus: 'line' })}
        ${btn('overhaul', '', 'OVERHAUL FLEET', { cls: 'ghost', focus: 'overhaul' })}
        ${btn('reform', '', 'REFORM BUREAU', { cls: 'ghost', focus: 'reform' })}
        ${btn('repair', '', 'REPAIR CAPITAL', { cls: 'ghost', focus: 'repair' })}
        ${btn('revision', '', 'FUND REVISIONS', { cls: 'ghost', focus: 'revision' })}
        ${f.crisis ? btn('emergency', '', 'EMERGENCY POWERS', { cls: 'danger', focus: 'emergency' }) : ''}
      </div>
      <p class="fine">Reliability decays with every hull; maintenance and standardisation oppose it. Chaos eats output. Unrest pays for itself eventually.</p>
    `;
    setHTML($('#fleet-card'), html);
  }

  function renderResearch() {
    const rows = A.PROJECTS.map((project) => {
      const rec = s.research[project.id];
      const stateText = rec.state === 0 ? 'UNAUTHORISED' : rec.state === 1 ? 'DRAFTING' : rec.state === 2 ? 'READY' : 'CERTIFIED';
      const canAuthorize = rec.state === 0 && s.ip >= project.ip && s.sp >= project.sp;
      const progress = rec.state === 1 ? clampPercent((rec.progress / 20) * 100) : rec.state === 2 ? clampPercent((rec.tests / 2) * 100) : rec.state === 3 ? 100 : 0;
      const progressLabel = rec.state === 1 ? `drafting ${Math.min(20, rec.progress).toFixed(0)}/20s` : `${rec.tests}/2 tests · ${rec.fails} failures`;
      return `<div class="project ${rec.state === 3 ? 'certified' : ''}">
        <div class="project-head">
          <span class="project-icon" aria-hidden="true">${project.icon}</span>
          <div><strong>${esc(project.name)}</strong><span class="project-state">${stateText}</span></div>
          <span class="project-tests">${rec.state === 2 ? `${rec.tests}/2` : ''}</span>
        </div>
        <p class="project-desc">${esc(project.desc)}</p>
        <p class="project-flaw">Flaw: ${esc(project.flaw)}</p>
        <div class="goal-track small"><i style="width:${progress}%"></i></div>
        <div class="project-foot"><span>${progressLabel}</span><span>${rec.state === 3 ? esc(project.bonus) : ''}</span></div>
        <div class="action-row">
          ${rec.state === 0 ? btn('research', project.id, `AUTHORISE · ${fmt(project.ip)} IP / ${fmt(project.sp)} SP`, { cls: 'buy small', disabled: !canAuthorize, focus: `research:${project.id}` }) : ''}
          ${rec.state === 2 && rec.tests < 2 ? btn('test', project.id, 'RUN TEST · 15 SP', { cls: 'buy small', disabled: s.sp < 15, focus: `test:${project.id}` }) : ''}
          ${rec.state === 2 && rec.tests >= 2 ? btn('certify', project.id, 'CERTIFY · 600 IP / 10 PC', { cls: 'buy small primary', disabled: s.ip < 600 || s.pc < 10 || s.hearings.length > 0, focus: `certify:${project.id}` }) : ''}
        </div>
      </div>`;
    }).join('');

    const hearings = s.hearings.length ? `<div class="hearings"><div class="group-head"><span class="eyebrow">SCIENTIFIC HEARINGS · ${s.hearings.length}</span><span>Policy: ${s.policies.autoHearing === 'revise' ? 'demand revisions' : 'endorse the excuse'} (${Math.ceil(s.hearings[0].timer)}s to auto-ruling)</span></div>
      ${s.hearings.map((hearing, index) => `<div class="hearing">
        <div><strong>${esc(hearing.name)}</strong><p>${hearing.reason === 'failure' ? 'Failure report: a crew was nearly destroyed by a specification nobody wrote.' : 'The tests passed and proved the specification incomplete. The Council wants a ruling.'}</p></div>
        <div class="hearing-actions">
          ${btn('hearing', `${index}:revise`, 'DEMAND REVISIONS · 30 IP / 5 PC', { cls: 'buy small', disabled: s.ip < 30 || s.pc < 5, focus: `hearing:${index}:revise` })}
          ${btn('hearing', `${index}:endorse`, 'ENDORSE THE EXCUSE', { cls: 'buy small danger', focus: `hearing:${index}:endorse` })}
        </div>
      </div>`).join('')}
    </div>` : '';

    const html = `
      ${cardHead('THE RESEARCH DIRECTORATE', 'Prototypes, Tests & Hearings', 'Every machine carries three directives. Only two of them were in the specification.')}
      <div class="projects">${rows}</div>
      ${hearings}
      <p class="fine">Tests cost 15 SP and may fail. Failures file hearings. Certification requires both tests and a clean record, and grants a permanent bonus.</p>
    `;
    setHTML($('#research-card'), html);
  }

  function renderBridge() {
    const f = s.fleet;
    const d = A.derive(s);
    const volleyReady = f.volley >= 1;
    const heat = clampPercent(f.heat);
    const html = `
      ${cardHead('THE TACTICAL BRIDGE', 'Auto-Sorties', 'One sortie every six seconds. The arithmetic of exchange is not interested in your intentions.')}
      <div class="battle-readout">
        <div><span>OUR FIREPOWER</span><strong>${fmt(d.combatPower)}</strong></div>
        <div class="vs">VS</div>
        <div><span>ENEMY POWER</span><strong>${fmt(d.enemyPower)}</strong></div>
      </div>
      <div class="battle-lines">
        <div><span>Last exchange</span><strong>${s.totals.sorties} sorties won · ${fmtInt(s.totals.kills)} hulls destroyed</strong></div>
        <div><span>Command vessels disrupted</span><strong>${fmtInt(s.totals.disrupts)}</strong></div>
        <div><span>Raids blocked by the field</span><strong>${fmtInt(s.totals.blocks)}</strong></div>
        <div><span>Analyzers destroyed</span><strong>${fmtInt(s.totals.analyzers)}</strong></div>
      </div>

      <div class="control-block">
        <span class="eyebrow">FORMATION</span>
        <div class="segmented">
          ${['line', 'escort', 'breakthrough'].map((id) => btn('formation', id, id === 'line' ? 'LINE AHEAD' : id === 'escort' ? 'ESCORT SCREEN' : 'BREAKTHROUGH', { cls: `seg ${f.formation === id ? 'active' : ''}`, focus: `formation:${id}` })).join('')}
        </div>
        <p class="fine">Line ahead balances fire and protection. Escort halves capital damage. Breakthrough kills faster and loses more hulls.</p>
      </div>

      <div class="control-block">
        <span class="eyebrow">TARGETING PRIORITY</span>
        <div class="segmented">
          ${['screen', 'support', 'command'].map((id) => btn('target', id, id.toUpperCase(), { cls: `seg ${f.target === id ? 'active' : ''}`, focus: `target:${id}` })).join('')}
        </div>
        <p class="fine">Support fire is the only way to kill an analyzer. Command fire disrupts coordination and halves raid damage.</p>
      </div>

      <div class="bridge-tools">
        <div class="tool ${volleyReady ? 'ready' : ''}">
          <span class="eyebrow">WONDER WEAPON</span>
          <strong>${volleyReady ? 'CHARGED' : `${Math.floor(f.volley * 100)}%`}</strong>
          ${meter(f.volley, 1)}
          ${btn('volley', '', volleyReady ? 'FIRE VOLLEY' : 'CHARGING…', { cls: volleyReady ? 'primary' : 'ghost', disabled: !volleyReady, focus: 'volley' })}
        </div>
        <div class="tool ${f.field ? 'ready' : ''}">
          <span class="eyebrow">EXPONENTIAL FIELD</span>
          <strong>${f.blackout > 0 ? `BLACKOUT ${Math.ceil(f.blackout)}s` : f.field ? 'ENGAGED' : 'OFF'}</strong>
          ${meter(f.heat, 100, 'heat')}
          ${btn('field', '', f.field ? 'DEACTIVATE FIELD' : 'ENGAGE FIELD', { cls: f.field ? 'ghost' : 'primary', disabled: f.blackout > 0, focus: 'field' })}
          <small class="fine">Hysteresis ${Math.round(heat)}% — deactivating blacks out the command link for six seconds.</small>
        </div>
        <div class="tool">
          <span class="eyebrow">ENEMY ANALYZER</span>
          <strong>${f.analyzer ? `SUPPORT SHIP · ${Math.max(0, Math.round(f.analyzerHp))} HP` : 'NONE DETECTED'}</strong>
          <p class="fine">${f.analyzer ? 'Target support to destroy it. Its death resets part of the enemy’s adaptation.' : `Enemy adaptation ${Math.round(f.adapt * 100) / 100}. It grows every twenty seconds.`}</p>
        </div>
      </div>
      <div class="action-row">
        ${btn('cede', '', 'CEDE OUTPOST FOUR · POISONED PROTOTYPE', { cls: 'danger', disabled: f.ceded, focus: 'cede' })}
        <span class="fine">One use. Destroys eight enemy hulls and raises unrest by fifteen.</span>
      </div>
    `;
    setHTML($('#bridge-card'), html);
  }

  function renderDoctrine() {
    const f = s.fleet;
    const html = `
      ${cardHead('THE DOCTRINE', 'Norden Or Voss', 'The Directorate cannot hold both beliefs, and neither can you.')}
      <div class="doctrines">
        <div class="doctrine ${f.doctrine === 'norden' ? 'active' : ''}">
          <span class="eyebrow">PROF. A. NORDEN</span>
          <strong>Brilliance First</strong>
          <p>+35% science, +15% output, +10% fleet firepower. Reliability decays faster and the crew is mentioned in an appendix.</p>
          ${btn('doctrine', 'norden', f.doctrine === 'norden' ? 'DOCTRINE HELD' : 'DECLARE NORDEN', { cls: f.doctrine === 'norden' ? 'ghost' : 'primary', disabled: f.doctrine === 'norden' || s.runSeconds < f.doctrineSwitch, focus: 'doctrine:norden' })}
        </div>
        <div class="doctrine ${f.doctrine === 'voss' ? 'active' : ''}">
          <span class="eyebrow">CHIEF ENGINEER VOSS</span>
          <strong>Standardisation First</strong>
          <p>+25% output, +25% reliability regeneration, +20% cruiser construction. Duller machines; crews come home.</p>
          ${btn('doctrine', 'voss', f.doctrine === 'voss' ? 'DOCTRINE HELD' : 'DECLARE VOSS', { cls: f.doctrine === 'voss' ? 'ghost' : 'primary', disabled: f.doctrine === 'voss' || s.runSeconds < f.doctrineSwitch, focus: 'doctrine:voss' })}
        </div>
      </div>
      <div class="goal-track"><i style="width:${clampPercent((f.mastery / 5) * 100)}%"></i></div>
      <div class="goal-foot"><span>DOCTRINE MASTERY ${f.mastery}/5 · each level compounds the doctrine’s own arithmetic</span><span>${f.doctrine ? 'DECLARED' : 'UNDECLARED'}</span></div>
    `;
    setHTML($('#doctrine-card'), html);
  }

  function renderSignal() {
    const sig = s.signal;
    const pips = [0, 1, 2].map((i) => `<span class="pip ${sig.fragments > i ? 'filled' : ''}"></span>`).join('');
    const answered = Boolean(sig.choice);
    const html = `
      ${cardHead('THE QUIET ARRAY', 'The Long Question', 'A machine older than the Empire has been asking one thing for ten thousand years. It is waiting on us.')}
      <div class="signal-panel">
        <div class="signal-pips">${pips}</div>
        <div class="signal-status">
          <strong>${answered ? (sig.choice === 'reply' ? 'ANSWER FILED: A GREETING' : 'ANSWER FILED: SILENCE') : sig.fragments >= 3 ? 'THE MESSAGE IS COMPLETE' : `FRAGMENT ${sig.fragments} / 3`}</strong>
          <span>${answered ? 'The array keeps the channel open. It has not stopped asking.' : sig.fragments >= 3 ? 'It is waiting for a reply. A reply costs 12 PC; silence costs nothing and steadies the fleet.' : `Next listening pass in ${Math.max(0, Math.ceil(20 - sig.timer))}s. Click to listen sooner.`}</span>
        </div>
        ${meter(sig.fragments, 3)}
      </div>
      ${answered ? `<p class="fine">${sig.reply ? 'First-contact protocol authorised. Somewhere beyond the charted dark, a machine has begun to compose an answer.' : 'Radio silence held. Enemy tracking is weaker and the fleet is steadier.'}</p>` : `<div class="action-row">
        ${btn('listen', '', 'LISTEN NOW', { cls: 'primary', disabled: sig.fragments >= 3, focus: 'listen' })}
        ${sig.fragments >= 3 ? btn('answer', 'reply', 'REPLY · 12 PC', { cls: 'buy small primary', disabled: s.pc < 12, focus: 'answer:reply' }) : ''}
        ${sig.fragments >= 3 ? btn('answer', 'silence', 'HOLD THE SILENCE', { cls: 'buy small', focus: 'answer:silence' }) : ''}
      </div>`}
    `;
    setHTML($('#signal-card'), html);
  }

  function renderPub() {
    const d = A.derive(s);
    const p = s.pub;
    const content = (window.WH && window.WH.content) || {};
    const rooms = (content.ROOM_DEFS || []).filter((room) => !room.secret);
    const openRooms = Object.keys(p.rooms).length;
    const roomRows = rooms.map((room) => {
      const opened = Boolean(p.rooms[room.id]);
      const cost = A.pubRoomCost(room.id);
      return `<div class="pub-row ${opened ? 'opened' : ''}">
        <div><strong>${esc(room.name)}</strong><span>${esc(room.special)}</span></div>
        ${opened ? '<span class="done-tag">OPEN</span>' : btn('pub-room', room.id, `${fmt(cost)} PT`, { cls: 'buy small', disabled: s.pints < cost, focus: `pub-room:${room.id}` })}
      </div>`;
    }).join('');

    const staffRows = A.PUB_STAFF.map((item) => {
      const hired = Boolean(p.staff[item.id]);
      return `<div class="pub-row ${hired ? 'opened' : ''}">
        <div><strong>${esc(item.name)}</strong><span>${esc(item.note)}</span></div>
        ${hired ? '<span class="done-tag">HIRED</span>' : btn('pub-staff', item.id, `${fmt(item.cost)} PT`, { cls: 'buy small', disabled: s.pints < item.cost, focus: `pub-staff:${item.id}` })}
      </div>`;
    }).join('');

    const amenityRows = A.PUB_AMENITIES.map((item) => {
      const bought = Boolean(p.amenities[item.id]);
      return `<div class="pub-row ${bought ? 'opened' : ''}">
        <div><strong>${esc(item.name)}</strong><span>${esc(item.note)}</span></div>
        ${bought ? '<span class="done-tag">INSTALLED</span>' : btn('pub-amenity', item.id, `${fmt(item.cost)} PT`, { cls: 'buy small', disabled: s.pints < item.cost, focus: `pub-amenity:${item.id}` })}
      </div>`;
    }).join('');

    const upgradeRows = A.PUB_UPGRADES.map((item) => {
      const level = A.seUpgradeLevel(s, item.id);
      const cost = Math.ceil(item.cost * Math.pow(1.75, level));
      const maxed = level >= item.max;
      return `<div class="pub-row ${maxed ? 'opened' : ''}">
        <div><strong>${esc(item.name)} <em>${level}/${item.max}</em></strong><span>${esc(item.note)}</span></div>
        ${maxed ? '<span class="done-tag">FULL</span>' : btn('pub-upgrade', item.id, `${fmt(cost)} SE`, { cls: 'buy small', disabled: s.se < cost, focus: `pub-upgrade:${item.id}` })}
      </div>`;
    }).join('');

    const nextTier = A.PUB_TIERS.find((tier) => tier.tier === p.tier + 1);
    const noise = clampPercent((p.noise / d.capacity) * 100);
    const html = `
      ${cardHead('THE WHITE HART · FLEET STREET', 'The Annex, Idle', 'The Research Directorate’s local since before the war. The landlord has never filed the paperwork.')}
      <div class="pub-top">
        <div class="pub-resources">
          ${stat('PINTS', fmt(s.pints), `${fmtRate(d.pintsPerSec)} / sec`, '')}
          ${stat('SILENCE ENERGY', fmt(s.se), `${fmtRate(d.sePerSec)} / sec`, '')}
          ${stat('PATRONS', fmtRate(d.patrons), `${openRooms} rooms open`, '')}
          ${stat('CHECKS FILED', fmtInt(s.totals.checks), 'witnessed by the landlord', '')}
        </div>
        <div class="noise-card ${noise > 75 ? 'warn' : ''}">
          <div class="noise-head"><span class="eyebrow">THE FENTON SILENCER · TIER ${p.tier} ${esc(d.tier.name.toUpperCase())}</span><strong>${Math.round(noise)}%</strong></div>
          ${meter(p.noise, d.capacity, noise > 85 ? 'danger' : '')}
          <p>Noise ${fmtRate(d.noisePerSec)} / sec · absorption ${fmtRate(d.absorption)} / sec · capacity ${fmt(d.capacity)}</p>
          <div class="action-row">
            ${btn('pub-vent', '', 'VENT THE APPARATUS', { cls: 'primary', focus: 'pub-vent' })}
            ${nextTier ? btn('pub-tier', '', `UPGRADE TO ${esc(nextTier.name.toUpperCase())} · ${fmt(nextTier.pints)} PT / ${fmt(nextTier.se)} SE`, { cls: 'ghost', disabled: s.pints < nextTier.pints || s.se < nextTier.se, focus: 'pub-tier' }) : '<span class="fine">The apparatus is Kendell-proof.</span>'}
          </div>
          <p class="fine">${esc(d.tier.note)}</p>
        </div>
        <div class="check-card">
          <span class="eyebrow">PROTOTYPE CHECK</span>
          <strong>${p.checking ? `READING ${Math.min(12, p.checkTimer).toFixed(0)} / 12 SECONDS` : s.totals.checks >= 3 ? 'RECORD COMPLETE' : 'READY'}</strong>
          ${meter(p.checking ? p.checkTimer : 0, 12)}
          <p class="fine">Twelve seconds of readings and one control pint. Costs 30 IP and 20 SP, rising with each check.</p>
          ${btn('pub-check', '', p.checking ? 'READINGS IN PROGRESS' : 'BEGIN A CHECK', { cls: 'primary', disabled: p.checking, focus: 'pub-check' })}
        </div>
      </div>
      <div class="pub-columns">
        <div class="pub-column">
          <div class="group-head"><span class="eyebrow">🚪 ROOMS</span><span>${openRooms} open</span></div>
          ${roomRows}
        </div>
        <div class="pub-column">
          <div class="group-head"><span class="eyebrow">🎩 STAFF</span><span>${Object.keys(p.staff).length} hired</span></div>
          ${staffRows}
          <div class="group-head"><span class="eyebrow">🪑 AMENITIES</span><span>${Object.keys(p.amenities).length} installed</span></div>
          ${amenityRows}
        </div>
        <div class="pub-column">
          <div class="group-head"><span class="eyebrow">🔇 SILENCER UPGRADES</span><span>SE</span></div>
          ${upgradeRows}
          <div class="group-head"><span class="eyebrow">WEATHER</span><span>${esc(d.weather.name)}</span></div>
          <p class="fine">${esc(d.weather.note)} Pints ×${d.weather.pints}, noise ×${d.weather.noise}, absorption ×${d.weather.se}. The weather changes every two and a half minutes.</p>
        </div>
      </div>
    `;
    setHTML($('#pub-card'), html);
  }

  function renderForecast() {
    const gain = A.prestigeGain(s);
    const upgrades = A.PRESTIGE_UPGRADES.map((def) => {
      const level = s.forecastUp[def.id] || 0;
      const cost = A.prestigeUpgradeCost(s, def);
      const maxed = level >= def.max;
      return `<div class="upgrade">
        <div class="upgrade-main"><strong>${esc(def.name)}</strong><span>${esc(def.note)}</span></div>
        <span class="upgrade-level">${level}/${def.max}</span>
        ${maxed ? '<span class="done-tag">REMEMBERED</span>' : btn('prestige-upgrade', def.id, `${cost} FORECAST`, { cls: 'buy small', disabled: s.forecast < cost, focus: `prestige-upgrade:${def.id}` })}
      </div>`;
    }).join('');
    const reckoning = s.step >= 24;
    const html = `
      ${cardHead('THE LONG FORECAST', 'Forecast', 'Everything the Calculus has learned about you, kept where the next phase can find it.')}
      <div class="forecast-top">
        <div class="forecast-reserve"><span class="eyebrow">FORECAST RESERVE</span><strong>${fmt(s.forecast)}</strong><span>×${A.forecastMult(s).toFixed(2)} all output · +5% per Forecast held</span></div>
        <div class="forecast-meta">
          <div><span>PHASE</span><strong>${roman(s.phase)}</strong></div>
          <div><span>PRESTIGES</span><strong>${s.prestiges}</strong></div>
          <div><span>PAST</span><strong>${fmt(s.forecastLifetime)} FORECAST</strong></div>
        </div>
      </div>
      <div class="upgrade-block">
        <div class="group-head"><span class="eyebrow">✦ PERMANENT REMEMBRANCE</span><span>Survives every recalculation.</span></div>
        ${upgrades}
      </div>
      ${reckoning ? `<div class="prestige-block">
        <span class="eyebrow">STEP 24 · THE RECKONING</span>
        <h3>Recalculate the Calculus</h3>
        <p>The corridor is won. The model has been asked for a new estimate and has declined to give one. Begin phase ${roman(s.phase + 1)} with <strong>+${gain} Forecast</strong>.</p>
        <div class="prestige-summary">
          <div><span>FORECAST GAINED</span><strong>+${gain}</strong></div>
          <div><span>STEPS 1–24</span><strong>COMPLETE</strong></div>
          <div><span>NEXT PHASE</span><strong>${roman(s.phase + 1)}</strong></div>
        </div>
        <ul class="gain-list">${A.prestigeBreakdown(s).map((row) => `<li><span>${esc(row.label)}</span><strong>+${row.value}</strong></li>`).join('')}</ul>
        ${btn('prestige', '', 'RECALCULATE THE CALCULUS ✦', { cls: 'primary big', focus: 'prestige' })}
        <p class="fine">Everything else resets: machines, research, fleet, the pub, the array. Forecast and remembrance do not.</p>
      </div>` : `<div class="prestige-block locked">
        <span class="eyebrow">THE RECKONING · STEP 24</span>
        <h3>Not yet.</h3>
        <p>The Calculus will recalculate when the corridor is won and the twenty-four steps are done. Until then it is content to watch the numbers move.</p>
      </div>`}
    `;
    setHTML($('#forecast-card'), html);
  }

  function renderPolicies() {
    const items = [
      ['autopilot', 'Autopilot', 'Buys machines, reforms, repairs and remembers to breathe.'],
      ['autoResearch', 'Research autopilot', 'Authorises, tests and certifies prototypes when affordable.'],
      ['autoHearing', 'Hearing policy', 'Revisions calm the admirals; endorsements pay IP.'],
      ['autoVent', 'Auto-vent', 'The Silencer vents itself at 75% capacity.'],
      ['autoCheck', 'Annex checks', 'Keeps filing prototype checks at The White Hart.'],
      ['autoFire', 'Auto-fire volleys', 'Fires the wonder weapon the moment it is charged.'],
      ['autoRepair', 'Auto-repair', 'Repairs the capital and funds revisions when unrest rises.'],
      ['autoDoctrine', 'Auto-doctrine', 'Declares Voss if no doctrine has been chosen.'],
    ];
    const rows = items.map(([id, label, note]) => {
      const value = s.policies[id];
      return `<div class="policy">
        <div><strong>${esc(label)}</strong><span>${esc(note)}</span></div>
        <button type="button" class="toggle ${value === 'endorse' ? 'on alt' : value === 'revise' ? 'on' : value ? 'on' : ''}" data-action="policy" data-id="${id}" data-focus="policy:${id}" aria-pressed="${Boolean(value)}">${id === 'autoHearing' ? (value === 'endorse' ? 'ENDORSE' : 'REVISE') : value ? 'ON' : 'OFF'}</button>
      </div>`;
    }).join('');
    const html = `
      ${cardHead('THE AUTOPILOT', 'Policies', 'The staff will keep the lights on. They will not necessarily keep your intentions.')}
      <div class="policies">${rows}</div>
      <p class="fine">Switching the autopilot off is allowed. The machines will still run; nothing will be bought for you.</p>
    `;
    setHTML($('#policies-card'), html);
  }

  function renderLog() {
    const entries = s.log.slice(0, 14).map((entry) => `<li><span class="log-time">${A.clock(entry.t)}</span><p>${esc(entry.text)}</p></li>`).join('');
    const achievements = A.ACHIEVEMENTS.map((achievement) => `<span class="achievement ${s.achievements.includes(achievement.id) ? 'got' : ''}" title="${esc(achievement.note)}">${esc(achievement.name)}</span>`).join('');
    const html = `
      ${cardHead('THE RECORD', 'Dispatches', 'For the record. For the war. For the eventual tribunal.')}
      <div class="log-columns">
        ${['BUILD', 'RESEARCH', 'ENGAGE'].map((phase) => `<div class="log-col"><span class="eyebrow">${phase}</span><p class="fine">${phase === 'BUILD' ? 'Machines, reforms, cruisers. The least interesting way to win.' : phase === 'RESEARCH' ? 'Directives, hearings, safeguards. The only way the crews survive.' : 'Sorties, formations, volleys. The arithmetic of exchange.'}</p></div>`).join('')}
      </div>
      <ul class="log-list">${entries || '<li><p>The record is empty. It will not stay that way.</p></li>'}</ul>
      <div class="achievements"><span class="eyebrow">ACHIEVEMENTS ${s.achievements.length}/${A.ACHIEVEMENTS.length}</span><div class="achievement-list">${achievements}</div></div>
    `;
    setHTML($('#log-card'), html);
  }

  function renderAll() {
    const inReckoning = s.step >= 24;
    showCard('action-card', !inReckoning);
    showCard('build-card', !inReckoning && s.step >= 2);
    showCard('fleet-card', !inReckoning && s.step >= 5);
    showCard('research-card', !inReckoning && s.step >= 8);
    showCard('bridge-card', !inReckoning && s.step >= 12);
    showCard('doctrine-card', !inReckoning && s.step >= 20);
    showCard('signal-card', !inReckoning && s.step >= 21);
    showCard('pub-card', !inReckoning && s.step >= 22);
    showCard('forecast-card', true);
    showCard('policies-card', !inReckoning);
    showCard('log-card', true);
    document.body.classList.toggle('reckoning', inReckoning);

    renderResources();
    renderRail();
    renderMoment();
    renderStep();
    if (!inReckoning) {
      renderAction();
      if (s.step >= 2) renderBuild();
      if (s.step >= 5) renderFleet();
      if (s.step >= 8) renderResearch();
      if (s.step >= 12) renderBridge();
      if (s.step >= 20) renderDoctrine();
      if (s.step >= 21) renderSignal();
      if (s.step >= 22) renderPub();
      renderPolicies();
    }
    renderForecast();
    renderLog();
  }

  /* --------------------------------------------------------------- toasts */
  function toast(text, kind = 'info', ms = 5200) {
    const root = $('#toasts');
    if (!root) return;
    const node = document.createElement('div');
    node.className = `toast toast-${kind}`;
    node.innerHTML = `<span class="toast-mark">${kind === 'bad' ? '!' : kind === 'step' ? '✦' : kind === 'good' ? '✓' : '·'}</span><p>${esc(text)}</p>`;
    root.appendChild(node);
    if (root.children.length > 3) root.firstElementChild.remove();
    setTimeout(() => { node.classList.add('gone'); setTimeout(() => node.remove(), 400); }, ms);
  }

  function drainNews() {
    if (!s.news || !s.news.length) return;
    const items = s.news.splice(0, s.news.length);
    items.forEach((item, index) => {
      const delay = index * 260;
      if (item.kind === 'step') setTimeout(() => { toast(item.text, 'step', 7000); chime(); }, delay);
      else if (item.kind === 'bad') setTimeout(() => toast(item.text, 'bad', 6500), delay);
      else if (item.kind === 'good') setTimeout(() => toast(item.text, 'good'), delay);
      else if (item.kind === 'event') setTimeout(() => toast(item.text, 'event', 7000), delay);
      else setTimeout(() => toast(item.text, 'info'), delay);
    });
  }

  /* ---------------------------------------------------------------- modal */
  function openModal(html, { wide = false } = {}) {
    const root = $('#modal-root');
    if (!root) return;
    const panel = root.querySelector('.modal-panel');
    panel.classList.toggle('wide', wide);
    $('#modal-content').innerHTML = html;
    root.hidden = false;
    document.body.classList.add('modal-open');
  }
  function closeModal() {
    const root = $('#modal-root');
    if (root) root.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function helpModal() {
    const steps = A.STEP_DEFS.map((def) => `<li><strong>${String(def.n).padStart(2, '0')} · ${esc(def.title)}</strong><span>${esc(def.unlock)}</span></li>`).join('');
    openModal(`
      <p class="eyebrow">CLASSIFIED / COMMAND BRIEFING</p>
      <h2 id="modal-title">Twenty-four steps, one long forecast</h2>
      <p>This is the whole war, converted to a clicker and an idle machine. Press <strong>REQUISITION</strong> to bank industrial points. Buy machines so the points arrive without you. Every step on the rail is a mechanic: build, research, fight, listen — and at step 24 there is only the reckoning.</p>
      <h3>How to play</h3>
      <ul class="help-list">
        <li><strong>Click</strong> REQUISITION (or press Space) to bank IP. A quick run builds a cadence bonus.</li>
        <li><strong>Idle</strong> with the Autopilot on, or switch it off in Policies and buy every machine yourself.</li>
        <li><strong>Steps 1–24</strong> advance the moment their order is complete. The rail on the left always shows where you are.</li>
        <li><strong>Research</strong> authorises three prototypes; tests cost SP; failures file hearings; safeguards certify them.</li>
        <li><strong>Combat</strong> runs itself every six seconds. Formations and targeting change the arithmetic.</li>
        <li><strong>The White Hart</strong> is an idle department: pints, patrons, noise, Silence Energy and prototype checks. It also answers to a few old words if you type them; the landlord will not explain which.</li>
        <li><strong>Step 24</strong> is prestige only. Take your Forecast, spend it on permanent remembrance, and open the next phase.</li>
      </ul>
      <h3>The twenty-four steps</h3>
      <ol class="help-steps">${steps}</ol>
      <p class="fine">Progress saves every few seconds and while you are away, up to eight hours (more with Sleeping Forecast). The archive is local to this browser.</p>
      <div class="action-row"><button type="button" class="btn primary" data-action="close-modal">ACKNOWLEDGED →</button></div>
    `, { wide: true });
  }

  function introModal() {
    const pages = (window.ASLore && window.ASLore.PROLOGUE) || [];
    const page = pages[s.seen.introPage || 0] || null;
    if (!page) { beginRun(); return; }
    const index = s.seen.introPage || 0;
    openModal(`
      <p class="eyebrow">${esc(page.kicker)}</p>
      <h2 id="modal-title">${esc(page.title)}</h2>
      ${page.body.map((para) => `<p>${esc(para)}</p>`).join('')}
      <p class="sign">— ${esc(page.sign)}</p>
      <div class="intro-foot">
        <span class="eyebrow">INTRODUCTION ${index + 1} / ${pages.length}</span>
        <div class="action-row">
          <button type="button" class="btn ghost" data-action="intro-skip">SKIP THE BRIEFING</button>
          <button type="button" class="btn primary" data-action="intro-next">${index >= pages.length - 1 ? 'BEGIN THE FORECAST →' : 'NEXT PAGE →'}</button>
        </div>
      </div>
    `);
  }

  function beginRun() {
    s.seen.intro = true;
    closeModal();
    A.save(s);
    renderAll();
  }

  function offlineModal() {
    const report = s.offlineReport;
    if (!report) return;
    openModal(`
      <p class="eyebrow">THE FORECAST CONTINUED WITHOUT YOU</p>
      <h2 id="modal-title">${A.clock(report.seconds)} of quiet progress</h2>
      <p>The machines kept their schedules. The Calculus kept its own.</p>
      <div class="cycle-report">
        <div class="report-row good"><span>Industrial points</span><strong>+${fmt(report.ip)} IP</strong></div>
        <div class="report-row good"><span>Scientific points</span><strong>+${fmt(report.sp)} SP</strong></div>
        ${report.kills ? `<div class="report-row good"><span>Enemy hulls destroyed</span><strong>${fmtInt(report.kills)}</strong></div>` : ''}
        ${report.checks ? `<div class="report-row good"><span>Annex checks filed</span><strong>${fmtInt(report.checks)}</strong></div>` : ''}
        ${report.steps ? `<div class="report-row good"><span>Steps advanced</span><strong>+${report.steps}</strong></div>` : ''}
        <div class="report-row"><span>Offline efficiency</span><strong>${Math.round(report.efficiency * 100)}%</strong></div>
      </div>
      <div class="action-row"><button type="button" class="btn primary" data-action="close-modal">BACK TO THE TERMINAL →</button></div>
    `);
    s.offlineReport = null;
  }

  function prestigeModal() {
    const gain = A.prestigeGain(s);
    openModal(`
      <p class="eyebrow">STEP 24 · THE RECKONING</p>
      <h2 id="modal-title">Recalculate the Calculus?</h2>
      <p>You will begin <strong>phase ${roman(s.phase + 1)}</strong> at step 01, with <strong>+${gain} Forecast</strong> added to your reserve. Machines, research, fleet, annex and array are all forgotten.</p>
      <p>Forecast and permanent remembrance survive. The Calculus has already noted the discrepancy.</p>
      <div class="action-row">
        <button type="button" class="btn ghost" data-action="close-modal">NOT YET</button>
        <button type="button" class="btn primary" data-action="confirm-prestige">BEGIN PHASE ${roman(s.phase + 1)} ✦</button>
      </div>
    `);
  }

  function restartModal() {
    openModal(`
      <p class="eyebrow">ARCHIVE CONTROL</p>
      <h2 id="modal-title">Start a new Forecast?</h2>
      <p>This wipes the local archive and begins again at phase I, step 01, with no Forecast. The pub ledger is part of the same archive now.</p>
      <p class="fine">There is no undo. The Calculus is not sentimental.</p>
      <div class="action-row">
        <button type="button" class="btn ghost" data-action="close-modal">KEEP THIS FORECAST</button>
        <button type="button" class="btn danger" data-action="confirm-restart">WIPE AND BEGIN AGAIN</button>
      </div>
    `);
  }

  /* -------------------------------------------------------------- actions */
  function floating(text, x, y, cls = '') {
    const layer = $('#float-layer');
    if (!layer) return;
    const node = document.createElement('span');
    node.className = `float ${cls}`;
    node.textContent = text;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    layer.appendChild(node);
    setTimeout(() => node.remove(), 1100);
  }

  function afterAction(action, result, event) {
    if (!result || result.ok === false) {
      if (result && result.msg) toast(result.msg, 'bad', 3200);
      return;
    }
    if (action === 'click') {
      const rect = event && event.target && event.target.closest ? event.target.closest('.click-button') : null;
      const box = rect ? rect.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
      const x = (event && event.clientX) || box.left + box.width / 2;
      const y = (event && event.clientY) || box.top + box.height / 2;
      floating(`+${fmt(result.gain)} IP`, x + (Math.random() * 30 - 15), y - 20);
      beep(320 + Math.min(280, s.click.streak * 6), 0.04, 'square', 0.018);
    }
    if (action === 'prestige') {
      s = result.state;
      closeModal();
      A.save(s);
      toast(`PHASE ${roman(s.phase)} BEGINS. +${result.gain} Forecast remembered.`, 'step', 8000);
      chime();
      renderAll();
      return;
    }
    if (['buy', 'line', 'upgrade', 'research', 'certify', 'pub-room', 'pub-staff', 'pub-amenity', 'pub-upgrade', 'pub-tier', 'prestige-upgrade'].includes(action)) {
      beep(500, 0.05, 'triangle', 0.02);
    }
    renderAll();
  }

  function handleAction(action, id, amount, event) {
    if (!action) return;
    switch (action) {
      case 'help': return helpModal();
      case 'restart': return restartModal();
      case 'close-modal': return closeModal();
      case 'intro-next': {
        const pages = (window.ASLore && window.ASLore.PROLOGUE) || [];
        s.seen.introPage = (s.seen.introPage || 0) + 1;
        if (s.seen.introPage >= pages.length) return beginRun();
        return introModal();
      }
      case 'intro-skip': return beginRun();
      case 'confirm-restart': {
        A.reset();
        s = A.newGame();
        s.seen.intro = true;
        A.save(s);
        closeModal();
        renderAll();
        toast('A new forecast begins at step 01.', 'step');
        return;
      }
      case 'confirm-prestige': {
        const result = A.act(s, 'prestige');
        return afterAction('prestige', result, event);
      }
      case 'sound': {
        soundOn = !soundOn;
        try { localStorage.setItem('as-idle-sound', soundOn ? 'on' : 'off'); } catch (_) { /* ignore */ }
        const button = $('#sound-btn');
        if (button) { button.textContent = soundOn ? '◉' : '◖'; button.classList.toggle('on', soundOn); }
        beep(560, 0.08, 'sine', 0.05);
        return;
      }
      case 'prestige': return prestigeModal();
      case 'click': {
        const result = A.act(s, 'click');
        return afterAction('click', result, event);
      }
      default: {
        if (action === 'hearing') {
          const [index, choice] = String(id || '').split(':');
          const result = A.act(s, 'hearing', { index: Number(index), choice });
          return afterAction(action, result, event);
        }
        const result = A.act(s, action, id, amount);
        return afterAction(action, result, event);
      }
    }
  }

  /* --------------------------------------------------------------- events */
  function bindEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const { action, id, amount } = target.dataset;
      if (action === 'hearing') {
        const [index, choice] = String(id || '').split(':');
        handleAction('hearing', `${index}:${choice}`, '', event);
        return;
      }
      handleAction(action, id, amount, event);
    });

    document.addEventListener('keydown', (event) => {
      if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (event.key === 'Escape') {
        if (!$('#modal-root').hidden) closeModal();
        return;
      }
      if (!$('#modal-root').hidden) return;
      if (event.code === 'Space') {
        event.preventDefault();
        handleAction('click');
        return;
      }
      if (event.key === 'h' || event.key === '?') {
        helpModal();
        return;
      }
      if (/^[a-z0-9]$/i.test(event.key)) {
        eggBuffer = (eggBuffer + event.key.toLowerCase()).slice(-24);
        const words = A.EGGS || [];
        const hit = words.find((egg) => eggBuffer.endsWith(egg.word));
        if (hit) {
          eggBuffer = '';
          const result = A.act(s, 'egg', hit.word);
          if (result.ok) {
            toast(hit.title, hit.line, 'good');
            beep(660, 0.12, 'sine', 0.03);
            renderAll();
          }
        }
      }
    });

    window.addEventListener('beforeunload', () => A.save(s));
    document.addEventListener('visibilitychange', () => {
      A.save(s);
    });
    window.addEventListener('resize', () => renderAll());
    document.addEventListener('pointerdown', () => {
      try {
        if (soundOn && audio && audio.state === 'suspended') audio.resume();
      } catch (_) { /* ignore */ }
    }, { once: true });
  }

  /* ----------------------------------------------------------------- boot */
  function loop(now) {
    const raw = Math.max(0, (now - lastFrame) / 1000);
    lastFrame = now;
    if (raw > 4) {
      // The tab slept. The machines did not; settle up before drawing anything.
      let remaining = Math.min(raw, 3600);
      while (remaining > 0) {
        const chunk = Math.min(1, remaining);
        A.tick(s, chunk);
        remaining -= chunk;
      }
    } else {
      A.tick(s, Math.min(0.5, raw));
    }
    drainNews();
    saveClock += Math.min(1, raw);
    if (saveClock > 5) { saveClock = 0; A.save(s); }
    renderAt += Math.min(1, raw);
    if (renderAt > 0.1) { renderAt = 0; renderAll(); }
    requestAnimationFrame(loop);
  }

  function boot() {
    s = A.load() || A.newGame();
    bindEvents();
    const soundButton = $('#sound-btn');
    if (soundButton) { soundButton.textContent = soundOn ? '◉' : '◖'; soundButton.classList.toggle('on', soundOn); }
    renderAll();
    drainNews();
    if (s.offlineReport) offlineModal();
    else if (!s.seen.intro && s.prestiges === 0 && s.playSeconds < 2) {
      s.seen.introPage = 0;
      introModal();
    }
    A.save(s);
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  window.ASIdleUI = {
    get state() { return s; },
    boot,
    render: () => renderAll(),
    action: (action, id, amount) => handleAction(action, id, amount),
    help: helpModal,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
