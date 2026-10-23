/* The White Hart — the running of the pub: economy, events, gags, secrets and consequences. */
(() => {
  'use strict';
  const WH = window.WH;
  const U = WH.util;
  const C = WH.content;

  const SAVE_KEY = 'silence-please-white-hart-v2';
  const NIGHT_LENGTH = 30;
  const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];
  const EGG_TOTAL = Object.keys(C.EGG_WORDS).length + 3; // the typed words, plus the code, the portrait and the machine

  let state = null;
  let roomPageSize = 4;
  let realClock = 0;
  let longPressTimer = null;
  let achievementClock = 0.5;
  let pendingExplosion = null;

  const ui = () => WH.ui;
  const scene = () => WH.scene;

  /* ----------------------------------------------------------------- state */
  function freshState() {
    const rooms = {};
    C.ROOM_DEFS.forEach((room) => {
      rooms[room.id] = {
        unlocked: room.id === 'general', damaged: false, zone: room.id === 'general',
        noiseSpike: 0, operaNoise: 0, eventNoiseUntil: 0, soundproofed: false
      };
    });
    return {
      version: 2,
      resources: { pints: 125, scoops: 4, manuscripts: 3, research: 45, loyalty: 12 },
      reputation: 100,
      energy: 18,
      tier: 1,
      rooms,
      homeRoom: 'general',
      patrons: [],
      nextPatronId: 1,
      staff: { barmaid: false, cellarMaster: false, physicist: false, journalistFriend: false, editor: false, bouncer: false, pianist: false, apprentice: false, catMinder: false },
      amenities: { jukebox: false, dartboard: false, betterBeer: false, thamesView: false, fireplace: false, pubCat: false, dartsTeam: false, neonSign: false, cheeseBoard: false, gramophone: false },
      soundproofedRooms: [],
      seUpgrades: { filters: 0, microphones: 0, absorber: 0, venting: 0, resonator: 0, casing: false, dumpUsed: false },
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
      nextGagAt: 26,
      nextBarmaidAt: 5,
      nextScientistAt: 30,
      nextWeatherAt: 180,
      highNoiseSeconds: 0,
      lastExplosionWeek: 0,
      currentEvent: '',
      eventUntil: 0,
      rivalUntil: 0,
      powerCutUntil: 0,
      powerCutRestore: null,
      storyFlags: { demo: false, revenge: false, tutorialExplosion: false, secret: false, perfected: false, green: false },
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
      tutorial: { intro: false, marks: [], hidden: false },
      tutorialExplosionAt: 0,
      chalk: C.CHALK_LINES[0],
      chalkIndex: 0,
      weather: C.WEATHER[0].id,
      weatherUntil: 0,
      shushUntil: 0,
      fentonMode: false,
      achievements: [],
      eggs: [],
      stats: {
        pintsServed: 0, patronsServed: 0, patronsLost: 0, pintsEarned: 0, explosions: 0,
        maxNoise: 0, seVented: 0, gags: 0, catPets: 0, dartsThrown: 0, weeksBest: 0,
        portraitTaps: 0, machineTaps: 0, zoneToggles: 0, eggsFound: 0
      },
      lastSaveAt: Date.now()
    };
  }

  function ensureExtras(target) {
    const base = freshState();
    target.stats = { ...base.stats, ...(target.stats || {}) };
    target.seUpgrades = { ...base.seUpgrades, ...(target.seUpgrades || {}) };
    target.staff = { ...base.staff, ...(target.staff || {}) };
    target.amenities = { ...base.amenities, ...(target.amenities || {}) };
    target.storyFlags = { ...base.storyFlags, ...(target.storyFlags || {}) };
    target.tutorial = { ...base.tutorial, ...(target.tutorial || {}) };
    if (!Array.isArray(target.tutorial.marks)) target.tutorial.marks = [];
    target.achievements = Array.isArray(target.achievements) ? target.achievements : [];
    target.eggs = Array.isArray(target.eggs) ? target.eggs : [];
    if (!target.chalk) target.chalk = C.CHALK_LINES[0];
    if (!target.weather) target.weather = C.WEATHER[0].id;
    return target;
  }

  function safeLoad() {
    try {
      const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem('silence-please-white-hart-v1');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.resources || !data.rooms) return null;
      const base = freshState();
      const merged = { ...base, ...data };
      merged.resources = { ...base.resources, ...data.resources };
      merged.rooms = { ...base.rooms, ...data.rooms };
      for (const def of C.ROOM_DEFS) merged.rooms[def.id] = { ...base.rooms[def.id], ...(data.rooms[def.id] || {}) };
      ensureExtras(merged);
      merged.version = 2;
      merged.patrons = Array.isArray(data.patrons) ? data.patrons.filter((p) => C.PATRONS[p.type] && merged.rooms[p.roomId]) : [];
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
      if (!C.ROOM_DEFS.some((room) => room.id === merged.homeRoom && merged.rooms[room.id].unlocked && !merged.rooms[room.id].damaged)) merged.homeRoom = 'general';
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
      const status = U.$('#pub-save-status');
      if (status) {
        status.textContent = 'SAVED LOCALLY';
        status.classList.remove('saving');
      }
    } catch (error) {
      const status = U.$('#pub-save-status');
      if (status) status.textContent = 'NO LOCAL LEDGER';
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
        patience: starter.patience, patienceMax: starter.patience, productionClock: 0,
        born: target.gameSeconds || 0, phase: Math.random() * Math.PI * 2
      });
    });
  }

  /* --------------------------------------------------------------- helpers */
  const roomDef = (id) => C.ROOM_DEFS.find((room) => room.id === id) || C.ROOM_DEFS[0];
  const isOperational = (roomId) => {
    const room = state.rooms[roomId];
    return Boolean(room && room.unlocked && !room.damaged);
  };
  const activePatrons = (roomId) => state.patrons.filter((patron) => patron.roomId === roomId);
  const seatLimit = (roomId) => roomDef(roomId).seats + (state.staff.journalistFriend && roomDef(roomId).seats > 0 ? 1 : 0);
  const currentSeason = () => SEASONS[(state.week - 1) % 4];
  const isSummer = () => currentSeason() === 'SUMMER';
  const tierDef = (tier = state.tier) => C.SILENCER_TIERS[tier - 1] || C.SILENCER_TIERS[0];
  const capacity = () => tierDef().capacity + state.seUpgrades.filters * 50;
  const absorption = () => {
    const base = tierDef().absorption + state.seUpgrades.microphones * 5;
    const mult = (state.staff.physicist ? 1.1 : 1) * (1 + state.seUpgrades.absorber * 0.1);
    return base * mult;
  };
  const ventRate = () => tierDef().vent + state.seUpgrades.venting * 2 + state.seUpgrades.resonator * 1.5 + (state.staff.cellarMaster ? 1 : 0);
  const pageSize = () => roomPageSize;
  const setPageSize = (value) => { roomPageSize = value; };
  const hasGreenRoom = () => Boolean(state.rooms.green && state.rooms.green.unlocked);
  const weatherName = () => (C.WEATHER.find((w) => w.id === state.weather) || C.WEATHER[0]).name;
  const weatherDef = () => C.WEATHER.find((w) => w.id === state.weather) || C.WEATHER[0];

  function resourceLabel(id) {
    return ({ pints: 'Pints', scoops: 'Scoops', manuscripts: 'Manuscripts', research: 'Research', loyalty: 'Loyalty', energy: 'Silence Energy' })[id] || id;
  }
  function formatCost(cost) {
    return Object.entries(cost).map(([key, amount]) => {
      const icon = ({ pints: '🍺', scoops: '📰', manuscripts: '📜', research: '⚗', loyalty: '♥', energy: '🔇' })[key] || '';
      return `${icon} ${U.formatNumber(amount)} ${resourceLabel(key)}`;
    }).join('  ·  ');
  }
  function canAfford(cost) {
    return Object.entries(cost).every(([key, amount]) => (key === 'energy' ? state.energy : (state.resources[key] || 0)) + 1e-8 >= amount);
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
    if (!Number.isFinite(amount)) return;
    if (key === 'energy') state.energy = U.clamp(state.energy + amount, 0, capacity());
    else if (Object.prototype.hasOwnProperty.call(state.resources, key)) {
      state.resources[key] = Math.max(0, state.resources[key] + amount);
      if (key === 'pints' && amount > 0) state.stats.pintsEarned += amount;
    }
  }
  function addStat(key, amount = 1) {
    state.stats[key] = Math.max(0, (state.stats[key] || 0) + amount);
  }

  function getClockLabel() { return U.formatClock(state.dayElapsed); }
  function setCaption(text) { const node = U.$('#scene-caption'); if (node) node.textContent = text; }
  function announce(text) { const node = U.$('#live-announcer'); if (node) node.textContent = text; }

  /* The evening's orders: a first-Wednesday checklist that teaches the loop. */
  const TOUR_STEPS = [
    { mark: 'select', text: 'Tap a patron standing in a room.' },
    { mark: 'pour', text: 'Pull their pint at the bar (the big button).' },
    { mark: 'serve', text: 'Tap the same patron again to hand it over.' },
    { mark: 'zone', text: 'Tap a room card to switch its Silencer Zone on.' },
    { mark: 'vent', text: 'Vent the apparatus before the tubes complain.' },
    { mark: 'desk', text: "Open the Landlord's Desk and buy something." }
  ];
  function tourMark(mark) {
    if (!state || !state.tutorial || state.tutorial.marks.includes(mark)) return false;
    state.tutorial.marks.push(mark);
    const step = TOUR_STEPS.find((entry) => entry.mark === mark);
    if (step && state.tutorial.marks.length === TOUR_STEPS.length) {
      announce('The evening\u2019s orders are complete. The method is now the pub\u2019s method.');
    }
    saveState();
    if (ui()) ui().renderTour();
    return true;
  }
  function tourReset() {
    if (!state) return;
    state.tutorial = { intro: true, marks: [], hidden: false };
    saveState();
    if (ui()) ui().renderTour();
  }

  function pushNews(tag, headline, copy, diaryId = null) {
    const clipping = { tag: `${tag} · WEDNESDAY ${String(state.week).padStart(2, '0')}`, headline, copy, time: getClockLabel() };
    state.clippings.unshift(clipping);
    state.clippings = state.clippings.slice(0, 15);
    if (diaryId && !state.diaryPages.includes(diaryId)) state.diaryPages.push(diaryId);
    if (ui()) ui().latestClipping(clipping);
    announce(`${tag}: ${headline}`);
    if (ui()) ui().render();
  }

  /* ------------------------------------------------------------ noise & SE */
  function sourceNoise(roomId) {
    if (!isOperational(roomId)) return 0;
    const room = state.rooms[roomId];
    let sound = activePatrons(roomId).reduce((total, patron) => total + (C.PATRONS[patron.type]?.noise || 0), 0);
    sound += room.noiseSpike + room.operaNoise;
    if (roomId === 'general' && state.amenities.jukebox) sound += 10;
    if (roomId === 'general' && state.amenities.dartboard) sound += 5;
    if (roomId === 'general' && state.staff.pianist) sound += 8;
    if (roomId === 'saloon' && state.amenities.gramophone) sound += 12;
    if (roomId === 'backroom' && state.amenities.dartsTeam) sound += 10;
    if (state.amenities.cheeseBoard) sound -= 1;
    if (state.staff.bouncer) sound -= 1;
    if (room.soundproofed || state.soundproofedRooms.includes(roomId)) sound *= 0.8;
    if (state.rooms.kitchen?.unlocked && !state.rooms.kitchen.damaged) sound *= 0.9;
    if (state.shushUntil > state.gameSeconds) sound *= 0.5;
    return U.clamp(Math.round(sound), 0, 100);
  }
  function roomNoise(roomId) {
    if (!isOperational(roomId)) return 0;
    if (state.rooms[roomId].zone && state.powerCutUntil <= state.gameSeconds) return 0;
    return sourceNoise(roomId);
  }
  function zoneIsOn(roomId) {
    return Boolean(isOperational(roomId) && state.rooms[roomId].zone && state.powerCutUntil <= state.gameSeconds);
  }
  function activeZoneCount() { return C.ROOM_DEFS.filter((room) => zoneIsOn(room.id)).length; }
  function maxRoomNoise() { return Math.max(0, ...C.ROOM_DEFS.map((room) => roomNoise(room.id))); }
  function totalEnergyRate() {
    if (state.powerCutUntil > state.gameSeconds || !isOperational(state.homeRoom)) return 0;
    const factor = absorption() / 100 * 0.7;
    return C.ROOM_DEFS.reduce((sum, room) => (zoneIsOn(room.id) ? sum + sourceNoise(room.id) * factor : sum), 0);
  }

  function resourceRates() {
    const rates = { pints: 0, scoops: 0, manuscripts: 0, research: 0, loyalty: 0 };
    if (isOperational('general')) rates.pints += 1;
    if (isOperational('saloon')) rates.scoops += 2;
    if (isOperational('snug')) rates.research += 3;
    if (isOperational('kitchen')) rates.loyalty += 2;
    if (isOperational('backroom') && state.eventUntil > state.gameSeconds) rates.loyalty += 5;
    if (isOperational('upstairs')) rates.manuscripts += 4;
    if (isOperational('roof') && isSummer()) rates.pints += 10;
    if (isOperational('green')) rates.scoops += 4;
    if (state.staff.editor) rates.manuscripts += 1 / 60;
    if (state.staff.bouncer) rates.loyalty += 1 / 60;
    if (state.staff.catMinder) rates.loyalty += 1;
    if (state.amenities.jukebox) rates.loyalty += 5 / 60;
    if (state.amenities.dartboard) rates.loyalty += 5 / 60;
    if (state.amenities.fireplace) rates.loyalty += 8 / 60;
    if (state.amenities.pubCat) rates.loyalty += 5 / 60;
    if (state.amenities.gramophone) rates.loyalty += 10 / 60;
    if (state.amenities.dartsTeam) rates.scoops += 3 / 60;
    state.patrons.forEach((patron) => {
      const production = C.PATRONS[patron.type]?.production;
      if (!production) return;
      let speed = 1;
      if (patron.type === 'scientist' && state.staff.apprentice) speed *= 1.25;
      Object.entries(production).forEach(([resource, amount]) => {
        if (resource === 'seconds') return;
        rates[resource] += (amount / production.seconds) * speed;
      });
    });
    if (state.amenities.betterBeer) rates.pints *= 1.5;
    if (state.fentonMode) rates.pints *= 1.5;
    return rates;
  }

  /* ------------------------------------------------------------- the rooms */
  function tryUnlockRoom(roomId) {
    const def = roomDef(roomId);
    const room = state.rooms[roomId];
    if (room.damaged && room.unlocked) return tryRebuildRoom(roomId);
    if (room.unlocked) {
      ui().toast('Already open', `${def.name} has been open long enough to acquire a smell of its own.`);
      return false;
    }
    const index = C.ROOM_DEFS.findIndex((entry) => entry.id === roomId);
    const previous = C.ROOM_DEFS[index - 1];
    if (previous && (!state.rooms[previous.id].unlocked || state.rooms[previous.id].damaged)) {
      ui().toast('One room at a time', `The ${previous.name} must be open before the ${def.name}. The architect was very particular.`);
      return false;
    }
    const cost = { pints: def.cost };
    if (!canAfford(cost)) {
      ui().toast('Not quite enough', `${def.name} costs ${def.cost} Pints. The landlord has checked the till twice.`);
      ui().openModal('shop', 'rooms');
      return false;
    }
    spend(cost);
    room.unlocked = true;
    room.damaged = false;
    room.zone = false;
    if (roomId === 'cellar') state.homeRoom = 'cellar';
    pushNews('ROOM OPENED', `${def.name.toUpperCase()} OPENS ITS DOORS`, `${def.special}. The rent is paid in advance, naturally.`, roomId === 'cellar' ? 'cellar' : roomId === 'kitchen' ? 'kitchen' : null);
    ui().toast('A new room', `${def.name} is open. There are now more ways to be quiet in public.`);
    if (roomId === 'snug') setCaption('The Snug is for scientists only. Their tweed has been entered in the guest book.');
    if (roomId === 'cellar') setCaption('The Silencer now lives in the Cellar. The building has a reassuringly thick ceiling.');
    if (roomId === 'kitchen') setCaption('The Kitchen is open. Somewhere behind the bar, a person is doing all of the actual work.');
    if (roomId === 'green') {
      state.storyFlags.green = true;
      setCaption('The Green Room is open. It is not on any plan, including this one.');
      addDiary('green');
    }
    scene().markDirty();
    afterStructureChange();
    return true;
  }

  function tryRebuildRoom(roomId) {
    const def = roomDef(roomId);
    const room = state.rooms[roomId];
    const cost = { pints: Math.max(25, Math.ceil(def.cost * 0.5)) };
    if (!canAfford(cost)) {
      ui().toast('Repairs are expensive', `Rebuilding the ${def.name} costs ${cost.pints} Pints. The quote does not include the wallpaper.`);
      return false;
    }
    spend(cost);
    room.damaged = false;
    room.zone = false;
    if (!isOperational(state.homeRoom)) state.homeRoom = roomId === 'cellar' ? 'cellar' : 'general';
    pushNews('REBUILDING WORKS', `${def.name.toUpperCase()} REOPENS AFTER “AN INCIDENT”`, 'The landlord has declined to specify which incident. The invoice is very specific.');
    ui().toast('Back in business', `${def.name} has been rebuilt. There is a fresh coat of paint over the scorch marks.`);
    scene().markDirty();
    afterStructureChange();
    return true;
  }

  function afterStructureChange() {
    checkWinCondition();
    if (ui()) ui().render();
    saveState();
  }

  function toggleZone(roomId) {
    const room = state.rooms[roomId];
    const def = roomDef(roomId);
    if (!room.unlocked) return tryUnlockRoom(roomId);
    if (room.damaged) return tryRebuildRoom(roomId);
    if (state.powerCutUntil > state.gameSeconds) {
      ui().toast('Power cut', 'The Fenton Silencer has been deprived of electricity until the lights return.');
      return false;
    }
    if (!isOperational(state.homeRoom)) {
      ui().toast('Silencer out of order', 'The housing is rubble. Rebuild a room before asking the apparatus to listen again.');
      return false;
    }
    room.zone = !room.zone;
    addStat('zoneToggles');
    tourMark('zone');
    const centre = scene().roomCenter(roomId);
    if (room.zone) {
      setCaption(`${def.name}: zone on. The room has become beautifully quiet, and the machine has noticed.`);
      announce(`${def.name} silencer zone on`);
      WH.audio.play('zoneOn');
      WH.fx.shockwave(centre.x, centre.y, { size: 14, to: Math.max(centre.x, 260), tint: 0x9fd0b0, alpha: 0.55, life: 0.7 });
      WH.fx.puff(centre.x, centre.y, { count: 8, tint: 0xa8d8bc, speedMax: 30 });
    } else {
      setCaption(`${def.name}: zone off. The conversation has returned to its usual volume.`);
      announce(`${def.name} silencer zone off`);
      WH.audio.play('zoneOff');
      WH.fx.puff(centre.x, centre.y, { count: 10, tint: 0xd9cba6, speedMax: 46 });
    }
    if (ui()) ui().render();
    saveState();
    return true;
  }

  /* -------------------------------------------------------------- patrons */
  function possibleRoomsFor(type) {
    return C.ROOM_DEFS.filter((def) => {
      if (!isOperational(def.id) || def.seats === 0 || activePatrons(def.id).length >= seatLimit(def.id)) return false;
      if (def.accepts && !def.accepts.includes(type)) return false;
      if (def.id === 'backroom' && state.eventUntil <= state.gameSeconds) return false;
      if (def.id === 'roof' && !isSummer()) return false;
      if (def.id === 'green' && !hasGreenRoom()) return false;
      const avoid = C.PATRONS[type].avoid || [];
      if (avoid.includes(def.id)) return false;
      return true;
    });
  }

  function choosePatronType() {
    let entries = Object.entries(C.PATRONS);
    if (state.staff.bouncer) entries = entries.filter(([key]) => key !== 'burt');
    if (state.tier < 5 && !state.fentonMode) entries = entries.filter(([key]) => key !== 'ghost');
    // Burt's noise is unwelcome even to the apparatus; he only enters while at least one zone is off.
    if (activeZoneCount() >= C.ROOM_DEFS.filter((room) => isOperational(room.id)).length) {
      entries = entries.filter(([key]) => key !== 'burt');
    }
    if (state.currentEvent === 'Opera Night') {
      entries = entries.map(([key, def]) => (key === 'choir' ? [key, { ...def, weight: def.weight * 8 }] : [key, def]));
    }
    if (state.storyFlags.revenge) {
      entries = entries.map(([key, def]) => (key === 'kendell' ? [key, { ...def, weight: def.weight * 4 }] : [key, def]));
    }
    const total = entries.reduce((sum, [, def]) => sum + def.weight, 0);
    let roll = Math.random() * total;
    for (const [key, def] of entries) {
      roll -= def.weight;
      if (roll <= 0) return key;
    }
    return 'regular';
  }

  function spawnPatron(forcedType = null, forcedRoom = null, forcedName = null) {
    if (state.gameOver || state.won || state.explosionFreeze > 0) return null;
    let type = forcedType || choosePatronType();
    if (type === 'burt' && state.staff.bouncer) type = 'regular';
    if (type === 'burt' && activeZoneCount() >= C.ROOM_DEFS.filter((room) => isOperational(room.id)).length) type = 'regular';
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
    if (type === 'scientist' && candidates.some((entry) => entry.id === 'snug') && Math.random() < 0.72) room = candidates.find((entry) => entry.id === 'snug');
    if (['writer', 'editor'].includes(type) && candidates.some((entry) => entry.id === 'upstairs') && Math.random() < 0.7) room = candidates.find((entry) => entry.id === 'upstairs');
    if ((type === 'choir' || type === 'kendell') && candidates.some((entry) => entry.id === 'green') && Math.random() < 0.8) room = candidates.find((entry) => entry.id === 'green');
    const def = C.PATRONS[type];
    const maxPatience = U.rand(16, 38);
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
      ui().toast('A cryptic visitor', 'Harry Purvis has left a note in the margin. It is mostly about thermodynamics.', 5400);
    }
    if (type === 'john') addResource('manuscripts', 1);
    if (type === 'ghost') {
      WH.audio.play('ghost');
      ui().toast('Somebody at the bar', 'A gentleman in an old-fashioned waistcoat has joined you. He is translucent.', 5600);
    }
    if (type === 'burt') {
      state.rooms[room.id].noiseSpike += 40;
      pushNews('BURT HUGGINS RANT', '“I CAN STILL HEAR MYSELF THINK,” SHOUTS BURT', 'Burt Huggins has taken the floor. The floor would prefer not to be involved.');
      setCaption('Burt Huggins is in the room. The Silencer is off. The neighbours have begun taking notes.');
      scene().patronSay(patron, '“I CAN STILL HEAR MYSELF THINK!”', { life: 3.4, shake: true, size: 11 });
      WH.fx.shockwave(scene().patronPoint(patron.id).x, scene().patronPoint(patron.id).y, { size: 8, to: 90, tint: 0xd06a4c, alpha: 0.5, life: 0.6 });
    } else if (type === 'harry') {
      pushNews('PURVIS VISITS', 'A STRANGER LEAVES A NOTE UNDER HIS GLASS', '“The energy has not gone away,” it reads. “It has merely changed its address.”', 'opening');
    } else if (type === 'john') {
      setCaption('John Christopher has arrived. He is reading quietly, which is not the same as being invisible.');
    }
    scene().syncPatrons();
    return patron;
  }

  function leavePatron(patron, reason = 'patience', angry = true) {
    const index = state.patrons.findIndex((entry) => entry.id === patron.id);
    if (index < 0) return;
    const room = state.rooms[patron.roomId];
    if (angry) {
      room.noiseSpike += 20;
      state.reputation = Math.max(0, state.reputation - 2);
      addStat('patronsLost');
      pushNews('ANGRY DEPARTURE', `${patron.name.toUpperCase()} LEAVES WITH A REMARK`, `${patron.name} was not served in time. The remark was +20 dB and −2 Reputation.`);
      setCaption(`${patron.name} has left angry. Noise +20 dB. Reputation −2. The door has been judged inadequate.`);
      const point = scene().patronPoint(patron.id);
      scene().patronSay(patron, '“I shall be writing about this.”', { life: 2.6, color: '#f0a08a', shake: true });
      WH.fx.puff(point.x, point.y + 30, { count: 10, tint: 0xd07a5a, speedMax: 40 });
      WH.audio.play('door');
    } else if (reason === 'burt') {
      setCaption('John Christopher has gone. Burt has finally managed to be interesting to somebody.');
    } else if (reason === 'served') {
      WH.fx.puff(scene().patronPoint(patron.id).x, scene().patronPoint(patron.id).y + 30, { count: 6, tint: 0xe0cba0, speedMax: 26 });
    }
    state.patrons.splice(index, 1);
    if (state.selectedPatron === patron.id) {
      state.selectedPatron = null;
      state.beerReady = false;
    }
    if (reason === 'noise') announce(`${patron.name} has left because it is too loud`);
    scene().syncPatrons();
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
    tourMark('select');
    const kind = C.PATRONS[patron.type];
    setCaption(`${patron.name} · ${kind.label}. ${kind.noise} dB of conversation. ${Math.ceil(patron.patience)} seconds of patience, give or take an anecdote.`);
    WH.audio.play('select');
    scene().patronSay(patron, U.pick(kind.quips), { life: 1.9 });
    if (ui()) ui().render();
  }

  function pourSelectedPint() {
    const patron = state.patrons.find((entry) => entry.id === state.selectedPatron);
    if (!patron || state.beerReady) return;
    state.beerReady = true;
    tourMark('pour');
    const point = scene().patronPoint(patron.id);
    WH.audio.play('pour');
    if (!U.reduceMotion()) {
      for (let i = 0; i < 8; i++) {
        WH.fx.emit({
          x: point.x + U.rand(-8, 8), y: point.y + 26,
          vx: U.rand(-8, 8), vy: U.rand(-26, -10), gravity: 20, drag: 0.8,
          life: U.rand(0.5, 1.1), size: U.rand(2, 4.6), tint: 0xf0e2b8, alpha: 0.8, toSize: 1
        });
      }
    }
    setCaption(`Pint poured for ${patron.name}. Tap the same patron to hand it over. Civilisation depends on the sequence.`);
    announce(`Pint ready for ${patron.name}. Tap them again to serve.`);
    if (patron.type === 'ghost') {
      scene().patronSay(patron, '“The pint goes straight through.”', { life: 2.6 });
    }
    if (ui()) ui().render();
  }

  function servePatron(patron) {
    const index = state.patrons.findIndex((entry) => entry.id === patron.id);
    if (index < 0) return;
    const servedType = patron.type;
    const payout = state.amenities.betterBeer ? 12 : 8;
    addResource('pints', payout);
    addStat('pintsServed', payout);
    addStat('patronsServed');
    state.reputation = Math.min(100, state.reputation + (servedType === 'inspector' ? 2 : 0.25));
    const roomId = patron.roomId;
    tourMark('serve');
    state.patrons.splice(index, 1);
    state.selectedPatron = null;
    state.beerReady = false;
    WH.audio.play('serve');
    scene().floatOnPatron(patron.id, `+${payout} 🍺`, { color: '#f2d68f' });
    scene().syncPatrons();
    setCaption(`${patron.name} has been served. +${payout} Pints. The transaction was conducted without a single form.`);
    if (servedType === 'burt') {
      const john = state.patrons.find((entry) => entry.type === 'john');
      if (john) leavePatron(john, 'burt', false);
      pushNews('A VERY LOUD ROUND', 'BURT HUGGINS IS PLEASED WITH THE SERVICE', 'John Christopher has left. The glasses are still trembling.');
      ui().toast('Burt Huggins served', 'Burt is happy. The rest of the room is considering a transfer.', 5200);
      unlock('burt-served');
      addStat('burtServed', 1);
    }
    if (servedType === 'harry') ui().toast('A note with the change', 'Harry Purvis has paid in exact change. He was not carrying any money.', 5200);
    if (servedType === 'john') ui().toast('A quiet regular', 'John Christopher has left a manuscript on the table. Nobody remembers seeing him write it.', 5200);
    if (servedType === 'ghost') {
      ui().toast('Paid in exact change', 'The gentleman in grey has settled his account with a coin that is no longer legal tender.', 5600);
      unlock('ghost-served');
      addStat('ghostServed', 1);
    }
    if (servedType === 'inspector') {
      ui().toast('The inspector is satisfied', '+2 Reputation. He has written something down, which is his version of applause.', 5000);
    }
    if (U.chance(0.2)) scene().sayAt(roomId, U.pick(['“Cheers.”', '“Lovely.”', '“About time.”', '“Mine’s a half.”']), { life: 1.8 });
    checkWinCondition();
    if (ui()) ui().render();
  }

  function autoServe() {
    if (!state.staff.barmaid || !state.patrons.length) return;
    const patron = [...state.patrons].sort((a, b) => a.patience - b.patience)[0];
    if (!patron) return;
    const payout = state.amenities.betterBeer ? 12 : 8;
    addResource('pints', payout);
    addStat('pintsServed', payout);
    addStat('patronsServed');
    state.reputation = Math.min(100, state.reputation + 0.25);
    state.patrons = state.patrons.filter((entry) => entry.id !== patron.id);
    if (state.selectedPatron === patron.id) { state.selectedPatron = null; state.beerReady = false; }
    scene().syncPatrons();
    setCaption(`The barmaid has served ${patron.name} without asking anyone's permission. +${payout} Pints.`);
    if (Math.random() < 0.25) ui().toast('The Barmaid', 'The Barmaid has dealt with the queue. Her method is not in the handbook.', 4200);
    if (patron.type === 'burt') {
      const john = state.patrons.find((entry) => entry.type === 'john');
      if (john) leavePatron(john, 'burt', false);
    }
  }

  function checkNoiseDepartures() {
    C.ROOM_DEFS.forEach((room) => {
      if (!isOperational(room.id) || zoneIsOn(room.id)) return;
      const noise = sourceNoise(room.id);
      const toLeave = activePatrons(room.id).filter((patron) => noise > C.PATRONS[patron.type].leavesAt);
      toLeave.forEach((patron) => leavePatron(patron, 'noise', true));
    });
  }

  function updatePatrons(dt) {
    for (const patron of [...state.patrons]) {
      patron.patience -= dt;
      patron.productionClock += dt;
      const def = C.PATRONS[patron.type];
      if (def.production && patron.productionClock >= def.production.seconds) {
        const speed = patron.type === 'scientist' && state.staff.apprentice ? 1.25 : 1;
        const cycles = Math.floor(patron.productionClock / def.production.seconds);
        for (let n = 0; n < cycles; n++) {
          Object.entries(def.production).forEach(([resource, amount]) => {
            if (resource !== 'seconds') addResource(resource, amount * speed);
          });
        }
        patron.productionClock -= cycles * def.production.seconds;
      }
      if (patron.patience <= 0) leavePatron(patron, 'patience', true);
    }
  }

  function setRandomSpawnTime() {
    const reputationMultiplier = 1.45 - state.reputation * 0.0045;
    const rivalMultiplier = state.rivalUntil > state.gameSeconds ? 1.11 : 1;
    const neonMultiplier = state.amenities.neonSign ? 0.87 : 1;
    const weatherMultiplier = state.weather === 'storm' ? 1.2 : state.weather === 'rain' ? 1.1 : state.weather === 'clear' ? 0.95 : 1;
    state.nextSpawnAt = state.gameSeconds + U.rand(3.4, 7) * reputationMultiplier * rivalMultiplier * neonMultiplier * weatherMultiplier;
  }

  /* --------------------------------------------------------------- events */
  function startOperaNight() {
    C.ROOM_DEFS.forEach((room) => {
      if (isOperational(room.id)) {
        state.rooms[room.id].operaNoise = 50;
        state.rooms[room.id].eventNoiseUntil = state.gameSeconds + 35;
      }
    });
    state.eventUntil = state.gameSeconds + 35;
    state.currentEvent = 'Opera Night';
    // The surge is scaled to the machine: a shock on a prototype, not an execution.
    const surge = Math.round(Math.min(200, Math.max(40, capacity() * 0.5)));
    state.energy += surge;
    pushNews('OPERA NIGHT', 'SILENCE! LOCAL PUB’S MIRACLE DEVICE STUNS OPERA CROWD', C.NEWS_QUOTES[0]);
    setCaption(`Opera Night. All rooms +50 dB. The Silencer has stored ${surge} SE without consulting the management.`);
    ui().toast('OPERA NIGHT', `All rooms +50 dB. Silence Energy +${surge}. The singer has found the one note the apparatus cannot ignore.`, 7800);
    WH.audio.play('fanfare');
    for (let i = 0; i < 4; i++) spawnPatron('choir');
    if (state.energy >= capacity()) beginExplosion(false);
    addStat('operaSurvived', 1);
  }

  function rollRandomEvent() {
    state.nextEventAt = state.gameSeconds + U.rand(120, 300);
    const table = C.EVENT_DEFS;
    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    let chosen = 'quiet';
    for (const entry of table) {
      roll -= entry.weight;
      if (roll <= 0) { chosen = entry.id; break; }
    }
    runEvent(chosen);
  }

  function runEvent(id) {
    switch (id) {
      case 'inspector': {
        const noisy = maxRoomNoise();
        pushNews('HEALTH INSPECTOR', 'THE INSPECTOR HAS REQUESTED A QUIETER TABLE', noisy > 90 ? 'Noise exceeds 90 dB. A £100 Pints fine has been issued in the public interest.' : 'The inspector has found the noise acceptable. This is not a compliment.');
        if (noisy > 90) {
          state.resources.pints = Math.max(0, state.resources.pints - 100);
          ui().toast('Health Inspector', 'The room is over 90 dB. Fine: 100 Pints. The inspector has kept the receipt.', 7200);
          WH.audio.play('nope');
        } else {
          ui().toast('Health Inspector', 'The inspector has found nothing wrong. They will return when it is louder.', 6500);
        }
        spawnPatron('inspector');
        break;
      }
      case 'author': {
        state.resources.manuscripts += 10;
        state.resources.scoops += 5;
        pushNews('FAMOUS AUTHOR', 'A FAMOUS AUTHOR HAS BEEN SPOTTED IN THE SALOON', 'They left ten manuscripts and five scoops. The signature is difficult to read.');
        ui().toast('A famous author', '+10 Manuscripts and +5 Scoops. They were expected to leave a note, but left a pile instead.');
        WH.audio.play('coin');
        break;
      }
      case 'powercut': {
        state.powerCutRestore = C.ROOM_DEFS.reduce((result, room) => { result[room.id] = state.rooms[room.id].zone; return result; }, {});
        state.powerCutUntil = state.gameSeconds + 30;
        C.ROOM_DEFS.forEach((room) => { if (state.rooms[room.id].unlocked) state.rooms[room.id].zone = false; });
        state.currentEvent = 'Power Cut';
        state.eventUntil = state.powerCutUntil;
        pushNews('POWER CUT', 'THE WHITE HART GOES DARK. THE PUB DOES NOT GET ANY QUIETER.', 'The Silencer is off for 30 seconds. The candles have been found, but nobody knows where the matches are.');
        ui().toast('Power Cut', 'Silencer off for 30 seconds. Noise is back in fashion.', 6500);
        WH.fx.flash('#0a1116', 0.55, 900);
        break;
      }
      case 'purvis': {
        addResource('research', 1);
        pushNews('PURVIS VISITS', 'HARRY PURVIS LEAVES A SINGLE, CRYPTIC FIGURE', 'A neatly written “1” appears on the back of the drinks bill. +1 Research.', 'opening');
        ui().toast('Purvis visits', '+1 Research. Harry has left a hint, though the hint is apparently the number one.');
        break;
      }
      case 'rival': {
        state.rivalUntil = state.gameSeconds + 300;
        pushNews('RIVAL PUB OPENS', 'A NEW PUBLIC HOUSE OPENS AROUND THE CORNER', 'Patron arrivals are down 10% for five minutes. Their sign is spelled correctly, which is ominous.');
        ui().toast('Rival Pub Opens', 'Patron arrivals −10% for five minutes. They have a better sign. It will not last.');
        break;
      }
      case 'prank': {
        state.energy += 50;
        pushNews('STUDENT PRANK', 'STUDENTS LEAVE A NOTE BESIDE THE FENTON SILENCER', 'The note says “What does this lever do?” The Silence Energy meter says +50.');
        ui().toast('Student Prank', 'Silence Energy +50. The students have gone on to study somewhere less expensive.', 6500);
        if (state.energy >= capacity()) beginExplosion(false);
        break;
      }
      case 'delivery': {
        const amount = 60;
        addResource('pints', amount);
        pushNews('A DELIVERY', 'THE WRONG CRATE HAS ARRIVED AND NOBODY IS COMPLAINING', `It contains ${amount} Pints and one barrel of something the cellar will not discuss.`);
        ui().toast('A delivery', `+${amount} Pints. The invoice is in a language the cellar does not speak.`, 6000);
        WH.audio.play('clink');
        break;
      }
      case 'quiz': {
        addResource('loyalty', 12);
        state.eventUntil = state.gameSeconds + 40;
        state.currentEvent = 'Pub Quiz';
        pushNews('PUB QUIZ', 'THE QUIZ HAS BEEN WON BY A TABLE OF STRANGERS', 'The prize is a pint each. The questions were, apparently, extremely hard.');
        ui().toast('Pub Quiz', '+12 Loyalty. The winning team has asked whether there is a league.', 6200);
        break;
      }
      case 'karaoke': {
        C.ROOM_DEFS.forEach((room) => { if (isOperational(room.id)) state.rooms[room.id].noiseSpike += 18; });
        addResource('loyalty', 8);
        state.eventUntil = state.gameSeconds + 30;
        state.currentEvent = 'Karaoke';
        pushNews('KARAOKE', 'THE REGULARS ATTEMPT “NIGHTS IN WHITE SATIN”', 'The apparatus has stored all of it. All of it.');
        ui().toast('Karaoke Night', '+18 dB everywhere and +8 Loyalty. Somebody always attempts the high bit.', 6800);
        break;
      }
      case 'darts': {
        if (isOperational('backroom')) {
          state.rooms.backroom.noiseSpike += 14;
          addResource('scoops', 3);
          pushNews('DARTS MATCH', 'THE DARTS TEAM HAS WON AGAIN, LOUDLY', 'The Back Room is +14 dB and +3 Scoops. The wall has stopped protesting.');
          ui().toast('Darts match', 'Back Room +14 dB, +3 Scoops. The away team has asked for a rematch.', 6000);
        } else {
          addResource('loyalty', 5);
          ui().toast('Darts cancelled', 'There is nowhere to play. The team has drunk about it instead. +5 Loyalty.', 5600);
        }
        break;
      }
      case 'dog': {
        addResource('loyalty', 9);
        pushNews('A CELEBRITY DOG', 'A DOG OF CONSIDERABLE LOCAL FAME VISITS THE BAR', 'It has been served a saucer of something. The regulars are delighted.');
        ui().toast('A celebrity dog', '+9 Loyalty. It has its own stool and everything.', 6000);
        WH.audio.play('bubble');
        break;
      }
      case 'gasleak': {
        const lost = Math.ceil(state.patrons.length * 0.35);
        for (let i = 0; i < lost; i++) {
          const patron = state.patrons[Math.floor(Math.random() * state.patrons.length)];
          if (patron) leavePatron(patron, 'noise', false);
        }
        pushNews('A SMELL OF GAS', 'THE PUB IS EVACUATED BRIEFLY AND THEN UN-EVACUATED', 'Everybody stood outside. The smell turned out to be the cheese board.');
        ui().toast('A smell of gas', `${lost} patron(s) stepped outside. The smell was the cheese board.`, 6400);
        break;
      }
      case 'silentdisco': {
        state.currentEvent = 'Silent Disco';
        state.eventUntil = state.gameSeconds + 25;
        state.energy += 120;
        pushNews('SILENT DISCO', 'THE PUB HOLDS A DISCO WITH NO AUDIBLE MUSIC', 'The Silencer has stored 120 SE. Everybody is dancing to nothing in particular.');
        ui().toast('Silent Disco', 'Silence Energy +120. Nobody can hear the music, and nobody has stopped dancing.', 6800);
        if (state.energy >= capacity()) beginExplosion(false);
        break;
      }
      case 'timeTravel': {
        addResource('manuscripts', 3);
        addResource('research', 3);
        pushNews('A VISITOR', 'A GENTLEMAN ASKS WHAT YEAR IT IS AND THEN APOLOGISES', 'He left three manuscripts and three units of research, and one very strange tip.');
        ui().toast('A visitor', '+3 Manuscripts, +3 Research. He asked whether the apparatus was “the early one”.', 7000);
        spawnPropNow('ufo');
        break;
      }
      case 'birthday': {
        addResource('loyalty', 15);
        pushNews('THE LANDLORD’S BIRTHDAY', 'A CAKE APPEARS. NOBODY WILL SAY WHOSE IDEA IT WAS.', 'The landlord has made a speech about the apparatus. The apparatus hummed appreciatively.');
        ui().toast('The landlord’s birthday', '+15 Loyalty. He has made a speech about the humming.', 6400);
        WH.audio.play('laugh');
        break;
      }
      default: {
        pushNews('A QUIET EVENING', 'PUB REPORTS AN UNEVENTFUL EVENING', 'The reporter was unable to hear anything worth printing.');
      }
    }
    if (ui()) ui().render();
  }

  /* ----------------------------------------------------------------- gags */
  function scheduleNextGag() {
    state.nextGagAt = state.gameSeconds + U.rand(14, 40) * (state.amenities.pubCat ? 0.7 : 1);
  }

  function pickGag() {
    const open = C.ROOM_DEFS.filter((room) => isOperational(room.id));
    if (!open.length) return null;
    const pool = C.GAGS.filter((gag) => state.week >= (gag.minWeek || 1));
    const total = pool.reduce((sum, gag) => sum + gag.weight, 0);
    let roll = Math.random() * total;
    let chosen = pool[0];
    for (const gag of pool) {
      roll -= gag.weight;
      if (roll <= 0) { chosen = gag; break; }
    }
    return chosen;
  }

  function runGag(gag) {
    if (!gag) return;
    addStat('gags');
    if (gag.kind === 'prop') spawnPropNow(gag.prop, gag);
    else runMoment(gag.id);
  }

  function spawnPropNow(kind, gag = null) {
    const size = scene().size;
    const y = size.height * U.rand(0.42, 0.72);
    const flip = Math.random() < 0.5;
    const fromX = flip ? -40 : size.width + 40;
    const toX = flip ? size.width + 40 : -40;
    const speed = kind === 'mouse' ? 4.5 : kind === 'ufo' ? 7 : 9;
    const entry = WH.fx.spawnProp(kind, {
      fromX, toX, y, duration: speed,
      scale: kind === 'mouse' ? 0.8 : kind === 'cab' ? 1.1 : 1,
      onTap: (taps) => tapProp(kind, taps, entry)
    });
    if (entry) {
      const point = { x: U.clamp(size.width * 0.5, 40, size.width - 40), y };
      if (kind === 'mouse') WH.audio.play('squeak');
      if (kind === 'ghost') WH.audio.play('ghost');
      if (kind === 'ufo') WH.audio.play('ufo');
      if (kind === 'cat') WH.audio.play('meow');
      if (kind === 'pigeon') WH.audio.play('bubble');
      if (gag) {
        setCaption(gag.credit);
        scene().sayAt(state.homeRoom, gag.label.toUpperCase(), { life: 2.4, dy: -30 });
      }
    }
    return entry;
  }

  function tapProp(kind, taps) {
    const lines = C.PROP_TAPS[kind] || ['Nothing happens.'];
    const line = lines[Math.min(taps, lines.length) - 1];
    const point = { x: scene().size.width / 2, y: scene().size.height * 0.5 };
    WH.fx.floatText(point.x, point.y - 40, line, { color: '#f0e0b0', size: 13, life: 2.2, rise: 24 });
    setCaption(line);
    let reward = null;
    if (kind === 'cat') {
      reward = { loyalty: 2 };
      addStat('catPets');
      WH.audio.play('meow');
      if (state.stats.catPets >= 3) unlock('cat-person');
    } else if (kind === 'mouse') {
      reward = taps === 3 ? { scoops: 1 } : { research: 1 };
      WH.audio.play('squeak');
    } else if (kind === 'ufo') {
      reward = taps === 2 ? { scoops: 1 } : { research: 1 };
      WH.audio.play('ufo');
    } else if (kind === 'teapot') {
      reward = taps === 3 ? { manuscripts: 1 } : { research: 1 };
      WH.audio.play('bubble');
    } else if (kind === 'ghost') {
      reward = taps === 3 ? { research: 1 } : { manuscripts: 1 };
      WH.audio.play('ghost');
    } else if (kind === 'pigeon') {
      reward = { loyalty: taps === 4 ? 2 : 1 };
      WH.audio.play('bubble');
    } else if (kind === 'cab') {
      reward = taps === 3 ? { scoops: 1 } : { loyalty: 1 };
      WH.audio.play('door');
    }
    if (reward) {
      Object.entries(reward).forEach(([key, amount]) => addResource(key, amount));
      const label = Object.entries(reward).map(([key, amount]) => `+${amount} ${resourceLabel(key)}`).join(' · ');
      WH.fx.floatText(point.x, point.y - 18, label, { color: '#cfe6a8', size: 13, life: 1.8, rise: 30 });
    }
    if (ui()) ui().render();
  }

  const LOUD_ROOM = () => {
    const open = C.ROOM_DEFS.filter((room) => isOperational(room.id) && room.seats > 0);
    if (open.length) {
      const busiest = open
        .map((room) => ({ room, people: activePatrons(room.id).length }))
        .sort((a, b) => b.people - a.people);
      return busiest[0].people > 0 ? busiest[0].room.id : U.pick(open).id;
    }
    return state.homeRoom;
  };

  function runMoment(id) {
    const roomId = LOUD_ROOM();
    const copy = U.pick(C.GAG_COPY[id] || ['Something happens.']);
    switch (id) {
      case 'sneeze': {
        state.rooms[roomId].noiseSpike += 15;
        WH.audio.play('sneeze');
        scene().sayAt(roomId, '“AH — AH — CHOO!”', { life: 2.2, shake: true, size: 12 });
        scene().floatAt(roomId, '+15 dB', { color: '#f0a08a', dy: -20 });
        unlock('sneeze');
        addStat('sneezes', 1);
        break;
      }
      case 'glass': {
        state.rooms[roomId].noiseSpike += 12;
        WH.audio.play('smash');
        const point = scene().roomCenter(roomId);
        WH.fx.spark(point.x, point.y + 10, { count: 16, tint: 0xd8e6ef, speedMax: 130 });
        scene().sayAt(roomId, '“SORRY!”', { life: 2, shake: true, size: 12 });
        break;
      }
      case 'piano': {
        WH.audio.play('bubble');
        scene().sayAt(roomId, '♫ plink plonk ♫', { life: 2.4, size: 12 });
        addResource('loyalty', 1);
        break;
      }
      case 'chalk': {
        state.chalkIndex = (state.chalkIndex + 1 + Math.floor(Math.random() * 3)) % C.CHALK_LINES.length;
        state.chalk = C.CHALK_LINES[state.chalkIndex];
        setCaption(`The chalkboard now reads: “${state.chalk}”`);
        break;
      }
      case 'crate': {
        addResource('pints', 15);
        scene().floatAt(roomId, '+15 🍺', { color: '#f2d68f' });
        WH.audio.play('clink');
        break;
      }
      case 'busker': {
        addResource('loyalty', 3);
        state.rooms[roomId].noiseSpike += 8;
        scene().sayAt(roomId, '“♫ …and the river, the river, the river…”', { life: 2.6, size: 11 });
        break;
      }
      case 'thunder': {
        WH.audio.play('thunder');
        WH.fx.flash('#dfe8f5', 0.4, 420);
        WH.fx.shake(0.7);
        C.ROOM_DEFS.forEach((room) => { if (isOperational(room.id)) state.rooms[room.id].noiseSpike += 6; });
        break;
      }
      case 'spill': {
        state.resources.pints = Math.max(0, state.resources.pints - 2);
        scene().sayAt(roomId, '“Oh — somebody’s pint has gone over.”', { life: 2.4, size: 11 });
        break;
      }
      case 'choirPractice': {
        state.rooms[roomId].noiseSpike += 22;
        addResource('loyalty', 4);
        scene().sayAt(roomId, '♪ la la LAAAA ♪', { life: 2.6, size: 13, shake: true });
        WH.audio.play('bubble');
        break;
      }
      case 'wrongPipe': {
        state.rooms[state.homeRoom].noiseSpike += 10;
        scene().sayAt(state.homeRoom, '*knock* … *knock*', { life: 2.6, size: 11 });
        WH.audio.play('zap');
        break;
      }
      default: {
        addResource('loyalty', 1);
        scene().sayAt(roomId, '“HAHAHAHA!”', { life: 2.4, size: 12, shake: true });
        WH.audio.play('laugh');
      }
    }
    setCaption(copy);
    if (ui()) ui().render();
  }

  /* ----------------------------------------------------------- easter eggs */
  function registerEgg(id) {
    if (state.eggs.includes(id)) return false;
    state.eggs.push(id);
    addStat('eggsFound');
    scene().celebrate('egg');
    WH.audio.play('fanfare');
    if (state.eggs.length >= 3) unlock('eggs-three');
    if (state.eggs.length >= EGG_TOTAL) unlock('eggs-all');
    saveState();
    return true;
  }

  function checkWord(word) {
    const key = String(word || '').toLowerCase().trim();
    const egg = C.EGG_WORDS[key];
    if (!egg) return false;
    const found = registerEgg(egg.id);
    setCaption(egg.line);
    ui().toast(egg.title, egg.line, 6200);
    if (egg.reward) {
      Object.entries(egg.reward).forEach(([resource, amount]) => addResource(resource, amount));
      const label = Object.entries(egg.reward).map(([r, a]) => `+${a} ${resourceLabel(r)}`).join(' · ');
      WH.fx.floatText(scene().size.width / 2, scene().size.height * 0.42, label, { color: '#cfe6a8', size: 15, life: 2.2 });
    }
    if (egg.shush) {
      state.shushUntil = state.gameSeconds + egg.shush;
      WH.audio.play('zoneOn');
      scene().sayAt(state.homeRoom, '🤫', { life: 2.4, size: 18 });
    }
    if (egg.prop) spawnPropNow(egg.prop);
    if (egg.ghost) spawnPropNow('ghost');
    if (egg.opera) {
      state.storyFlags.revenge = true;
      addDiary('kendell');
      spawnPatron('kendell');
    }
    if (!found) ui().toast(egg.title, 'You have already found this one. The pub remembers.', 4200);
    if (ui()) ui().render();
    return true;
  }

  function konami() {
    const found = registerEgg('konami');
    state.fentonMode = true;
    document.body.classList.add('fenton-mode');
    WH.audio.play('fanfare');
    WH.fx.confetti(scene().size.width / 2, scene().size.height * 0.5, 70);
    ui().toast('FENTON’S PRIVATE STOCK', 'The casing opens, just a little. Inside is a label, in Fenton’s hand: “FOR EMERGENCIES. AND WEDNESDAYS.” Pint income +50%.', 9000);
    setCaption('Fenton’s private stock has been opened. The apparatus is, briefly, a little smug.');
    unlock('konami');
    if (!found) ui().toast('Fenton’s Private Stock', 'The label is already in your pocket. It has always been in your pocket.', 5000);
    if (ui()) ui().render();
    saveState();
  }

  function tapPortrait() {
    addStat('portraitTaps');
    const taps = state.stats.portraitTaps;
    if (taps < 3) {
      scene().sayAt(state.homeRoom, U.pick(['“He does not blink.”', '“Stop that.”', '“The portrait is aware of you.”']), { life: 2, size: 11 });
      return;
    }
    if (taps === 3) {
      registerEgg('portrait');
      addResource('manuscripts', 2);
      addDiary('ghost');
      ui().toast('The portrait', 'H. Fenton, Esq. has winked. It may have been the gaslight. Probably the gaslight. +2 Manuscripts.', 7600);
      setCaption('The portrait has winked. The pub will not be discussing it.');
      spawnPropNow('ghost');
    } else {
      scene().sayAt(state.homeRoom, '“Again?”', { life: 1.8, size: 11 });
    }
    WH.audio.play('click');
  }

  function tapMachine() {
    addStat('machineTaps');
    const taps = state.stats.machineTaps;
    WH.audio.play('click');
    const point = scene().machinePoint();
    WH.fx.spark(point.x, point.y, { count: 4, tint: 0xffd27a, speedMax: 60 });
    if (taps % 7 !== 0) {
      scene().sayAt(state.homeRoom, U.pick(['*click*', '*clack*', '“Moom.”', '*whirr*']), { life: 1.6, size: 12 });
      return;
    }
    const found = registerEgg('machine');
    state.energy = Math.max(0, state.energy - 5);
    ui().toast('The apparatus approves', 'Seven taps. The machine has vented 5 SE entirely on its own and has begun to hum in a major key.', 7000);
    setCaption('The apparatus has been tapped seven times. It has opinions about this.');
    if (!found) ui().toast('The apparatus', 'It remembers you. It always remembers you.', 4200);
    WH.fx.shockwave(point.x, point.y, { size: 10, to: 200, tint: 0x9fd0b0, alpha: 0.6, life: 0.7 });
    if (ui()) ui().render();
  }

  function tapJukebox() {
    const lines = [
      'The jukebox remains inexplicably silent. It has been like that since 1962.',
      'The jukebox is plugged in. The jukebox is switched on. The jukebox says nothing.',
      'Somebody has taped a note to it: “DO NOT FIX. IT IS PERFECT.”',
      'The jukebox has one record. It is a recording of this room, in 1974.'
    ];
    const line = U.pick(lines);
    scene().sayAt('general', line, { life: 3, size: 10.5, wrap: 150 });
    setCaption(line);
    WH.audio.play('click');
  }

  function throwDart(roomId) {
    addStat('dartsThrown');
    const roll = Math.random();
    const centre = scene().roomCenter(roomId);
    WH.audio.play('zap');
    WH.fx.spark(centre.x, centre.y - 20, { count: 6, tint: 0xe8d9a8, speedMax: 90 });
    if (roll < 0.22) {
      addResource('loyalty', 3);
      scene().sayAt(roomId, 'BULLSEYE! The room has stood up.', { life: 2.4, size: 12 });
      scene().floatAt(roomId, '+3 ♥', { color: '#f0a8b8' });
      WH.audio.play('coin');
    } else if (roll < 0.55) {
      addResource('scoops', 1);
      scene().sayAt(roomId, 'Treble twenty. Somebody has written it on the wall.', { life: 2.4, size: 11 });
      scene().floatAt(roomId, '+1 📰', { color: '#f2d68f' });
    } else if (roll < 0.85) {
      scene().sayAt(roomId, 'It has gone into the skirting board.', { life: 2.4, size: 11 });
    } else {
      scene().sayAt(roomId, 'You have put another hole in the landlord’s good wall.', { life: 2.8, size: 11 });
      state.reputation = Math.max(0, state.reputation - 0.5);
    }
    if (ui()) ui().render();
  }

  /* ------------------------------------------------------------- weather */
  function rollWeather() {
    const season = currentSeason();
    const table = season === 'WINTER'
      ? ['fog', 'snow', 'drizzle', 'clear', 'rain']
      : season === 'SUMMER'
        ? ['clear', 'clear', 'drizzle', 'rain', 'storm']
        : season === 'AUTUMN'
          ? ['fog', 'drizzle', 'rain', 'clear', 'storm']
          : ['drizzle', 'rain', 'clear', 'fog', 'storm'];
    const next = U.pick(table);
    if (next !== state.weather) {
      state.weather = next;
      WH.fx.setWeather(next);
      const def = weatherDef();
      scene().sayAt(state.homeRoom, def.note, { life: 3.2, size: 10, wrap: 170, dy: -26 });
      setCaption(`${def.name}: ${def.note}`);
    }
    state.nextWeatherAt = state.gameSeconds + U.rand(120, 260);
  }

  /* -------------------------------------------------------- achievements */
  function unlock(id) {
    if (state.achievements.includes(id)) return false;
    const def = C.ACHIEVEMENTS.find((entry) => entry.id === id);
    if (!def) return false;
    state.achievements.push(id);
    WH.audio.play('coin');
    scene().celebrate('achievement');
    ui().achievementToast(def);
    saveState();
    return true;
  }

  function checkAchievements() {
    const s = state;
    const openRooms = C.ROOM_DEFS.filter((room) => s.rooms[room.id].unlocked).length;
    const staffCount = Object.values(s.staff).filter(Boolean).length;
    const amenityCount = Object.values(s.amenities).filter(Boolean).length + s.soundproofedRooms.length;
    const test = {
      'first-pint': s.stats.pintsServed >= 1,
      'round-ten': s.stats.patronsServed >= 10,
      'hundred-pints': s.stats.pintsEarned >= 500,
      'three-rooms': openRooms >= 3,
      'every-room': C.ROOM_DEFS.filter((room) => !room.secret).every((room) => s.rooms[room.id].unlocked),
      'first-boom': s.explosions >= 1,
      survivor: s.weeksSurvived >= 5,
      legend: s.won,
      perfect: Boolean(s.won && s.explosions === 0),
      tier5: s.tier >= 5,
      tier6: s.tier >= 6,
      'burt-served': (s.stats.burtServed || 0) > 0,
      'ghost-served': (s.stats.ghostServed || 0) > 0,
      'cat-person': s.stats.catPets >= 3,
      'eggs-three': s.eggs.length >= 3,
      'eggs-all': s.eggs.length >= EGG_TOTAL,
      konami: Boolean(s.fentonMode),
      'gags-ten': s.stats.gags >= 10,
      opera: s.operaSurvived === true,
      powercut: s.powerCutSurvived === true,
      'hundred-db': s.stats.maxNoise >= 100,
      venter: s.stats.seVented >= 1000,
      'staff-five': staffCount >= 5,
      'amenities-five': amenityCount >= 5,
      loyal: s.reputation >= 90 && s.patrons.length >= 20,
      'silence-fifty': activeZoneCount() >= 5,
      sneeze: (s.stats.sneezes || 0) > 0,
      time: s.week >= 25
    };
    Object.entries(test).forEach(([id, passed]) => { if (passed) unlock(id); });
  }

  function addDiary(id) {
    if (id && !state.diaryPages.includes(id)) {
      state.diaryPages.push(id);
      ui().toast('A page has been added', 'Fenton’s notebook has acquired another page. It is not clear who wrote it.', 6000);
    }
  }

  /* ----------------------------------------------------------- the story */
  function storyForTier() {
    if (state.tier >= 2 && !state.storyFlags.demo) {
      state.storyFlags.demo = true;
      addDiary('demo');
      pushNews('FENTON’S DEMONSTRATION', 'FENTON DEMONSTRATES THE IMPROVED SILENCER', '“You may not hear it,” says Fenton, “but it is doing something.” The tubes flicker politely.', 'demo');
      ui().toast('Fenton’s Demonstration', 'The improved valves are in. Fenton says the faint hum is “a sign of success.”', 7200);
    }
    if (state.tier >= 3 && !state.storyFlags.tutorialExplosion) {
      state.storyFlags.tutorialExplosion = true;
      state.tutorialExplosionAt = state.gameSeconds + 4;
      addDiary('explosion');
    }
    if (state.tier >= 4 && !state.storyFlags.secret) {
      state.storyFlags.secret = true;
      addDiary('secret');
      addResource('research', 1);
      pushNews('PURVIS’S SECRET', 'PURVIS EXPLAINS THE CONSERVATION OF ENERGY', '“You can’t destroy energy, old boy. You can only move it somewhere else. Somewhere else is usually where you least want it.”', 'secret');
      ui().toast('Purvis’s Secret', 'Purvis has explained the Silencer. He has not explained the cellar.', 8000);
    }
    if (state.tier >= 5 && !state.storyFlags.perfected) {
      state.storyFlags.perfected = true;
      addDiary('ghost');
      pushNews('THE PERFECTED SILENCER', 'THE FENTON SILENCER IS PRONOUNCED PERFECT', 'Fenton’s ghost has been seen buying a round. The pub has declined to enter it on the till.', 'ghost');
      ui().toast('Perfected', 'The apparatus is perfect. The work, unfortunately, is not yet finished.', 7600);
      spawnPropNow('ghost');
    }
    if (state.resources.loyalty >= 50 && !state.storyFlags.revenge) {
      state.storyFlags.revenge = true;
      addDiary('kendell');
      pushNews('KENDELL’S REVENGE', 'AN OPERA SCORE IS FOUND IN THE CELLAR', 'Kendell has arranged a rather personal performance. The notes are sharp; the consequences may be sharper.');
      ui().toast('Kendell’s Revenge', 'A cut scene, an opera score, and a receipt for one very suspicious soprano.', 7200);
    }
  }

  function enterNewWednesday() {
    // Last orders. Anyone still holding a glass is asked, very politely, to go home.
    const stragglers = state.patrons.length;
    if (stragglers) {
      const rooms = [...new Set(state.patrons.map((patron) => patron.roomId))];
      state.patrons.forEach((patron) => scene().patronSay(patron, '“Time, gentlemen, please.”', { life: 1.6 }));
      rooms.forEach((roomId) => scene().hatsOff(roomId));
      state.patrons = [];
      state.selectedPatron = null;
      state.beerReady = false;
      ui().setCaption(stragglers === 1
        ? 'Time, gentlemen, please. The last regular takes the hint and the hat.'
        : `Time, gentlemen, please. ${stragglers} regulars pretend they did not hear you.`);
    }
    if (state.lastExplosionWeek === state.week) state.weeksSurvived = 0;
    else state.weeksSurvived += 1;
    state.stats.weeksBest = Math.max(state.stats.weeksBest || 0, state.weeksSurvived);
    state.week += 1;
    state.dayElapsed = 0;
    state.highNoiseSeconds = 0;
    state.currentEvent = '';
    if (state.week === 10 || state.week === 20) {
      unlock('time');
    }
    if (Math.random() < 0.1) startOperaNight();
    else {
      setCaption(`Wednesday ${String(state.week).padStart(2, '0')}. The chalkboard has been wiped. The energy has not.`);
      if (Math.random() < 0.42) ui().toast('Purvis’s advice', U.pick(C.PURVIS_TIPS), 7000);
    }
    setRandomSpawnTime();
    pushNews('A NEW WEDNESDAY', `WEDNESDAY ${String(state.week).padStart(2, '0')} OPENS AT THE WHITE HART`, 'The regulars return. The clock is very sure this has happened before.');
    storyForTier();
    rollWeather();
    checkWinCondition();
    if (ui()) ui().render();
  }

  /* ------------------------------------------------------------ exploding */
  function beginExplosion(tutorial = false) {
    if (state.explosionFreeze > 0 || state.gameOver || state.won) return;
    state.pendingExplosion = { tutorial };
    state.explosionFreeze = 2;
    state.venting = false;
    const crisis = ui().crisisNodes();
    if (!crisis) return;
    crisis.root.hidden = false;
    crisis.root.classList.remove('is-boom', 'is-loss', 'is-win');
    crisis.kicker.textContent = 'A MOMENT OF PERFECT SILENCE';
    crisis.title.textContent = 'Nobody said a word.';
    crisis.copy.textContent = 'Even the clock seemed to feel it had been rather loud.';
    crisis.button.hidden = true;
    crisis.button.textContent = 'CONTINUE →';
    crisis.root.setAttribute('aria-label', 'The pub is silent for two seconds');
    document.body.classList.add('critical-signal');
    WH.audio.hush();
    if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    setCaption('Nothing. Not even the apparatus. Two seconds, if nobody minds.');
    announce('The Fenton Silencer has reached critical mass. Two seconds of silence.');
    if (ui()) ui().render();
  }

  function resolveExplosion() {
    const tutorial = Boolean(state.pendingExplosion?.tutorial);
    state.pendingExplosion = null;
    state.explosionFreeze = 0;
    document.body.classList.remove('critical-signal');
    const crisis = ui().crisisNodes();
    if (!crisis) return;
    crisis.root.classList.add('is-boom');
    WH.audio.boom();
    scene().celebrate('boom');
    if (tutorial) {
      state.energy = 0;
      state.tutorialExplosionAt = 0;
      crisis.kicker.textContent = 'THE EXPLOSION · DEMONSTRATION ONLY';
      crisis.title.textContent = 'A very convincing demonstration.';
      crisis.copy.textContent = 'Fenton insists nobody was in the room. Nobody recalls there being a room.';
      crisis.button.hidden = false;
      pushNews('THE EXPLOSION', 'FENTON’S DEMONSTRATION ENDS WITH A VERY LOUD BOOM', 'Non-damaging demonstration. The physicists have written “we told you so” on a clipboard.', 'explosion');
      setCaption('The tutorial explosion has been carefully demonstrated. The paperwork has not been carefully demonstrated.');
      state.crisisDismissAt = realClock + 7;
      ui().toast('A controlled demonstration', 'No damage. No lost patrons. Fenton is very keen to call it controlled.', 6000);
      if (ui()) ui().render();
      return;
    }

    state.explosions += 1;
    addStat('explosions');
    state.weeksSurvived = 0;
    state.lastExplosionWeek = state.week;
    const home = state.homeRoom;
    const cellarProtection = home === 'cellar';
    const casing = state.seUpgrades.casing ? 0.75 : 1;
    const radius = cellarProtection ? 0.5 : 1;
    const homePatrons = activePatrons(home);
    const homeLost = homePatrons.length;
    scene().explosion(home);
    state.patrons = state.patrons.filter((patron) => patron.roomId !== home);
    state.rooms[home].damaged = true;
    state.rooms[home].zone = false;
    let repDamage = 10 * casing;
    const adj = C.ROOM_ADJACENCY[home] || [];
    adj.forEach((roomId) => {
      if (!isOperational(roomId)) return;
      const people = activePatrons(roomId);
      const lossShare = Math.min(1, 0.5 * radius * (state.seUpgrades.casing ? 0.75 : 1));
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
    C.ROOM_DEFS.forEach((room) => { state.rooms[room.id].zone = false; });
    state.homeRoom = isOperational('general') ? 'general' : (C.ROOM_DEFS.find((room) => isOperational(room.id))?.id || home);
    if (home === 'general') state.rooms.general.damaged = true;
    state.currentEvent = 'Explosion';
    state.eventUntil = state.gameSeconds + 12;
    scene().markDirty();
    pushNews('FENTON SILENCER EXPLODES', 'FENTON SILENCER EXPLODES: “WE TOLD YOU SO,” SAY PHYSICISTS.', `The ${roomDef(home).name} is destroyed. ${U.plural(homeLost, 'patron')} lost. The apparatus has reset to Tier 1.`, 'explosion');
    setCaption('The White Hart has had an incident. The White Hart is still open. The landlord has always been very clear on this point.');
    crisis.kicker.textContent = 'EXTRA! EXTRA!';
    crisis.title.textContent = 'FENTON SILENCER EXPLODES';
    crisis.copy.textContent = '“We told you so,” say physicists. The White Hart remains open, pending a small amount of rebuilding.';
    crisis.button.hidden = false;
    crisis.button.textContent = 'RETURN TO THE PUB  →';
    crisis.root.classList.add('is-boom');
    document.body.classList.add('shake-screen');
    setTimeout(() => document.body.classList.remove('shake-screen'), 1300);
    state.crisisDismissAt = realClock + 7;
    ui().toast('A newspaper extra', 'The Fenton Silencer has reset to Tier 1. The landlord has reset the table as well.', 7000);
    unlock('first-boom');
    scene().markDirty();
    if (state.explosions >= 3) gameOver('Three explosions in one session. The White Hart closed today. The silence was deafening.');
    else checkLossCondition('The White Hart lost too many patrons in the blast.');
    if (ui()) ui().render();
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
    const crisis = ui().crisisNodes();
    if (crisis) {
      crisis.root.hidden = false;
      crisis.root.classList.remove('is-boom', 'is-win');
      crisis.root.classList.add('is-loss');
      crisis.kicker.textContent = 'NOTICE OF CLOSURE';
      crisis.title.textContent = 'The White Hart closed today.';
      crisis.copy.textContent = reason && !reason.includes('deafening') ? `${reason} The silence was deafening.` : 'The silence was deafening.';
      crisis.button.hidden = false;
      crisis.button.textContent = 'START A NEW WEDNESDAY  ↻';
    }
    document.body.classList.remove('critical-signal');
    WH.audio.play('sadTrombone');
    pushNews('GAME OVER', 'THE WHITE HART CLOSED TODAY', 'The silence was deafening.');
    if (ui()) ui().render();
    saveState();
  }

  function conditionsMet() {
    return state.tier >= 5 && state.weeksSurvived >= 10 &&
      state.resources.pints >= 1000 && state.resources.scoops >= 50 && state.resources.manuscripts >= 50 &&
      state.resources.research >= 100 && state.resources.loyalty >= 100 &&
      C.ROOM_DEFS.filter((room) => !room.secret).every((room) => state.rooms[room.id].unlocked && !state.rooms[room.id].damaged);
  }

  function checkWinCondition() {
    if (state.won || state.gameOver || !conditionsMet()) return;
    state.won = true;
    state.paused = true;
    state.ending = state.explosions === 0 ? 'legendary' : 'resilient';
    const crisis = ui().crisisNodes();
    if (crisis) {
      crisis.root.hidden = false;
      crisis.root.classList.remove('is-boom', 'is-loss');
      crisis.root.classList.add('is-win');
      crisis.kicker.textContent = 'A VERY RARE FINAL EDITION';
      crisis.title.textContent = 'The White Hart is legendary.';
      crisis.copy.textContent = 'Purvis reveals the Silencer’s true potential. Fenton’s ghost buys a round. For once, nobody asks what is in it.';
      crisis.button.hidden = false;
      crisis.button.textContent = 'RETURN TO THE WHITE HART  →';
    }
    pushNews('THE WHITE HART IS LEGENDARY', 'THE PERFECTED SILENCER MAKES HISTORY', 'Purvis reveals its true potential. Fenton’s ghost buys a round. The pub remains open.');
    addDiary('ghost');
    scene().celebrate('win');
    WH.audio.play('fanfare');
    unlock('legend');
    if (state.explosions === 0) unlock('perfect');
    if (ui()) ui().render();
    saveState();
  }

  function closeCrisis() {
    state.crisisDismissAt = 0;
    const crisis = ui().crisisNodes();
    if (state.gameOver) {
      startNewGame();
      return;
    }
    if (crisis) {
      crisis.root.hidden = true;
      crisis.root.classList.remove('is-boom', 'is-loss', 'is-win');
    }
    state.crisisVisible = false;
    if (state.won) state.paused = false;
    if (ui()) ui().render();
  }

  /* ------------------------------------------------------------- shopping */
  function buyTier(tier) {
    if (tier !== state.tier + 1) {
      ui().toast('One step at a time', 'The Silencer must be improved one tier at a time. Fenton is very strict about ladders.');
      return false;
    }
    const def = C.SILENCER_TIERS[tier - 1];
    if (!canAfford(def.cost)) {
      ui().toast('More research required', `Tier ${tier} requires ${formatCost(def.cost)}.`);
      return false;
    }
    spend(def.cost);
    state.tier = tier;
    pushNews('SILENCER RESEARCH', `FENTON SILENCER: ${def.name.toUpperCase()} TIER INSTALLED`, `Capacity ${U.formatNumber(def.capacity)} SE · Absorption ${def.absorption} dB/sec · Vent ${def.vent} SE/sec.`);
    ui().toast(`Tier ${U.roman(tier)} · ${def.name}`, def.note, 7600);
    WH.audio.play('fanfare');
    storyForTier();
    checkWinCondition();
    if (ui()) ui().render();
    saveState();
    return true;
  }

  function upgradeCount(id) {
    if (id === 'dump') return state.seUpgrades.dumpUsed ? 1 : 0;
    if (id === 'casing') return state.seUpgrades.casing ? 1 : 0;
    return state.seUpgrades[id] || 0;
  }

  function buySEUpgrade(id) {
    const upgrade = C.SE_UPGRADES.find((entry) => entry.id === id);
    if (!upgrade) return false;
    if (upgradeCount(id) >= upgrade.max) {
      ui().toast('Already fitted', `${upgrade.name} has already been fitted as often as the Silencer can tolerate.`);
      return false;
    }
    if (state.energy < upgrade.cost) {
      ui().toast('Not enough Silence Energy', `${upgrade.name} costs ${upgrade.cost} SE. It is a peculiar thing to be short of silence.`);
      return false;
    }
    if (id === 'dump') {
      state.energy = Math.max(0, state.energy - upgrade.cost);
      const vented = state.energy * 0.5;
      state.energy *= 0.5;
      addStat('seVented', Math.round(vented));
      state.seUpgrades.dumpUsed = true;
      ui().toast('Emergency Dump', '200 SE spent. Half the remainder vented immediately. Once per session means once per session.');
      pushNews('EMERGENCY DUMP', 'THE SILENCER PERFORMS AN UNSCHEDULED EXHALE', 'Half the remaining Silence Energy is gone. The other half has been asked to wait.');
      WH.audio.play('zap');
      const point = scene().machinePoint();
      WH.fx.puff(point.x, point.y, { count: 22, tint: 0xa8d8bc, speedMax: 70, sizeMax: 22 });
      WH.fx.shockwave(point.x, point.y, { size: 12, to: 240, tint: 0xa8d8bc, alpha: 0.6, life: 0.8 });
    } else {
      state.energy -= upgrade.cost;
      if (id === 'casing') state.seUpgrades.casing = true;
      else state.seUpgrades[id] = (state.seUpgrades[id] || 0) + 1;
      pushNews('SILENCER UPGRADE', `${upgrade.name.toUpperCase()} FITTED`, `${upgrade.effect}. The invoice is attached to the machine with a small brass tack.`);
      ui().toast(upgrade.name, `${upgrade.effect}. The Silence Energy buffer is now ${U.formatNumber(capacity())} SE.`);
      WH.audio.play('buy');
      const point = scene().machinePoint();
      WH.fx.spark(point.x, point.y, { count: 10, tint: 0xffd27a, speedMax: 90 });
    }
    saveState();
    return true;
  }

  function buyStaff(id) {
    const def = C.STAFF_DEFS.find((staff) => staff.id === id);
    if (!def || state.staff[id]) return false;
    if (!canAfford(def.cost)) {
      ui().toast('The till is not quite there', `${def.name} costs ${formatCost(def.cost)}.`);
      return false;
    }
    spend(def.cost);
    state.staff[id] = true;
    if (id === 'barmaid') state.nextBarmaidAt = state.gameSeconds + 5;
    pushNews('NEW MEMBER OF STAFF', `${def.name.toUpperCase()} JOINS THE WHITE HART`, def.effect);
    ui().toast(`${def.name} hired`, def.effect, 7200);
    WH.audio.play('buy');
    scene().markDirty();
    if (ui()) ui().render();
    saveState();
    return true;
  }

  function buyAmenity(id, roomId = '') {
    const def = C.AMENITY_DEFS.find((amenity) => amenity.id === id);
    if (!def) return false;
    if (id === 'soundproofing') {
      if (!roomId || !isOperational(roomId)) {
        ui().toast('Choose a room', 'Soundproofing belongs in an open room. Choose a room from the menu first.');
        return false;
      }
      if (state.soundproofedRooms.includes(roomId)) {
        ui().toast('Already soundproofed', `${roomDef(roomId).name} is already soundproofed. It is taking the compliment very well.`);
        return false;
      }
    } else if (state.amenities[id]) {
      ui().toast('Already installed', `${def.name} is already part of the pub. The jukebox remains silent.`);
      return false;
    }
    if (!canAfford(def.cost)) {
      ui().toast('The landlord checks the till', `${def.name} costs ${formatCost(def.cost)}.`);
      return false;
    }
    spend(def.cost);
    if (id === 'soundproofing') state.soundproofedRooms.push(roomId);
    else state.amenities[id] = true;
    if (id === 'thamesView') state.nextScientistAt = state.gameSeconds + 30;
    pushNews('PUB AMENITY', `${def.name.toUpperCase()} ADDED TO THE PUB`, id === 'soundproofing' ? `${roomDef(roomId).name}: −20% noise. A sensible use of exactly ${def.cost.pints} Pints.` : def.effect);
    ui().toast(def.name, id === 'soundproofing' ? `${roomDef(roomId).name} has been soundproofed. Noise −20%.` : def.effect, 7200);
    WH.audio.play('buy');
    if (id === 'pubCat') setTimeout(() => spawnPropNow('cat'), 900);
    scene().markDirty();
    if (ui()) ui().render();
    saveState();
    return true;
  }

  /* ---------------------------------------------------------------- tick */
  function tick(dt) {
    realClock += dt;
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
        C.ROOM_DEFS.forEach((room) => { state.rooms[room.id].zone = Boolean(state.powerCutRestore[room.id]); });
        state.powerCutRestore = null;
      }
      state.currentEvent = '';
      state.powerCutSurvived = true;
      pushNews('POWER RESTORED', 'THE LIGHTS RETURN TO THE WHITE HART', 'The apparatus resumes its work. Nobody has asked why it needed the lights.');
      ui().toast('Power restored', 'The Fenton Silencer is back on. The hum is, if anything, more confident.', 4500);
      WH.fx.flash('#fff3d6', 0.25, 400);
    }
    if (state.rivalUntil && state.gameSeconds >= state.rivalUntil) state.rivalUntil = 0;
    if (state.eventUntil && state.gameSeconds >= state.eventUntil) {
      if (state.currentEvent === 'Opera Night') state.operaSurvived = true;
      state.eventUntil = 0;
      if (!state.powerCutUntil) state.currentEvent = '';
    }
    C.ROOM_DEFS.forEach((room) => {
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
      if (rate > 0) {
        const before = state.energy;
        state.energy = Math.max(0, state.energy - rate * dt);
        addStat('seVented', before - state.energy);
      }
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
    if (state.gameSeconds >= state.nextGagAt) {
      runGag(pickGag());
      scheduleNextGag();
    }
    if (state.gameSeconds >= state.nextWeatherAt) rollWeather();
    if (state.gameSeconds >= state.nextTipAt) {
      if (Math.random() < 0.38) ui().toast('A word from Harry Purvis', U.pick(C.PURVIS_TIPS), 6900);
      state.nextTipAt = state.gameSeconds + U.rand(48, 95);
    }
    if (state.tutorialExplosionAt && state.gameSeconds >= state.tutorialExplosionAt && !state.pendingExplosion) beginExplosion(true);

    const loudest = maxRoomNoise();
    state.stats.maxNoise = Math.max(state.stats.maxNoise || 0, loudest);
    if (loudest > 95) state.highNoiseSeconds += dt;
    else state.highNoiseSeconds = 0;
    if (state.highNoiseSeconds >= 60) {
      gameOver('The Health Inspector has shut the pub for noise above 95 dB for a full minute. The silence was deafening.');
      return;
    }
    if (state.energy >= capacity() - 0.001) {
      state.energy = capacity();
      beginExplosion(false);
      return;
    }
    if (state.dayElapsed >= NIGHT_LENGTH) enterNewWednesday();
    // Achievement checks walk the whole room list; twice a second is plenty.
    achievementClock -= dt;
    if (achievementClock <= 0) {
      achievementClock = 0.5;
      checkAchievements();
    }
    checkWinCondition();
  }

  /* ------------------------------------------------------------- controls */
  function togglePause() {
    if (state.gameOver || state.won || state.explosionFreeze > 0) return;
    state.paused = !state.paused;
    WH.audio.play('click');
    if (ui()) ui().render();
  }

  function toggleVenting() {
    tourMark('vent');
    if (ventRate() <= 0) {
      ui().toast('No vent fitted', 'Fit a Venting System or improve the Silencer before opening the outlet.');
      ui().openModal('shop', 'silencer');
      return;
    }
    if (state.energy <= 0 && !state.venting) {
      ui().toast('Nothing to vent', 'The Silence Energy gauge is empty. Enjoy the quiet while it lasts.');
      return;
    }
    state.venting = !state.venting;
    if (state.venting) {
      ui().toast('Vent open', `Bleeding off ${U.formatNumber(ventRate(), 1)} Silence Energy per second. Slowly, and with a paperwork trail.`, 4300);
      WH.audio.play('zoneOn');
    } else {
      ui().toast('Vent closed', 'The energy will stay where it is. For the moment.', 3500);
    }
    if (ui()) ui().render();
    saveState();
  }

  function setPage(delta) {
    const count = Math.ceil(C.ROOM_DEFS.length / roomPageSize);
    const next = U.clamp(state.roomPage + delta, 0, count - 1);
    if (next === state.roomPage) return;
    state.roomPage = next;
    scene().markDirty();
    if (ui()) ui().render();
  }

  /* ------------------------------------------------------------- tooltips */
  function showPatronTooltip(patron, globalPoint) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const meta = C.PATRONS[patron.type];
    const output = meta.production
      ? Object.entries(meta.production).filter(([key]) => key !== 'seconds')
        .map(([key, amount]) => `+${amount} ${resourceLabel(key)} / ${meta.production.seconds >= 60 ? `${meta.production.seconds / 60} min` : `${meta.production.seconds} sec`}`).join(' · ')
      : patron.type === 'harry' ? '+1 Research · +1 Scoop on arrival'
        : patron.type === 'john' ? '+1 Manuscript on arrival · leaves when Burt is served'
          : patron.type === 'ghost' ? 'No known production. No known pulse.'
            : patron.type === 'inspector' ? 'Serving the inspector improves your reputation'
              : 'No known production. A remarkably loud man.';
    ui().tooltipAt(`${patron.name} · ${meta.noise} dB · patience ${Math.max(0, Math.ceil(patron.patience))}s · ${output}`, globalPoint, 250, 90);
  }

  function showRoomTooltip(roomId, globalPoint) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const def = roomDef(roomId);
    const effective = roomNoise(roomId);
    const raw = sourceNoise(roomId);
    const zoneOn = zoneIsOn(roomId);
    ui().tooltipAt(`${def.name} · ${effective} dB${zoneOn ? ` (absorbing ${raw} dB)` : ''} · ${def.special}. Tap to switch the zone.`, globalPoint, 240, 70);
  }

  function showPlainTooltip(text, globalPoint) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    ui().tooltipAt(text, globalPoint, 240, 70);
  }

  function hideTooltip() { if (ui()) ui().hideTooltip(); }

  function startLongPress(patron) {
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      const point = scene().patronPoint(patron.id);
      ui().tooltipAt(`${patron.name} · ${C.PATRONS[patron.type].label} · ${C.PATRONS[patron.type].noise} dB · ${Math.max(0, Math.ceil(patron.patience))}s of patience`,
        { x: point.x, y: point.y }, 240, 80, true);
    }, 470);
  }
  function cancelLongPress() { clearTimeout(longPressTimer); }

  /* ---------------------------------------------------------------- setup */
  function startNewGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    state = freshState();
    seedStartingPatrons(state);
    state.chalk = C.CHALK_LINES[0];
    document.body.classList.remove('fenton-mode', 'critical-signal', 'shake-screen', 'is-paused', 'energy-alert');
    WH.fx.clearAll();
    WH.fx.setWeather(state.weather);
    const crisis = ui().crisisNodes();
    if (crisis) {
      crisis.root.hidden = true;
      crisis.root.classList.remove('is-boom', 'is-loss', 'is-win');
    }
    if (ui()) {
      ui().closeModal();
      ui().render();
    }
    scene().markDirty();
    setCaption('Three regulars have arrived. One of them has brought a notebook and an opinion.');
    saveState();
    // A fresh ledger begins the way the first one did: with the briefing.
    ui().showIntro(0);
  }

  function boot() {
    state = safeLoad() || freshState();
    if (!state.patrons.length && !state.gameOver && !state.won) seedStartingPatrons(state);
    if (!state.clippings?.length) state.clippings = freshState().clippings;
    ensureExtras(state);
    if (state.fentonMode) document.body.classList.add('fenton-mode');
    WH.fx.setWeather(state.weather);
    return state;
  }

  WH.game = {
    boot, startNewGame, tick, saveState, tourMark, tourReset, TOUR_STEPS,
    get state() { return state; },
    set state(value) { state = value; },
    // helpers
    roomDef, isOperational, activePatrons, seatLimit, currentSeason, isSummer, tierDef,
    capacity, absorption, ventRate, sourceNoise, roomNoise, zoneIsOn, activeZoneCount,
    maxRoomNoise, totalEnergyRate, resourceRates, canAfford, formatCost, resourceLabel,
    addResource, spend, getClockLabel, pageSize, setPageSize, hasGreenRoom, weatherName, weatherDef,
    // actions
    toggleZone, tryUnlockRoom, tryRebuildRoom, selectPatron, pourSelectedPint, servePatron,
    toggleVenting, togglePause, setPage, buyTier, buySEUpgrade, buyStaff, buyAmenity, upgradeCount,
    closeCrisis, checkWord, konami, tapPortrait, tapMachine, tapJukebox, throwDart,
    // misc
    showPatronTooltip, showRoomTooltip, showPlainTooltip, hideTooltip, startLongPress, cancelLongPress,
    unlock, checkAchievements, addDiary, setCaption, announce, pushNews,
    // the machinery, exposed for the curious and for testing
    spawnPatron, leavePatron, runEvent, runGag, pickGag, spawnPropNow, rollWeather,
    beginExplosion, resolveExplosion, checkWinCondition, checkLossCondition, gameOver, enterNewWednesday,
    startOperaNight, scheduleNextGag, updatePatrons, checkNoiseDepartures, autoServe,
    get realClock() { return realClock; },
    get eggTotal() { return EGG_TOTAL; },
    get nightLength() { return NIGHT_LENGTH; }
  };
})();
