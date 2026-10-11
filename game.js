/* The White Hart — a small, self-contained pub management game. */
(() => {
  'use strict';

  const ROOM_DEFS = [
    { id: 'general', name: 'General Bar', short: 'GENERAL', seats: 4, cost: 0, special: '+1 Pint / sec', style: 'general' },
    { id: 'saloon', name: 'Saloon Bar', short: 'SALOON', seats: 3, cost: 50, special: '+2 Scoops / sec', style: 'saloon' },
    { id: 'snug', name: 'The Snug', short: 'SNUG', seats: 2, cost: 120, special: 'Scientists only · +3 Research / sec', style: 'snug' },
    { id: 'cellar', name: 'The Cellar', short: 'CELLAR', seats: 0, cost: 200, special: 'Silencer housing · half blast radius', style: 'cellar' },
    { id: 'backroom', name: 'Back Room', short: 'BACK ROOM', seats: 6, cost: 350, special: 'Events only · +5 Loyalty / sec', style: 'backroom' },
    { id: 'upstairs', name: 'Upstairs', short: 'UPSTAIRS', seats: 8, cost: 500, special: 'Writers & editors · +4 Manuscripts / sec', style: 'upstairs' },
    { id: 'roof', name: 'Roof Terrace', short: 'ROOF TERRACE', seats: 10, cost: 800, special: 'Summer only · +10 Pints / sec', style: 'roof' }
  ];

  const SILENCER_TIERS = [
    { tier: 1, name: 'Prototype', capacity: 100, absorption: 5, vent: 0, cost: {} },
    { tier: 2, name: 'Improved', capacity: 250, absorption: 10, vent: 2, cost: { research: 150 } },
    { tier: 3, name: 'Linearized', capacity: 500, absorption: 20, vent: 5, cost: { research: 400 } },
    { tier: 4, name: 'Purvis Modified', capacity: 1000, absorption: 40, vent: 15, cost: { research: 1000, manuscripts: 5 } },
    { tier: 5, name: 'Perfected', capacity: 2500, absorption: 80, vent: 50, cost: { research: 2500, scoops: 10, loyalty: 5 } }
  ];

  const PATRONS = {
    journalist: { label: 'Journalist', weight: 20, noise: 15, leavesAt: 80, production: { scoops: 2, seconds: 60 }, coat: 0x9b7542, hat: 0x44382a, prop: 'paper', names: ['Mavis Quill', 'Len Button', 'Iris Ledger', 'Percy Ink'] },
    writer: { label: 'Writer', weight: 25, noise: 10, leavesAt: 70, production: { manuscripts: 1, seconds: 120 }, coat: 0x526d58, hat: 0x29362d, prop: 'pipe', names: ['Agnes Bell', 'Martin Page', 'E. C. Wren', 'Daphne Blot'] },
    editor: { label: 'Editor', weight: 10, noise: 5, leavesAt: 60, production: { scoops: 1, manuscripts: 1, seconds: 180 }, coat: 0x773f37, hat: 0x372823, prop: 'spectacles', names: ['Clive Redpen', 'Vera Proof', 'Nigel Copy', 'Edith Comma'] },
    scientist: { label: 'Scientist', weight: 15, noise: 3, leavesAt: 50, production: { research: 2, seconds: 60 }, coat: 0x829087, hat: 0x36433d, prop: 'flask', names: ['Dr. Ada Vale', 'Prof. Bell', 'Dr. L. Finch', 'Mr. Purcell'] },
    regular: { label: 'Regular', weight: 20, noise: 12, leavesAt: Infinity, production: { loyalty: 1, seconds: 60 }, coat: 0x3c5660, hat: 0x28363a, prop: 'mug', names: ['Mrs. Pottle', 'Old Tom', 'Maisie Pike', 'Arthur Bell'] },
    burt: { label: 'Burt Huggins', weight: 5, noise: 40, leavesAt: Infinity, production: null, coat: 0x954939, hat: 0x33241c, prop: 'moustache', names: ['Burt Huggins'] },
    harry: { label: 'Harry Purvis', weight: 3, noise: 2, leavesAt: Infinity, production: null, coat: 0x4b5552, hat: 0x272e2e, prop: 'shadow', names: ['Harry Purvis'] },
    john: { label: 'John Christopher', weight: 2, noise: 8, leavesAt: Infinity, production: null, coat: 0x6b725a, hat: 0x30392b, prop: 'book', names: ['John Christopher'] }
  };

  const STAFF_DEFS = [
    { id: 'barmaid', name: 'Barmaid', icon: '♙', cost: { pints: 100 }, effect: 'Auto-serves one patron every 5 seconds. Has opinions about the regulars.' },
    { id: 'cellarMaster', name: 'Cellar Master', icon: '⌁', cost: { pints: 200 }, effect: '+1 SE / sec to the safe vent rate.' },
    { id: 'physicist', name: 'Physicist', icon: '⚗', cost: { research: 300 }, effect: '+10% Silencer absorption. Insists this is not a pub.' },
    { id: 'journalistFriend', name: 'Journalist Friend', icon: '✎', cost: { scoops: 5 }, effect: '+1 patron seat in every room.' },
    { id: 'editor', name: 'Editor', icon: '¶', cost: { manuscripts: 10 }, effect: '+1 Manuscript / min. Will not discuss the headline.' }
  ];

  const AMENITY_DEFS = [
    { id: 'jukebox', name: 'Fix the Jukebox', icon: '♫', cost: { pints: 50 }, effect: '+10 dB in the General Bar and +5 Loyalty / min. It remains inexplicably silent.' },
    { id: 'dartboard', name: 'Dartboard', icon: '◎', cost: { pints: 75 }, effect: '+5 dB in the General Bar and +5 Loyalty / min.' },
    { id: 'betterBeer', name: 'Better Beer', icon: '◉', cost: { pints: 150 }, effect: '+50% Pint income from the bar and from every grateful customer.' },
    { id: 'thamesView', name: 'Thames View', icon: '⌂', cost: { pints: 200 }, effect: '+2 Scientists / min. The window is technically in the toilet.' },
    { id: 'soundproofing', name: 'Soundproofing', icon: '▤', cost: { pints: 300 }, effect: '-20% noise in one chosen room. Requires an available room.' }
  ];

  const NEWS_QUOTES = [
    ['“I couldn’t hear myself think,” says one patron. “I couldn’t hear anything,” says another.'],
    ['The landlord says the humming is “almost certainly supposed to do that.”'],
    ['A visiting physicist has requested a quieter room. The pub has taken this as a compliment.'],
    ['Regulars report that the silence is getting louder. The landlord has declined to comment.'],
    ['The White Hart remains open, despite several compelling arguments to the contrary.']
  ];

  const PURVIS_TIPS = [
    'You can’t destroy energy, old boy. You can only move it somewhere else. And somewhere else is usually where you least want it.',
    'A quiet room is not an empty room. It is merely a room whose complaints have been carefully filed.',
    'The meter is not a suggestion. It only looks like one because Fenton chose a friendly font.',
    'If the tubes begin to smoke, do try not to fan them. The air has enough to do already.',
    'A cellar is a splendid place to put anything you would rather not hear from again.',
    'One pint for the customer, one scoop for the paper, and absolutely no promises to the inspector.'
  ];

  const DIARY_PAGES = [
    { id: 'opening', title: 'Fenton’s notebook · Page I', unlock: 'At the opening', copy: 'The machine does not remove sound. It takes it, folds it into a neat little parcel, and leaves it somewhere behind the wall. I have asked where. Fenton has asked me to stop asking.' },
    { id: 'demo', title: 'Fenton’s notebook · Page II', unlock: 'Improved Silencer', copy: 'He demonstrated the improved valves after closing. The pipes flickered like a gas mantle and every glass in the room became suddenly fascinating.' },
    { id: 'explosion', title: 'Fenton’s notebook · Page III', unlock: 'The demonstration', copy: 'Fenton called it a controlled demonstration. The insurance man called it a second visit. Neither of them would explain the humming.' },
    { id: 'secret', title: 'Purvis’s folded note', unlock: 'Purvis Modified', copy: 'You can’t destroy energy, old boy. You can only move it somewhere else. And somewhere else is usually where you least want it.' },
    { id: 'ghost', title: 'A receipt with no handwriting', unlock: 'The Perfected Silencer', copy: 'One round, paid in full. No signature. The barman swears the gentleman wore a rather old-fashioned waistcoat.' }
  ];

  const SAVE_KEY = 'silence-please-white-hart-v1';
  const NIGHT_LENGTH = 30;
  const ROOM_ADJACENCY = {
    general: ['saloon'], saloon: ['general', 'snug'], snug: ['saloon', 'cellar'], cellar: ['snug', 'backroom'],
    backroom: ['cellar', 'upstairs'], upstairs: ['backroom', 'roof'], roof: ['upstairs']
  };

  const $ = (selector) => document.querySelector(selector);
  const dom = {
    stageInner: $('#stage-inner'), loading: $('#stage-loading'), canvas: $('#pub-canvas'),
    toast: $('#toast'), toastTitle: $('#toast-title'), toastBody: $('#toast-body'),
    modalRoot: $('#modal-root'), modalContent: $('#modal-content'), modalClose: $('#modal-close'),
    crisis: $('#crisis-screen'), crisisKicker: $('#crisis-kicker'), crisisTitle: $('#crisis-title'), crisisCopy: $('#crisis-copy'), crisisButton: $('#crisis-button'),
    tooltip: $('#tooltip')
  };

  let app;
  let stageResizeObserver;
  let state;
  let lastFrameAt = performance.now();
  let uiClock = 0;
  let realClock = 0;
  let drawClock = 0;
  let saveClock = 0;
  let roomPageSize = 4;
  let renderedTabsKey = '';
  let avatarNodes = [];
  let modalMode = null;
  let toastTimer = null;
  let crisisTimer = null;
  let longPressTimer = null;
  let swipeStart = null;
  let audioRig = null;
  let audioEnabled = (() => { try { return localStorage.getItem('white-hart-sound') === 'on'; } catch (_) { return false; } })();
  let lastWarningTickAt = 0;

  function freshState() {
    const rooms = {};
    ROOM_DEFS.forEach((room) => {
      rooms[room.id] = {
        unlocked: room.id === 'general', damaged: false, zone: room.id === 'general', noiseSpike: 0,
        operaNoise: 0, eventNoiseUntil: 0, soundproofed: false
      };
    });
    return {
      version: 1,
      resources: { pints: 125, scoops: 4, manuscripts: 3, research: 45, loyalty: 12 },
      reputation: 100,
      energy: 18,
      tier: 1,
      rooms,
      homeRoom: 'general',
      patrons: [],
      nextPatronId: 1,
      staff: { barmaid: false, cellarMaster: false, physicist: false, journalistFriend: false, editor: false },
      amenities: { jukebox: false, dartboard: false, betterBeer: false, thamesView: false },
      soundproofedRooms: [],
      seUpgrades: { filters: 0, microphones: 0, venting: 0, casing: false, dumpUsed: false },
      venting: false,
      paused: false,
      explosions: 0,
      weeksSurvived: 0,
      week: 1,
      dayElapsed: 0,
      gameSeconds: 0,
      nextSpawnAt: 7,
      nextEventAt: 145,
      nextTipAt: 32,
      nextBarmaidAt: 5,
      nextScientistAt: 30,
      highNoiseSeconds: 0,
      lastExplosionWeek: 0,
      currentEvent: '',
      eventUntil: 0,
      rivalUntil: 0,
      powerCutUntil: 0,
      powerCutRestore: null,
      storyFlags: { demo: false, revenge: false, tutorialExplosion: false, secret: false, perfected: false },
      diaryPages: ['opening'],
      clippings: [{ tag: 'LATEST EDITION · WEDNESDAY', headline: '“Regulars insist the pub is perfectly normal.”', copy: 'The Fenton apparatus has been switched on. Nobody is quite sure by whom.', time: '7:00 PM' }],
      selectedPatron: null,
      beerReady: false,
      roomPage: 0,
      pendingExplosion: null,
      explosionFreeze: 0,
      crisisVisible: false,
      crisisDismissAt: 0,
      gameOver: false,
      won: false,
      ending: '',
      tutorialExplosionAt: 0,
      lastSaveAt: Date.now()
    };
  }

  function safeLoad() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || !data.resources || !data.rooms) return null;
      const base = freshState();
      const merged = { ...base, ...data };
      merged.resources = { ...base.resources, ...data.resources };
      merged.rooms = { ...base.rooms, ...data.rooms };
      for (const def of ROOM_DEFS) merged.rooms[def.id] = { ...base.rooms[def.id], ...(data.rooms[def.id] || {}) };
      merged.staff = { ...base.staff, ...(data.staff || {}) };
      merged.amenities = { ...base.amenities, ...(data.amenities || {}) };
      merged.seUpgrades = { ...base.seUpgrades, ...(data.seUpgrades || {}) };
      merged.storyFlags = { ...base.storyFlags, ...(data.storyFlags || {}) };
      merged.patrons = Array.isArray(data.patrons) ? data.patrons.filter((p) => PATRONS[p.type] && merged.rooms[p.roomId]) : [];
      merged.clippings = Array.isArray(data.clippings) && data.clippings.length ? data.clippings.slice(-15) : base.clippings;
      merged.diaryPages = Array.isArray(data.diaryPages) ? data.diaryPages : ['opening'];
      merged.selectedPatron = null;
      merged.beerReady = false;
      merged.pendingExplosion = null;
      merged.explosionFreeze = 0;
      merged.crisisVisible = false;
      merged.crisisDismissAt = 0;
      merged.paused = false;
      merged.gameOver = Boolean(data.gameOver);
      merged.won = Boolean(data.won);
      if (!ROOM_DEFS.some((room) => room.id === merged.homeRoom && merged.rooms[room.id].unlocked && !merged.rooms[room.id].damaged)) {
        merged.homeRoom = 'general';
      }
      if (!merged.patrons.length && !merged.gameOver && !merged.won) seedStartingPatrons(merged);
      return merged;
    } catch (error) {
      console.warn('The ledger was unreadable; a fresh Wednesday will be opened.', error);
      return null;
    }
  }

  function saveState() {
    if (!state) return;
    state.lastSaveAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      const saveStatus = $('#save-status');
      if (saveStatus) {
        saveStatus.textContent = 'SAVED LOCALLY';
        saveStatus.classList.remove('saving');
      }
    } catch (error) {
      console.warn('The White Hart could not save this ledger.', error);
      const saveStatus = $('#save-status');
      if (saveStatus) saveStatus.textContent = 'NO LOCAL LEDGER';
    }
  }

  function seedStartingPatrons(target = state) {
    const starters = [
      { type: 'regular', name: 'Mrs. Pottle', patience: 74 },
      { type: 'writer', name: 'Agnes Bell', patience: 87 },
      { type: 'journalist', name: 'Len Button', patience: 62 }
    ];
    starters.forEach((starter) => {
      target.patrons.push({
        id: target.nextPatronId++, type: starter.type, name: starter.name, roomId: 'general',
        patience: starter.patience, patienceMax: starter.patience, productionClock: 0, born: target.gameSeconds || 0,
        phase: Math.random() * Math.PI * 2
      });
    });
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function randomBetween(min, max) { return min + Math.random() * (max - min); }
  function roomDef(id) { return ROOM_DEFS.find((room) => room.id === id) || ROOM_DEFS[0]; }
  function isOperational(roomId) {
    const room = state.rooms[roomId];
    return Boolean(room && room.unlocked && !room.damaged);
  }
  function activePatrons(roomId) { return state.patrons.filter((patron) => patron.roomId === roomId); }
  function seatLimit(roomId) { return roomDef(roomId).seats + (state.staff.journalistFriend && roomDef(roomId).seats > 0 ? 1 : 0); }
  function isSummer() { return ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'][(state.week - 1) % 4] === 'SUMMER'; }
  function currentSeason() { return ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'][(state.week - 1) % 4]; }
  function tierDef(tier = state.tier) { return SILENCER_TIERS[tier - 1] || SILENCER_TIERS[0]; }
  function capacity() { return tierDef().capacity + state.seUpgrades.filters * 50; }
  function absorption() { return (tierDef().absorption + state.seUpgrades.microphones * 5) * (state.staff.physicist ? 1.1 : 1); }
  function ventRate() { return tierDef().vent + state.seUpgrades.venting * 2 + (state.staff.cellarMaster ? 1 : 0); }
  function formatNumber(value, digits = 0) {
    const n = Number.isFinite(value) ? value : 0;
    return n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function formatRate(value) {
    const digits = value < .01 ? 3 : value < 1 ? 2 : value < 10 ? 1 : 0;
    return formatNumber(value, digits);
  }
  function resourceLabel(id) {
    return ({ pints: 'Pints', scoops: 'Scoops', manuscripts: 'Manuscripts', research: 'Research', loyalty: 'Loyalty', energy: 'Silence Energy' })[id] || id;
  }
  function formatCost(cost) {
    return Object.entries(cost).map(([key, amount]) => {
      const icon = ({ pints: '🍺', scoops: '📰', manuscripts: '📜', research: '⚗', loyalty: '♥', energy: '🔇' })[key] || '';
      return `${icon} ${formatNumber(amount)} ${resourceLabel(key)}`;
    }).join('  ·  ');
  }
  function canAfford(cost) {
    return Object.entries(cost).every(([key, amount]) => key === 'energy' ? state.energy + 1e-8 >= amount : (state.resources[key] || 0) + 1e-8 >= amount);
  }
  function spend(cost) {
    if (!canAfford(cost)) return false;
    Object.entries(cost).forEach(([key, amount]) => {
      if (key === 'energy') state.energy = Math.max(0, state.energy - amount);
      else state.resources[key] = Math.max(0, (state.resources[key] || 0) - amount);
    });
    return true;
  }
  function addResource(key, amount) {
    if (key === 'energy') state.energy = clamp(state.energy + amount, 0, capacity());
    else if (Object.prototype.hasOwnProperty.call(state.resources, key)) state.resources[key] = Math.max(0, state.resources[key] + amount);
  }
  function setCaption(text) { $('#scene-caption').textContent = text; }
  function announce(text) { $('#live-announcer').textContent = text; }

  function pushNews(tag, headline, copy, diaryId = null) {
    const clock = getClockLabel();
    const clipping = { tag: `${tag} · WEDNESDAY ${String(state.week).padStart(2, '0')}`, headline, copy, time: clock };
    state.clippings.unshift(clipping);
    state.clippings = state.clippings.slice(0, 15);
    $('#press-tag').textContent = clipping.tag;
    $('#press-headline').textContent = headline;
    $('#press-copy').textContent = copy;
    if (diaryId && !state.diaryPages.includes(diaryId)) state.diaryPages.push(diaryId);
    announce(`${tag}: ${headline}`);
  }

  function showToast(title, body, duration = 6800) {
    dom.toastTitle.textContent = title;
    dom.toastBody.textContent = body;
    dom.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { dom.toast.hidden = true; }, duration);
  }
  function dismissToast() { dom.toast.hidden = true; if (toastTimer) clearTimeout(toastTimer); }

  function getClockLabel() {
    const minutes = Math.floor(state.dayElapsed);
    const hour24 = 19 + Math.floor(minutes / 60);
    const hour = ((hour24 + 11) % 12) + 1;
    const minute = String(minutes % 60).padStart(2, '0');
    return `${hour}:${minute} PM`;
  }

  function sourceNoise(roomId) {
    if (!isOperational(roomId)) return 0;
    const room = state.rooms[roomId];
    const roomPatrons = activePatrons(roomId);
    let sound = roomPatrons.reduce((total, patron) => total + (PATRONS[patron.type]?.noise || 0), 0);
    sound += room.noiseSpike + room.operaNoise;
    if (roomId === 'general' && state.amenities.jukebox) sound += 10;
    if (roomId === 'general' && state.amenities.dartboard) sound += 5;
    if (room.soundproofed || state.soundproofedRooms.includes(roomId)) sound *= .8;
    return clamp(Math.round(sound), 0, 100);
  }
  function roomNoise(roomId) {
    if (!isOperational(roomId)) return 0;
    if (state.rooms[roomId].zone && state.powerCutUntil <= state.gameSeconds) return 0;
    return sourceNoise(roomId);
  }
  function zoneIsOn(roomId) {
    return Boolean(isOperational(roomId) && state.rooms[roomId].zone && state.powerCutUntil <= state.gameSeconds);
  }
  function activeZoneCount() {
    return ROOM_DEFS.filter((room) => zoneIsOn(room.id)).length;
  }
  function maxRoomNoise() {
    return Math.max(0, ...ROOM_DEFS.map((room) => roomNoise(room.id)));
  }
  function totalEnergyRate() {
    if (state.powerCutUntil > state.gameSeconds || !isOperational(state.homeRoom)) return 0;
    const factor = absorption() / 100 * .7;
    return ROOM_DEFS.reduce((sum, room) => {
      if (!zoneIsOn(room.id)) return sum;
      return sum + sourceNoise(room.id) * factor;
    }, 0);
  }

  function resourceRates() {
    const rates = { pints: 0, scoops: 0, manuscripts: 0, research: 0, loyalty: 0 };
    if (isOperational('general')) rates.pints += 1;
    if (isOperational('saloon')) rates.scoops += 2;
    if (isOperational('snug')) rates.research += 3;
    if (isOperational('backroom') && state.eventUntil > state.gameSeconds) rates.loyalty += 5;
    if (isOperational('upstairs')) rates.manuscripts += 4;
    if (isOperational('roof') && isSummer()) rates.pints += 10;
    if (state.staff.editor) rates.manuscripts += 1 / 60;
    if (state.amenities.jukebox) rates.loyalty += 5 / 60;
    if (state.amenities.dartboard) rates.loyalty += 5 / 60;
    state.patrons.forEach((patron) => {
      const production = PATRONS[patron.type]?.production;
      if (!production) return;
      const interval = production.seconds;
      Object.entries(production).forEach(([resource, amount]) => {
        if (resource === 'seconds') return;
        rates[resource] += amount / interval;
      });
    });
    if (state.amenities.betterBeer) rates.pints *= 1.5;
    return rates;
  }

  function maxAllowedNoise(roomId, noise) {
    return activePatrons(roomId).some((patron) => noise > PATRONS[patron.type].leavesAt);
  }

  function tryUnlockRoom(roomId) {
    const def = roomDef(roomId);
    const room = state.rooms[roomId];
    if (room.damaged && room.unlocked) return tryRebuildRoom(roomId);
    if (room.unlocked) {
      showToast('Already open', `${def.name} has been open long enough to acquire a smell of its own.`);
      return false;
    }
    const index = ROOM_DEFS.findIndex((entry) => entry.id === roomId);
    const previous = ROOM_DEFS[index - 1];
    if (previous && (!state.rooms[previous.id].unlocked || state.rooms[previous.id].damaged)) {
      showToast('One room at a time', `The ${previous.name} must be open before the ${def.name}. The architect was very particular.`);
      return false;
    }
    const cost = { pints: def.cost };
    if (!canAfford(cost)) {
      showToast('Not quite enough', `${def.name} costs ${def.cost} Pints. The landlord has checked the till twice.`);
      openShop('rooms');
      return false;
    }
    spend(cost);
    room.unlocked = true;
    room.damaged = false;
    room.zone = false;
    if (roomId === 'cellar') state.homeRoom = 'cellar';
    pushNews('ROOM OPENED', `${def.name.toUpperCase()} OPENS ITS DOORS`, `${def.special}. The rent is paid in advance, naturally.`);
    showToast('A new room', `${def.name} is open. There are now more ways to be quiet in public.`);
    if (roomId === 'snug') setCaption('The Snug is for scientists only. Their tweed has been entered in the guest book.');
    if (roomId === 'cellar') setCaption('The Silencer now lives in the Cellar. The building has a reassuringly thick ceiling.');
    if (roomId === 'roof') setCaption(isSummer() ? 'A terrace, a Thames breeze, and considerably more things to absorb.' : 'The roof is ready. London is not yet having summer.');
    checkWinCondition();
    renderUI();
    drawStage();
    saveState();
    return true;
  }

  function tryRebuildRoom(roomId) {
    const def = roomDef(roomId);
    const room = state.rooms[roomId];
    const cost = { pints: Math.max(25, Math.ceil(def.cost * .5)) };
    if (!canAfford(cost)) {
      showToast('Repairs are expensive', `Rebuilding the ${def.name} costs ${cost.pints} Pints. The quote does not include the wallpaper.`);
      return false;
    }
    spend(cost);
    room.damaged = false;
    room.zone = false;
    if (!isOperational(state.homeRoom)) state.homeRoom = roomId === 'cellar' ? 'cellar' : 'general';
    pushNews('REBUILDING WORKS', `${def.name.toUpperCase()} REOPENS AFTER “AN INCIDENT”`, 'The landlord has declined to specify which incident. The invoice is very specific.');
    showToast('Back in business', `${def.name} has been rebuilt. There is a fresh coat of paint over the scorch marks.`);
    renderUI();
    drawStage();
    saveState();
    return true;
  }

  function toggleZone(roomId) {
    const room = state.rooms[roomId];
    const def = roomDef(roomId);
    if (!room.unlocked) return tryUnlockRoom(roomId);
    if (room.damaged) return tryRebuildRoom(roomId);
    if (state.powerCutUntil > state.gameSeconds) {
      showToast('Power cut', 'The Fenton Silencer has been deprived of electricity until the lights return.');
      return false;
    }
    if (!isOperational(state.homeRoom)) {
      showToast('Silencer out of order', 'The housing is rubble. Rebuild a room before asking the apparatus to listen again.');
      return false;
    }
    room.zone = !room.zone;
    if (room.zone) {
      setCaption(`${def.name}: zone on. The room has become beautifully quiet, and the machine has noticed.`);
      announce(`${def.name} silencer zone on`);
    } else {
      setCaption(`${def.name}: zone off. The conversation has returned to its usual volume.`);
      announce(`${def.name} silencer zone off`);
    }
    playTinySound(room.zone ? 440 : 310, .045);
    renderUI();
    drawStage();
    saveState();
    return true;
  }

  function possibleRoomsFor(type) {
    return ROOM_DEFS.filter((def) => {
      if (!isOperational(def.id) || def.seats === 0 || activePatrons(def.id).length >= seatLimit(def.id)) return false;
      if (def.id === 'backroom' && state.eventUntil <= state.gameSeconds) return false;
      if (def.id === 'roof' && !isSummer()) return false;
      if (def.id === 'snug' && type !== 'scientist') return false;
      if (def.id === 'upstairs' && !['writer', 'editor'].includes(type)) return false;
      return true;
    });
  }

  function choosePatronType() {
    const entries = Object.entries(PATRONS);
    let pool = entries;
    // Burt's noise is unwelcome even to the apparatus; he only enters while at least one zone is off.
    if (activeZoneCount() === ROOM_DEFS.filter((room) => isOperational(room.id)).length) {
      pool = entries.filter(([key]) => key !== 'burt');
    }
    const total = pool.reduce((sum, [, def]) => sum + def.weight, 0);
    let roll = Math.random() * total;
    for (const [key, def] of pool) {
      roll -= def.weight;
      if (roll <= 0) return key;
    }
    return 'regular';
  }

  function spawnPatron(forcedType = null, forcedRoom = null, forcedName = null) {
    if (state.gameOver || state.won || state.explosionFreeze > 0) return null;
    let type = forcedType || choosePatronType();
    if (type === 'burt' && activeZoneCount() >= ROOM_DEFS.filter((room) => isOperational(room.id)).length) {
      type = 'regular';
    }
    let candidates = possibleRoomsFor(type);
    if (type === 'burt') candidates = candidates.filter((room) => !zoneIsOn(room.id));
    if (forcedRoom) candidates = candidates.filter((room) => room.id === forcedRoom);
    if (!candidates.length) {
      if (!forcedRoom) {
        state.reputation = Math.max(0, state.reputation - 1);
        pushNews('NO ROOM AT THE BAR', 'A VISITOR HAS BEEN TURNED AWAY', 'There was no seat. The visitor has told a friend, who is probably in the next queue.');
        setCaption('No seat. Reputation −1. One can only be hospitable up to the legal capacity of the room.');
        checkLossCondition('There was no seat, and then another no seat, until nobody thought to ask again.');
      }
      return null;
    }
    let room = candidates[Math.floor(Math.random() * candidates.length)];
    // The specialist rooms are preferred, without making the ordinary bars feel empty.
    if (type === 'scientist' && candidates.some((entry) => entry.id === 'snug') && Math.random() < .72) room = candidates.find((entry) => entry.id === 'snug');
    if (['writer', 'editor'].includes(type) && candidates.some((entry) => entry.id === 'upstairs') && Math.random() < .7) room = candidates.find((entry) => entry.id === 'upstairs');
    if (type === 'burt') room = candidates[Math.floor(Math.random() * candidates.length)];
    const def = PATRONS[type];
    const maxPatience = randomBetween(30, 90);
    const name = forcedName || def.names[Math.floor(Math.random() * def.names.length)];
    const patron = {
      id: state.nextPatronId++, type, name, roomId: room.id,
      patience: maxPatience, patienceMax: maxPatience, productionClock: 0,
      born: state.gameSeconds, phase: Math.random() * Math.PI * 2
    };
    state.patrons.push(patron);
    if (type === 'harry') {
      addResource('research', 1);
      addResource('scoops', 1);
      showToast('A cryptic visitor', 'Harry Purvis has left a note in the margin. It is mostly about thermodynamics.', 5400);
    }
    if (type === 'john') addResource('manuscripts', 1);
    if (type === 'burt') {
      state.rooms[room.id].noiseSpike += 40;
      pushNews('BURT HUGGINS RANT', '“I CAN STILL HEAR MYSELF THINK,” SHOUTS BURT', 'Burt Huggins has taken the floor. The floor would prefer not to be involved.');
      setCaption('Burt Huggins is in the room. The Silencer is off. The neighbours have begun taking notes.');
    } else if (type === 'harry') {
      pushNews('PURVIS VISITS', 'A STRANGER LEAVES A NOTE UNDER HIS GLASS', '“The energy has not gone away,” it reads. “It has merely changed its address.”', 'opening');
    } else if (type === 'john') {
      setCaption('John Christopher has arrived. He is reading quietly, which is not the same as being invisible.');
    }
    return patron;
  }

  function leavePatron(patron, reason = 'patience', angry = true) {
    const index = state.patrons.findIndex((entry) => entry.id === patron.id);
    if (index < 0) return;
    const room = state.rooms[patron.roomId];
    if (angry) {
      room.noiseSpike += 20;
      state.reputation = Math.max(0, state.reputation - 2);
      pushNews('ANGRY DEPARTURE', `${patron.name.toUpperCase()} LEAVES WITH A REMARK`, `${patron.name} was not served in time. The remark was +20 dB and −2 Reputation.`);
      setCaption(`${patron.name} has left angry. Noise +20 dB. Reputation −2. The door has been judged inadequate.`);
    } else if (reason === 'burt') {
      setCaption('John Christopher has gone. Burt has finally managed to be interesting to somebody.');
    }
    state.patrons.splice(index, 1);
    if (state.selectedPatron === patron.id) {
      state.selectedPatron = null;
      state.beerReady = false;
    }
    if (reason === 'noise') announce(`${patron.name} has left because it is too loud`);
    checkLossCondition('The White Hart has lost the confidence of its neighbourhood.');
  }

  function selectPatron(patronId) {
    const patron = state.patrons.find((entry) => entry.id === patronId);
    if (!patron) return;
    if (state.selectedPatron === patronId && state.beerReady) {
      servePatron(patron);
      return;
    }
    state.selectedPatron = patronId;
    state.beerReady = false;
    const kind = PATRONS[patron.type];
    setCaption(`${patron.name} · ${kind.label}. ${kind.noise} dB of conversation. ${Math.ceil(patron.patience)} seconds of patience, give or take an anecdote.`);
    playTinySound(370, .04);
    renderUI();
    drawStage();
  }

  function pourSelectedPint() {
    const patron = state.patrons.find((entry) => entry.id === state.selectedPatron);
    if (!patron || state.beerReady) return;
    state.beerReady = true;
    setCaption(`Pint poured for ${patron.name}. Tap the same patron to hand it over. Civilisation depends on the sequence.`);
    playTinySound(550, .08);
    renderUI();
    drawStage();
    announce(`Pint ready for ${patron.name}. Tap them again to serve.`);
  }

  function servePatron(patron) {
    const index = state.patrons.findIndex((entry) => entry.id === patron.id);
    if (index < 0) return;
    const servedType = patron.type;
    const payout = state.amenities.betterBeer ? 12 : 8;
    addResource('pints', payout);
    state.reputation = Math.min(100, state.reputation + .25);
    state.patrons.splice(index, 1);
    state.selectedPatron = null;
    state.beerReady = false;
    playTinySound(740, .06);
    setCaption(`${patron.name} has been served. +${payout} Pints. The transaction was conducted without a single form.`);
    if (servedType === 'burt') {
      const john = state.patrons.find((entry) => entry.type === 'john');
      if (john) leavePatron(john, 'burt', false);
      pushNews('A VERY LOUD ROUND', 'BURT HUGGINS IS PLEASED WITH THE SERVICE', 'John Christopher has left. The glasses are still trembling.');
      showToast('Burt Huggins served', 'Burt is happy. The rest of the room is considering a transfer.', 5200);
    }
    if (servedType === 'harry') showToast('A note with the change', 'Harry Purvis has paid in exact change. He was not carrying any money.', 5200);
    if (servedType === 'john') showToast('A quiet regular', 'John Christopher has left a manuscript on the table. Nobody remembers seeing him write it.', 5200);
    renderUI();
    drawStage();
    checkWinCondition();
  }

  function autoServe() {
    if (!state.staff.barmaid || !state.patrons.length) return;
    const patron = [...state.patrons].sort((a, b) => a.patience - b.patience)[0];
    if (!patron) return;
    const payout = state.amenities.betterBeer ? 12 : 8;
    addResource('pints', payout);
    state.reputation = Math.min(100, state.reputation + .25);
    state.patrons = state.patrons.filter((entry) => entry.id !== patron.id);
    if (state.selectedPatron === patron.id) { state.selectedPatron = null; state.beerReady = false; }
    setCaption(`The barmaid has served ${patron.name} without asking anyone's permission. +${payout} Pints.`);
    if (Math.random() < .25) showToast('The Barmaid', 'The Barmaid has dealt with the queue. Her method is not in the handbook.', 4200);
    if (patron.type === 'burt') {
      const john = state.patrons.find((entry) => entry.type === 'john');
      if (john) leavePatron(john, 'burt', false);
    }
  }

  function checkNoiseDepartures() {
    ROOM_DEFS.forEach((room) => {
      if (!isOperational(room.id) || zoneIsOn(room.id)) return;
      const noise = sourceNoise(room.id);
      const toLeave = activePatrons(room.id).filter((patron) => noise > PATRONS[patron.type].leavesAt);
      toLeave.forEach((patron) => leavePatron(patron, 'noise', true));
    });
  }

  function updatePatrons(dt) {
    for (const patron of [...state.patrons]) {
      patron.patience -= dt;
      patron.productionClock += dt;
      const def = PATRONS[patron.type];
      if (def.production && patron.productionClock >= def.production.seconds) {
        const cycles = Math.floor(patron.productionClock / def.production.seconds);
        for (let n = 0; n < cycles; n++) {
          Object.entries(def.production).forEach(([resource, amount]) => {
            if (resource !== 'seconds') addResource(resource, amount);
          });
        }
        patron.productionClock -= cycles * def.production.seconds;
      }
      if (patron.patience <= 0) leavePatron(patron, 'patience', true);
    }
  }

  function setRandomSpawnTime() {
    const reputationMultiplier = 1.45 - state.reputation * .0045;
    const rivalMultiplier = state.rivalUntil > state.gameSeconds ? 1.11 : 1;
    state.nextSpawnAt = state.gameSeconds + randomBetween(5, 15) * reputationMultiplier * rivalMultiplier;
  }

  function startOperaNight() {
    ROOM_DEFS.forEach((room) => {
      if (isOperational(room.id)) {
        state.rooms[room.id].operaNoise = 50;
        state.rooms[room.id].eventNoiseUntil = state.gameSeconds + 35;
      }
    });
    state.eventUntil = state.gameSeconds + 35;
    state.currentEvent = 'Opera Night';
    state.energy += 200;
    pushNews('OPERA NIGHT', 'SILENCE! LOCAL PUB’S MIRACLE DEVICE STUNS OPERA CROWD', NEWS_QUOTES[0][0]);
    setCaption('Opera Night. All rooms +50 dB. The Silencer has stored 200 SE without consulting the management.');
    showToast('OPERA NIGHT', 'All rooms +50 dB. Silence Energy +200. The singer has found the one note the apparatus cannot ignore.', 7800);
    if (state.energy >= capacity()) beginExplosion(false);
  }

  function rollRandomEvent() {
    state.nextEventAt = state.gameSeconds + randomBetween(120, 300);
    const roll = Math.random() * 100;
    if (roll < 5) {
      const noisy = maxRoomNoise();
      pushNews('HEALTH INSPECTOR', 'THE INSPECTOR HAS REQUESTED A QUIETER TABLE', noisy > 90 ? 'Noise exceeds 90 dB. A £100 Pints fine has been issued in the public interest.' : 'The inspector has found the noise acceptable. This is not a compliment.');
      if (noisy > 90) {
        state.resources.pints = Math.max(0, state.resources.pints - 100);
        showToast('Health Inspector', 'The room is over 90 dB. Fine: 100 Pints. The inspector has kept the receipt.', 7200);
      } else showToast('Health Inspector', 'The inspector has found nothing wrong. They will return when it is louder.', 6500);
    } else if (roll < 8) {
      state.resources.manuscripts += 10;
      state.resources.scoops += 5;
      pushNews('FAMOUS AUTHOR', 'A FAMOUS AUTHOR HAS BEEN SPOTTED IN THE SALOON', 'They left ten manuscripts and five scoops. The signature is difficult to read.');
      showToast('A famous author', '+10 Manuscripts and +5 Scoops. They were expected to leave a note, but left a pile instead.');
    } else if (roll < 10) {
      state.powerCutRestore = ROOM_DEFS.reduce((result, room) => { result[room.id] = state.rooms[room.id].zone; return result; }, {});
      state.powerCutUntil = state.gameSeconds + 30;
      ROOM_DEFS.forEach((room) => { if (state.rooms[room.id].unlocked) state.rooms[room.id].zone = false; });
      state.currentEvent = 'Power Cut';
      state.eventUntil = state.powerCutUntil;
      pushNews('POWER CUT', 'THE WHITE HART GOES DARK. THE PUB DOES NOT GET ANY QUIETER.', 'The Silencer is off for 30 seconds. The candles have been found, but nobody knows where the matches are.');
      showToast('Power Cut', 'Silencer off for 30 seconds. Noise is back in fashion.', 6500);
    } else if (roll < 15) {
      state.resources.research += 1;
      pushNews('PURVIS VISITS', 'HARRY PURVIS LEAVES A SINGLE, CRYPTIC FIGURE', 'A neatly written “1” appears on the back of the drinks bill. +1 Research.', 'opening');
      showToast('Purvis visits', '+1 Research. Harry has left a hint, though the hint is apparently the number one.');
    } else if (roll < 16) {
      state.rivalUntil = state.gameSeconds + 300;
      pushNews('RIVAL PUB OPENS', 'A NEW PUBLIC HOUSE OPENS AROUND THE CORNER', 'Patron arrivals are down 10% for five minutes. Their sign is spelled correctly, which is ominous.');
      showToast('Rival Pub Opens', 'Patron arrivals −10% for five minutes. They have a better sign. It will not last.');
    } else if (roll < 20) {
      state.energy += 50;
      pushNews('STUDENT PRANK', 'STUDENTS LEAVE A NOTE BESIDE THE FENTON SILENCER', 'The note says “What does this lever do?” The Silence Energy meter says +50.');
      showToast('Student Prank', 'Silence Energy +50. The students have gone on to study somewhere less expensive.', 6500);
      if (state.energy >= capacity()) beginExplosion(false);
    } else {
      pushNews('A QUIET EVENING', 'PUB REPORTS AN UNEVENTFUL EVENING', 'The reporter was unable to hear anything worth printing.');
    }
  }

  function storyForTier() {
    if (state.tier >= 2 && !state.storyFlags.demo) {
      state.storyFlags.demo = true;
      if (!state.diaryPages.includes('demo')) state.diaryPages.push('demo');
      pushNews('FENTON’S DEMONSTRATION', 'FENTON DEMONSTRATES THE IMPROVED SILENCER', '“You may not hear it,” says Fenton, “but it is doing something.” The tubes flicker politely.', 'demo');
      showToast('Fenton’s Demonstration', 'The improved valves are in. Fenton says the faint hum is “a sign of success.”', 7200);
    }
    if (state.tier >= 3 && !state.storyFlags.tutorialExplosion) {
      state.storyFlags.tutorialExplosion = true;
      state.tutorialExplosionAt = state.gameSeconds + 4;
      if (!state.diaryPages.includes('explosion')) state.diaryPages.push('explosion');
    }
    if (state.tier >= 4 && !state.storyFlags.secret) {
      state.storyFlags.secret = true;
      if (!state.diaryPages.includes('secret')) state.diaryPages.push('secret');
      state.resources.research += 1;
      pushNews('PURVIS’S SECRET', 'PURVIS EXPLAINS THE CONSERVATION OF ENERGY', '“You can’t destroy energy, old boy. You can only move it somewhere else. Somewhere else is usually where you least want it.”', 'secret');
      showToast('Purvis’s Secret', 'Purvis has explained the Silencer. He has not explained the cellar.', 8000);
    }
    if (state.tier >= 5 && !state.storyFlags.perfected) {
      state.storyFlags.perfected = true;
      if (!state.diaryPages.includes('ghost')) state.diaryPages.push('ghost');
      pushNews('THE PERFECTED SILENCER', 'THE FENTON SILENCER IS PRONOUNCED PERFECT', 'Fenton’s ghost has been seen buying a round. The pub has declined to enter it on the till.', 'ghost');
      showToast('Perfected', 'The apparatus is perfect. The work, unfortunately, is not yet finished.', 7600);
    }
    if (state.resources.loyalty >= 50 && !state.storyFlags.revenge) {
      state.storyFlags.revenge = true;
      pushNews('KENDELL’S REVENGE', 'AN OPERA SCORE IS FOUND IN THE CELLAR', 'Kendell has arranged a rather personal performance. The notes are sharp; the consequences may be sharper.');
      showToast('Kendell’s Revenge', 'A cut scene, an opera score, and a receipt for one very suspicious soprano.', 7200);
    }
  }

  function enterNewWednesday() {
    if (state.lastExplosionWeek === state.week) state.weeksSurvived = 0;
    else state.weeksSurvived += 1;
    state.week += 1;
    state.dayElapsed = 0;
    state.highNoiseSeconds = 0;
    state.currentEvent = '';
    if (Math.random() < .1) startOperaNight();
    else {
      setCaption(`Wednesday ${String(state.week).padStart(2, '0')}. The chalkboard has been wiped. The energy has not.`);
      if (Math.random() < .42) showToast('Purvis’s advice', PURVIS_TIPS[Math.floor(Math.random() * PURVIS_TIPS.length)], 7000);
    }
    state.nextSpawnAt = state.gameSeconds + randomBetween(5, 15) * (1.45 - state.reputation * .0045);
    pushNews('A NEW WEDNESDAY', `WEDNESDAY ${String(state.week).padStart(2, '0')} OPENS AT THE WHITE HART`, 'The regulars return. The clock is very sure this has happened before.');
    storyForTier();
    checkWinCondition();
  }

  function beginExplosion(tutorial = false) {
    if (state.explosionFreeze > 0 || state.gameOver || state.won) return;
    state.pendingExplosion = { tutorial };
    state.explosionFreeze = 2;
    state.venting = false;
    dom.crisis.hidden = false;
    dom.crisis.classList.remove('is-boom', 'is-loss', 'is-win');
    dom.crisisKicker.textContent = 'A MOMENT OF PERFECT SILENCE';
    dom.crisisTitle.textContent = 'Nobody said a word.';
    dom.crisisCopy.textContent = 'Even the clock seemed to feel it had been rather loud.';
    dom.crisisButton.hidden = true;
    dom.crisisButton.textContent = 'CONTINUE →';
    dom.crisis.setAttribute('aria-label', 'The pub is silent for two seconds');
    document.body.classList.add('critical-signal');
    hushForExplosion();
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    setCaption('Nothing. Not even the apparatus. Two seconds, if nobody minds.');
    announce('The Fenton Silencer has reached critical mass. Two seconds of silence.');
  }

  function resolveExplosion() {
    const tutorial = Boolean(state.pendingExplosion?.tutorial);
    state.pendingExplosion = null;
    state.explosionFreeze = 0;
    document.body.classList.remove('critical-signal');
    dom.crisis.classList.add('is-boom');
    triggerBoomSound();
    if (tutorial) {
      state.energy = 0;
      state.tutorialExplosionAt = 0;
      dom.crisisKicker.textContent = 'THE EXPLOSION · DEMONSTRATION ONLY';
      dom.crisisTitle.textContent = 'A very convincing demonstration.';
      dom.crisisCopy.textContent = 'Fenton insists nobody was in the room. Nobody recalls there being a room.';
      dom.crisisButton.hidden = false;
      pushNews('THE EXPLOSION', 'FENTON’S DEMONSTRATION ENDS WITH A VERY LOUD BOOM', 'Non-damaging demonstration. The physicists have written “we told you so” on a clipboard.', 'explosion');
      setCaption('The tutorial explosion has been carefully demonstrated. The paperwork has not been carefully demonstrated.');
      state.crisisDismissAt = realClock + 7;
      showToast('A controlled demonstration', 'No damage. No lost patrons. Fenton is very keen to call it controlled.', 6000);
      renderUI();
      return;
    }

    state.explosions += 1;
    state.weeksSurvived = 0;
    state.lastExplosionWeek = state.week;
    const home = state.homeRoom;
    const cellarProtection = home === 'cellar';
    const casing = state.seUpgrades.casing ? .75 : 1;
    const radius = cellarProtection ? .5 : 1;
    const homePatrons = activePatrons(home);
    const homeLost = homePatrons.length;
    state.patrons = state.patrons.filter((patron) => patron.roomId !== home);
    state.rooms[home].damaged = true;
    state.rooms[home].zone = false;
    let repDamage = 10 * casing;
    const adj = ROOM_ADJACENCY[home] || [];
    adj.forEach((roomId) => {
      if (!isOperational(roomId)) return;
      const people = activePatrons(roomId);
      const lossShare = Math.min(1, .5 * radius * (state.seUpgrades.casing ? .75 : 1));
      const lostCount = Math.ceil(people.length * lossShare);
      const lostIds = new Set(people.slice(0, lostCount).map((person) => person.id));
      state.patrons = state.patrons.filter((person) => !lostIds.has(person.id));
      state.rooms[roomId].noiseSpike += 20;
      repDamage += 5 * radius * casing;
    });
    state.reputation = Math.max(0, state.reputation - repDamage);
    state.energy = 0;
    state.tier = 1;
    state.venting = false;
    state.selectedPatron = null;
    state.beerReady = false;
    ROOM_DEFS.forEach((room) => { state.rooms[room.id].zone = false; });
    if (home === 'cellar' || home === 'general') {
      state.homeRoom = isOperational('general') ? 'general' : (ROOM_DEFS.find((room) => isOperational(room.id))?.id || home);
    } else {
      state.homeRoom = isOperational('general') ? 'general' : (ROOM_DEFS.find((room) => isOperational(room.id))?.id || home);
    }
    if (home === 'general') state.rooms.general.damaged = true;
    state.currentEvent = 'Explosion';
    state.eventUntil = state.gameSeconds + 12;
    pushNews('FENTON SILENCER EXPLODES', 'FENTON SILENCER EXPLODES: “WE TOLD YOU SO,” SAY PHYSICISTS.', `The ${roomDef(home).name} is destroyed. ${homeLost} patron${homeLost === 1 ? '' : 's'} lost. The apparatus has reset to Tier 1.`, 'explosion');
    setCaption('The White Hart has had an incident. The White Hart is still open. The landlord has always been very clear on this point.');
    dom.crisisKicker.textContent = 'EXTRA! EXTRA!';
    dom.crisisTitle.textContent = 'FENTON SILENCER EXPLODES';
    dom.crisisCopy.textContent = '“We told you so,” say physicists. The White Hart remains open, pending a small amount of rebuilding.';
    dom.crisisButton.hidden = false;
    dom.crisisButton.textContent = 'RETURN TO THE PUB  →';
    dom.crisis.classList.add('is-boom');
    document.body.classList.add('shake-screen');
    setTimeout(() => document.body.classList.remove('shake-screen'), 1300);
    state.crisisDismissAt = realClock + 7;
    showToast('A newspaper extra', 'The Fenton Silencer has reset to Tier 1. The landlord has reset the table as well.', 7000);
    if (state.explosions >= 3) {
      gameOver('Three explosions in one session. The White Hart closed today. The silence was deafening.');
    } else {
      checkLossCondition('The White Hart lost too many patrons in the blast.');
    }
    renderUI();
    saveState();
  }

  function checkLossCondition(reason) {
    if (state.gameOver || state.won) return;
    if (state.reputation <= 0) gameOver(reason || 'Reputation reached zero. The White Hart closed today. The silence was deafening.');
  }

  function gameOver(reason) {
    if (state.gameOver) return;
    state.gameOver = true;
    state.paused = true;
    state.ending = 'closed';
    dom.crisis.hidden = false;
    dom.crisis.classList.remove('is-boom', 'is-win');
    dom.crisis.classList.add('is-loss');
    dom.crisisKicker.textContent = 'NOTICE OF CLOSURE';
    dom.crisisTitle.textContent = 'The White Hart closed today.';
    dom.crisisCopy.textContent = 'The silence was deafening.';
    if (reason && !reason.includes('deafening')) dom.crisisCopy.textContent = `${reason} The silence was deafening.`;
    dom.crisisButton.hidden = false;
    dom.crisisButton.textContent = 'START A NEW WEDNESDAY  ↻';
    pushNews('GAME OVER', 'THE WHITE HART CLOSED TODAY', 'The silence was deafening.');
    renderUI();
    saveState();
  }

  function conditionsMet() {
    return state.tier >= 5 && state.weeksSurvived >= 10 &&
      state.resources.pints >= 1000 && state.resources.scoops >= 50 && state.resources.manuscripts >= 50 &&
      state.resources.research >= 100 && state.resources.loyalty >= 100 &&
      ROOM_DEFS.every((room) => state.rooms[room.id].unlocked && !state.rooms[room.id].damaged);
  }

  function checkWinCondition() {
    if (state.won || state.gameOver || !conditionsMet()) return;
    state.won = true;
    state.paused = true;
    state.ending = state.explosions === 0 ? 'legendary' : 'resilient';
    dom.crisis.hidden = false;
    dom.crisis.classList.remove('is-boom', 'is-loss');
    dom.crisis.classList.add('is-win');
    dom.crisisKicker.textContent = 'A VERY RARE FINAL EDITION';
    dom.crisisTitle.textContent = 'The White Hart is legendary.';
    dom.crisisCopy.textContent = 'Purvis reveals the Silencer’s true potential. Fenton’s ghost buys a round. For once, nobody asks what is in it.';
    dom.crisisButton.hidden = false;
    dom.crisisButton.textContent = 'RETURN TO THE WHITE HART  →';
    pushNews('THE WHITE HART IS LEGENDARY', 'THE PERFECTED SILENCER MAKES HISTORY', 'Purvis reveals its true potential. Fenton’s ghost buys a round. The pub remains open.');
    if (!state.diaryPages.includes('ghost')) state.diaryPages.push('ghost');
    renderUI();
    saveState();
  }

  function closeCrisis() {
    if (state) state.crisisDismissAt = 0;
    if (state.gameOver) {
      startNewGame();
      return;
    }
    if (state.won) {
      dom.crisis.hidden = true;
      dom.crisis.classList.remove('is-boom', 'is-loss', 'is-win');
      state.paused = false;
      renderUI();
      return;
    }
    dom.crisis.hidden = true;
    dom.crisis.classList.remove('is-boom', 'is-loss', 'is-win');
    state.crisisVisible = false;
  }

  function beginNewWednesday() {
    state.dayElapsed += 0;
    state.gameSeconds += 0;
    state.weeksSurvived = 0;
    state.explosions = 0;
    state.week = 1;
    state.resources = { pints: 125, scoops: 4, manuscripts: 3, research: 45, loyalty: 12 };
    state.reputation = 100;
    state.energy = 18;
    state.tier = 1;
    state.homeRoom = 'general';
    state.rooms = freshState().rooms;
    state.patrons = [];
    state.nextPatronId = 1;
    state.staff = freshState().staff;
    state.amenities = freshState().amenities;
    state.soundproofedRooms = [];
    state.seUpgrades = freshState().seUpgrades;
    state.venting = false;
    state.paused = false;
    state.dayElapsed = 0;
    state.gameSeconds = 0;
    state.nextSpawnAt = 7;
    state.nextEventAt = 145;
    state.nextTipAt = 32;
    state.nextBarmaidAt = 5;
    state.nextScientistAt = 30;
    state.highNoiseSeconds = 0;
    state.lastExplosionWeek = 0;
    state.currentEvent = '';
    state.eventUntil = 0;
    state.rivalUntil = 0;
    state.powerCutUntil = 0;
    state.powerCutRestore = null;
    state.storyFlags = { demo: false, revenge: false, tutorialExplosion: false, secret: false, perfected: false };
    state.diaryPages = ['opening'];
    state.clippings = [{ tag: 'LATEST EDITION · WEDNESDAY', headline: '“Regulars insist the pub is perfectly normal.”', copy: 'The Fenton apparatus has been switched on. Nobody is quite sure by whom.', time: '7:00 PM' }];
    state.selectedPatron = null;
    state.beerReady = false;
    state.roomPage = 0;
    renderedTabsKey = '';
    state.pendingExplosion = null;
    state.explosionFreeze = 0;
    state.crisisVisible = false;
    state.crisisDismissAt = 0;
    state.gameOver = false;
    state.won = false;
    state.ending = '';
    state.tutorialExplosionAt = 0;
    seedStartingPatrons(state);
    dom.crisis.hidden = true;
    document.body.classList.remove('is-paused', 'energy-alert', 'critical-signal');
    setCaption('Three regulars have arrived. One of them has brought a notebook and an opinion.');
    renderUI();
    drawStage();
    saveState();
    showToast('Wednesday, 7:00 PM', 'The White Hart is open. Serve the regulars, keep an eye on the Silencer, and try not to make the physicists right.', 9000);
  }

  function hasSavedGame() {
    try { return Boolean(localStorage.getItem(SAVE_KEY)); } catch (_) { return false; }
  }

  function showSavedGameOver() {
    dom.crisis.hidden = false;
    dom.crisis.classList.add('is-loss');
    dom.crisisKicker.textContent = 'NOTICE OF CLOSURE';
    dom.crisisTitle.textContent = 'The White Hart closed today.';
    dom.crisisCopy.textContent = 'The silence was deafening.';
    dom.crisisButton.hidden = false;
    dom.crisisButton.textContent = 'START A NEW WEDNESDAY  ↻';
    state.paused = true;
    renderUI();
  }

  function showSavedWin() {
    dom.crisis.hidden = false;
    dom.crisis.classList.add('is-win');
    dom.crisisKicker.textContent = 'A VERY RARE FINAL EDITION';
    dom.crisisTitle.textContent = 'The White Hart is legendary.';
    dom.crisisCopy.textContent = 'Purvis reveals the Silencer’s true potential. Fenton’s ghost buys a round.';
    dom.crisisButton.hidden = false;
    dom.crisisButton.textContent = 'RETURN TO THE WHITE HART  →';
    state.paused = true;
    renderUI();
  }

  function startNewGame() {
    dismissToast();
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    state = freshState();
    seedStartingPatrons(state);
    modalMode = null;
    dom.modalRoot.hidden = true;
    dom.crisis.hidden = true;
    beginNewWednesday();
  }

  function tick(dt) {
    if (state.explosionFreeze > 0) {
      state.explosionFreeze -= dt;
      if (state.explosionFreeze <= 0) resolveExplosion();
      return;
    }
    if (state.paused || state.gameOver || state.won) return;
    state.gameSeconds += dt;
    state.dayElapsed += dt;

    if (state.powerCutUntil > 0 && state.gameSeconds >= state.powerCutUntil) {
      state.powerCutUntil = 0;
      if (state.powerCutRestore) {
        ROOM_DEFS.forEach((room) => { state.rooms[room.id].zone = Boolean(state.powerCutRestore[room.id]); });
        state.powerCutRestore = null;
      }
      state.currentEvent = '';
      pushNews('POWER RESTORED', 'THE LIGHTS RETURN TO THE WHITE HART', 'The apparatus resumes its work. Nobody has asked why it needed the lights.');
      showToast('Power restored', 'The Fenton Silencer is back on. The hum is, if anything, more confident.', 4500);
    }
    if (state.rivalUntil && state.gameSeconds >= state.rivalUntil) state.rivalUntil = 0;
    if (state.eventUntil && state.gameSeconds >= state.eventUntil) {
      state.eventUntil = 0;
      if (!state.powerCutUntil) state.currentEvent = '';
    }
    ROOM_DEFS.forEach((room) => {
      const record = state.rooms[room.id];
      record.noiseSpike = Math.max(0, record.noiseSpike - dt * 2.2);
      if (record.eventNoiseUntil && state.gameSeconds >= record.eventNoiseUntil) {
        record.operaNoise = 0;
        record.eventNoiseUntil = 0;
      }
    });

    const rates = resourceRates();
    Object.entries(rates).forEach(([resource, rate]) => addResource(resource, rate * dt));
    updatePatrons(dt);
    checkNoiseDepartures();

    if (state.venting) {
      const rate = ventRate();
      if (rate > 0) state.energy = Math.max(0, state.energy - rate * dt);
      if (state.energy <= 0.01) state.energy = 0;
    }
    const incoming = totalEnergyRate();
    state.energy = Math.min(capacity(), state.energy + incoming * dt);

    if (state.staff.barmaid && state.gameSeconds >= state.nextBarmaidAt) {
      autoServe();
      state.nextBarmaidAt = state.gameSeconds + 5;
    }
    if (state.amenities.thamesView && state.gameSeconds >= state.nextScientistAt) {
      const rounds = Math.floor((state.gameSeconds - state.nextScientistAt) / 30) + 1;
      for (let n = 0; n < rounds; n++) spawnPatron('scientist');
      state.nextScientistAt += rounds * 30;
    }
    if (state.gameSeconds >= state.nextSpawnAt) {
      spawnPatron();
      setRandomSpawnTime();
    }
    if (state.gameSeconds >= state.nextEventAt) rollRandomEvent();
    if (state.gameSeconds >= state.nextTipAt) {
      if (Math.random() < .38) showToast('A word from Harry Purvis', PURVIS_TIPS[Math.floor(Math.random() * PURVIS_TIPS.length)], 6900);
      state.nextTipAt = state.gameSeconds + randomBetween(48, 95);
    }
    if (state.tutorialExplosionAt && state.gameSeconds >= state.tutorialExplosionAt && !state.pendingExplosion) beginExplosion(true);

    const loudest = maxRoomNoise();
    if (loudest > 95) state.highNoiseSeconds += dt;
    else state.highNoiseSeconds = 0;
    if (state.highNoiseSeconds >= 60) {
      gameOver('The Health Inspector has shut the pub for noise above 95 dB for a full minute. The silence was deafening.');
      return;
    }
    if (state.energy >= capacity() - .001) {
      state.energy = capacity();
      beginExplosion(false);
      return;
    }
    if (state.dayElapsed >= NIGHT_LENGTH) enterNewWednesday();
    checkWinCondition();
  }

  function runShopAction(action, id, extra = {}) {
    if (action === 'unlock-room') tryUnlockRoom(id);
    else if (action === 'rebuild-room') tryRebuildRoom(id);
    else if (action === 'tier') buyTier(Number(id));
    else if (action === 'se-upgrade') buySEUpgrade(id);
    else if (action === 'staff') buyStaff(id);
    else if (action === 'amenity') buyAmenity(id, extra.roomId);
    renderModal();
    renderUI();
    drawStage();
  }

  function buyTier(tier) {
    if (tier !== state.tier + 1) {
      showToast('One step at a time', 'The Silencer must be improved one tier at a time. Fenton is very strict about ladders.');
      return false;
    }
    const def = SILENCER_TIERS[tier - 1];
    if (!canAfford(def.cost)) {
      showToast('More research required', `Tier ${tier} requires ${formatCost(def.cost)}.`);
      return false;
    }
    spend(def.cost);
    state.tier = tier;
    pushNews('SILENCER RESEARCH', `FENTON SILENCER: ${def.name.toUpperCase()} TIER INSTALLED`, `Capacity ${formatNumber(def.capacity)} SE · Absorption ${def.absorption} dB/sec · Vent ${def.vent} SE/sec.`);
    storyForTier();
    checkWinCondition();
    saveState();
    return true;
  }

  function buySEUpgrade(id) {
    const table = {
      filters: { cost: 50, max: 4, name: 'Better Filters' },
      microphones: { cost: 75, max: 3, name: 'Extra Microphone' },
      venting: { cost: 100, max: 4, name: 'Venting System' },
      casing: { cost: 150, max: 1, name: 'Reinforced Casing' },
      dump: { cost: 200, max: 1, name: 'Emergency Dump' }
    };
    const upgrade = table[id];
    if (!upgrade) return false;
    const count = id === 'dump' ? (state.seUpgrades.dumpUsed ? 1 : 0) : id === 'casing' ? (state.seUpgrades.casing ? 1 : 0) : state.seUpgrades[id];
    if (count >= upgrade.max) {
      showToast('Already fitted', `${upgrade.name} has already been fitted as often as the Silencer can tolerate.`);
      return false;
    }
    if (state.energy < upgrade.cost) {
      showToast('Not enough Silence Energy', `${upgrade.name} costs ${upgrade.cost} SE. It is a peculiar thing to be short of silence.`);
      return false;
    }
    if (id === 'dump') {
      state.energy = Math.max(0, state.energy - upgrade.cost);
      state.energy *= .5;
      state.seUpgrades.dumpUsed = true;
      showToast('Emergency Dump', '200 SE spent. Half the remainder vented immediately. Once per session means once per session.');
      pushNews('EMERGENCY DUMP', 'THE SILENCER PERFORMS AN UNSCHEDULED EXHALE', 'Half the remaining Silence Energy is gone. The other half has been asked to wait.');
    } else {
      state.energy -= upgrade.cost;
      if (id === 'casing') state.seUpgrades.casing = true;
      else state.seUpgrades[id] += 1;
      const effect = id === 'filters' ? '+50 Capacity' : id === 'microphones' ? '+5 dB/sec absorption' : id === 'venting' ? '+2 SE/sec vent rate' : '−25% explosion damage';
      pushNews('SILENCER UPGRADE', `${upgrade.name.toUpperCase()} FITTED`, `${effect}. The invoice is attached to the machine with a small brass tack.`);
      showToast(upgrade.name, `${effect}. The Silence Energy buffer is now ${formatNumber(capacity())} SE.`);
    }
    saveState();
    return true;
  }

  function buyStaff(id) {
    const def = STAFF_DEFS.find((staff) => staff.id === id);
    if (!def || state.staff[id]) return false;
    if (!canAfford(def.cost)) {
      showToast('The till is not quite there', `${def.name} costs ${formatCost(def.cost)}.`);
      return false;
    }
    spend(def.cost);
    state.staff[id] = true;
    if (id === 'barmaid') state.nextBarmaidAt = state.gameSeconds + 5;
    pushNews('NEW MEMBER OF STAFF', `${def.name.toUpperCase()} JOINS THE WHITE HART`, def.effect);
    showToast(`${def.name} hired`, def.effect, 7200);
    saveState();
    return true;
  }

  function buyAmenity(id, roomId = '') {
    const def = AMENITY_DEFS.find((amenity) => amenity.id === id);
    if (!def) return false;
    if (id === 'soundproofing') {
      if (!roomId || !isOperational(roomId)) {
        showToast('Choose a room', 'Soundproofing belongs in an open room. Choose a room from the menu first.');
        return false;
      }
      if (state.soundproofedRooms.includes(roomId)) {
        showToast('Already soundproofed', `${roomDef(roomId).name} is already soundproofed. It is taking the compliment very well.`);
        return false;
      }
    } else if (state.amenities[id]) {
      showToast('Already installed', `${def.name} is already part of the pub. The jukebox remains silent.`);
      return false;
    }
    if (!canAfford(def.cost)) {
      showToast('The landlord checks the till', `${def.name} costs ${formatCost(def.cost)}.`);
      return false;
    }
    spend(def.cost);
    if (id === 'soundproofing') state.soundproofedRooms.push(roomId);
    else state.amenities[id] = true;
    if (id === 'thamesView') state.nextScientistAt = state.gameSeconds + 30;
    pushNews('PUB AMENITY', `${def.name.toUpperCase()} ADDED TO THE PUB`, id === 'soundproofing' ? `${roomDef(roomId).name}: −20% noise. A sensible use of exactly ${def.cost.pints} Pints.` : def.effect);
    showToast(def.name, id === 'soundproofing' ? `${roomDef(roomId).name} has been soundproofed. Noise −20%.` : def.effect, 7200);
    saveState();
    return true;
  }

  function openModal(mode, tab = null) {
    modalMode = { mode, tab: tab || (mode === 'shop' ? 'rooms' : null) };
    renderModal();
    dom.modalRoot.hidden = false;
    setTimeout(() => dom.modalClose.focus(), 0);
  }

  function closeModal() {
    modalMode = null;
    dom.modalRoot.hidden = true;
    if ($('#help-button')) $('#help-button').focus();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function itemCard({ icon = '✦', title, sub = '', body, cost, action, id, purchased = false, disabled = false, buttonText = 'BUY', status = '', selectedRoom = '' }) {
    const affordable = !cost || canAfford(cost);
    const missing = cost && !affordable;
    const costText = cost ? formatCost(cost) : '';
    return `<article class="shop-item ${purchased ? 'purchased' : ''} ${missing ? 'unaffordable' : ''}">
      <div class="shop-item-heading"><span class="shop-item-icon">${icon}</span><div><h3>${escapeHtml(title)}</h3><span class="item-sub">${escapeHtml(sub || '')}</span></div></div>
      <p>${escapeHtml(body)}</p>
      <div class="shop-item-foot">${status ? `<span class="item-status">${escapeHtml(status)}</span>` : `<span class="item-cost ${missing ? 'missing' : ''}">${escapeHtml(costText)}</span>`}
      ${purchased ? '<span class="item-status">FITTED</span>' : `<button class="item-buy" type="button" data-action="${escapeHtml(action || '')}" data-id="${escapeHtml(id || '')}" ${selectedRoom ? `data-room="${escapeHtml(selectedRoom)}"` : ''} ${disabled || !affordable ? 'disabled' : ''}>${escapeHtml(buttonText)}</button>`}</div>
    </article>`;
  }

  function roomShopMarkup() {
    const route = ROOM_DEFS.map((room, index) => {
      const record = state.rooms[room.id];
      const current = index === ROOM_DEFS.findIndex((entry) => !state.rooms[entry.id].unlocked || state.rooms[entry.id].damaged);
      return `<div class="route-stop ${record.unlocked && !record.damaged ? 'open' : ''} ${current ? 'current' : ''}"><b>${escapeHtml(room.short)}</b><span>${record.damaged ? 'REBUILD' : record.unlocked ? 'OPEN' : `${room.cost} P`}</span></div>`;
    }).join('');
    const cards = ROOM_DEFS.map((room, index) => {
      const record = state.rooms[room.id];
      const previous = ROOM_DEFS[index - 1];
      const canReach = !previous || (state.rooms[previous.id].unlocked && !state.rooms[previous.id].damaged);
      if (record.damaged) {
        const repair = Math.max(25, Math.ceil(room.cost * .5));
        return itemCard({ icon: '⚒', title: room.name, sub: 'DAMAGED · REBUILD REQUIRED', body: `${room.special}. Reopening costs half the original build, at least 25 Pints.`, cost: { pints: repair }, action: 'rebuild-room', id: room.id, buttonText: 'REBUILD' });
      }
      if (record.unlocked) return itemCard({ icon: room.id === 'cellar' ? '⌖' : '✦', title: room.name, sub: `${room.seats} PATRON ${room.seats === 1 ? 'SEAT' : 'SEATS'}`, body: room.special, purchased: true, status: room.id === 'cellar' && state.homeRoom === 'cellar' ? 'SILENCER HOUSING' : 'OPEN' });
      return itemCard({ icon: '▧', title: room.name, sub: canReach ? 'NEXT ON THE FLOOR PLAN' : 'OPEN THE PREVIOUS ROOM FIRST', body: room.special, cost: { pints: room.cost }, action: 'unlock-room', id: room.id, buttonText: canReach ? 'OPEN ROOM' : 'LOCKED', disabled: !canReach });
    }).join('');
    return `<p class="modal-kicker">THE PUB EXPANDS ONE DOOR AT A TIME</p><h2 class="modal-title" id="modal-title">Rooms &amp; improvements</h2><p class="modal-lede">Every new room brings more seats, more opportunities, and a fresh set of things to apologise for.</p>
      <div class="modal-notice"><span>✦</span><span>All rooms must be unlocked and undamaged for the White Hart to become legendary.</span></div>
      <div class="room-route">${route}</div><div class="shop-grid">${cards}</div>`;
  }

  function silencerShopMarkup() {
    const tierCards = SILENCER_TIERS.map((tier) => {
      if (tier.tier <= state.tier) return itemCard({ icon: '◉', title: `Tier ${tier.tier} · ${tier.name}`, sub: `${formatNumber(tier.capacity)} SE CAPACITY`, body: `${tier.absorption} dB/sec absorption · ${tier.vent} SE/sec vent rate.`, purchased: true, status: 'INSTALLED' });
      const next = tier.tier === state.tier + 1;
      return itemCard({ icon: '◉', title: `Tier ${tier.tier} · ${tier.name}`, sub: `${formatNumber(tier.capacity)} SE CAPACITY`, body: `${tier.absorption} dB/sec absorption · ${tier.vent} SE/sec vent rate.`, cost: tier.cost, action: 'tier', id: tier.tier, buttonText: next ? 'RESEARCH' : 'LOCKED', disabled: !next });
    }).join('');
    const seCards = [
      itemCard({ icon: '▤', title: 'Better Filters', sub: `INSTALLED ${state.seUpgrades.filters} / 4`, body: '+50 Silence Energy capacity. A little more room for one very specific mistake.', cost: { energy: 50 }, action: 'se-upgrade', id: 'filters', buttonText: 'FIT FILTERS', disabled: state.seUpgrades.filters >= 4 }),
      itemCard({ icon: '⌕', title: 'Extra Microphone', sub: `INSTALLED ${state.seUpgrades.microphones} / 3`, body: '+5 dB/sec absorption. It hears things the regular microphone was not told about.', cost: { energy: 75 }, action: 'se-upgrade', id: 'microphones', buttonText: 'ADD MIC', disabled: state.seUpgrades.microphones >= 3 }),
      itemCard({ icon: '↧', title: 'Venting System', sub: `INSTALLED ${state.seUpgrades.venting} / 4`, body: '+2 SE/sec safe vent rate. The pipe leads to a strictly unmarked destination.', cost: { energy: 100 }, action: 'se-upgrade', id: 'venting', buttonText: 'ADD VENT', disabled: state.seUpgrades.venting >= 4 }),
      itemCard({ icon: '▣', title: 'Reinforced Casing', sub: state.seUpgrades.casing ? 'FITTED' : 'ONE-TIME FITTING', body: 'Reduces explosion damage by 25%. Does not reduce the sound of the explosion.', cost: { energy: 150 }, action: 'se-upgrade', id: 'casing', buttonText: 'REINFORCE', purchased: state.seUpgrades.casing }),
      itemCard({ icon: '⌁', title: 'Emergency Dump', sub: state.seUpgrades.dumpUsed ? 'USED THIS SESSION' : 'ONCE PER SESSION', body: 'Instantly vents 50% of remaining Silence Energy. Costs 200 SE to operate.', cost: { energy: 200 }, action: 'se-upgrade', id: 'dump', buttonText: 'DUMP 50%', purchased: state.seUpgrades.dumpUsed })
    ].join('');
    return `<p class="modal-kicker">THE SCIENCE OF NOT HEARING SOMETHING</p><h2 class="modal-title" id="modal-title">Fenton Silencer</h2><p class="modal-lede">Absorption makes the room quiet; the resulting Silence Energy is less quiet about being stored.</p>
      <div class="modal-notice ${state.energy / capacity() >= .7 ? 'warn' : ''}"><span>🔇</span><span>Current store: <b>${formatNumber(state.energy, 1)} / ${formatNumber(capacity())} SE</b> · Spend SE to fit equipment, or vent it safely.</span></div>
      <h3 class="modal-kicker section-kicker">RESEARCH TIERS</h3><div class="shop-grid">${tierCards}</div>
      <h3 class="modal-kicker section-kicker">SILENCE ENERGY UPGRADES</h3><div class="shop-grid">${seCards}</div>`;
  }

  function staffShopMarkup() {
    const cards = STAFF_DEFS.map((staff) => itemCard({
      icon: staff.icon, title: staff.name, sub: state.staff[staff.id] ? 'ON THE PAYROLL' : 'A ONE-TIME HIRE', body: staff.effect,
      cost: staff.cost, action: 'staff', id: staff.id, buttonText: 'HIRE', purchased: state.staff[staff.id]
    })).join('');
    return `<p class="modal-kicker">HELP WANTED · MUST BE CALM NEAR MACHINERY</p><h2 class="modal-title" id="modal-title">The staff room</h2><p class="modal-lede">A reliable employee is worth two emergency notices. Possibly three if they can read.</p><div class="shop-grid">${cards}</div>`;
  }

  function amenityShopMarkup() {
    const available = ROOM_DEFS.filter((room) => room.seats > 0 && isOperational(room.id));
    const selected = available.find((room) => room.id === $('#amenity-room-select')?.value)?.id || available[0]?.id || '';
    const soundproofed = state.soundproofedRooms.includes(selected);
    const cards = AMENITY_DEFS.map((amenity) => {
      const purchased = amenity.id === 'soundproofing' ? soundproofed : state.amenities[amenity.id];
      const missingRoom = amenity.id === 'soundproofing' && !selected;
      return itemCard({ icon: amenity.icon, title: amenity.name, sub: amenity.id === 'soundproofing' ? `ROOM: ${selected ? roomDef(selected).name.toUpperCase() : 'NONE OPEN'}` : 'PUB AMENITY', body: amenity.effect, cost: amenity.cost, action: 'amenity', id: amenity.id, selectedRoom: amenity.id === 'soundproofing' ? selected : '', buttonText: amenity.id === 'soundproofing' ? 'SOUNDPROOF' : 'INSTALL', purchased, disabled: missingRoom });
    }).join('');
    const options = available.map((room) => `<option value="${room.id}" ${room.id === selected ? 'selected' : ''}>${escapeHtml(room.name)}</option>`).join('');
    return `<p class="modal-kicker">A PUB NEEDS MORE THAN A ROOF</p><h2 class="modal-title" id="modal-title">Amenities</h2><p class="modal-lede">Add a little comfort. The noise is mostly an administrative side effect.</p>
      <label class="room-select-row"><span>ROOM TO SOUNDPROOF</span><select id="amenity-room-select" aria-label="Room to soundproof">${options || '<option value="">No open rooms</option>'}</select></label>
      <div class="shop-grid">${cards}</div>`;
  }

  function journalMarkup() {
    const found = new Set(state.diaryPages);
    const diaries = DIARY_PAGES.map((page) => {
      const unlocked = found.has(page.id);
      return `<article class="clipping ${unlocked ? '' : 'locked'}"><p class="eyebrow">${unlocked ? 'FENTON’S DIARY · FOUND' : `FENTON’S DIARY · ${escapeHtml(page.unlock.toUpperCase())}`}</p><h3>${unlocked ? escapeHtml(page.title) : 'A page, folded shut'}</h3><p>${unlocked ? escapeHtml(page.copy) : 'Some things are not legible until the apparatus has been improved.'}</p></article>`;
    }).join('');
    const clips = state.clippings.map((entry) => `<article class="clipping"><p class="eyebrow">${escapeHtml(entry.tag)} · ${escapeHtml(entry.time)}</p><h3>${escapeHtml(entry.headline)}</h3><p>${escapeHtml(entry.copy)}</p></article>`).join('');
    return `<p class="modal-kicker">PAPERS, PLEASE · AND KEEP THE OLD ONES</p><h2 class="modal-title" id="modal-title">Newspaper &amp; scrapbook</h2><p class="modal-lede">A record of Wednesday evenings, written by people who were not in the room.</p><h3 class="modal-kicker section-kicker">CLIPPINGS</h3><div class="scrapbook-list">${clips}</div><h3 class="modal-kicker section-kicker">FENTON’S DIARY</h3><div class="scrapbook-list">${diaries}</div>`;
  }

  function helpMarkup() {
    return `<p class="modal-kicker">A BRIEF NOTE FROM THE LANDLORD</p><h2 class="modal-title" id="modal-title">How to keep the peace</h2><p class="modal-lede">Wednesday service is simple. Physics is not.</p>
      <div class="help-grid">
        <article class="help-card"><b>01 · SERVE A REGULAR</b><p>Tap a patron, pull a pint at the Beer Tap, then tap that same patron again. A served customer pays 8 Pints and makes a little room.</p></article>
        <article class="help-card"><b>02 · MIND THE ZONES</b><p>Tap any open room to switch its Silencer Zone. Noise falls to 0 dB while active; absorbed noise becomes Silence Energy.</p></article>
        <article class="help-card"><b>03 · WATCH THE METER</b><p>At 70% the tubes flicker, 85% brings smoke, and 95% brings the ticking. At 100%, the room housing the apparatus is lost.</p></article>
        <article class="help-card"><b>04 · CHOOSE YOUR OUTLET</b><p>Spend Silence Energy on filters, microphones, venting or a casing. The Vent button bleeds it away only when a vent rate has been fitted.</p></article>
        <article class="help-card"><b>05 · KEEP THE PUB OPEN</b><p>Grow Reputation, unlock every room and research all five Silencer tiers. Three explosions, zero Reputation, or an inspector’s closure ends the session.</p></article>
        <article class="help-card"><b>06 · TAKE YOUR TIME</b><p>The pub keeps running while you read a menu. Pause whenever you like; the regulars are used to waiting.</p></article>
      </div>
      <div class="modal-notice" style="margin-top:15px"><span>✦</span><span>Swipe left or right over the rooms to explore. Long-press a patron for their noise, patience and trade.</span></div>`;
  }

  function restartMarkup() {
    return `<p class="modal-kicker">THE LEDGER WILL BE CLOSED</p><h2 class="modal-title" id="modal-title">A new Wednesday?</h2><p class="modal-lede">This starts a fresh session: all rooms, staff, research and newspaper clippings will be reset. The Silencer will not be consulted.</p><div class="machine-controls" style="max-width:350px"><button class="button button-secondary" type="button" data-action="cancel-restart">KEEP THE PUB OPEN</button><button class="button button-primary" type="button" data-action="confirm-restart">START OVER ↻</button></div>`;
  }

  function renderModal() {
    if (!modalMode) return;
    const { mode, tab } = modalMode;
    if (mode === 'shop') {
      const tabs = `<div class="shop-tabs"><button class="shop-tab ${tab === 'rooms' ? 'active' : ''}" data-tab="rooms">PUB EXPANSION</button><button class="shop-tab ${tab === 'silencer' ? 'active' : ''}" data-tab="silencer">SILENCER</button></div>`;
      const panel = tab === 'silencer' ? silencerShopMarkup() : roomShopMarkup();
      const splitAt = panel.indexOf('<div class="');
      dom.modalContent.innerHTML = splitAt > -1 ? `${panel.slice(0, splitAt)}${tabs}${panel.slice(splitAt)}` : `${panel}${tabs}`;
    } else if (mode === 'staff') dom.modalContent.innerHTML = staffShopMarkup();
    else if (mode === 'amenities') dom.modalContent.innerHTML = amenityShopMarkup();
    else if (mode === 'journal') dom.modalContent.innerHTML = journalMarkup();
    else if (mode === 'help') dom.modalContent.innerHTML = helpMarkup();
    else if (mode === 'restart') dom.modalContent.innerHTML = restartMarkup();
  }

  function handleModalClick(event) {
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) {
      modalMode.tab = tabButton.dataset.tab;
      renderModal();
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const { action, id, room } = actionButton.dataset;
    if (action === 'cancel-restart') { closeModal(); return; }
    if (action === 'confirm-restart') { startNewGame(); return; }
    if (modalMode?.mode === 'staff' && action === 'staff') runShopAction('staff', id);
    else if (modalMode?.mode === 'amenities' && action === 'amenity') runShopAction('amenity', id, { roomId: room || $('#amenity-room-select')?.value || '' });
    else if (action === 'tier' || action === 'se-upgrade' || action === 'unlock-room' || action === 'rebuild-room') runShopAction(action, id);
  }

  function renderUI() {
    if (!state) return;
    const resources = state.resources;
    $('#res-pints').textContent = formatNumber(Math.floor(resources.pints));
    $('#res-scoops').textContent = formatNumber(Math.floor(resources.scoops));
    $('#res-manuscripts').textContent = formatNumber(Math.floor(resources.manuscripts));
    $('#res-research').textContent = formatNumber(Math.floor(resources.research));
    $('#res-loyalty').textContent = formatNumber(Math.floor(resources.loyalty));
    $('#res-energy-top').textContent = formatNumber(state.energy, state.energy < 100 ? 1 : 0);
    const rates = resourceRates();
    const pintsRate = rates.pints;
    $('#rate-pints').textContent = pintsRate > 0 ? `+${formatRate(pintsRate)} / sec` : '—';
    $('#rate-scoops').textContent = rates.scoops > 0 ? `+${formatRate(rates.scoops)} / sec` : '—';
    $('#rate-manuscripts').textContent = rates.manuscripts > 0 ? `+${formatRate(rates.manuscripts)} / sec` : '—';
    $('#rate-research').textContent = rates.research > 0 ? `+${formatRate(rates.research)} / sec` : '—';
    $('#rate-loyalty').textContent = rates.loyalty > 0 ? `+${formatRate(rates.loyalty)} / sec` : '—';

    const cap = capacity();
    const pct = clamp(state.energy / cap * 100, 0, 100);
    const energyRate = totalEnergyRate();
    const netRate = energyRate - (state.venting ? ventRate() : 0);
    $('#energy-readout').textContent = formatNumber(state.energy, state.energy < 100 ? 1 : 0);
    $('#energy-capacity').textContent = formatNumber(cap);
    $('#energy-percent').innerHTML = `${Math.floor(pct)}<span>%</span>`;
    $('#energy-fill').style.width = `${pct}%`;
    $('#energy-flow').textContent = `${netRate >= 0 ? '+' : '−'}${formatNumber(Math.abs(netRate), 1)} / sec`;
    $('#rate-energy-top').textContent = `${netRate >= 0 ? '+' : '−'}${formatNumber(Math.abs(netRate), 1)} / sec`;
    $('.energy-track').setAttribute('aria-valuenow', String(Math.floor(pct)));
    $('#meter-tier-cap').textContent = `${formatNumber(cap)} SE`;
    $('#active-zones').textContent = `${activeZoneCount()} ACTIVE`;
    const warning = $('#energy-status');
    const meter = $('#energy-card');
    meter.classList.remove('energy-70', 'energy-85', 'energy-95');
    document.body.classList.toggle('energy-alert', pct >= 85);
    if (pct >= 95) {
      meter.classList.add('energy-95');
      warning.innerHTML = '<span class="warning-icon">⚠</span><span>TICK. TICK. TICK. DO SOMETHING.</span>';
      if (audioEnabled && realClock - lastWarningTickAt > (pct >= 95 ? .72 : 1.4)) {
        playWarningTick();
        lastWarningTickAt = realClock;
      }
    } else if (pct >= 85) {
      meter.classList.add('energy-85');
      warning.innerHTML = '<span class="warning-icon">⚠</span><span>Smoke from the tubes. Someone asks if it is normal.</span>';
    } else if (pct >= 70) {
      meter.classList.add('energy-70');
      warning.innerHTML = '<span class="warning-icon">⚠</span><span>The tubes flicker. A faint, distinctly smug hum.</span>';
    } else if (state.venting && ventRate() > 0) {
      warning.innerHTML = `<span class="warning-icon">↧</span><span>Venting at ${formatNumber(ventRate(), 1)} SE/sec. The machine exhales.</span>`;
    } else if (!activeZoneCount()) {
      warning.innerHTML = '<span class="warning-icon">◌</span><span>Zones off. The noise is not being stored.</span>';
    } else {
      warning.innerHTML = '<span class="warning-icon">✦</span><span>Comfortably below catastrophe.</span>';
    }

    $('#silencer-tier').textContent = `TIER ${['I', 'II', 'III', 'IV', 'V'][state.tier - 1] || 'I'}`;
    $('#silencer-name').textContent = `The ${tierDef().name}`;
    $('#absorption-value').innerHTML = `${formatNumber(absorption(), 1)} <small>dB / sec</small>`;
    $('#vent-rate-value').innerHTML = `${formatNumber(ventRate(), 1)} <small>SE / sec</small>`;
    $('#home-room').textContent = roomDef(state.homeRoom).name.toUpperCase();
    $('.silencer-card').classList.toggle('is-active', activeZoneCount() > 0);
    $('#machine-glow').style.opacity = activeZoneCount() ? String(.25 + pct / 150) : '.13';
    const ventButton = $('#vent-button');
    const canVent = ventRate() > 0 && state.energy > 0;
    ventButton.disabled = !canVent;
    ventButton.classList.toggle('active', state.venting);
    $('#vent-button-label').textContent = state.venting ? 'VENTING' : 'VENT';
    $('#dock-vent-button').classList.toggle('active', state.venting);
    $('#dock-vent-copy').textContent = ventRate() > 0 ? `${state.venting ? 'Stop venting' : `${formatNumber(ventRate(), 1)} SE / sec`}` : 'Needs a vent system';
    $('#dock-vent-button').disabled = !canVent;

    const selected = state.patrons.find((patron) => patron.id === state.selectedPatron);
    $('#serve-title').textContent = selected ? (state.beerReady ? `Ready for ${selected.name}.` : `${selected.name} is waiting.`) : 'An honest pint.';
    $('#serve-detail').textContent = selected ? (state.beerReady ? 'The pint is poured. Tap the same patron in the room to hand it over.' : `${PATRONS[selected.type].label} · ${PATRONS[selected.type].noise} dB · ${Math.ceil(selected.patience)} sec of patience. Pour their pint, then tap them once more.`) : 'Tap a patron in the room, pour their beer, then tap them once more. The method is older than the pub.';
    $('#serve-button').disabled = !selected || state.beerReady;
    $('#serve-button-label').textContent = !selected ? 'SELECT A PATRON' : state.beerReady ? 'PINT READY · TAP PATRON' : `PULL A PINT FOR ${selected.name.toUpperCase()}`;
    $('#serve-cancel').hidden = !selected;

    $('#reputation-value').textContent = formatNumber(state.reputation, state.reputation % 1 ? 1 : 0);
    $('#reputation-fill').style.width = `${clamp(state.reputation, 0, 100)}%`;
    $('#reputation-fill').style.background = state.reputation < 25 ? 'linear-gradient(90deg,#a63d35,#e06149)' : state.reputation < 55 ? 'linear-gradient(90deg,#b27b43,#d1a34f)' : 'linear-gradient(90deg,#61794f,#bdad63)';
    $('#standing-copy').textContent = state.reputation > 75 ? 'Beloved, if occasionally loud.' : state.reputation > 45 ? 'The regulars are beginning to compare notes.' : state.reputation > 20 ? 'The neighbours have started a committee.' : 'The last regular has brought a suitcase.';
    $('#explosion-count').textContent = String(state.explosions);
    $('#night-count').textContent = String(state.week).padStart(2, '0');
    $('#night-progress').style.width = `${clamp(state.dayElapsed / NIGHT_LENGTH * 100, 0, 100)}%`;
    $('#clock-label').textContent = getClockLabel();
    $('#streak-label').textContent = `${state.weeksSurvived} survived in a row`;
    $('#season-label').textContent = currentSeason();
    $('#open-status').textContent = state.paused ? 'SERVICE PAUSED' : 'OPEN FOR THE EVENING';
    $('#door-status').textContent = state.paused ? 'DOOR HELD OPEN' : 'DOOR OPEN';
    $('#pause-icon').textContent = state.paused ? '▶' : 'Ⅱ';
    $('#pause-button').classList.toggle('active', state.paused);
    $('#pause-button').setAttribute('aria-label', state.paused ? 'Resume game' : 'Pause game');
    document.body.classList.toggle('is-paused', state.paused);
    $('#scene-note').textContent = state.powerCutUntil > state.gameSeconds ? 'POWER CUT · 30 SECONDS' : activeZoneCount() ? 'THE SILENCER IS LISTENING' : 'THE ROOM IS UNFILTERED';
    $('#sound-icon').textContent = audioEnabled ? '♫' : '◖';
    $('#sound-button').classList.toggle('active', audioEnabled);
    $('#sound-button').setAttribute('aria-label', audioEnabled ? 'Turn sound off' : 'Turn sound on');
    updateAudioRig();
    renderRoomTabs();
  }

  function renderRoomTabs() {
    const pageCount = Math.ceil(ROOM_DEFS.length / roomPageSize);
    state.roomPage = clamp(state.roomPage, 0, Math.max(0, pageCount - 1));
    const container = $('#room-tabs');
    const key = `${pageCount}:${state.roomPage}:${roomPageSize}`;
    if (key === renderedTabsKey) {
      $('#room-prev').disabled = state.roomPage <= 0;
      $('#room-next').disabled = state.roomPage >= pageCount - 1;
      return;
    }
    renderedTabsKey = key;
    container.innerHTML = '';
    for (let page = 0; page < pageCount; page++) {
      const button = document.createElement('button');
      const entries = ROOM_DEFS.slice(page * roomPageSize, (page + 1) * roomPageSize);
      button.type = 'button';
      button.className = `room-page-tab ${page === state.roomPage ? 'selected' : ''}`;
      button.textContent = String(page + 1);
      button.title = entries.map((room) => room.name).join(' · ');
      button.setAttribute('aria-label', `Room page ${page + 1}: ${button.title}`);
      if (page === state.roomPage) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => { state.roomPage = page; drawStage(); renderRoomTabs(); });
      container.appendChild(button);
    }
    $('#room-prev').disabled = state.roomPage <= 0;
    $('#room-next').disabled = state.roomPage >= pageCount - 1;
  }

  function setRoomPage(delta) {
    const count = Math.ceil(ROOM_DEFS.length / roomPageSize);
    const next = clamp(state.roomPage + delta, 0, count - 1);
    if (next === state.roomPage) return;
    state.roomPage = next;
    drawStage();
    renderRoomTabs();
  }

  function getPageSize() {
    return dom.stageInner.clientWidth < 610 ? 2 : 4;
  }

  function addText(container, text, x, y, style = {}, anchorX = 0, anchorY = 0) {
    const node = new PIXI.Text({
      text: String(text),
      style: {
        fontFamily: style.fontFamily || 'Georgia',
        fontSize: style.fontSize || 12,
        fill: style.fill || '#e7ddc6',
        fontWeight: style.fontWeight || 'normal',
        fontStyle: style.fontStyle || 'normal',
        letterSpacing: style.letterSpacing || 0,
        align: style.align || 'left',
        wordWrap: style.wordWrap || false,
        wordWrapWidth: style.wordWrapWidth || 0,
        lineHeight: style.lineHeight,
        breakWords: true
      }
    });
    node.anchor.set(anchorX, anchorY);
    node.position.set(x, y);
    container.addChild(node);
    return node;
  }

  function fillRect(g, x, y, width, height, color, alpha = 1, radius = 0, stroke = null, strokeWidth = 1) {
    const shape = radius ? g.roundRect(x, y, width, height, radius) : g.rect(x, y, width, height);
    shape.fill({ color, alpha });
    if (stroke) {
      const outline = new PIXI.Graphics();
      const outlineShape = radius ? outline.roundRect(x, y, width, height, radius) : outline.rect(x, y, width, height);
      outlineShape.stroke({ color: stroke, width: strokeWidth, alpha: Math.min(1, alpha + .1) });
      g.addChild(outline);
    }
    return shape;
  }

  function strokePath(g, points, style) {
    const path = new PIXI.Graphics();
    path.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) path.lineTo(points[i][0], points[i][1]);
    path.stroke(style);
    g.addChild(path);
    return path;
  }

  function strokeCircle(g, x, y, radius, style) {
    const outline = new PIXI.Graphics();
    outline.circle(x, y, radius).stroke(style);
    g.addChild(outline);
    return outline;
  }

  function drawLine(g, x1, y1, x2, y2, color, width = 1, alpha = 1) {
    strokePath(g, [[x1, y1], [x2, y2]], { color, width, alpha });
  }

  function drawWindow(g, x, y, w, h, sky = 0x58646a) {
    fillRect(g, x - 2, y - 2, w + 4, h + 4, 0x674d30, 1, 2, 0xb48e54, 1);
    fillRect(g, x, y, w, h, sky, 1);
    fillRect(g, x + 2, y + h * .56, w - 4, h * .42, 0x263d40, .9);
    // London roofline and the river's unhelpful glint.
    for (let i = 0; i < 5; i++) {
      const bx = x + 3 + i * (w - 6) / 5;
      const bh = h * (.12 + ((i * 7) % 4) * .05);
      fillRect(g, bx, y + h * .6 - bh, w / 8, bh, 0x273235, .9);
      fillRect(g, bx + w / 13, y + h * .6 - bh - 2, w / 20, 3, 0x8a7350, .9);
    }
    drawLine(g, x + w / 2, y, x + w / 2, y + h, 0x9b8255, 2, .9);
    drawLine(g, x, y + h * .5, x + w, y + h * .5, 0x9b8255, 2, .9);
    drawLine(g, x + w * .12, y + h * .79, x + w * .86, y + h * .81, 0xb7aa77, 1, .52);
  }

  function drawRoomDecor(g, def, x, y, w, h) {
    const baseY = y + h;
    const mid = x + w * .5;
    const small = w < 290;
    const shelfColor = 0x71502f;
    if (def.id === 'general') {
      fillRect(g, x + 13, y + 13, w * .36, h * .24, 0x312c22, .93, 2, 0x795b37, 1);
      for (let b = 0; b < 5; b++) {
        const bx = x + 19 + b * Math.min(17, w * .05);
        const bh = h * (.08 + (b % 3) * .025);
        fillRect(g, bx, y + h * .19 - bh, small ? 5 : 7, bh, [0x75804d, 0x945f39, 0xb69354][b % 3], .85, 1);
        fillRect(g, bx + 1, y + h * .19 - bh - 2, small ? 3 : 5, 3, 0xc6ae70, .9, 1);
      }
      drawLine(g, x + 12, y + h * .21, x + w * .4, y + h * .21, 0xaa8954, 2, .8);
      fillRect(g, x + 7, y + h * .59, w - 14, h * .17, 0x533820, 1, 3, 0xa07a46, 1);
      fillRect(g, x + 7, y + h * .58, w - 14, h * .045, 0xc09a57, 1, 2);
      for (let i = 0; i < 4; i++) fillRect(g, x + 17 + i * (w - 40) / 4, y + h * .65, Math.max(3, w * .018), h * .07, 0x241d15, .7, 1);
      drawWindow(g, x + w * .65, y + h * .06, w * .24, h * .31, 0x525e66);
    } else if (def.id === 'saloon') {
      drawWindow(g, x + 12, y + h * .04, w * .27, h * .34, 0x4d626a);
      fillRect(g, x + w * .58, y + h * .12, w * .29, h * .22, 0x333024, .94, 2, 0x8c7045, 1);
      drawLine(g, x + w * .57, y + h * .21, x + w * .88, y + h * .21, 0xc09c5f, 2, .7);
      for (let i = 0; i < 3; i++) {
        const cx = x + w * (.38 + i * .22), cy = y + h * .57;
        fillRect(g, cx - w * .055, cy, w * .11, h * .08, shelfColor, 1, 3, 0x9b7845, 1);
        drawLine(g, cx - w * .045, cy + h * .07, cx - w * .045, cy + h * .19, 0x60472c, 2, .9);
        drawLine(g, cx + w * .045, cy + h * .07, cx + w * .045, cy + h * .19, 0x60472c, 2, .9);
      }
    } else if (def.id === 'snug') {
      drawWindow(g, x + w * .34, y + h * .035, w * .32, h * .36, 0x40545b);
      fillRect(g, x + 11, y + h * .53, w * .28, h * .11, 0x4a3424, 1, 2, 0x9b7747, 1);
      fillRect(g, x + 14, y + h * .46, 5, h * .07, 0x778878, 1, 1);
      fillRect(g, x + 23, y + h * .42, 6, h * .1, 0x8c5642, 1, 1);
      fillRect(g, x + w * .7, y + h * .53, w * .22, h * .09, 0x493624, 1, 2, 0x94764a, 1);
      fillRect(g, x + w * .76, y + h * .31, w * .12, h * .22, 0x566c63, .65, 3, 0xc1a568, 1);
      g.circle(x + w * .82, y + h * .28, Math.max(3, h * .035)).fill({ color: 0xd2bb7e, alpha: .9 });
    } else if (def.id === 'cellar') {
      fillRect(g, x + 8, y + h * .07, w - 16, h * .52, 0x282a21, 1, 3, 0x604b31, 1);
      for (let i = 0; i < 5; i++) {
        const bx = x + 15 + i * (w - 45) / 5;
        const by = y + h * (.18 + (i % 2) * .04);
        fillRect(g, bx, by, w * .09, h * .34, 0x64472d, 1, 7, 0xb0864e, 1);
        drawLine(g, bx + 2, by + h * .13, bx + w * .09 - 2, by + h * .13, 0x302318, 1, .8);
        drawLine(g, bx + 2, by + h * .25, bx + w * .09 - 2, by + h * .25, 0x302318, 1, .8);
        g.circle(bx + w * .045, by + h * .19, 2).fill({ color: 0xd0ae69, alpha: .8 });
      }
      fillRect(g, x + w * .35, y + h * .63, w * .3, h * .1, 0x3b3022, 1, 2, 0x997b49, 1);
    } else if (def.id === 'backroom') {
      fillRect(g, x + 8, y + h * .05, w - 16, h * .44, 0x542e29, 1, 2, 0xa6764b, 1);
      for (let i = 0; i < 6; i++) {
        const cx = x + 16 + i * (w - 35) / 5;
        drawLine(g, cx, y + h * .07, cx + (i % 2 ? -7 : 7), y + h * .47, 0x98533e, 2, .75);
      }
      fillRect(g, x + w * .38, y + h * .27, w * .25, h * .22, 0x26352c, .9, 1, 0xc39f5c, 1);
      drawLine(g, x + w * .43, y + h * .37, x + w * .57, y + h * .37, 0xd0b879, 1, .85);
    } else if (def.id === 'upstairs') {
      for (let side = 0; side < 2; side++) {
        const sx = side ? x + w * .72 : x + 10;
        fillRect(g, sx, y + h * .08, w * .19, h * .47, 0x32291f, 1, 1, 0x9c7947, 1);
        for (let i = 0; i < 4; i++) {
          const sy = y + h * (.12 + i * .095);
          drawLine(g, sx + 2, sy, sx + w * .18, sy, 0xb08a52, 1, .8);
          for (let b = 0; b < 4; b++) fillRect(g, sx + 4 + b * (w * .04), sy - h * .055, w * .025, h * .05, [0x7c473a,0x546c55,0x887547,0x665b83][(i + b) % 4], 1, 1);
        }
      }
      drawWindow(g, x + w * .36, y + h * .1, w * .28, h * .35, 0x4d6068);
    } else if (def.id === 'roof') {
      fillRect(g, x + 7, y + h * .32, w - 14, h * .29, 0x3b554c, .9, 1, 0x8b7448, 1);
      for (let i = 0; i < 7; i++) {
        const bx = x + 12 + i * (w - 32) / 7;
        const bh = h * (.13 + ((i * 3) % 4) * .035);
        fillRect(g, bx, y + h * .31 - bh, w / 12, bh, 0x303a3a, 1, 1);
        if (i % 2 === 0) fillRect(g, bx + w / 34, y + h * .3 - bh + 3, 3, 4, 0xe0b369, .8, 1);
      }
      drawLine(g, x + 10, y + h * .61, x + w - 10, y + h * .61, 0xb58d4f, 2, .9);
      fillRect(g, x + 18, y + h * .1, w - 36, h * .05, 0x7c4634, 1, 2, 0xc39b5b, 1);
      drawLine(g, x + 22, y + h * .15, x + 22, y + h * .33, 0x87633c, 1, .9);
      drawLine(g, x + w - 22, y + h * .15, x + w - 22, y + h * .33, 0x87633c, 1, .9);
    }
    // Boarded floor, brass threshold, and small marks of wear.
    fillRect(g, x + 4, baseY - h * .18, w - 8, h * .18, 0x403225, 1);
    for (let row = 0; row < 3; row++) {
      const ly = baseY - h * (.17 - row * .052);
      drawLine(g, x + 6, ly, x + w - 6, ly, 0x83623d, 1, .5);
    }
    for (let plank = 0; plank < 7; plank++) {
      const lx = x + 12 + plank * (w - 24) / 7;
      drawLine(g, lx, baseY - h * .17, lx + (plank % 2 ? 4 : -3), baseY, 0x80603b, 1, .27);
    }
  }

  function drawPatronArt(container, patron, x, baseline, scale, selected, beerReady, slotIndex) {
    const palette = PATRONS[patron.type];
    const person = new PIXI.Container();
    person.position.set(x, baseline);
    person.eventMode = 'static';
    person.cursor = 'pointer';
    person.hitArea = new PIXI.Rectangle(-20 * scale, -49 * scale, 40 * scale, 60 * scale);
    person._baseY = baseline;
    person._phase = patron.phase || slotIndex;
    const g = new PIXI.Graphics();
    const s = scale;
    // A hand-drawn coat, chin, head, and a hat not wholly approved by the landlord.
    g.ellipse(0, 0, 13 * s, 3.1 * s).fill({ color: 0x090e0a, alpha: .55 });
    g.roundRect(-10 * s, -28 * s, 20 * s, 27 * s, 5 * s).fill({ color: palette.coat });
    g.roundRect(-3.5 * s, -27 * s, 7 * s, 22 * s, 2 * s).fill({ color: 0xd0c29d, alpha: .88 });
    g.circle(0, -36 * s, 9 * s).fill({ color: 0xc5a77e });
    g.roundRect(-8 * s, -45 * s, 16 * s, 5 * s, 2 * s).fill({ color: palette.hat });
    g.ellipse(0, -44 * s, 10 * s, 3 * s).fill({ color: palette.hat });
    g.circle(-3 * s, -36 * s, 1 * s).fill({ color: 0x271f18 });
    g.circle(3 * s, -36 * s, 1 * s).fill({ color: 0x271f18 });
    strokePath(g, [[-2 * s, -31 * s], [1 * s, -30 * s], [3 * s, -31 * s]], { color: 0x755248, width: 1.1 * s, alpha: .9 });
    strokePath(g, [[-8 * s, -24 * s], [-13 * s, -17 * s]], { color: palette.coat, width: 4 * s, cap: 'round' });
    strokePath(g, [[8 * s, -24 * s], [12 * s, -17 * s]], { color: palette.coat, width: 4 * s, cap: 'round' });
    if (patron.type === 'scientist') {
      strokeCircle(g, -3 * s, -36 * s, 3 * s, { color: 0xb4c0a8, width: 1 * s });
      strokeCircle(g, 3 * s, -36 * s, 3 * s, { color: 0xb4c0a8, width: 1 * s });
      strokePath(g, [[0, -36 * s], [0, -36 * s]], { color: 0xb4c0a8, width: 1 * s });
      g.circle(13 * s, -18 * s, 3 * s).fill({ color: 0x8fb5a3, alpha: .85 });
      strokePath(g, [[13 * s, -22 * s], [13 * s, -27 * s]], { color: 0xd4c382, width: 1 * s });
    } else if (patron.type === 'journalist') {
      g.roundRect(9 * s, -24 * s, 7 * s, 10 * s, 1 * s).fill({ color: 0xe2d4ad });
      strokePath(g, [[10 * s, -21 * s], [15 * s, -21 * s]], { color: 0x765a37, width: .7 * s });
      strokePath(g, [[10 * s, -18 * s], [14 * s, -18 * s]], { color: 0x765a37, width: .7 * s });
    } else if (patron.type === 'writer') {
      strokePath(g, [[8 * s, -22 * s], [14 * s, -28 * s]], { color: 0xd7bd74, width: 1.4 * s });
    } else if (patron.type === 'burt') {
      strokePath(g, [[-5 * s, -32 * s], [0, -30 * s], [5 * s, -32 * s]], { color: 0x443021, width: 2.3 * s });
      strokePath(g, [[0, -40 * s], [6 * s, -42 * s]], { color: 0x2d271f, width: 1.2 * s });
    } else if (patron.type === 'harry') {
      g.roundRect(-10 * s, -45 * s, 20 * s, 7 * s, 3 * s).fill({ color: 0x272f2d, alpha: .7 });
      g.circle(0, -36 * s, 9.4 * s).fill({ color: 0x657069, alpha: .52 });
    }
    if (selected) {
      const selection = new PIXI.Graphics();
      selection.roundRect(-19 * s, -51 * s, 38 * s, 57 * s, 8 * s).stroke({ color: beerReady ? 0x9ec27d : 0xe6c871, width: 1.5 * s, alpha: .95 });
      g.addChild(selection);
      g.circle(0, -54 * s, 2.5 * s).fill({ color: beerReady ? 0x9ec27d : 0xe6c871 });
    }
    person.addChild(g);
    const shortName = patron.name.split(' ').slice(0, 1)[0].toUpperCase().slice(0, 8);
    addText(person, shortName, 0, 9 * s, { fontFamily: 'Courier New', fontSize: Math.max(6, 7.2 * s), fill: selected ? '#f1d993' : '#d6ceb4', fontWeight: 'bold', letterSpacing: .2 }, .5, .5);
    const ratio = clamp(patron.patience / patron.patienceMax, 0, 1);
    const patienceColor = ratio > .48 ? 0x77945f : ratio > .2 ? 0xc39c4c : 0xd35e49;
    const barWidth = 23 * s;
    const patienceG = new PIXI.Graphics();
    patienceG.roundRect(-barWidth / 2, 15 * s, barWidth, 2.5 * s, 1).fill({ color: 0x151c17, alpha: .9 });
    patienceG.roundRect(-barWidth / 2, 15 * s, barWidth * ratio, 2.5 * s, 1).fill({ color: patienceColor });
    person.addChild(patienceG);
    container.addChild(person);
    avatarNodes.push(person);
    person.on('pointertap', (event) => {
      event.stopPropagation();
      selectPatron(patron.id);
    });
    person.on('pointerdown', (event) => {
      clearTimeout(longPressTimer);
      const point = event.global.clone();
      longPressTimer = setTimeout(() => showPatronTooltip(patron, point), 470);
    });
    person.on('pointerup', () => clearTimeout(longPressTimer));
    person.on('pointerupoutside', () => clearTimeout(longPressTimer));
    person.on('pointerover', (event) => {
      event.stopPropagation();
      if (window.matchMedia('(hover: hover)').matches) showPatronTooltip(patron, event.global);
    });
    person.on('pointerout', (event) => { event.stopPropagation(); hideTooltip(); });
  }

  function showPatronTooltip(patron, globalPoint) {
    const meta = PATRONS[patron.type];
    const rect = app.canvas.getBoundingClientRect();
    const x = rect.left + globalPoint.x * rect.width / app.screen.width;
    const y = rect.top + globalPoint.y * rect.height / app.screen.height;
    const output = meta.production ? Object.entries(meta.production).filter(([key]) => key !== 'seconds').map(([key, amount]) => `+${amount} ${resourceLabel(key)} / ${meta.production.seconds >= 60 ? `${meta.production.seconds / 60} min` : `${meta.production.seconds} sec`}`).join(' · ') : patron.type === 'harry' ? '+1 Research · +1 Scoop on arrival' : patron.type === 'john' ? '+1 Manuscript on arrival · leaves when Burt is served' : 'No known production. A remarkably loud man.';
    dom.tooltip.textContent = `${patron.name} · ${meta.noise} dB · patience ${Math.max(0, Math.ceil(patron.patience))}s · ${output}`;
    dom.tooltip.style.left = `${clamp(x + 11, 7, window.innerWidth - 250)}px`;
    dom.tooltip.style.top = `${clamp(y - 10, 6, window.innerHeight - 90)}px`;
    dom.tooltip.hidden = false;
  }
  function hideTooltip() { dom.tooltip.hidden = true; }

  function drawLockedCard(container, g, def, x, y, w, h, record) {
    fillRect(g, x, y, w, h, 0x101711, .97, 6, 0x6d5838, 1.3);
    fillRect(g, x + 5, y + 5, w - 10, 30, 0x2b372b, 1, 3, 0x775e39, .9);
    addText(container, def.name.toUpperCase(), x + 14, y + 14, { fontFamily: 'Courier New', fontSize: Math.max(9, Math.min(12, w * .034)), fill: '#d9c394', fontWeight: 'bold', letterSpacing: 1 }, 0, .5);
    addText(container, `${def.seats} ${def.seats === 1 ? 'SEAT' : 'SEATS'}`, x + w - 13, y + 15, { fontFamily: 'Courier New', fontSize: 8, fill: '#a49773' }, 1, .5);
    fillRect(g, x + 7, y + 39, w - 14, h - 45, 0x263127, .74, 4, 0x5f5639, .7);
    for (let i = 0; i < 7; i++) drawLine(g, x + 10, y + 49 + i * 13, x + w - 10, y + 49 + i * 13, 0x8a744b, 1, .12);
    const cx = x + w / 2;
    const cy = y + h * .51;
    strokeCircle(g, cx, cy - 12, 16, { color: 0x927547, width: 1.2, alpha: .55 });
    const lockBody = new PIXI.Graphics();
    lockBody.roundRect(cx - 8, cy + 7, 16, 19, 3).stroke({ color: 0x927547, width: 1.2, alpha: .55 });
    g.addChild(lockBody);
    const lockArc = new PIXI.Graphics();
    lockArc.arc(cx, cy - 14, 6, Math.PI, 0).stroke({ color: 0xb39157, width: 2, alpha: .65 });
    g.addChild(lockArc);
    fillRect(g, cx - 7, cy - 13, 14, 12, 0x57472e, .95, 2, 0xc09a5a, 1);
    addText(container, record.damaged ? 'THE ROOM HAS BEEN REDUCED TO A FOOTNOTE' : `LOCKED · ${def.cost} PINTS`, cx, y + h - 27, { fontFamily: 'Courier New', fontSize: Math.max(8, Math.min(10, w * .028)), fill: record.damaged ? '#d89977' : '#d5bd82', fontWeight: 'bold', letterSpacing: .6, align: 'center' }, .5, .5);
    addText(container, def.special, cx, y + h - 13, { fontFamily: 'Courier New', fontSize: Math.max(7, Math.min(9, w * .024)), fill: '#89927c', align: 'center' }, .5, .5);
  }

  function drawRoomCard(container, def, index, x, y, w, h) {
    const record = state.rooms[def.id];
    const card = new PIXI.Container();
    const g = new PIXI.Graphics();
    card.addChild(g);
    fillRect(g, x + 3, y + 4, w, h, 0x070d09, .48, 6);
    if (!record.unlocked || record.damaged) {
      drawLockedCard(card, g, def, x, y, w, h, record);
      card.eventMode = 'static';
      card.cursor = 'pointer';
      card.hitArea = new PIXI.Rectangle(x, y, w, h);
      card.on('pointertap', (event) => { event.stopPropagation(); record.damaged ? tryRebuildRoom(def.id) : tryUnlockRoom(def.id); });
      card.on('pointerover', () => { if (window.matchMedia('(hover: hover)').matches) { dom.tooltip.textContent = record.damaged ? `Rebuild ${def.name} for ${Math.max(25, Math.ceil(def.cost * .5))} Pints.` : `${def.name} · ${def.cost} Pints · ${def.special}`; dom.tooltip.style.left = '50%'; dom.tooltip.style.top = '50%'; dom.tooltip.hidden = false; } });
      card.on('pointerout', hideTooltip);
      container.addChild(card);
      return card;
    }

    const border = def.id === state.homeRoom ? 0xd1ae69 : 0x8d7043;
    fillRect(g, x, y, w, h, 0x2d281d, 1, 5, border, def.id === state.homeRoom ? 1.5 : 1);
    fillRect(g, x + 4, y + 4, w - 8, h - 8, 0x19231b, 1, 3, 0x5b4a31, .8);
    const headerH = 28;
    fillRect(g, x + 6, y + 6, w - 12, headerH, 0x314031, 1, 2, 0x79623d, .8);
    drawLine(g, x + 11, y + headerH + 9, x + w - 11, y + headerH + 9, 0x9a7d4c, 1, .45);
    const fontName = Math.max(9, Math.min(12, w * .034));
    addText(card, def.name.toUpperCase(), x + 14, y + 6 + headerH / 2, { fontFamily: 'Courier New', fontSize: fontName, fill: '#eed8a2', fontWeight: 'bold', letterSpacing: .85 }, 0, .5);
    const seatCount = `${activePatrons(def.id).length}/${seatLimit(def.id)} SEATS`;
    addText(card, def.id === 'cellar' ? 'HOUSING' : seatCount, x + w - 14, y + 6 + headerH / 2, { fontFamily: 'Courier New', fontSize: Math.max(7, Math.min(9, w * .026)), fill: def.id === 'cellar' ? '#d8b66e' : '#b7ad8a' }, 1, .5);

    const artX = x + 7;
    const artY = y + 38;
    const artW = w - 14;
    const artH = h - 101;
    fillRect(g, artX, artY, artW, artH, def.id === 'roof' ? 0x33453c : 0x344039, 1, 1, 0x665638, .8);
    fillRect(g, artX + 2, artY + 2, artW - 4, artH * .55, def.id === 'roof' ? 0x657276 : 0x3d4b43, .44, 1);
    // A restrained Victorian wallpaper repeat.
    for (let ix = 0; ix < 6; ix++) {
      const px = artX + 8 + ix * (artW - 16) / 6;
      g.circle(px, artY + 10 + (ix % 2) * 3, 1.1).fill({ color: 0xceb476, alpha: .22 });
    }
    drawRoomDecor(g, def, artX, artY, artW, artH);

    const patrons = activePatrons(def.id);
    if (!patrons.length && def.seats > 0) {
      const seatsToShow = Math.min(seatLimit(def.id), 4);
      for (let i = 0; i < seatsToShow; i++) {
        const sx = artX + (i + 1) * artW / (seatsToShow + 1);
        g.ellipse(sx, artY + artH - 4, 7, 2).fill({ color: 0x090f0b, alpha: .35 });
        g.roundRect(sx - 4, artY + artH - 15, 8, 11, 2).fill({ color: 0x58462d, alpha: .68 });
      }
    }
    const maxAvatars = Math.max(1, Math.min(seatLimit(def.id) || 0, 6));
    const step = Math.min(48, (artW - 20) / Math.max(1, Math.min(maxAvatars, patrons.length || 1)));
    const avatarScale = clamp(Math.min(.98, step / 39), .68, .98);
    const baseY = artY + artH - 5;
    patrons.forEach((patron, slot) => {
      const spacing = Math.min(47 * avatarScale, (artW - 30) / Math.max(1, patrons.length));
      const start = artX + artW / 2 - ((patrons.length - 1) * spacing) / 2;
      drawPatronArt(card, patron, start + slot * spacing, baseY, avatarScale, state.selectedPatron === patron.id, state.beerReady && state.selectedPatron === patron.id, slot);
    });
    if (def.id === 'cellar') {
      const machineX = artX + artW * .5;
      const machineY = artY + artH * .82;
      fillRect(g, machineX - 23, machineY - 19, 46, 20, 0x29251d, 1, 3, 0xc39c5d, 1);
      for (let i = 0; i < 3; i++) fillRect(g, machineX - 14 + i * 13, machineY - 29, 7, 29, 0x9c7740, 1, 3, 0xd2b875, 1);
      addText(card, 'FENTON & CO.', machineX, machineY + 4, { fontFamily: 'Courier New', fontSize: 6, fill: '#c1a66b', letterSpacing: .5 }, .5, .5);
    }

    const footerY = y + h - 57;
    const effective = roomNoise(def.id);
    const raw = sourceNoise(def.id);
    const noisy = effective >= 70;
    addText(card, 'NOISE', x + 11, footerY + 9, { fontFamily: 'Courier New', fontSize: 7.5, fill: '#b1a987', fontWeight: 'bold', letterSpacing: 1 }, 0, .5);
    addText(card, `${effective} dB`, x + w - 12, footerY + 9, { fontFamily: 'Courier New', fontSize: 9, fill: noisy ? '#ed8a68' : zoneIsOn(def.id) ? '#9eb17e' : '#d4bc86', fontWeight: 'bold' }, 1, .5);
    fillRect(g, x + 11, footerY + 15, w - 22, 5, 0x101711, .92, 2, 0x576047, .5);
    if (effective > 0) fillRect(g, x + 12, footerY + 16, (w - 24) * effective / 100, 3, effective >= 85 ? 0xd45742 : effective >= 60 ? 0xc88c4e : 0x83955f, 1, 2);
    else if (zoneIsOn(def.id)) fillRect(g, x + 12, footerY + 16, 2, 3, 0x9da96d, .8, 2);
    if (zoneIsOn(def.id)) {
      addText(card, `FIELD ${raw} dB → ABSORBED`, x + 11, footerY + 26, { fontFamily: 'Courier New', fontSize: Math.max(6.5, Math.min(7.4, w * .022)), fill: '#9aa078', letterSpacing: .4 }, 0, .5);
    } else {
      addText(card, def.id === 'backroom' && state.eventUntil <= state.gameSeconds ? 'EVENTS ONLY · CLOSED' : def.special.toUpperCase(), x + 11, footerY + 26, { fontFamily: 'Courier New', fontSize: Math.max(6.5, Math.min(7.4, w * .022)), fill: '#a59a79', letterSpacing: .25 }, 0, .5);
    }
    const zoneButtonY = y + h - 23;
    const zoneOn = zoneIsOn(def.id);
    const powerOff = state.powerCutUntil > state.gameSeconds;
    fillRect(g, x + 7, zoneButtonY, w - 14, 17, zoneOn ? 0x3f5b3f : 0x242b22, 1, 3, zoneOn ? 0x97a86a : 0x695d3d, .85);
    addText(card, powerOff ? '⚡ POWER CUT' : zoneOn ? '🔇  SILENCER ZONE  ·  ON' : '◌  SILENCER ZONE  ·  OFF', x + w / 2, zoneButtonY + 8.5, { fontFamily: 'Courier New', fontSize: Math.max(7, Math.min(9, w * .027)), fill: powerOff ? '#df9271' : zoneOn ? '#d2d59c' : '#b4a987', fontWeight: 'bold', letterSpacing: .55 }, .5, .5);

    card.eventMode = 'static';
    card.cursor = 'pointer';
    card.hitArea = new PIXI.Rectangle(x, y, w, h);
    card.on('pointertap', (event) => { event.stopPropagation(); toggleZone(def.id); });
    card.on('pointerover', (event) => {
      if (window.matchMedia('(hover: hover)').matches) {
        const rect = app.canvas.getBoundingClientRect();
        const px = rect.left + event.global.x * rect.width / app.screen.width;
        const py = rect.top + event.global.y * rect.height / app.screen.height;
        dom.tooltip.textContent = `${def.name} · ${effective} dB${zoneOn ? ` (absorbing ${raw} dB)` : ''} · ${def.special}. Tap to switch zone.`;
        dom.tooltip.style.left = `${clamp(px + 9, 6, window.innerWidth - 240)}px`;
        dom.tooltip.style.top = `${clamp(py + 10, 6, window.innerHeight - 70)}px`;
        dom.tooltip.hidden = false;
      }
    });
    card.on('pointerout', hideTooltip);
    container.addChild(card);
    return card;
  }

  function containerAdd(child) { app.stage.addChild(child); }

  function drawBackdrop(width, height) {
    const g = new PIXI.Graphics();
    fillRect(g, 0, 0, width, height, 0x1b251e);
    // Dark timber, old plaster, and a little of the London night.
    fillRect(g, 0, 0, width, 34, 0x24251d);
    fillRect(g, 7, 3, width - 14, height - 7, 0x1b241d, 1, 3, 0x72603d, 1);
    drawLine(g, 11, 36, width - 11, 36, 0xb39358, 1, .65);
    for (let beam = 0; beam < 7; beam++) {
      const x = 14 + beam * (width - 28) / 6;
      drawLine(g, x, 38, x - 5, height - 11, 0x94764a, 1, .11);
    }
    for (let row = 0; row < 12; row++) {
      const yy = 41 + row * (height - 54) / 12;
      drawLine(g, 11, yy, width - 11, yy, 0xd4bd85, 1, .025);
    }
    return g;
  }

  function drawStage() {
    if (!app || !state) return;
    try {
      const screen = app.screen;
      const width = Math.max(320, screen.width || dom.stageInner.clientWidth || 700);
      const height = Math.max(380, screen.height || dom.stageInner.clientHeight || 500);
      roomPageSize = getPageSize();
      const pageCount = Math.ceil(ROOM_DEFS.length / roomPageSize);
      state.roomPage = clamp(state.roomPage, 0, pageCount - 1);
      app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
      avatarNodes = [];
      app.stage.addChild(drawBackdrop(width, height));
      addText(app.stage, `WEDNESDAY SERVICE · ${currentSeason()}`, width / 2, 18, { fontFamily: 'Courier New', fontSize: 9, fill: '#b7a374', fontWeight: 'bold', letterSpacing: 1.6 }, .5, .5);
      const margin = width < 610 ? 12 : 17;
      const top = 42;
      const bottom = 16;
      const gapX = width < 610 ? 9 : 13;
      const gapY = width < 610 ? 9 : 12;
      const columns = roomPageSize === 2 ? 1 : 2;
      const rows = 2;
      const cardWidth = (width - margin * 2 - gapX * (columns - 1)) / columns;
      const cardHeight = (height - top - bottom - gapY * (rows - 1)) / rows;
      const pageRooms = ROOM_DEFS.slice(state.roomPage * roomPageSize, (state.roomPage + 1) * roomPageSize);
      pageRooms.forEach((room, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = margin + col * (cardWidth + gapX);
        const y = top + row * (cardHeight + gapY);
        drawRoomCard(app.stage, room, ROOM_DEFS.findIndex((entry) => entry.id === room.id), x, y, cardWidth, cardHeight);
      });
      const pageText = `${String(state.roomPage + 1).padStart(2, '0')} / ${String(pageCount).padStart(2, '0')}  ·  DRAG OR SWIPE TO WANDER`;
      addText(app.stage, pageText, width / 2, height - 5, { fontFamily: 'Courier New', fontSize: 7.5, fill: '#827d65', letterSpacing: .8 }, .5, 1);
      renderRoomTabs();
    } catch (error) {
      console.error('The pub floor plan could not be drawn.', error);
    }
  }

  function animateAvatars() {
    if (!state) return;
    const time = performance.now() / 540;
    avatarNodes.forEach((node) => {
      node.y = node._baseY + Math.sin(time + node._phase) * 1.2;
    });
  }

  function togglePause() {
    if (state.gameOver || state.won || state.explosionFreeze > 0) return;
    state.paused = !state.paused;
    renderUI();
  }

  function toggleVenting() {
    if (ventRate() <= 0) {
      showToast('No vent fitted', 'Fit a Venting System or improve the Silencer before opening the outlet.');
      openModal('shop', 'silencer');
      return;
    }
    if (state.energy <= 0 && !state.venting) {
      showToast('Nothing to vent', 'The Silence Energy gauge is empty. Enjoy the quiet while it lasts.');
      return;
    }
    state.venting = !state.venting;
    if (state.venting) {
      showToast('Vent open', `Bleeding off ${formatNumber(ventRate(), 1)} Silence Energy per second. Slowly, and with a paperwork trail.`, 4300);
      playTinySound(260, .08);
    } else showToast('Vent closed', 'The energy will stay where it is. For the moment.', 3500);
    renderUI();
    saveState();
  }

  function showCurrentArticle() {
    openModal('journal');
  }

  function setupAudio() {
    if (audioRig) return audioRig;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      const context = new AudioContextClass();
      const master = context.createGain();
      master.gain.value = audioEnabled ? .18 : 0;
      master.connect(context.destination);
      const sampleCount = context.sampleRate * 2;
      const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) data[i] = (Math.random() * 2 - 1) * .2;
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const lowpass = context.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 360;
      const ambientGain = context.createGain();
      ambientGain.gain.value = .17;
      noise.connect(lowpass);
      lowpass.connect(ambientGain);
      ambientGain.connect(master);
      noise.start();
      const hum = context.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 56;
      const humGain = context.createGain();
      humGain.gain.value = 0;
      hum.connect(humGain);
      humGain.connect(master);
      hum.start();
      const singerOne = context.createOscillator();
      const singerTwo = context.createOscillator();
      const singerGain = context.createGain();
      singerOne.type = 'triangle';
      singerTwo.type = 'sine';
      singerOne.frequency.value = 294;
      singerTwo.frequency.value = 311;
      singerGain.gain.value = 0;
      singerOne.connect(singerGain);
      singerTwo.connect(singerGain);
      singerGain.connect(master);
      singerOne.start();
      singerTwo.start();
      audioRig = { context, master, noise, hum, humGain, singerOne, singerTwo, singerGain, enabled: audioEnabled, quiet: false };
      context.resume().catch(() => {});
      return audioRig;
    } catch (error) {
      console.warn('The pub is quieter than expected.', error);
      return null;
    }
  }

  function updateAudioRig() {
    if (!audioRig) return;
    const { context, master, humGain } = audioRig;
    const now = context.currentTime;
    const energyRatio = state.energy / capacity();
    const active = activeZoneCount() > 0 && !state.paused && !state.pendingExplosion;
    humGain.gain.setTargetAtTime(active ? .004 + energyRatio * .027 : 0, now, .35);
    const opera = audioEnabled && state.currentEvent === 'Opera Night' && state.eventUntil > state.gameSeconds && !audioRig.quiet;
    audioRig.singerGain.gain.setTargetAtTime(opera ? .022 : 0, now, .3);
    audioRig.singerOne.frequency.setTargetAtTime(294 + Math.sin(realClock * 3.1) * 17, now, .18);
    audioRig.singerTwo.frequency.setTargetAtTime(311 + Math.sin(realClock * 2.3 + 1) * 23, now, .18);
    if (!audioRig.quiet) master.gain.setTargetAtTime(audioEnabled ? .18 : 0, now, .2);
    if (audioEnabled && context.state === 'suspended' && !state.pendingExplosion) context.resume().catch(() => {});
  }

  function toggleSound() {
    audioEnabled = !audioEnabled;
    try { localStorage.setItem('white-hart-sound', audioEnabled ? 'on' : 'off'); } catch (_) {}
    const rig = setupAudio();
    if (rig) {
      rig.enabled = audioEnabled;
      if (audioEnabled) rig.context.resume().catch(() => {});
      rig.master.gain.setTargetAtTime(audioEnabled ? .18 : 0, rig.context.currentTime, .2);
    }
    renderUI();
    showToast(audioEnabled ? 'The pub makes a noise' : 'The pub goes quiet', audioEnabled ? 'Soft room tone, a little Silencer hum, and no actual singing.' : 'Sound is off. The Silencer has not been consulted.', 3600);
  }

  function playTinySound(frequency = 440, duration = .06) {
    if (!audioEnabled) return;
    const rig = setupAudio();
    if (!rig) return;
    const { context, master } = rig;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration + .02);
  }

  function playWarningTick() {
    if (!audioEnabled) return;
    const rig = setupAudio();
    if (!rig) return;
    const { context, master } = rig;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'square';
    osc.frequency.value = state.energy / capacity() >= .95 ? 990 : 760;
    gain.gain.setValueAtTime(.027, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .07);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + .08);
  }

  function hushForExplosion() {
    if (!audioEnabled || !audioRig) return;
    const rig = audioRig;
    rig.quiet = true;
    rig.master.gain.cancelScheduledValues(rig.context.currentTime);
    rig.master.gain.setTargetAtTime(0, rig.context.currentTime, .01);
    rig.context.suspend().catch(() => {});
  }

  function triggerBoomSound() {
    if (!audioEnabled) return;
    const rig = setupAudio();
    if (!rig) return;
    const { context, master } = rig;
    rig.quiet = false;
    context.resume().then(() => {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(.21, now);
      const boom = context.createOscillator();
      const boomGain = context.createGain();
      boom.type = 'sawtooth';
      boom.frequency.setValueAtTime(72, now);
      boom.frequency.exponentialRampToValueAtTime(31, now + .32);
      boomGain.gain.setValueAtTime(.32, now);
      boomGain.gain.exponentialRampToValueAtTime(.001, now + .55);
      boom.connect(boomGain);
      boomGain.connect(master);
      boom.start(now);
      boom.stop(now + .58);
      const ring = context.createOscillator();
      const ringGain = context.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(930, now + .06);
      ringGain.gain.setValueAtTime(.001, now);
      ringGain.gain.setValueAtTime(.055, now + .06);
      ringGain.gain.exponentialRampToValueAtTime(.001, now + 1.8);
      ring.connect(ringGain);
      ringGain.connect(master);
      ring.start(now + .04);
      ring.stop(now + 1.85);
      setTimeout(() => {
        if (audioRig && audioEnabled) audioRig.master.gain.setTargetAtTime(.18, audioRig.context.currentTime, .9);
      }, 600);
    }).catch(() => {});
  }

  function resizeRendererToStage() {
    if (!app?.renderer) return;
    const width = dom.stageInner.clientWidth;
    const height = dom.stageInner.clientHeight;
    if (!width || !height) return;
    if (app.screen.width !== width || app.screen.height !== height) {
      app.renderer.resize(width, height);
      roomPageSize = getPageSize();
      renderedTabsKey = '';
      renderUI();
      drawStage();
    }
  }

  function bindEvents() {
    $('#serve-button').addEventListener('click', pourSelectedPint);
    $('#serve-cancel').addEventListener('click', () => { state.selectedPatron = null; state.beerReady = false; renderUI(); });
    $('#vent-button').addEventListener('click', toggleVenting);
    $('#dock-vent-button').addEventListener('click', toggleVenting);
    $('#upgrade-button').addEventListener('click', () => openModal('shop', 'silencer'));
    $('#shop-button').addEventListener('click', () => openModal('shop', 'rooms'));
    $('#staff-button').addEventListener('click', () => openModal('staff'));
    $('#amenities-button').addEventListener('click', () => openModal('amenities'));
    $('#journal-button').addEventListener('click', showCurrentArticle);
    $('#help-button').addEventListener('click', () => openModal('help'));
    $('#pause-button').addEventListener('click', togglePause);
    $('#sound-button').addEventListener('click', toggleSound);
    $('#restart-button').addEventListener('click', () => openModal('restart'));
    $('#room-prev').addEventListener('click', () => setRoomPage(-1));
    $('#room-next').addEventListener('click', () => setRoomPage(1));
    $('#toast-close').addEventListener('click', dismissToast);
    dom.modalClose.addEventListener('click', closeModal);
    dom.modalRoot.addEventListener('click', (event) => { if (event.target.dataset.closeModal) closeModal(); });
    dom.modalContent.addEventListener('click', handleModalClick);
    dom.modalContent.addEventListener('change', (event) => { if (event.target.id === 'amenity-room-select') renderModal(); });
    dom.crisisButton.addEventListener('click', closeCrisis);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!dom.modalRoot.hidden) closeModal();
        else if (!dom.crisis.hidden && state.explosionFreeze <= 0) closeCrisis();
      } else if (event.key === ' ' && document.activeElement?.tagName !== 'BUTTON' && dom.modalRoot.hidden) {
        event.preventDefault();
        togglePause();
      } else if (event.key === 'ArrowLeft' && dom.modalRoot.hidden) setRoomPage(-1);
      else if (event.key === 'ArrowRight' && dom.modalRoot.hidden) setRoomPage(1);
    });
    dom.stageInner.addEventListener('pointerdown', (event) => { swipeStart = { x: event.clientX, y: event.clientY }; });
    dom.stageInner.addEventListener('pointerup', (event) => {
      if (!swipeStart) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.2) setRoomPage(dx < 0 ? 1 : -1);
      swipeStart = null;
    });
    dom.stageInner.addEventListener('pointercancel', () => { swipeStart = null; });
    window.addEventListener('resize', () => {
      clearTimeout(window._whiteHartResize);
      window._whiteHartResize = setTimeout(() => { renderUI(); drawStage(); }, 120);
    });
    window.addEventListener('beforeunload', saveState);
  }

  async function boot() {
    if (!window.PIXI) {
      dom.loading.innerHTML = '<span class="loading-mark">!</span><span>The pub cannot find its illustrator. Please refresh the page.</span>';
      return;
    }
    state = safeLoad() || freshState();
    if (!state.patrons.length && !state.gameOver && !state.won) seedStartingPatrons(state);
    if (!state.clippings?.length) state.clippings = freshState().clippings;
    const savedClipping = state.clippings[0];
    if (savedClipping) {
      $('#press-tag').textContent = savedClipping.tag;
      $('#press-headline').textContent = savedClipping.headline;
      $('#press-copy').textContent = savedClipping.copy;
    }
    bindEvents();
    try {
      app = new PIXI.Application();
      await app.init({
        backgroundColor: 0x1b251e,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        resizeTo: dom.stageInner,
        preference: 'webgl',
        powerPreference: 'low-power'
      });
      dom.canvas.remove();
      app.canvas.id = 'pub-canvas';
      app.canvas.setAttribute('aria-label', 'Interactive illustrated pub. Tap a patron to serve them, or tap a room to toggle its Silencer Zone.');
      app.canvas.setAttribute('role', 'img');
      dom.stageInner.insertBefore(app.canvas, dom.loading);
      if ('ResizeObserver' in window) {
        stageResizeObserver = new ResizeObserver(resizeRendererToStage);
        stageResizeObserver.observe(dom.stageInner);
      }
      dom.loading.classList.add('ready');
      setTimeout(() => { dom.loading.hidden = true; }, 400);
      roomPageSize = getPageSize();
      renderUI();
      drawStage();
      app.ticker.maxFPS = 30;
      app.ticker.add((ticker) => {
        const now = performance.now();
        let dt = Math.min((now - lastFrameAt) / 1000, .1);
        lastFrameAt = now;
        if (!Number.isFinite(dt) || dt < 0) dt = 0;
        uiClock += dt;
        realClock += dt;
        if (state && state.crisisDismissAt && realClock >= state.crisisDismissAt && !dom.crisis.hidden && !state.gameOver && !state.won) {
          closeCrisis();
          state.crisisDismissAt = 0;
        }
        tick(dt);
        animateAvatars();
        drawClock += dt;
        uiClock += 0;
        if (drawClock >= 1) { drawClock = 0; drawStage(); }
        if (uiClock >= .22) { renderUI(); uiClock = 0; }
        saveClock += dt;
        if (saveClock >= 8) { saveClock = 0; saveState(); }
      });
      if (state.gameOver) showSavedGameOver();
      else if (state.won) showSavedWin();
      else if (!hasSavedGame()) {
        setCaption('Three regulars have arrived. One of them has brought a notebook and an opinion.');
        showToast('Wednesday, 7:00 PM', 'Serve a patron, pull a pint, then tap them again. The Silencer is already on in the General Bar.', 9200);
      } else {
        showToast('The White Hart is open again', 'Your ledger has been restored. The regulars have been waiting, but not impatiently.', 5500);
      }
      saveState();
    } catch (error) {
      console.error('PixiJS could not open the pub.', error);
      dom.loading.classList.remove('ready');
      dom.loading.hidden = false;
      dom.loading.innerHTML = '<span class="loading-mark">W H</span><span>The White Hart is having a technical moment. Please refresh.</span>';
    }
  }

  window.addEventListener('DOMContentLoaded', boot, { once: true });
})();
