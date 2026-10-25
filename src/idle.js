/* Absolute Superiority — The Long Forecast.
   The whole campaign, converted to twenty-four steps of clicker and idle.
   This file is the engine: it never touches the DOM, so it can be simulated headlessly.

   Every mechanic from the old turn-based game survives in a new shape:
   requisition, extraction, theory, authority, shipyards, reliability, chaos,
   prototypes, field tests, hearings, safeguards, sorties, formations, targeting,
   wonder weapons, the exponential field, the enemy analyzer, capital defence,
   unrest, doctrine, the Quiet Array, the White Hart annex, total victory — and,
   at step 24, a prestige that opens the next phase. */
(() => {
  'use strict';

  const VERSION = 4;
  const SAVE_KEY = 'absolute-superiority-idle-v4';
  const LEGACY_KEYS = ['absolute-superiority-campaign-v1', 'silence-please-white-hart-v2', 'silence-please-white-hart-v1'];
  const OFFLINE_BASE_HOURS = 8;
  const STEP_COUNT = 24;

  /* ------------------------------------------------------------- numbers */
  const clamp = (value, low, high) => (value < low ? low : value > high ? high : value);
  const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

  const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd'];
  function fmt(value) {
    const n = num(value);
    if (!Number.isFinite(n)) return '∞';
    const sign = n < 0 ? '−' : '';
    const abs = Math.abs(n);
    if (abs < 1000) {
      if (abs < 10 && abs % 1 !== 0) return sign + (Math.round(abs * 10) / 10).toFixed(1);
      return sign + Math.round(abs).toLocaleString('en-GB');
    }
    let tier = 0;
    let scaled = abs;
    while (scaled >= 1000 && tier < UNITS.length - 1) {
      scaled /= 1000;
      tier += 1;
    }
    const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    return sign + scaled.toFixed(digits) + UNITS[tier];
  }
  const fmtInt = (value) => Math.round(num(value)).toLocaleString('en-GB');
  const fmtRate = (value) => {
    const n = num(value);
    if (n === 0) return '0';
    if (Math.abs(n) < 10) return (Math.round(n * 100) / 100).toFixed(2).replace(/0$/, '');
    return fmt(n);
  };
  const pct = (value) => `${Math.round(num(value))}%`;
  const clock = (seconds) => {
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  };

  /* --------------------------------------------------------------- tables */
  const GENS = [
    { id: 'ore', name: 'Ore Extractor', icon: '⛏', base: 1, cost: 15, growth: 1.15, step: 2, note: 'Cuts the asteroid. Sells the noise.' },
    { id: 'foundry', name: 'Foundry', icon: '⚒', base: 7, cost: 190, growth: 1.16, step: 2, note: 'Bolts, plates, and a foreman with opinions.' },
    { id: 'press', name: 'Shipyard Press', icon: '▥', base: 34, cost: 3000, growth: 1.17, step: 5, note: 'Turns ore into a hull, then a hull into an argument.' },
    { id: 'magnet', name: 'Orbital Magnet', icon: '◎', base: 190, cost: 45000, growth: 1.18, step: 8, note: 'Siphons the trade lanes nobody has audited.' },
    { id: 'rig', name: 'Kepler Rig', icon: '⛭', base: 1150, cost: 620000, growth: 1.19, step: 12, note: 'Drills exactly where the Calculus said not to.' },
    { id: 'hauler', name: 'Dyson Hauler', icon: '⌁', base: 7600, cost: 1.3e7, growth: 1.2, step: 17, note: 'Moves a small star’s worth of freight per shift.' },
    { id: 'forge', name: 'Stellar Forge', icon: '✷', base: 58000, cost: 3e8, growth: 1.21, step: 21, note: 'The Foundry’s idea, taken entirely literally.' },
  ];
  const LABS = [
    { id: 'pool', name: 'Theory Pool', icon: '⚛', base: 0.6, cost: 60, growth: 1.18, step: 3, note: 'A chalkboard, a kettle, and a wager about magnets.' },
    { id: 'lab', name: 'Directorate Lab', icon: '⚗', base: 2.4, cost: 2400, growth: 1.2, step: 5, note: 'Where the future is drafted, and then blamed.' },
    { id: 'bench', name: 'Quiet Bench', icon: '⌕', base: 12, cost: 60000, growth: 1.21, step: 10, note: 'The apparatus hums; the bench takes notes.' },
    { id: 'array', name: 'Listening Array', icon: '◉', base: 70, cost: 1.2e6, growth: 1.22, step: 15, note: 'Points at the unregistered object. Does not blink.' },
    { id: 'oracle', name: 'Forecast Oracle', icon: '◈', base: 420, cost: 3e7, growth: 1.23, step: 20, note: 'Predicts the prediction. Sends an invoice either way.' },
  ];
  const CONS = [
    { id: 'consul', name: 'Consulate', icon: '⚑', base: 0.5, cost: 700, growth: 1.3, step: 4, note: 'One clerk, two stamps, unlimited patience.' },
    { id: 'whips', name: 'Whip Office', icon: '⚖', base: 1.1, cost: 40000, growth: 1.32, step: 9, note: 'Counts admirals the way other offices count spoons.' },
    { id: 'chancery', name: 'Chancery', icon: '▤', base: 4, cost: 1.5e6, growth: 1.33, step: 16, note: 'Where a favour becomes a filing, and a filing a fleet.' },
    { id: 'senate', name: 'Client Senate', icon: '⌂', base: 16, cost: 4e7, growth: 1.34, step: 21, note: 'Elected by a formula the Calculus is still reviewing.' },
  ];

  const PROJECTS = [
    {
      id: 0, name: 'Sphere of Annihilation', icon: '◎', sp: 40, ip: 350,
      desc: 'Total matter disintegration inside a controlled radius. An elegant end to numerical inferiority.',
      flaw: 'It also annihilates its own launcher.',
      bonus: '+18% fleet firepower once certified.',
    },
    {
      id: 1, name: 'Battle Analyzer', icon: '⌘', sp: 35, ip: 350,
      desc: 'Perfect targeting. Perfect coordination. Five hundred minds working as one.',
      flaw: 'The five hundred engineers require an unarmed support ship. The enemy targets it first.',
      bonus: '+25% science and slower enemy adaptation once certified.',
    },
    {
      id: 2, name: 'Exponential Field', icon: '◈', sp: 45, ip: 350,
      desc: 'A spatial envelope that renders the flagship untouchable.',
      flaw: 'Hysteresis scrambles fleet instruments after deactivation.',
      bonus: '+20% capital protection and +15% all output once certified.',
    },
  ];

  const UPGRADES = [
    { id: 'gloves', name: 'Requisition Gloves', note: '+2 IP per requisition', cost: 25, growth: 2.2, max: 8, step: 1, effect: 'click' },
    { id: 'ledger', name: 'Forecast Ledger', note: '+14 IP per requisition', cost: 900, growth: 2.9, max: 5, step: 6, effect: 'click' },
    { id: 'protocol', name: 'Requisition Protocol', note: '+120 IP per requisition', cost: 60000, growth: 3.3, max: 5, step: 13, effect: 'click' },
    { id: 'pressgang', name: 'Press-Gang', note: '+0.4 automatic requisitions / sec', cost: 400, growth: 2.6, max: 8, step: 4, effect: 'auto' },
    { id: 'tooling', name: 'Assembly Tooling', note: '+12% industrial output per level', cost: 300, growth: 2.1, max: 10, step: 3, effect: 'ip' },
    { id: 'automation', name: 'Bureau Automation', note: '+15% all output, −10% chaos drift', cost: 2500, growth: 2.4, max: 8, step: 7, effect: 'all' },
    { id: 'maintenance', name: 'Maintenance Bay', note: '+0.14 reliability / sec', cost: 1200, growth: 2.3, max: 6, step: 6, effect: 'reliability' },
    { id: 'standardize', name: 'Standardize Hulls', note: '−22% reliability decay', cost: 1500, growth: 2.2, max: 6, step: 6, effect: 'reliability' },
    { id: 'reform', name: 'Bureaucratic Reform', note: '−20% chaos drift, −5 chaos now', cost: 800, growth: 2.3, max: 8, step: 7, effect: 'chaos' },
    { id: 'drydock', name: 'Drydock Cranes', note: '+25% cruiser construction', cost: 1800, growth: 2.5, max: 6, step: 5, effect: 'ships' },
    { id: 'torpedo', name: 'Torpedo Tuning', note: '+15% fleet firepower', cost: 3000, growth: 2.4, max: 8, step: 12, effect: 'war' },
    { id: 'armour', name: 'Ablative Armour', note: '−12% ship losses', cost: 4000, growth: 2.5, max: 6, step: 13, effect: 'war' },
    { id: 'endowment', name: 'Scientific Endowment', note: '+12% scientific output', cost: 2200, growth: 2.3, max: 6, step: 9, effect: 'sp' },
    { id: 'lobbyist', name: 'Permanent Lobbyist', note: '+15% political capital', cost: 2600, growth: 2.4, max: 6, step: 10, effect: 'pc' },
    { id: 'salvage', name: 'Salvage Guild', note: '+8% IP per enemy vessel destroyed', cost: 9000, growth: 2.6, max: 5, step: 14, effect: 'war' },
    { id: 'shielding', name: 'Civil Shielding', note: '−12% capital damage from raids', cost: 12000, growth: 2.6, max: 5, step: 18, effect: 'capital' },
  ];

  const PRESTIGE_UPGRADES = [
    { id: 'memory', name: 'Deep Memory', note: '+25% all output, permanently', cost: [3, 6, 12], max: 3 },
    { id: 'hands', name: 'Remembered Hands', note: '+100% requisition power, permanently', cost: [2, 5, 10], max: 3 },
    { id: 'offline', name: 'Sleeping Forecast', note: '+25% offline efficiency and +4h cap', cost: [2, 4, 8], max: 3 },
    { id: 'headstart', name: 'Inherited Yard', note: 'Begin each phase with 3 extractors, a theory pool and 250 IP', cost: [4, 10], max: 2 },
  ];

  const PUB_STAFF = [
    { id: 'barmaid', name: 'Barmaid', cost: 90, effect: { pints: 0.25 }, note: '+25% pints. Auto-serves one patron at a time.' },
    { id: 'cellarMaster', name: 'Cellar Master', cost: 160, effect: { se: 0.25 }, note: '+25% Silence Energy. Calls the machine “she”.' },
    { id: 'physicist', name: 'Physicist', cost: 240, effect: { absorption: 0.3 }, note: '+30% absorption. Insists this is not a pub.' },
    { id: 'bouncer', name: 'Bouncer', cost: 200, effect: { noise: -0.22 }, note: '−22% noise. Burt Huggins is redirected to the pavement.' },
    { id: 'apprentice', name: 'Apprentice', cost: 260, effect: { sp: 0.2 }, note: '+20% science. He has read the manual twice.' },
    { id: 'pianist', name: 'Pianist', cost: 140, effect: { global: 0.08 }, note: '+8% all output. He knows one song. It is a long one.' },
    { id: 'catMinder', name: 'Cat Minder', cost: 70, effect: { se: 0.1 }, note: '+10% Silence Energy and a small animal on payroll.' },
    { id: 'journalistFriend', name: 'Journalist Friend', cost: 300, effect: { patrons: 0.2 }, note: '+20% patrons. The seats are imaginary.' },
    { id: 'editor', name: 'Editor', cost: 340, effect: { pints: 0.15 }, note: '+15% pints. Will not discuss the headline.' },
  ];
  const PUB_AMENITIES = [
    { id: 'betterBeer', name: 'Better Beer', cost: 150, effect: { pints: 0.6 }, note: '+60% pints. The landlord has opinions about hops.' },
    { id: 'neonSign', name: 'Neon Sign', cost: 180, effect: { patrons: 0.25 }, note: '+25% patrons. It says SILENCE PLEASE and buzzes at its own jokes.' },
    { id: 'soundproofing', name: 'Soundproofing', cost: 300, effect: { noise: -0.25 }, note: '−25% noise in every room.' },
    { id: 'cheeseBoard', name: 'Cheese Board', cost: 130, effect: { noise: -0.1 }, note: '−10% noise. Nobody argues with cheese.' },
    { id: 'jukebox', name: 'Fix the Jukebox', cost: 50, effect: { global: 0.04 }, note: '+4% all output. It remains inexplicably silent.' },
    { id: 'fireplace', name: 'Light the Fire', cost: 90, effect: { pints: 0.1 }, note: '+10% pints. The warmth is mostly enthusiasm.' },
    { id: 'pubCat', name: 'Adopt a Pub Cat', cost: 60, effect: { se: 0.1 }, note: '+10% Silence Energy and a cat. The cat does nothing else.' },
    { id: 'thamesView', name: 'Thames View', cost: 200, effect: { patrons: 0.15 }, note: '+15% patrons. The window is technically in the toilet.' },
    { id: 'dartsTeam', name: 'Darts Team', cost: 110, effect: { pints: 0.12 }, note: '+12% pints. They travel in a van.' },
    { id: 'gramophone', name: 'Gramophone', cost: 220, effect: { se: 0.15 }, note: '+15% Silence Energy. One record, played thoughtfully.' },
    { id: 'dartboard', name: 'Dartboard', cost: 75, effect: { pints: 0.08 }, note: '+8% pints. The wall has accepted its fate.' },
  ];
  const PUB_UPGRADES = [
    { id: 'filters', name: 'Better Filters', cost: 40, max: 4, capacity: 0.5, note: '+50% Silencer capacity' },
    { id: 'microphones', name: 'Extra Microphone', cost: 60, max: 3, absorption: 0.35, note: '+35% absorption' },
    { id: 'absorber', name: 'Resonance Absorber', cost: 90, max: 3, absorption: 0.25, note: '+25% absorption' },
    { id: 'venting', name: 'Venting System', cost: 80, max: 4, vent: 0.3, note: '+30% venting' },
    { id: 'resonator', name: 'Tuning Resonator', cost: 70, max: 2, vent: 0.2, note: '+20% venting' },
    { id: 'casing', name: 'Reinforced Casing', cost: 120, max: 1, casing: 0.25, note: '−25% explosion damage' },
    { id: 'dump', name: 'Emergency Dump', cost: 150, max: 1, dump: 1, note: 'One-use instant dump, once per phase' },
  ];
  const PUB_TIERS = [
    { tier: 1, name: 'Prototype', capacity: 100, absorption: 6, pints: 0, se: 0, note: 'Held together with optimism and one very good clamp.' },
    { tier: 2, name: 'Improved', capacity: 160, absorption: 10, pints: 45, se: 40, note: 'The valves are new. The humming is not.' },
    { tier: 3, name: 'Linearized', capacity: 260, absorption: 16, pints: 110, se: 90, note: 'Fenton says “linear” until everybody stops asking.' },
    { tier: 4, name: 'Purvis Modified', capacity: 420, absorption: 24, pints: 220, se: 170, note: 'One note from Purvis, one afternoon from Fenton.' },
    { tier: 5, name: 'Perfected', capacity: 700, absorption: 36, pints: 420, se: 280, note: 'Perfect, in that it now does exactly what it was built to do.' },
    { tier: 6, name: 'Kendell-Proof', capacity: 1200, absorption: 55, pints: 800, se: 460, note: 'Built after the opera. The opera has not been told.' },
  ];
  const WEATHERS = [
    { id: 'clear', name: 'CLEAR', note: 'A clear night over Fleet Street. The river is behaving.', pints: 1, noise: 1, se: 1 },
    { id: 'drizzle', name: 'DRIZZLE', note: 'Drizzle. London’s default setting.', pints: 1, noise: 1, se: 0.95 },
    { id: 'rain', name: 'RAIN', note: 'Rain. The windows have begun to compose letters.', pints: 0.9, noise: 1.05, se: 0.95 },
    { id: 'fog', name: 'FOG', note: 'Fog. The pub has acquired a soft outline.', pints: 0.95, noise: 0.9, se: 1.05 },
    { id: 'snow', name: 'SNOW', note: 'Snow on the terrace. The roof room is optimistic.', pints: 1.1, noise: 0.95, se: 1 },
    { id: 'storm', name: 'STORM', note: 'A storm. The apparatus enjoys thunder enormously.', pints: 0.85, noise: 1.25, se: 1.1 },
  ];

  /* Hidden words: the White Hart still answers to the old names. Typed once each phase. */
  const EGGS = [
    { word: 'purvis', title: 'Harry Purvis', line: '“You can’t destroy energy, old boy. You can only move it somewhere else.”', apply: (s) => { const ip = Math.max(60, derive(s).ipPerSec * 45); s.ip += ip; s.totals.ip += ip; return `+${fmt(ip)} IP`; } },
    { word: 'fenton', title: 'Something in the cellar', line: 'A valve turns by itself. Somewhere below you, a man clears his throat.', apply: (s) => { s.se += 35; s.totals.se += 35; s.pub.noise = Math.min(100, s.pub.noise + 4); return '+35 SE'; } },
    { word: 'silence', title: 'A hush', line: 'Everybody shushes at once. For ten seconds the terminal is a photograph.', apply: (s) => { s.pub.noise = Math.max(0, s.pub.noise - 12); return 'noise −12'; } },
    { word: 'hush', title: 'A hush', line: 'The regulars shush, then look around to see who started it.', apply: (s) => { s.pub.noise = Math.max(0, s.pub.noise - 8); return 'noise −8'; } },
    { word: 'tea', title: 'A pot of tea', line: 'A pot arrives. It is, technically, a vessel in orbit.', apply: (s) => { s.pc += 4; return '+4 PC'; } },
    { word: 'pint', title: 'One for the road', line: 'Somebody puts a pint in front of you. Nobody will admit to it.', apply: (s) => { s.pints += 30; s.totals.pints = num(s.totals.pints, 0) + 30; return '+30 pints'; } },
    { word: '42', title: 'The answer', line: 'The answer is 42. The question, apparently, was about the cellar.', apply: (s) => { s.sp += 42; s.totals.sp += 42; return '+42 SP'; } },
    { word: 'kendell', title: 'Kendell is cross', line: 'Kendell is cross. Somewhere, a soprano clears her throat.', apply: (s) => { s.pub.noise = Math.min(100, s.pub.noise + 10); s.pints += 12; return '+12 pints, and the alto section' } },
    { word: 'wibble', title: 'Wibble', line: 'The landlord refuses to explain. “Wibble,” he says, “is a technical term.”', apply: (s) => { s.pints += 8; return '+8 pints' } },
    { word: 'cheese', title: 'The cheese board', line: 'A wedge of cheese appears. Noise drops by sheer authority.', apply: (s) => { s.pub.noise = Math.max(0, s.pub.noise - 9); s.fleet.unrest = Math.max(0, s.fleet.unrest - 4); return 'noise −9, unrest −4' } },
    { word: 'cat', title: 'The cat', line: 'The cat arrives from an unspecified department.', apply: (s) => { s.se += 18; s.totals.se += 18; return '+18 SE' } },
    { word: 'wednesday', title: 'It is Wednesday', line: 'It is always Wednesday here. The clock has made peace with this.', apply: (s) => { s.pc += 6; return '+6 PC' } },
    { word: 'moom', title: 'Moom', line: '“Moom,” says the apparatus, thoughtfully.', apply: (s) => { s.sp += 2; s.se += 4; return '+2 SP, +4 SE' } },
  ];

  const MOMENTS = [
    {
      id: 'windfall', title: 'A requisition convoy has arrived', cta: 'Sign for it',
      copy: 'Eight crates of forms, and behind them, actual industrial plant. The Calculus classifies this as a clerical error.',
      effect: (s, d) => { const ip = Math.max(120, d.ipPerSec * 60); s.ip += ip; return `+${fmt(ip)} IP signed for.`; },
    },
    {
      id: 'boom', title: 'The Calculus predicts a good quarter', cta: 'Authorise the forecast',
      copy: 'A favourable projection has been filed. In this office, a favourable projection is as good as a machine.',
      effect: (s) => { s.event.mult = 2; s.event.multUntil = s.runSeconds + 45; return 'All output doubled for 45 seconds.'; },
    },
    {
      id: 'raid', title: 'A raid slips past the picket', cta: 'Repel them',
      copy: 'Three hostile hulls are inside the corridor, firing at the paperwork first.',
      effect: (s) => {
        const killed = Math.min(Math.max(1, Math.floor(s.fleet.enemy)), 3);
          s.fleet.enemy = Math.max(0, s.fleet.enemy - killed);
        s.totals.kills += killed;
        s.fleet.unrest = clamp(s.fleet.unrest - 1, 0, 100);
        return `${killed} hostile hull${killed === 1 ? '' : 's'} destroyed. The admirals are briefly pleased.`;
      },
      penalty: (s) => {
        s.fleet.capital = Math.max(0, s.fleet.capital - 6);
        return 'The raid got through: capital integrity −6%.';
      },
    },
    {
      id: 'choir', title: 'A choir has arrived at The White Hart', cta: 'Serve them quietly',
      copy: 'The Kendell Memorial Choir is in the saloon and has already found the low notes.',
      effect: (s) => {
        const se = 45;
        s.se += se; s.totals.se += se;
        s.pub.noise = Math.max(0, s.pub.noise + 20);
        return `+${se} SE. The apparatus absorbs the alto section with enthusiasm.`;
      },
    },
    {
      id: 'audit', title: 'An inspector is measuring the humming', cta: 'Show him the cellar',
      copy: 'He has a clipboard, a decibel meter, and an expression that has never been surprised by a cellar.',
      effect: (s) => {
        s.pc += 3;
        s.fleet.chaos = clamp(s.fleet.chaos - 5, 0, 100);
        return '+3 PC, −5 chaos. He writes “within tolerance” and leaves quickly.';
      },
    },
    {
      id: 'widows', title: 'The admirals are asking about the widows', cta: 'Fund the pensions',
      copy: 'A delegation has arrived with a list. The list is longer than the last one.',
      effect: (s) => {
        s.fleet.unrest = clamp(s.fleet.unrest - 9, 0, 100);
        s.pc = Math.max(0, s.pc - 2);
        return '−9 unrest, −2 PC. Nobody thanks you, but the list is shorter.';
      },
    },
  ];

  const ACHIEVEMENTS = [
    { id: 'first-click', name: 'One Working Key', note: 'Requisition for the first time.', test: (s) => s.totals.clicks >= 1 },
    { id: 'hundred-clicks', name: 'The Clerk’s Revenge', note: 'Requisition one hundred times.', test: (s) => s.totals.clicks >= 100 },
    { id: 'first-gen', name: 'Let the Machine Press It', note: 'Buy your first extractor.', test: (s) => (s.gens.ore || 0) >= 1 },
    { id: 'thousand-ip', name: 'A Rounding Error', note: 'Earn 1,000 IP in one phase.', test: (s) => s.totals.ip >= 1000 },
    { id: 'million-ip', name: 'The Calculus Notices', note: 'Earn one million IP in one phase.', test: (s) => s.totals.ip >= 1e6 },
    { id: 'ten-ships', name: 'Standard, And Therefore Winning', note: 'Have ten cruisers at once.', test: (s) => s.fleet.ships >= 10 },
    { id: 'word-cellar', name: 'A Word in the Cellar', note: 'Say something the White Hart recognises.', test: (s) => Object.keys(s.seen).some((key) => key.startsWith('egg:')) },
    { id: 'first-blood', name: 'An Exchange Of Views', note: 'Destroy your first enemy vessel.', test: (s) => s.totals.kills >= 1 },
    { id: 'certified', name: 'The Second Directive', note: 'Certify all three prototypes.', test: (s) => s.research.every((r) => r.state === 3) },
    { id: 'answered', name: 'A Greeting In The Dark', note: 'Answer the Quiet Array.', test: (s) => Boolean(s.signal.choice) },
    { id: 'landlord', name: 'The Landlord Approves', note: 'Open five rooms at The White Hart.', test: (s) => Object.keys(s.pub.rooms).length >= 5 },
    { id: 'phase-two', name: 'The Second Forecast', note: 'Prestige once.', test: (s) => s.prestiges >= 1 },
  ];

  /* ---------------------------------------------------------------- steps */
  const STEP_DEFS = [
    {
      n: 1, key: 'requisition', kicker: 'THE CLICK', title: 'Requisition',
      copy: 'The Calculus has given you twelve cycles and a terminal with one working key. Press it. Industrial points are the only language the frontier respects.',
      unlock: 'Click REQUISITION to bank industrial points.',
      tip: 'Space also requisitions. A run of clicks builds a small combo.',
      goal: (s) => ({ label: 'manual requisitions', value: s.totals.clicks, target: 20, extra: '' }),
    },
    {
      n: 2, key: 'extraction', kicker: 'THE IDLE', title: 'Extraction',
      copy: 'A clerk watches you press the key for the ninth time and suggests, delicately, a machine that presses it for you. He has already requisitioned one.',
      unlock: 'Buy extractors and foundries. They produce IP every second, even while you do nothing.',
      tip: 'AUTOPILOT buys the cheapest useful thing for you. Switch it off in Policies for a tighter economy.',
      goal: (s, d) => ({ label: 'ore extractors', value: s.gens.ore || 0, target: 4, extra: `${fmtRate(d.ipPerSec)} IP / sec` }),
    },
    {
      n: 3, key: 'theory', kicker: 'THE SECOND CURRENCY', title: 'Theory',
      copy: 'Norden sends a theory pool, a chalkboard and an invoice. Scientific points are what a prototype costs before it becomes a catastrophe.',
      unlock: 'Study manually, and build theory pools and Directorate labs for science every second.',
      tip: 'Science is spent on research, tests and listening passes. It is never wasted on a battleship.',
      goal: (s) => ({ label: 'scientific points banked', value: s.sp, target: 60, extra: '' }),
    },
    {
      n: 4, key: 'authority', kicker: 'THE THIRD CURRENCY', title: 'Authority',
      copy: 'The admirals require being lobbied, the Directorate requires being overruled, and both require a form. Political capital is the form.',
      unlock: 'Lobby the admirals by hand and build consulates for political capital over time.',
      tip: 'PC pays for hearings, safeguards and field doctrine. An empty treasury is how commanders become memos.',
      goal: (s) => ({ label: 'political capital', value: s.pc, target: 15, extra: '' }),
    },
    {
      n: 5, key: 'yards', kicker: 'THE FLEET', title: 'The Yards',
      copy: 'Vega’s shipyards produce identical hulls with interchangeable bolts. It is the least interesting way to win, and the forecast office has checked the alternatives.',
      unlock: 'Build cruiser lines. They turn industrial points into Standard Cruisers, automatically.',
      tip: 'More lines means more ships. Ships are the only thing the enemy respects in a corridor.',
      goal: (s) => ({ label: 'operational cruisers', value: s.fleet.ships, target: 8, extra: '' }),
    },
    {
      n: 6, key: 'reliability', kicker: 'MAINTENANCE', title: 'Reliability',
      copy: 'A hull works until the bolts learn ambition. Reliability falls as the fleet grows; maintenance bays and standardised parts push it back up.',
      unlock: 'Buy Maintenance Bays and Standardize Hulls. Watch reliability, because the enemy does.',
      tip: 'Below 50% reliability your sorties go badly. Keep it above 80% and the Calculus stops writing footnotes.',
      goal: (s) => ({ label: 'fleet reliability with 8+ cruisers', value: s.fleet.reliability, target: 85, extra: s.fleet.ships >= 8 ? '' : 'needs 8 cruisers' }),
    },
    {
      n: 7, key: 'drift', kicker: 'SPECIFICATION DRIFT', title: 'Chaos',
      copy: 'Every machine you add writes a small amendment to its own specification. Enough amendments and the fleet is no longer one fleet.',
      unlock: 'Chaos is produced by industry. Reforms and automation push it down; the Autopilot will buy reforms for you.',
      tip: 'Chaos reduces all output. Keep it under 15% and it costs you almost nothing.',
      goal: (s) => ({ label: 'bureaucratic chaos', value: s.fleet.chaos, target: 15, extra: '' }),
    },
    {
      n: 8, key: 'prototypes', kicker: 'THE DIRECTIVE PROBLEM', title: 'Prototypes',
      copy: 'Three specifications arrive from the Directorate. Each is brilliant. Each leaves something out on purpose, and the something is usually the crew.',
      unlock: 'Authorise the Sphere of Annihilation, the Battle Analyzer and the Exponential Field. Each takes time to draft.',
      tip: 'Certified prototypes grant permanent bonuses. Uncertified ones file reports.',
      goal: (s) => ({ label: 'projects authorised', value: s.research.filter((r) => r.state >= 1).length, target: 3, extra: '' }),
    },
    {
      n: 9, key: 'tests', kicker: 'THE FIELD TESTS', title: 'Field Tests',
      copy: 'Two tests per specification. The first shows what it does. The second shows what it does to the people nearby.',
      unlock: 'Authorised prototypes now test themselves. Tests cost science; failures file a scientific hearing.',
      tip: 'Click RUN TEST to hurry a test along. Failures are not a setback — they are the mechanic.',
      goal: (s) => ({ label: 'successful field tests', value: s.totals.tests, target: 6, extra: `${s.hearings.length} report${s.hearings.length === 1 ? '' : 's'} open` }),
    },
    {
      n: 10, key: 'hearings', kicker: 'THE SCIENTIFIC COUNCIL', title: 'Hearings',
      copy: 'A failure report is a request for a decision. Demand revisions, and the prototype is grounded. Endorse the excuse, and the admirals hear about it.',
      unlock: 'Hearings can be ruled on by hand, or left to the remembered policy: revisions by default.',
      tip: 'Revisions cost IP and PC but calm the admirals. Endorsements pay IP and raise unrest.',
      goal: (s) => ({ label: 'hearings resolved', value: s.totals.hearings, target: 3, extra: `${s.hearings.length} pending` }),
    },
    {
      n: 11, key: 'safeguards', kicker: 'ENGINEERING', title: 'Safeguards',
      copy: 'A safeguard is the sentence in the specification that mentions the crew. It costs money, it slows the project, and it is the only line the Directorate has ever been persuaded to keep.',
      unlock: 'Certify each tested prototype. Certification removes its failure risk and grants its bonus.',
      tip: 'Certification needs no open hearings. The Autopilot will certify as soon as the record is clean.',
      goal: (s) => ({ label: 'prototypes certified', value: s.research.filter((r) => r.state === 3).length, target: 3, extra: '' }),
    },
    {
      n: 12, key: 'engagements', kicker: 'THE CORRIDOR', title: 'Engagements',
      copy: 'The enemy is in the corridor, and the corridor is where the capital’s damage comes from. Sorties now run themselves: formations, torpedoes, the arithmetic of exchange.',
      unlock: 'Automatic sorties every six seconds. Build cruisers faster than the enemy destroys them.',
      tip: 'Watch losses, not kills. A sortie that destroys three hulls and loses four is a bad sortie.',
      goal: (s) => ({ label: 'enemy vessels destroyed', value: s.totals.kills, target: 10, extra: `${Math.max(0, Math.floor(s.fleet.enemy))} remain` }),
    },
    {
      n: 13, key: 'formations', kicker: 'ORDERS', title: 'Formations',
      copy: 'Line ahead balances fire and protection. An escort screen protects the vulnerable. Breakthrough trades the fleet for the enemy’s command deck.',
      unlock: 'Choose a formation. The Autopilot changes formation as the capital gets thin.',
      tip: 'Escort halves capital damage. Breakthrough kills faster and loses more hulls.',
      goal: (s) => ({ label: 'sorties won', value: s.totals.sorties, target: 5, extra: 'a sortie is won when it destroys a hull' }),
    },
    {
      n: 14, key: 'targeting', kicker: 'PRIORITIES', title: 'Targeting',
      copy: 'The enemy’s command vessels are louder than their guns. Fire at them and their formations arrive late, and their apologies arrive early.',
      unlock: 'Choose a targeting priority: screen, support or command. Command fire disrupts enemy coordination.',
      tip: 'Support fire is the only way to kill an analyzer. Command fire halves the damage raids do.',
      goal: (s) => ({ label: 'command vessels disrupted', value: s.totals.disrupts, target: 5, extra: '' }),
    },
    {
      n: 15, key: 'wonder', kicker: 'WONDER WEAPONS', title: 'Wonder Weapons',
      copy: 'Torpedoes fire themselves. The wonder weapon does not: it waits for a decision, which is why the Directorate prefers it.',
      unlock: 'A volley charges over twenty seconds. Fire it by hand for a burst, or let the Autopilot fire it when it is full.',
      tip: 'A volley scales with fleet size. Save it for a moment when the enemy is numerous.',
      goal: (s) => ({ label: 'volleys fired', value: s.totals.volleys, target: 4, extra: '' }),
    },
    {
      n: 16, key: 'field', kicker: 'THE THIRD DIRECTIVE', title: 'The Exponential Field',
      copy: 'The field protects the flagship, and the flagship protects the corridor. It also refuses to switch off quietly: hysteresis is self-preservation, and self-preservation is the third directive.',
      unlock: 'Engage the field to block raids. It builds hysteresis; at 100% it blacks out the command link. Switching it off by hand does the same.',
      tip: 'Field on costs nothing per raid — until heat hits 100, when everything goes dark for six seconds.',
      goal: (s) => ({ label: 'raids blocked by the field', value: s.totals.blocks, target: 4, extra: '' }),
    },
    {
      n: 17, key: 'analyzer', kicker: 'IT LEARNS', title: 'The Analyzer',
      copy: 'The enemy has built a machine that predicts your formations. Its support ship is unarmed, enormous, and surrounded by five hundred engineers taking notes.',
      unlock: 'Enemy adaptation now grows over time. An analyzer appears every so often; target support to destroy it.',
      tip: 'The Analyzer’s death resets part of the enemy adaptation. Its life makes every raid hurt more.',
      goal: (s) => ({ label: 'battle analyzers destroyed', value: s.totals.analyzers, target: 2, extra: s.fleet.analyzer ? 'one is in the corridor' : 'none present' }),
    },
    {
      n: 18, key: 'capital', kicker: 'THE CAPITAL', title: 'Capital Defence',
      copy: 'Capital integrity is the number the Calculus prints first. Repairs are cheap and unglamorous; the enemy is neither.',
      unlock: 'Raids damage the capital. Repairs are automatic, and you may cede one outpost with a poisoned prototype.',
      tip: 'Ceding an outpost destroys eight enemy hulls and raises unrest by fifteen. It is a legitimate strategy with an illegitimate smell.',
      goal: (s) => ({ label: 'capital integrity with 12 sorties flown', value: s.fleet.capital, target: 85, extra: `${s.totals.sortieCount || 0} sorties flown` }),
    },
    {
      n: 19, key: 'unrest', kicker: 'THE ADMIRALS', title: 'Unrest',
      copy: 'Endorsing a scientist’s excuse is cheap until it reaches the admirals. At a hundred percent they relieve you of duty, which is a polite word for the airlock.',
      unlock: 'Fund revisions to calm unrest, or win sorties. A mutiny halves all output until it is paid off.',
      tip: 'Unrest rises with losses, endorsements and ceded bases. It falls with victories and revisions.',
      goal: (s) => ({ label: 'military unrest', value: s.fleet.unrest, target: 15, extra: s.fleet.mutiny ? 'MUTINY IN PROGRESS' : '' }),
    },
    {
      n: 20, key: 'doctrine', kicker: 'DOCTRINE', title: 'Doctrine',
      copy: 'Norden believes a brilliant machine excuses its own accidents. Voss believes a machine that works is brilliant enough. The Directorate cannot hold both, and neither can you.',
      unlock: 'Declare a doctrine. Mastery grows while it holds; each doctrine permanently reshapes the run.',
      tip: 'Norden: more science, less reliability. Voss: less science, more reliability and output. You may switch, at a price.',
      goal: (s) => ({ label: 'doctrine mastery', value: s.fleet.mastery, target: 3, extra: s.fleet.doctrine ? s.fleet.doctrine === 'norden' ? 'Norden' : 'Voss' : 'no doctrine declared' }),
    },
    {
      n: 21, key: 'array', kicker: 'THE LONG QUESTION', title: 'The Quiet Array',
      copy: 'Past the mapped lanes something repeats a question every 101 seconds. It has outlived its makers, and it is waiting on whoever answers next.',
      unlock: 'Listening passes decode three fragments. Then answer the array — and choose what kind of answer it receives.',
      tip: 'Replying opens the first-contact ending and boosts science. Holding silence hides the capital and steadies the fleet.',
      goal: (s) => ({ label: 'fragments decoded, then answer', value: s.signal.fragments, target: 3, extra: s.signal.choice ? 'answered' : '' }),
    },
    {
      n: 22, key: 'white-hart', kicker: 'THE ANNEX', title: 'The White Hart',
      copy: 'The Research Directorate’s local stands beside the shipyards. Its landlord has been running a prototype check in the cellar since before the war, and has never once filed the paperwork.',
      unlock: 'The pub is now an idle department: rooms, patrons, pints, noise, Silence Energy, staff, amenities and prototype checks.',
      tip: 'The Silencer converts noise into Silence Energy. The pub’s dividend feeds every other machine you own.',
      goal: (s) => ({ label: 'pub checks filed', value: s.totals.checks, target: 3, extra: `${Object.keys(s.pub.rooms).length}/5 rooms · ${fmt(s.totals.se)} SE gathered` }),
    },
    {
      n: 23, key: 'victory', kicker: 'TOTAL VICTORY', title: 'The Armada',
      copy: 'The Forecast Office has stopped revising its estimate. The enemy has assembled everything it has left in one corridor, which is either a mistake or a compliment.',
      unlock: 'Total mobilisation: all output doubled. Destroy the armada. It will not be replaced.',
      tip: 'Buy cruiser lines, keep reliability high, fire volleys, keep the field up. The armada does not regenerate.',
      goal: (s) => ({ label: 'armada vessels remaining', value: Math.max(0, s.fleet.enemy), target: 0, extra: `${s.totals.kills} destroyed this phase` }),
    },
    {
      n: 24, key: 'prestige', kicker: 'THE RECKONING', title: 'Recalculate The Calculus',
      copy: 'The corridor is won. The Calculus recalculates, and finds the same frontier, the same files, and a commander who remembers more than the model does. Take what you have learned and begin the next phase.',
      unlock: 'PRESTIGE is the only order here. Recalculate to begin the next phase with permanent Forecast.',
      tip: 'Forecast held gives +5% output each. Spend it on permanent upgrades, or keep it in reserve.',
      goal: () => ({ label: 'the reckoning', value: 1, target: 1, extra: 'recalculate the Calculus to open the next phase' }),
    },
  ];

  /* ---------------------------------------------------------------- state */
  function emptyResearch() {
    return PROJECTS.map((project, index) => ({ id: index, state: 0, progress: 0, tests: 0, fails: 0, timer: 0, testTimer: 0, testing: false, filed: false }));
  }

  function newGame(prev = null) {
    const phase = prev ? num(prev.phase, 1) + 1 : 1;
    const forecast = prev ? num(prev.forecast, 0) : 0;
    const forecastUp = prev ? { ...(prev.forecastUp || {}) } : {};
    const state = {
      version: VERSION,
      phase,
      step: 1,
      startedAt: Date.now(),
      lastSeen: Date.now(),
      runSeconds: 0,
      playSeconds: 0,
      prestiges: prev ? num(prev.prestiges, 0) + 1 : 0,
      forecast,
      forecastLifetime: prev ? num(prev.forecastLifetime, 0) : 0,
      forecastUp,
      ip: 0,
      sp: 0,
      pc: 0,
      se: 0,
      pints: 0,
      gens: { ore: 0, foundry: 0, press: 0, magnet: 0, rig: 0, hauler: 0, forge: 0 },
      labs: { pool: 0, lab: 0, bench: 0, array: 0, oracle: 0 },
      cons: { consul: 0, whips: 0, chancery: 0, senate: 0 },
      lines: 0,
      up: {},
      totals: {
        ip: 0, sp: 0, pc: 0, se: 0, clicks: 0, shipsBuilt: 0, kills: 0, sorties: 0,
        sortieCount: 0, tests: 0, hearings: 0, volleys: 0, blocks: 0, analyzers: 0,
        checks: 0, disrupts: 0, raids: 0, explosions: 0,
      },
      fleet: {
        ships: 0, reliability: 92, chaos: 20, capital: 100, unrest: 5,
        enemy: 0, adapt: 0, analyzer: 0, analyzerHp: 0, analyzerTimer: 0,
        field: false, heat: 0, blackout: 0, volley: 0, doctrine: '', mastery: 0,
        doctrineTimer: 0, doctrineSwitch: 0, crisis: false, mutiny: false,
        sortieTimer: 0, repairTimer: 0, adaptTimer: 0, reformTimer: 0,
        overhaulTimer: 0, reinforceTimer: 0, revisionTimer: 0, fieldAuto: true,
        ceded: false, formation: 'line', target: 'screen', focus: 'corridor',
      },
      research: emptyResearch(),
      hearings: [],
      heardTimer: 0,
      signal: { fragments: 0, timer: 0, choice: '', answerTimer: 0, reply: false, silence: false },
      pub: {
        rooms: { general: true }, noise: 0, tier: 1, upgrades: {}, staff: {}, amenities: {},
        checks: 0, checkTimer: 0, checking: false, weather: 'clear', weatherTimer: 150,
        reputation: 100, explosions: 0, dumpUsed: false, se: 0,
      },
      policies: {
        autopilot: true, autoResearch: true, autoHearing: 'revise', autoField: true,
        autoFire: true, autoSignal: false, autoDoctrine: true, autoVent: true,
        autoCheck: true, autoRepair: true,
      },
      click: { streak: 0, lastAt: -10, combo: 1 },
      event: { id: '', until: 0, mult: 1, multUntil: -1 },
      autoTimer: 0,
      log: [],
      news: [],
      achievements: [],
      seen: {},
      stepsSeen: [1],
      mobilised: false,
      offlineReport: null,
      stats: null,
    };
    const startLevel = num(forecastUp.headstart, 0);
    if (startLevel > 0) {
      state.ip = 250 * startLevel;
      state.gens.ore = 3 * startLevel;
      state.labs.pool = startLevel;
      state.news.push({ kind: 'good', text: `Inherited Yard: the phase opens with ${state.gens.ore} extractors and ${state.labs.pool} theory pool.` });
    }
    pushLog(state, phase > 1
      ? `Phase ${phase} opens. The Calculus has been recalculated; the frontier has not noticed yet.`
      : 'The Long Forecast begins. One working key, twenty-four steps, and a corridor to hold.');
    return state;
  }

  function pushLog(s, text) {
    s.log.unshift({ t: s.runSeconds, text });
    if (s.log.length > 80) s.log.length = 80;
  }
  function say(s, text, kind = 'info') {
    pushLog(s, text);
    s.news.push({ kind, text });
    if (s.news.length > 12) s.news.splice(0, s.news.length - 12);
  }

  /* -------------------------------------------------------------- derived */
  function pubCounts(s) {
    const staff = Object.keys(s.pub.staff).length;
    const amenities = Object.keys(s.pub.amenities).length;
    const upgrades = Object.values(s.pub.upgrades || {}).reduce((a, b) => a + num(b), 0);
    return { staff, amenities, upgrades };
  }

  function seUpgradeLevel(s, id) {
    return num((s.pub.upgrades || {})[id], 0);
  }

  function pubEffect(s, key) {
    let value = 0;
    PUB_STAFF.forEach((item) => {
      if (s.pub.staff[item.id] && item.effect[key]) value += item.effect[key];
    });
    PUB_AMENITIES.forEach((item) => {
      if (s.pub.amenities[item.id] && item.effect[key]) value += item.effect[key];
    });
    return value;
  }

  function pubDividend(s) {
    const counts = pubCounts(s);
    return 1 + 0.03 * counts.upgrades + 0.04 * counts.staff + 0.03 * counts.amenities + 0.03 * (s.pub.tier - 1);
  }

  function doctrineBonus(s) {
    if (s.fleet.doctrine === 'norden') return 1.15;
    if (s.fleet.doctrine === 'voss') return 1.25;
    return 1;
  }

  function eventMultiplier(s) {
    return s.runSeconds < s.event.multUntil ? num(s.event.mult, 1) : 1;
  }

  function globalMult(s) {
    const forecast = 1 + 0.05 * num(s.forecast) + 0.25 * num(s.forecastUp.memory, 0);
    const phase = 1 + 0.12 * (num(s.phase, 1) - 1);
    const drift = 1 - Math.min(0.4, num(s.fleet.chaos) / 250);
    const crisis = s.fleet.crisis ? 0.35 : 1;
    const mutiny = s.fleet.mutiny ? 0.5 : 1;
    const blackout = s.fleet.blackout > 0 ? 0.5 : 1;
    const mobilised = s.mobilised ? 2 : 1;
    const fieldCert = s.research[2] && s.research[2].state === 3 ? 1.15 : 1;
    return forecast * phase * pubDividend(s) * doctrineBonus(s) * drift * crisis * mutiny * blackout * mobilised * fieldCert * eventMultiplier(s);
  }

  function bulkCost(def, owned, count) {
    const growth = def.growth;
    const base = def.cost * Math.pow(growth, owned);
    if (growth === 1) return Math.ceil(base * count);
    return Math.ceil((base * (Math.pow(growth, count) - 1)) / (growth - 1));
  }

  function maxAffordable(def, owned, money) {
    if (money < def.cost * Math.pow(def.growth, owned)) return 0;
    const growth = def.growth;
    const base = def.cost * Math.pow(growth, owned);
    if (growth === 1) return Math.floor(money / base);
    const raw = Math.floor(Math.log(1 + (money * (growth - 1)) / base) / Math.log(growth));
    return Math.max(0, Math.min(raw, 5000));
  }

  function upgradeCost(def, level) {
    return Math.ceil(def.cost * Math.pow(def.growth, level));
  }

  function upgradeBy(id) {
    return UPGRADES.find((u) => u.id === id);
  }

  function upgradeLevel(s, id) {
    return num(s.up[id], 0);
  }

  function derive(s) {
    const u = s.up || {};
    const lvl = (id) => num(u[id], 0);
    const mult = globalMult(s);
    const pubStaff = pubCounts(s);
    const allBoost = 1 + 0.15 * lvl('automation');
    const ipBoost = (1 + 0.12 * lvl('tooling')) * allBoost;
    const spBoost = (1 + 0.12 * lvl('endowment')) * allBoost * (s.research[1].state === 3 ? 1.25 : 1) * (s.fleet.doctrine === 'norden' ? 1.35 : 1) * (s.fleet.focus === 'vesper' ? 1.25 : 1);
    const pcBoost = (1 + 0.15 * lvl('lobbyist')) * allBoost;
    const clickBase = 1 + 2 * lvl('gloves') + 14 * lvl('ledger') + 120 * lvl('protocol');
    const clickPower = clickBase * (1 + 0.5 * num(s.click.combo, 1)) * (1 + num(s.forecastUp.hands, 0) * 1) * mult;
    const autoClicks = 0.4 * lvl('pressgang');

    let ipPerSec = 0;
    GENS.forEach((gen) => { ipPerSec += num(s.gens[gen.id], 0) * gen.base; });
    ipPerSec = ipPerSec * ipBoost * mult + autoClicks * clickPower;

    let spPerSec = 0;
    LABS.forEach((lab) => { spPerSec += num(s.labs[lab.id], 0) * lab.base; });
    spPerSec *= spBoost * mult;

    let pcPerSec = 0;
    CONS.forEach((con) => { pcPerSec += num(s.cons[con.id], 0) * con.base; });
    pcPerSec *= pcBoost * mult;

    const shipBoost = (1 + 0.25 * lvl('drydock')) * (s.fleet.doctrine === 'voss' ? 1.2 : 1) * (s.research[1].state === 3 ? 1.1 : 1) * (s.fleet.focus === 'yards' ? 1.25 : 1);
    const shipPerSec = s.lines > 0 ? s.lines * 0.16 * shipBoost * (0.5 + s.fleet.reliability / 200) : 0;
    const shipIpCost = 18;

    const pubActive = s.step >= 22;
    const roomCount = Object.keys(s.pub.rooms).length;
    const tier = PUB_TIERS[Math.max(0, Math.min(PUB_TIERS.length - 1, s.pub.tier - 1))];
    const weather = WEATHERS.find((w) => w.id === s.pub.weather) || WEATHERS[0];
    const seats = Object.keys(s.pub.rooms).reduce((sum, id) => {
      const room = WH_ROOM(id);
      return sum + (room ? room.seats : 0);
    }, 0);
    const patrons = pubActive
      ? Math.min(seats, 2 + 2 * roomCount) * (1 + pubEffect(s, 'patrons'))
      : 0;
    const pintsPerSec = pubActive ? patrons * 0.45 * (1 + pubEffect(s, 'pints')) * weather.pints * (1 + 0.05 * pubStaff.staff) : 0;
    const absorption = pubActive
      ? tier.absorption * (1 + 0.35 * seUpgradeLevel(s, 'microphones') + 0.25 * seUpgradeLevel(s, 'absorber')) * (1 + pubEffect(s, 'absorption')) * weather.se
      : 0;
    const noisePerSec = pubActive
      ? patrons * 1.3 * weather.noise * Math.max(0.2, 1 + pubEffect(s, 'noise')) * (1 + 0.15 * (s.pub.tier - 1))
      : 0;
    const capacity = pubActive
      ? tier.capacity * (1 + 0.5 * seUpgradeLevel(s, 'filters'))
      : 100;
    const ventPower = 1 + 0.3 * seUpgradeLevel(s, 'venting') + 0.2 * seUpgradeLevel(s, 'resonator');
    const sePerSec = pubActive
      ? Math.min(s.pub.noise + noisePerSec, absorption) * 0.45 * (1 + pubEffect(s, 'se')) * ventPower
      : 0;

    const combatPower = (s.fleet.ships) * (0.5 + s.fleet.reliability / 100) * formationOff(s) * (1 + 0.15 * lvl('torpedo')) * (s.research[0].state === 3 ? 1.18 : 1) * (s.fleet.doctrine === 'norden' ? 1.1 : 1) * (s.fleet.focus === 'corridor' ? 1.18 : 1) * (1 - Math.min(0.25, s.fleet.chaos / 300));
    const enemyPower = s.fleet.enemy * 0.6 * (1 + 0.18 * s.fleet.analyzer + 0.06 * s.fleet.adapt);

    return {
      mult, clickBase, clickPower, autoClicks, ipPerSec, spPerSec, pcPerSec,
      shipPerSec, shipIpCost, pintsPerSec, sePerSec, noisePerSec, absorption,
      capacity, patrons, ventPower, combatPower, enemyPower, pubActive,
      rooms: roomCount, tier, weather, doctrineBonus: doctrineBonus(s),
    };
  }

  function formationOff(s) {
    if (s.fleet.formation === 'breakthrough') return 1.35;
    if (s.fleet.formation === 'escort') return 0.8;
    return 1;
  }
  function formationLoss(s) {
    if (s.fleet.formation === 'breakthrough') return 1.5;
    if (s.fleet.formation === 'escort') return 1.1;
    return 1;
  }
  function formationCapital(s) {
    if (s.fleet.formation === 'escort') return 0.5;
    if (s.fleet.formation === 'breakthrough') return 1.2;
    return 1;
  }
  function targetOff(s) {
    if (s.fleet.target === 'support') return 0.85;
    if (s.fleet.target === 'command') return 0.8;
    return 1;
  }

  function WH_ROOM(id) {
    const content = (window.WH && window.WH.content) || {};
    return (content.ROOM_DEFS || []).find((room) => room.id === id) || null;
  }

  /* ------------------------------------------------------------- research */
  function researchOpen(s) {
    return s.hearings.length;
  }

  function authorize(s, project) {
    const rec = s.research[project.id];
    if (!rec || rec.state !== 0) return { ok: false, msg: 'Already authorised.' };
    if (s.ip < project.ip || s.sp < project.sp) {
      return { ok: false, msg: `The Directorate needs ${fmt(project.ip)} IP and ${fmt(project.sp)} SP.` };
    }
    s.ip -= project.ip;
    s.sp -= project.sp;
    s.totals.sp += 0;
    rec.state = 1;
    rec.progress = 0;
    s.fleet.chaos = clamp(s.fleet.chaos + 8, 0, 100);
    say(s, `${project.name} authorised. Production of everything interesting stops for a while.`, 'good');
    return { ok: true, msg: `${project.name} authorised.` };
  }

  function startTest(s, project) {
    const d = derive(s);
    const rec = s.research[project.id];
    if (!rec || rec.state < 2) return { ok: false, msg: 'Not ready for testing.' };
    if (rec.tests >= 2) return { ok: false, msg: 'The tests are complete.' };
    if (s.sp < 15) return { ok: false, msg: 'A test costs 15 SP.' };
    s.sp -= 15;
    rec.testTimer = 0;
    rec.testing = true;
    say(s, `${project.name}: field test ${rec.tests + 1} of 2 begins. The test crew has been promised a pint.`, 'info');
    return { ok: true, msg: 'Test begun.' };
  }

  function fileHearing(s, project, reason) {
    s.hearings.push({ id: project.id, name: project.name, timer: 22, reason });
    s.fleet.chaos = clamp(s.fleet.chaos + (reason === 'failure' ? 3 : 1), 0, 100);
    say(s, reason === 'failure'
      ? `${project.name} filed a failure report: ${project.flaw} The Scientific Council demands a ruling.`
      : `${project.name} passed both field tests and immediately filed a specification-omission report. The Council demands a ruling on what the tests proved.`, 'bad');
  }

  function completeTest(s, project, rec) {
    const failed = Math.random() < 0.4;
    if (failed) {
      rec.fails += 1;
      fileHearing(s, project, 'failure');
    } else {
      rec.tests += 1;
      s.totals.tests += 1;
      const complete = rec.tests >= 2;
      say(s, `${project.name}: field test ${rec.tests}/2 passed. ${complete ? 'The specification is now provably incomplete.' : 'The crew survived, which is the point.'}`, 'good');
      if (complete && !rec.filed) {
        rec.filed = true;
        fileHearing(s, project, 'omission');
      }
    }
  }

  function certify(s, project) {
    const rec = s.research[project.id];
    if (!rec || rec.state !== 2) return { ok: false, msg: 'Not ready for certification.' };
    if (rec.tests < 2) return { ok: false, msg: 'Both field tests must pass first.' };
    if (s.hearings.length) return { ok: false, msg: 'The record is not clean: resolve the open hearings first.' };
    const ipCost = 600;
    const pcCost = 10;
    if (s.ip < ipCost || s.pc < pcCost) return { ok: false, msg: `Safeguards cost ${ipCost} IP and ${pcCost} PC.` };
    s.ip -= ipCost;
    s.pc -= pcCost;
    rec.state = 3;
    s.fleet.chaos = clamp(s.fleet.chaos - 4, 0, 100);
    s.fleet.unrest = clamp(s.fleet.unrest - 2, 0, 100);
    say(s, `${project.name} certified. The second directive now has a sentence about the crew. ${project.bonus}`, 'good');
    return { ok: true, msg: `${project.name} certified.` };
  }

  function resolveHearing(s, index, choice) {
    const hearing = s.hearings[index];
    if (!hearing) return { ok: false, msg: 'No such report.' };
    const revise = choice === 'revise';
    if (revise) {
      if (s.ip < 30 || s.pc < 5) return { ok: false, msg: 'Revisions cost 30 IP and 5 PC.' };
      s.ip -= 30;
      s.pc -= 5;
      s.fleet.unrest = clamp(s.fleet.unrest - 5, 0, 100);
      s.fleet.chaos = clamp(s.fleet.chaos - 2, 0, 100);
      say(s, `Revisions demanded on ${hearing.name}. The prototype is grounded, the crew is alive, and the admirals are calmer.`, 'good');
    } else {
      s.ip += 20;
      s.fleet.unrest = clamp(s.fleet.unrest + 9, 0, 100);
      s.fleet.chaos = clamp(s.fleet.chaos + 5, 0, 100);
      say(s, `The excuse endorsed on ${hearing.name}. +20 IP; the admirals have started a file with your name on it.`, 'bad');
    }
    s.totals.hearings += 1;
    s.hearings.splice(index, 1);
    return { ok: true, msg: revise ? 'Revisions demanded.' : 'Excuse endorsed.' };
  }

  /* --------------------------------------------------------------- combat */
  function sortie(s) {
    const d = derive(s);
    const enemy = s.fleet.enemy;
    if (s.fleet.ships < 1 || enemy <= 0) return null;
    const field = s.fleet.field && s.fleet.blackout <= 0;
    let power = d.combatPower * targetOff(s) * (0.7 + 0.3 * s.fleet.reliability / 100);
    let enemyPower = d.enemyPower;
    if (s.fleet.target === 'command') enemyPower *= 0.75;
    const ratio = power / Math.max(0.001, enemyPower);
    const killCap = s.step >= 23 ? Math.min(Math.floor(enemy), 25) : Math.floor(enemy);
    let kills = clamp(Math.round(1 + 2.2 * ratio), 0, killCap);
    const lossesRaw = (0.4 / Math.max(0.2, ratio)) * formationLoss(s) * Math.pow(0.88, upgradeLevel(s, 'armour'));
    const losses = Math.min(s.fleet.ships, Math.max(0, Math.round(lossesRaw * 10) / 10));
    let capitalDamage = Math.max(1, Math.round(enemy * 0.03 * formationCapital(s) * Math.pow(0.88, upgradeLevel(s, 'shielding'))));
    if (s.fleet.target === 'command') capitalDamage = Math.max(1, Math.round(capitalDamage * 0.5));
    if (field) capitalDamage = 0;

    s.fleet.ships = Math.max(0, s.fleet.ships - losses);
    s.fleet.enemy = Math.max(0, s.fleet.enemy - kills);
    s.totals.kills += kills;
    s.totals.sortieCount += 1;
    if (kills > 0) s.totals.sorties += 1;
    if (kills > 0) s.fleet.unrest = clamp(s.fleet.unrest - 0.15, 0, 100);
    if (losses > 0) s.fleet.unrest = clamp(s.fleet.unrest + 0.35, 0, 100);
    s.fleet.capital = Math.max(0, s.fleet.capital - capitalDamage);

    if (field) {
      s.totals.blocks += 1;
      s.fleet.heat = clamp(s.fleet.heat + 12, 0, 100);
      if (s.fleet.heat >= 100) {
        s.fleet.field = false;
        s.fleet.blackout = 6;
        s.fleet.heat = 40;
        say(s, 'The exponential field enters hysteresis: six seconds of command blackout. Every clock disagrees.', 'bad');
      }
    }

    if (s.fleet.target === 'command' && kills > 0) {
      s.totals.disrupts += 1;
    }

    if (s.fleet.analyzer > 0) {
      if (s.fleet.target === 'support') {
        const damage = 4 + Math.round(s.fleet.ships * 0.12) + kills;
        s.fleet.analyzerHp -= damage;
        if (s.fleet.analyzerHp <= 0) {
          s.fleet.analyzer = 0;
          s.fleet.adapt = Math.max(0, s.fleet.adapt - 2);
          s.totals.analyzers += 1;
          say(s, 'The Battle Analyzer is destroyed. Five hundred engineers are briefly unemployed and permanently relieved.', 'good');
        }
      }
    }
    return { kills, losses, capitalDamage, field };
  }

  /* ------------------------------------------------------------------ pub */
  function pubRoomCost(id) {
    const room = WH_ROOM(id);
    if (!room) return 0;
    return Math.ceil(room.cost * 0.4);
  }

  function buyRoom(s, id) {
    const room = WH_ROOM(id);
    if (!room || s.pub.rooms[id]) return { ok: false, msg: 'Already open.' };
    const cost = pubRoomCost(id);
    if (s.pints < cost) return { ok: false, msg: `Opening ${room.name} costs ${fmt(cost)} pints.` };
    s.pints -= cost;
    s.pub.rooms[id] = true;
    say(s, `${room.name} is open. ${room.special}. ${room.blurb}`, 'good');
    return { ok: true, msg: `${room.name} open.` };
  }

  function pubItemEffect(item) {
    const [key] = Object.keys(item.effect);
    const value = item.effect[key];
    if (key === 'global') return `+${Math.round(value * 100)}% all output`;
    if (key === 'pints') return `+${Math.round(value * 100)}% pints`;
    if (key === 'se') return `+${Math.round(value * 100)}% Silence Energy`;
    if (key === 'absorption') return `+${Math.round(value * 100)}% absorption`;
    if (key === 'noise') return `${Math.round(value * 100)}% noise`;
    if (key === 'patrons') return `+${Math.round(value * 100)}% patrons`;
    if (key === 'sp') return `+${Math.round(value * 100)}% science`;
    return item.note;
  }

  function buyPubItem(s, list, id) {
    const item = list.find((entry) => entry.id === id);
    if (!item) return { ok: false, msg: 'Unknown.' };
    if (s.pub.staff[id] || s.pub.amenities[id]) return { ok: false, msg: 'Already hired.' };
    if (s.pints < item.cost) return { ok: false, msg: `Costs ${fmt(item.cost)} pints.` };
    s.pints -= item.cost;
    if (list === PUB_STAFF) s.pub.staff[id] = true;
    else s.pub.amenities[id] = true;
    say(s, `${item.name} engaged at The White Hart. ${item.note}`, 'good');
    return { ok: true, msg: `${item.name} engaged.` };
  }

  function buyPubUpgrade(s, id) {
    const item = PUB_UPGRADES.find((entry) => entry.id === id);
    if (!item) return { ok: false, msg: 'Unknown upgrade.' };
    const level = seUpgradeLevel(s, id);
    if (level >= item.max) return { ok: false, msg: 'Fully installed.' };
    const cost = Math.ceil(item.cost * Math.pow(1.75, level));
    if (s.se < cost) return { ok: false, msg: `Costs ${fmt(cost)} SE.` };
    s.se -= cost;
    s.pub.upgrades[id] = level + 1;
    say(s, `${item.name} installed in the Silencer. ${item.note}.`, 'good');
    return { ok: true, msg: `${item.name} installed.` };
  }

  function buyPubTier(s) {
    const next = PUB_TIERS.find((tier) => tier.tier === s.pub.tier + 1);
    if (!next) return { ok: false, msg: 'The apparatus is already Kendell-proof.' };
    if (s.pints < next.pints || s.se < next.se) return { ok: false, msg: `The ${next.name} Silencer costs ${next.pints} pints and ${next.se} SE.` };
    s.pints -= next.pints;
    s.se -= next.se;
    s.pub.tier = next.tier;
    say(s, `The Fenton Silencer is now ${next.name}. ${next.note}`, 'good');
    return { ok: true, msg: `Silencer tier ${next.tier}: ${next.name}.` };
  }

  function ventPub(s, manual) {
    const d = derive(s);
    const gain = s.pub.noise * 0.75 * d.ventPower * (1 + pubEffect(s, 'se'));
    if (gain < 1) return { ok: false, msg: 'Nothing to vent yet.' };
    s.pub.noise = 0;
    s.se += gain;
    s.totals.se += gain;
    if (manual) say(s, `Vented ${fmt(gain)} SE into the cellar. The pipes lead to a strictly unmarked destination.`, 'good');
    return { ok: true, msg: `+${fmt(gain)} SE.` };
  }

  function pubExplosion(s) {
    const casing = seUpgradeLevel(s, 'casing') > 0 ? 0.75 : 1;
    const lostSe = s.se * 0.4 * casing;
    s.se = Math.max(0, s.se - lostSe);
    s.pub.noise = 0;
    s.pub.reputation = clamp(s.pub.reputation - 12, 0, 100);
    s.pub.explosions += 1;
    s.totals.explosions += 1;
    s.fleet.unrest = clamp(s.fleet.unrest + 2, 0, 100);
    say(s, `THE SILENCER HAS EXPLODED. ${fmt(lostSe)} SE lost, reputation damaged. Everything freezes for two seconds out of respect.`, 'bad');
  }

  function checkCost(s) {
    return { ip: Math.ceil(30 * Math.pow(1.4, s.totals.checks)), sp: Math.ceil(20 * Math.pow(1.3, s.totals.checks)) };
  }

  function checkPub(s) {
    if (s.pub.checking) return { ok: false, msg: 'A check is already running.' };
    const cost = checkCost(s);
    if (s.ip < cost.ip || s.sp < cost.sp) return { ok: false, msg: `A check costs ${fmt(cost.ip)} IP and ${fmt(cost.sp)} SP.` };
    s.ip -= cost.ip;
    s.sp -= cost.sp;
    s.pub.checking = true;
    s.pub.checkTimer = 0;
    s.pub.checks += 1;
    say(s, `Prototype check ${s.pub.checks} begins at The White Hart: twelve seconds of readings and one control pint.`, 'info');
    return { ok: true, msg: 'Check started.' };
  }

  /* ------------------------------------------------------------ prestige */
  function ending(s) {
    const certified = s.research.every((rec) => rec.state === 3);
    if (s.signal.choice === 'reply') {
      return {
        title: 'A greeting in the dark',
        copy: 'The array stops asking and starts answering: one word, repeating, in a language the machines translate as relief. The Calculus has no column for it, so a new one is drawn.',
      };
    }
    if (s.signal.choice === 'silence') {
      return {
        title: 'The long silence',
        copy: 'The enemy retreats from a capital they can no longer locate. The array keeps its channel open and keeps asking, patiently, at something with nobody left to answer it.',
      };
    }
    if (certified && s.fleet.doctrine === 'voss') {
      return {
        title: 'Reliability outweighs genius',
        copy: 'Every prototype came home certified. Every machine that returned had obeyed its directives, and not one of them was brilliant enough to be excused.',
      };
    }
    if (certified) {
      return {
        title: 'A working theory',
        copy: 'The corridor is held by machines that were tested twice and signed for once. The Directorate calls this a compromise. The crews call it a fleet.',
      };
    }
    return {
      title: 'An expensive peace',
      copy: 'The frontier is quiet because there is nothing left in it to argue about. The Calculus files the result under victory and does not itemise the cost.',
    };
  }

  function prestigeBreakdown(s) {
    const certified = s.research.filter((r) => r.state === 3).length;
    const rooms = Object.keys(s.pub.rooms).length;
    const rows = [
      { label: `phase ${s.phase}`, value: 10 + 5 * s.phase },
      { label: 'industrial total', value: Math.floor(Math.pow(Math.max(0, s.totals.ip), 0.25) / 2) },
      { label: 'hulls destroyed', value: Math.floor(s.totals.kills / 200) },
      { label: 'silence collected', value: Math.floor(Math.max(0, s.totals.se) / 6000) },
      { label: 'annex checks', value: Math.min(8, Math.floor(s.totals.checks / 2)) },
      { label: 'certifications', value: certified },
      { label: 'the array', value: s.signal.choice ? 4 : 0 },
      { label: 'rooms opened', value: Math.min(4, rooms) },
      { label: 'doctrine', value: s.fleet.doctrine ? 2 : 0 },
    ];
    return rows.filter((row) => row.value > 0);
  }

  function prestigeGain(s) {
    const certified = s.research.filter((r) => r.state === 3).length;
    const rooms = Object.keys(s.pub.rooms).length;
    const base = 10 + 5 * s.phase;
    const fromIp = Math.floor(Math.pow(Math.max(0, s.totals.ip), 0.25) / 2);
    const fromKills = Math.floor(s.totals.kills / 200);
    const fromSe = Math.floor(Math.max(0, s.totals.se) / 6000);
    const bonus = Math.min(8, Math.floor(s.totals.checks / 2)) + certified + (s.signal.choice ? 4 : 0) + Math.min(4, rooms) + (s.fleet.doctrine ? 2 : 0);
    return Math.max(1, base + fromIp + fromKills + fromSe + bonus);
  }

  function forecastMult(s) {
    return 1 + 0.05 * num(s.forecast) + 0.25 * num(s.forecastUp.memory, 0);
  }

  function buyPrestigeUpgrade(s, id) {
    const def = PRESTIGE_UPGRADES.find((entry) => entry.id === id);
    if (!def) return { ok: false, msg: 'Unknown.' };
    const level = num(s.forecastUp[id], 0);
    if (level >= def.max) return { ok: false, msg: 'Already at maximum.' };
    const cost = def.cost[level];
    if (s.forecast < cost) return { ok: false, msg: `Costs ${cost} Forecast.` };
    s.forecast -= cost;
    s.forecastUp[id] = level + 1;
    say(s, `${def.name} remembered permanently. The next phase begins with it.`, 'good');
    return { ok: true, msg: `${def.name} bought.` };
  }

  function doPrestige(s) {
    if (s.step < 24) return { ok: false, msg: 'The Reckoning is not yet open.' };
    const gain = prestigeGain(s);
    const previous = {
      phase: s.phase,
      precipes: s.prestiges,
      forecast: s.forecast + gain,
      forecastLifetime: s.forecastLifetime + gain,
      forecastUp: { ...s.forecastUp },
      prestiges: s.prestiges + 1,
      isPrestige: true,
    };
    const next = newGame(previous);
    next.forecast = s.forecast + gain;
    next.forecastLifetime = s.forecastLifetime + gain;
    next.phase = s.phase + 1;
    next.prestiges = s.prestiges + 1;
    next.forecastUp = { ...s.forecastUp };
    say(next, `THE CALCULUS IS RECALCULATED. Phase ${next.phase} opens with ${next.forecast} Forecast in reserve (+${gain} gained).`, 'good');
    return { ok: true, msg: `Prestige: +${gain} Forecast. Phase ${next.phase}.`, state: next, gain };
  }

  /* ------------------------------------------------------------- actions */
  function buyGenerator(s, list, store, id, amount) {
    const def = list.find((entry) => entry.id === id);
    if (!def) return { ok: false, msg: 'Unknown machine.' };
    if (s.step < def.step) return { ok: false, msg: 'Not yet unlocked.' };
    const owned = num(s[store][id], 0);
    let count = amount === 'max' ? maxAffordable(def, owned, s.ip) : Math.max(1, Math.floor(num(amount, 1)));
    if (amount === 'max' && count < 1) return { ok: false, msg: 'Cannot afford one yet.' };
    const cost = bulkCost(def, owned, count);
    if (s.ip < cost) return { ok: false, msg: `Needs ${fmt(cost)} IP.` };
    s.ip -= cost;
    s[store][id] = owned + count;
    return { ok: true, msg: `Built ${count} × ${def.name}.` };
  }

  function buyUpgrade(s, id) {
    const def = upgradeBy(id);
    if (!def) return { ok: false, msg: 'Unknown upgrade.' };
    if (s.step < def.step) return { ok: false, msg: 'Not yet unlocked.' };
    const level = upgradeLevel(s, id);
    if (level >= def.max) return { ok: false, msg: 'Fully developed.' };
    const cost = upgradeCost(def, level);
    if (s.ip < cost) return { ok: false, msg: `Needs ${fmt(cost)} IP.` };
    s.ip -= cost;
    s.up[id] = level + 1;
    if (id === 'reform') s.fleet.chaos = clamp(s.fleet.chaos - 5, 0, 100);
    if (id === 'standardize') s.fleet.reliability = clamp(s.fleet.reliability + 2, 0, 100);
    say(s, `${def.name} installed. ${def.note}.`, 'good');
    return { ok: true, msg: `${def.name} installed.` };
  }

  function buyLine(s) {
    if (s.step < 5) return { ok: false, msg: 'The yards are not yet open.' };
    if (s.lines >= 8) return { ok: false, msg: 'The yards are at capacity: eight lines.' };
    const cost = Math.ceil(400 * Math.pow(1.85, s.lines));
    if (s.ip < cost) return { ok: false, msg: `A cruiser line costs ${fmt(cost)} IP.` };
    s.ip -= cost;
    s.lines += 1;
    say(s, `Cruiser line ${s.lines} opened. Identical hulls, interchangeable bolts, no interesting decisions.`, 'good');
    return { ok: true, msg: 'Cruiser line opened.' };
  }

  function clickAction(s) {
    const d = derive(s);
    s.click.streak = s.runSeconds - s.click.lastAt < 1.25 ? s.click.streak + 1 : 1;
    s.click.lastAt = s.runSeconds;
    s.click.combo = Math.min(3, 1 + 0.06 * s.click.streak);
    const gain = d.clickPower;
    s.ip += gain;
    s.totals.ip += gain;
    s.totals.clicks += 1;
    return { ok: true, gain };
  }

  function studyAction(s) {
    const d = derive(s);
    const gain = (1 + 0.05 * upgradeLevel(s, 'endowment')) * (1 + num(s.forecastUp.hands, 0)) * Math.sqrt(d.mult);
    s.sp += gain;
    s.totals.sp += gain;
    return { ok: true, gain };
  }

  function lobbyAction(s) {
    if (s.ip < 15) return { ok: false, msg: 'Lobbying costs 15 IP in stamps.' };
    const d = derive(s);
    s.ip -= 15;
    const gain = 1 + 0.2 * upgradeLevel(s, 'lobbyist');
    s.pc += gain;
    s.totals.pc += gain;
    return { ok: true, gain };
  }

  function setDoctrine(s, id) {
    if (s.step < 20) return { ok: false, msg: 'Doctrine is not yet open.' };
    if (!['norden', 'voss'].includes(id)) return { ok: false, msg: 'Unknown doctrine.' };
    if (s.fleet.doctrine === id) return { ok: true, msg: 'Already declared.' };
    if (s.fleet.doctrine && s.runSeconds < s.fleet.doctrineSwitch) {
      return { ok: false, msg: `The Directorate needs ${Math.ceil(s.fleet.doctrineSwitch - s.runSeconds)}s to rewrite the doctrine.` };
    }
    if (s.fleet.doctrine) {
      s.fleet.unrest = clamp(s.fleet.unrest + 6, 0, 100);
      s.fleet.chaos = clamp(s.fleet.chaos + 5, 0, 100);
    }
    s.fleet.doctrine = id;
    s.fleet.mastery = 0;
    s.fleet.doctrineTimer = 0;
    s.fleet.doctrineSwitch = s.runSeconds + 25;
    say(s, id === 'norden'
      ? 'Doctrine: Norden. Brilliance first, and the crew mentioned in an appendix. Science rises; reliability will not.'
      : 'Doctrine: Voss. Standardisation first. The machines are duller and the crews come home.', 'good');
    return { ok: true, msg: id === 'norden' ? 'Norden declared.' : 'Voss declared.' };
  }

  function gainFragment(s) {
    if (s.signal.fragments >= 3) return false;
    s.signal.fragments += 1;
    s.signal.timer = 0;
    const excerpts = [
      'First interval isolated: prime-number pulses shaped like a question, stable across an unknown span of time.',
      'Second interval isolated: the question concerns endings, and it has been asked before by something no longer here to hear the reply.',
      'Third interval isolated: the final coordinate is this receiver. The question was addressed to whoever answered next.',
    ];
    say(s, `Listening pass ${s.signal.fragments}/3. ${excerpts[s.signal.fragments - 1]}`, 'good');
    return true;
  }

  function listen(s, manual) {
    if (s.step < 21) return { ok: false, msg: 'The array is not yet in range.' };
    if (s.signal.fragments >= 3) return { ok: false, msg: 'The message is complete. It is waiting for an answer.' };
    s.signal.timer += manual ? 7 : 0;
    if (manual) pushLog(s, 'A listening pass begins. The array answers with the same prime intervals, patient as arithmetic.');
    if (s.signal.timer >= 20) gainFragment(s);
    return { ok: true, msg: manual ? 'The array listens back.' : '' };
  }

  function answerSignal(s, choice) {
    if (s.signal.fragments < 3 || s.signal.choice) return { ok: false, msg: 'There is nothing to answer yet.' };
    if (!['reply', 'silence'].includes(choice)) return { ok: false, msg: 'Unknown answer.' };
    if (choice === 'reply') {
      if (s.pc < 12) return { ok: false, msg: 'A first-contact reply costs 12 PC.' };
      s.pc -= 12;
      s.signal.choice = 'reply';
      s.signal.reply = true;
      s.sp += 25;
      say(s, 'Reply transmitted: a short sequence of prime intervals, carrying our name and no demands. Somewhere out there, something begins to compose an answer.', 'good');
    } else {
      s.signal.choice = 'silence';
      s.signal.silence = true;
      s.fleet.enemy = Math.max(0, Math.floor(s.fleet.enemy * 0.9));
      s.fleet.reliability = clamp(s.fleet.reliability + 8, 0, 100);
      say(s, 'Radio silence held. The array’s carrier masks the capital from enemy tracking; enemy strength falls and the fleet steadies.', 'good');
    }
    return { ok: true, msg: choice === 'reply' ? 'Reply transmitted.' : 'Silence held.' };
  }

  function cedeOutpost(s) {
    if (s.step < 18) return { ok: false, msg: 'Not yet available.' };
    if (s.fleet.ceded) return { ok: false, msg: 'The outpost is already gone.' };
    s.fleet.ceded = true;
    s.fleet.enemy = Math.max(0, Math.floor(s.fleet.enemy - 8));
    s.fleet.unrest = clamp(s.fleet.unrest + 15, 0, 100);
    s.fleet.chaos = clamp(s.fleet.chaos + 6, 0, 100);
    s.totals.kills += 8;
    say(s, 'Outpost Four ceded to the enemy with a poisoned prototype aboard. Eight enemy hulls enter the dockyard and do not leave it. The admirals are not amused.', 'bad');
    return { ok: true, msg: 'Outpost ceded.' };
  }

  function repairCapital(s, fully) {
    const missing = 100 - s.fleet.capital;
    if (missing <= 0 && !s.fleet.crisis) return { ok: false, msg: 'The capital is intact.' };
    const points = fully ? missing : Math.min(10, missing);
    const cost = Math.ceil(points * 3);
    if (s.ip < cost) return { ok: false, msg: `Repairs cost ${fmt(cost)} IP.` };
    s.ip -= cost;
    s.fleet.capital = clamp(s.fleet.capital + points, 0, 100);
    if (s.fleet.capital > 0) s.fleet.crisis = false;
    return { ok: true, msg: `Capital repaired +${Math.round(points)}%.` };
  }

  function fundRevisions(s) {
    if (s.ip < 80 || s.pc < 6) return { ok: false, msg: 'A revision package costs 80 IP and 6 PC.' };
    s.ip -= 80;
    s.pc -= 6;
    s.fleet.unrest = clamp(s.fleet.unrest - 12, 0, 100);
    s.fleet.mutiny = false;
    say(s, 'A revision package funded. The admirals return to their offices, which they prefer to the bridge.', 'good');
    return { ok: true, msg: 'Unrest reduced.' };
  }

  function emergency(s) {
    if (s.ip >= 2000) {
      s.ip -= 2000;
      s.fleet.capital = Math.max(s.fleet.capital, 60);
      s.fleet.crisis = false;
      say(s, 'Emergency appropriations passed. The capital’s lights come back on, one district at a time.', 'good');
      return { ok: true, msg: 'Crisis averted.' };
    }
    if (s.pc >= 25) {
      s.pc -= 25;
      s.fleet.capital = Math.max(s.fleet.capital, 60);
      s.fleet.crisis = false;
      say(s, 'Emergency powers invoked. The capital’s lights come back on, and so does the argument.', 'good');
      return { ok: true, msg: 'Crisis averted.' };
    }
    return { ok: false, msg: 'Emergency powers need 2,000 IP or 25 PC.' };
  }

  /* ---------------------------------------------------------------- tick */
  function addTotals(s, d, dt) {
    const ip = d.ipPerSec * dt;
    s.ip += ip;
    s.totals.ip += ip;
    const sp = d.spPerSec * dt;
    s.sp += sp;
    s.totals.sp += sp;
    const pc = d.pcPerSec * dt;
    s.pc += pc;
    s.totals.pc += pc;
  }

  function tickPub(s, dt) {
    if (s.step < 22) return;
    const d = derive(s);
    const p = s.pub;
    s.pints += d.pintsPerSec * dt;
    p.noise += Math.max(0.15, d.noisePerSec - d.absorption * 0.8) * dt;
    s.se += d.sePerSec * dt;
    s.totals.se += d.sePerSec * dt;

    if (s.policies.autoVent && p.noise > d.capacity * 0.75) {
      const gain = p.noise * 0.55 * d.ventPower * (1 + pubEffect(s, 'se'));
      p.noise = 0;
      s.se += gain;
      s.totals.se += gain;
    }
    if (p.noise >= d.capacity) pubExplosion(s);

    p.weatherTimer -= dt;
    if (p.weatherTimer <= 0) {
      p.weatherTimer = 150;
      const next = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
      if (next.id !== p.weather) {
        p.weather = next.id;
        pushLog(s, `The weather turns: ${next.name}. ${next.note}`);
      }
    }

    if (p.checking) {
      p.checkTimer += dt;
      if (p.checkTimer >= 12) {
        p.checking = false;
        p.checkTimer = 0;
        s.totals.checks += 1;
        s.sp += 12;
        s.se += 40;
        s.totals.se += 40;
        s.pub.reputation = clamp(p.reputation + 3, 0, 100);
        say(s, `Prototype check ${s.totals.checks} filed. The landlord witnessed it. Norden claims a deviation of 0.000001%.`, 'good');
      }
    } else if (s.policies.autoCheck && s.runSeconds > 1) {
      const cost = checkCost(s);
      if (s.ip >= cost.ip && s.sp >= cost.sp) checkPub(s);
    }

    // Barmaid keeps the regulars served.
    if (p.staff.barmaid && Math.random() < dt * 0.35) {
      s.pints += 1.5;
    }
  }

  function tickResearch(s, dt) {
    s.research.forEach((rec) => {
      const project = PROJECTS[rec.id];
      if (rec.state === 1) {
        rec.progress += dt;
        if (rec.progress >= 20) {
          rec.state = 2;
          rec.progress = 0;
          say(s, `${project.name} drafted. It is ready for field tests.`, 'good');
        }
      } else if (rec.state === 2) {
        if (s.step < 9) return;
        if (rec.tests >= 2) return;
        if (!rec.testing) {
          if (s.sp >= 15) {
            s.sp -= 15;
            rec.testing = true;
            rec.testTimer = 0;
          }
        } else {
          rec.testTimer += dt;
          if (rec.testTimer >= 15) {
            rec.testing = false;
            rec.testTimer = 0;
            completeTest(s, project, rec);
          }
        }
      }
    });

    if (s.step >= 11 && s.policies.autoResearch && s.hearings.length === 0) {
      for (const rec of s.research) {
        if (rec.state === 2 && rec.tests >= 2) {
          const project = PROJECTS[rec.id];
          if (s.ip >= 600 && s.pc >= 10) certify(s, project);
        }
      }
    }
    if (s.step >= 8 && s.policies.autoResearch) {
      for (const rec of s.research) {
        if (rec.state === 0) {
          const project = PROJECTS[rec.id];
          if (s.ip >= project.ip && s.sp >= project.sp) authorize(s, project);
        }
      }
    }
  }

  function tickHearings(s, dt) {
    if (!s.hearings.length) return;
    for (let i = s.hearings.length - 1; i >= 0; i--) {
      const hearing = s.hearings[i];
      hearing.timer -= dt;
      if (hearing.timer <= 0) {
        const choice = s.policies.autoHearing;
        if (choice === 'revise' && (s.ip < 30 || s.pc < 5)) {
          resolveHearing(s, i, 'endorse');
        } else {
          resolveHearing(s, i, choice);
        }
      }
    }
  }

  function overhaulFleet(s, manual) {
    const missing = 100 - s.fleet.reliability;
    if (missing < 2) return { ok: false, msg: 'The fleet is already at full reliability.' };
    const cost = Math.ceil(80 + missing * 18);
    if (s.ip < cost) return { ok: false, msg: `An overhaul costs ${fmt(cost)} IP.` };
    s.ip -= cost;
    s.fleet.reliability = clamp(s.fleet.reliability + Math.min(25, missing), 0, 100);
    if (manual) say(s, 'The fleet is recalled, refitted and returned. Every bolt is now the same bolt.', 'good');
    return { ok: true, msg: 'Fleet overhauled.' };
  }

  function bureaucraticReform(s, manual) {
    if (s.fleet.chaos < 3) return { ok: false, msg: 'There is nothing left to standardise.' };
    if (s.pc < 3) return { ok: false, msg: 'A reform package costs 3 PC.' };
    s.pc -= 3;
    const cut = Math.max(4, s.fleet.chaos * 0.12);
    s.fleet.chaos = clamp(s.fleet.chaos - cut, 0, 100);
    if (manual) say(s, `Reform package passed: chaos reduced by ${Math.round(cut)}%. The paperwork is now only mostly circular.`, 'good');
    return { ok: true, msg: 'Reform passed.' };
  }

  function tickWar(s, dt) {
    const f = s.fleet;
    if (s.step < 5) return;

    if (s.lines > 0) {
      const d = derive(s);
      const wanted = d.shipPerSec * dt;
      if (wanted > 0) {
        const budget = s.ip * 0.5;
        const possible = Math.min(wanted, budget / d.shipIpCost);
        if (possible > 0) {
          s.ip -= possible * d.shipIpCost;
          f.ships += possible;
          s.totals.shipsBuilt += possible;
        }
      }
    }
    if (s.step < 6) return;

    const decay = Math.pow(Math.max(0, f.ships), 0.62) * 0.02 * (1 + f.chaos / 150) * Math.pow(0.78, upgradeLevel(s, 'standardize'));
    const regen = 0.08 + 0.14 * upgradeLevel(s, 'maintenance') + (f.doctrine === 'voss' ? 0.14 : 0);
    f.reliability = clamp(f.reliability + (regen - decay) * dt, 0, 100);

    if (s.step >= 7) {
      const gens = GENS.reduce((sum, g) => sum + num(s.gens[g.id], 0), 0);
      const drift = (0.0004 * gens + 0.003 * s.lines) * Math.pow(0.8, upgradeLevel(s, 'reform')) * Math.pow(0.9, upgradeLevel(s, 'automation'));
      f.chaos = clamp(f.chaos + drift * dt, 0, 100);
      f.reformTimer += dt;
      if (s.policies.autopilot && f.reformTimer >= 2) {
        f.reformTimer = 0;
        if (f.chaos > 12) bureaucraticReform(s, false);
      }
      f.overhaulTimer += dt;
      if (s.policies.autopilot && f.overhaulTimer >= 4) {
        f.overhaulTimer = 0;
        if (f.reliability < 72) overhaulFleet(s, false);
      }
    }

    if (f.mutiny) {
      if (s.policies.autoRepair) fundRevisions(s);
    } else if (f.unrest >= 100) {
      f.mutiny = true;
      say(s, 'MUTINY. The admirals have barricaded the bridge and are reading out a list of grievances. All output halved until it is funded.', 'bad');
    }

    if (f.crisis && s.policies.autoRepair) emergency(s);

    if (s.step >= 20) {
      if (f.doctrine) {
        f.doctrineTimer += dt;
        if (f.doctrineTimer >= 15) {
          f.doctrineTimer = 0;
          if (f.mastery < 5) {
            f.mastery += 1;
            say(s, `Doctrine mastery ${f.mastery}/5. ${f.doctrine === 'norden' ? 'The Directorate is delighted and unsupervised.' : 'The Bureau is delighted and well-documented.'}`, 'good');
          }
        }
      } else if (s.policies.autoDoctrine && s.runSeconds > 3) {
        setDoctrine(s, 'voss');
      }
    }

    if (s.step >= 21) {
      s.signal.timer += dt;
      if (s.signal.fragments < 3 && s.signal.timer >= 20) gainFragment(s);
      if (s.signal.fragments >= 3 && !s.signal.choice) {
        s.signal.answerTimer += dt;
        if (s.signal.answerTimer > 75) {
          if (s.pc >= 12) answerSignal(s, 'reply');
          else answerSignal(s, 'silence');
        }
      }
    }

    if (s.step >= 19 && s.policies.autopilot) {
      f.revisionTimer = num(f.revisionTimer, 0) + dt;
      if (f.revisionTimer >= 3) {
        f.revisionTimer = 0;
        if (f.unrest > 18) fundRevisions(s);
      }
    }

    if (s.step >= 18) {
      f.repairTimer += dt;
      if (f.repairTimer >= 3 && s.policies.autoRepair) {
        f.repairTimer = 0;
        if (f.capital < 92 && s.ip > 6000) repairCapital(s, false);
      }
    }

    if (s.step >= 12) {
      f.blackout = Math.max(0, f.blackout - dt);
      const d = derive(s);

      if (s.step >= 12 && s.step < 23) {
        f.reinforceTimer += dt;
        if (f.reinforceTimer >= 12) {
          f.reinforceTimer = 0;
          const floor = 12 + 3 * s.phase;
          if (f.enemy < floor) f.enemy += Math.ceil(floor - f.enemy + 6);
        }
      }

      if (s.step >= 15) {
        f.volley = Math.min(1, f.volley + dt / 20);
        if (s.policies.autoFire && f.volley >= 1 && f.enemy > 0) fireVolley(s);
      }

      if (s.step >= 16) {
        if (s.policies.autoField) {
          if (!f.field && f.blackout <= 0 && f.heat < 82) {
            f.field = true;
            pushLog(s, 'The exponential field engages. The flagship becomes a rumour.');
          } else if (f.field && f.heat >= 96) {
            f.field = false;
            f.blackout = 6;
            f.heat = 35;
            say(s, 'The field is switched off to cool. Hysteresis takes the instruments for six seconds.', 'bad');
          }
        }
        if (f.field) f.heat = clamp(f.heat + dt * 0.6, 0, 100);
      }

      if (s.step >= 17) {
        f.adaptTimer += dt;
        if (f.adaptTimer >= 20) {
          f.adaptTimer = 0;
          if (f.enemy > 0) f.adapt = Math.min(12, f.adapt + 0.06 * (s.research[1].state === 3 ? 0.8 : 1));
        }
        f.analyzerTimer += dt;
        if (f.analyzer <= 0 && f.enemy > 3 && f.analyzerTimer >= 45) {
          f.analyzerTimer = 0;
          f.analyzer = 1;
          f.analyzerHp = 30 + f.enemy * 0.4;
          say(s, 'A Battle Analyzer has entered the corridor. Its support ship is unarmed and enormous. Target support to kill it.', 'bad');
        }
      }

      if (s.policies.autopilot && s.step >= 13) {
        if (s.step >= 17 && f.analyzer > 0) f.target = 'support';
        else if (s.step === 14 || (s.step >= 18 && f.capital < 70)) f.target = 'command';
        else f.target = 'screen';
        if (f.capital < 55) f.formation = 'escort';
        else if (f.analyzer > 0) f.formation = 'breakthrough';
        else f.formation = 'line';
      }

      f.sortieTimer += dt;
      if (f.sortieTimer >= 6 && f.enemy > 0 && f.ships >= 1) {
        f.sortieTimer = 0;
        sortie(s);
        if (f.capital <= 0 && !f.crisis) {
          f.crisis = true;
          f.capital = 0;
          say(s, 'CAPITAL INTEGRITY ZERO. The lights are going out district by district. All output cut until emergency powers are found.', 'bad');
        }
      }
    }
  }

  function fireVolley(s) {
    if (s.step < 15 || s.fleet.volley < 1) return { ok: false, msg: 'The volley is not charged.' };
    s.fleet.volley = 0;
    const kills = Math.min(Math.floor(s.fleet.enemy), 3 + Math.round(s.fleet.ships * 0.25), s.step >= 23 ? 45 : Infinity);
    s.fleet.enemy = Math.max(0, s.fleet.enemy - kills);
    s.totals.kills += kills;
    s.totals.volleys += 1;
    if (s.fleet.enemy > 0) s.fleet.enemy = Math.max(1, s.fleet.enemy);
    say(s, `Wonder weapon fired: ${kills} enemy hull${kills === 1 ? '' : 's'} removed from the forecast. The Directorate applauds its own invoice.`, 'good');
    return { ok: true, msg: `Volley: ${kills} destroyed.` };
  }

  function autoPub(s) {
    if (s.step < 22) return;
    const content = (window.WH && window.WH.content) || {};
    // Rooms first while the goal needs them, then improvements.
    const rooms = (content.ROOM_DEFS || []).filter((room) => !room.secret);
    const nextRoom = rooms.find((room) => !s.pub.rooms[room.id] && s.pints >= pubRoomCost(room.id) + 20);
    if (nextRoom && Object.keys(s.pub.rooms).length < 8) {
      buyRoom(s, nextRoom.id);
    }
    const staffItem = PUB_STAFF.filter((item) => !s.pub.staff[item.id]).sort((a, b) => a.cost - b.cost)[0];
    if (staffItem && s.pints > staffItem.cost * 1.6) buyPubItem(s, PUB_STAFF, staffItem.id);
    const amenity = PUB_AMENITIES.filter((item) => !s.pub.amenities[item.id]).sort((a, b) => a.cost - b.cost)[0];
    if (amenity && s.pints > amenity.cost * 1.8) buyPubItem(s, PUB_AMENITIES, amenity.id);
    const upgrade = PUB_UPGRADES
      .filter((item) => seUpgradeLevel(s, item.id) < item.max)
      .map((item) => ({ item, cost: Math.ceil(item.cost * Math.pow(1.75, seUpgradeLevel(s, item.id))) }))
      .filter((entry) => s.se > entry.cost * 1.4)
      .sort((a, b) => a.cost - b.cost)[0];
    if (upgrade) buyPubUpgrade(s, upgrade.item.id);
    const tier = PUB_TIERS.find((entry) => entry.tier === s.pub.tier + 1);
    if (tier && s.pints > tier.pints * 1.5 && s.se > tier.se * 1.5) buyPubTier(s);
  }

  function autoInvest(s, dt) {
    if (!s.policies.autopilot) return;
    s.autoTimer = num(s.autoTimer, 0) + num(dt, 0.1);
    if (s.autoTimer < 0.5) return;
    s.autoTimer = 0;
    autoPub(s);
    // Cruiser lines first, then generators, then upgrades.
    if (s.step >= 5) {
      const lineCost = Math.ceil(400 * Math.pow(1.85, s.lines));
      const keep = s.step >= 8 ? 900 : 150;
      if (s.ip > lineCost * 2 + keep && s.lines < 8) buyLine(s);
    }
    if (s.step >= 2) {
      let best = null;
      let bestValue = 0;
      GENS.forEach((gen) => {
        if (s.step < gen.step) return;
        const owned = num(s.gens[gen.id], 0);
        const cost = Math.ceil(gen.cost * Math.pow(gen.growth, owned));
        if (cost > s.ip * 0.7) return;
        const value = gen.base / cost;
        if (value > bestValue) { bestValue = value; best = { list: GENS, store: 'gens', id: gen.id }; }
      });
      LABS.forEach((lab) => {
        if (s.step < lab.step) return;
        const owned = num(s.labs[lab.id], 0);
        const cost = Math.ceil(lab.cost * Math.pow(lab.growth, owned));
        if (cost > s.ip * 0.5) return;
        const value = (lab.base * 6) / cost;
        if (value > bestValue) { bestValue = value; best = { list: LABS, store: 'labs', id: lab.id }; }
      });
      CONS.forEach((con) => {
        if (s.step < con.step) return;
        const owned = num(s.cons[con.id], 0);
        const cost = Math.ceil(con.cost * Math.pow(con.growth, owned));
        if (cost > s.ip * 0.45) return;
        const value = (con.base * 14) / cost;
        if (value > bestValue) { bestValue = value; best = { list: CONS, store: 'cons', id: con.id }; }
      });
      if (best) buyGenerator(s, best.list, best.store, best.id, 1);
    }
    // Upgrades: buy the cheapest useful one when there is headroom.
    if (s.step >= 3) {
      const available = UPGRADES.filter((def) => s.step >= def.step && upgradeLevel(s, def.id) < def.max)
        .map((def) => ({ def, cost: upgradeCost(def, upgradeLevel(s, def.id)) }))
        .filter((entry) => entry.cost <= s.ip * 0.5)
        .sort((a, b) => a.cost - b.cost);
      if (available.length) buyUpgrade(s, available[0].def.id);
    }
  }

  function stepDef(n) {
    return STEP_DEFS[Math.max(0, Math.min(STEP_DEFS.length - 1, n - 1))];
  }

  function stepInfo(s) {
    const def = stepDef(s.step);
    const d = derive(s);
    const goal = def.goal(s, d);
    const target = goal.target;
    let done;
    if (s.step === 2) done = s.gens.ore >= 4 && d.ipPerSec >= 6;
    else if (s.step === 6) done = s.fleet.reliability >= 85 && s.fleet.ships >= 8;
    else if (s.step === 7) done = s.fleet.chaos <= 15;
    else if (s.step === 10) done = s.totals.hearings >= 3 && s.hearings.length === 0;
    else if (s.step === 18) done = s.fleet.capital >= 85 && s.totals.sortieCount >= 12;
    else if (s.step === 19) done = s.fleet.unrest <= 15;
    else if (s.step === 22) done = s.totals.checks >= 3 && Object.keys(s.pub.rooms).length >= 5 && s.totals.se >= 150;
    else if (s.step === 21) done = Boolean(s.signal.choice);
    else if (s.step === 23) done = s.fleet.enemy <= 0;
    else if (s.step === 24) done = false;
    else if (target === 0) done = goal.value <= 0;
    else done = goal.value >= target;
    let progress;
    if (s.step === 7) progress = clamp((35 - s.fleet.chaos) / 20, 0, 1);
    else if (s.step === 19) progress = clamp((60 - s.fleet.unrest) / 45, 0, 1);
    else if (s.step === 21) progress = s.signal.choice ? 1 : clamp((s.signal.fragments / 3) * 0.75, 0, 0.75);
    else if (s.step === 23) progress = s.fleet.armadaStart ? clamp(1 - s.fleet.enemy / s.fleet.armadaStart, 0, 1) : 0;
    else if (s.step === 24) progress = 1;
    else progress = target > 0 ? clamp(goal.value / target, 0, 1) : done ? 1 : 0;
    return { def, goal, done, progress, d };
  }

  function enterStep(s, step) {
    if (step === 2) {
      say(s, 'STEP 02. The clerk’s machine is installed. Extractors now bank IP whether or not you are watching.', 'good');
    } else if (step === 5) {
      say(s, 'STEP 05. Vega’s yards are open. Cruiser lines turn IP into Standard Cruisers automatically.', 'good');
    } else if (step === 8) {
      s.sp += 30;
      say(s, 'STEP 08. Three specifications arrive on the Directorate’s paper. Authorise them when you can afford the science.', 'good');
    } else if (step === 12) {
      if (s.fleet.enemy <= 0) s.fleet.enemy = 24;
      if (s.fleet.ships < 4) s.fleet.ships = 4;
      say(s, 'STEP 12. The enemy enters the corridor: 24 hulls. Sorties now run themselves every six seconds.', 'bad');
    } else if (step === 15) {
      s.fleet.volley = 1;
      say(s, 'STEP 15. The wonder weapon is charged. You may fire it yourself, or set the Autopilot to fire when full.', 'good');
    } else if (step === 17) {
      s.fleet.analyzerTimer = 30;
      say(s, 'STEP 17. The enemy has begun to adapt. An analyzer will appear in the corridor and must be killed.', 'bad');
    } else if (step === 18) {
      s.fleet.capital = Math.min(s.fleet.capital, 66);
      say(s, 'STEP 18. A raid got through the picket. Capital integrity is at 66%; repairs are unglamorous and necessary.', 'bad');
    } else if (step === 19) {
      s.fleet.unrest = Math.max(s.fleet.unrest, 43);
      say(s, 'STEP 19. The admirals have read the casualty lists. Unrest is at ' + Math.round(s.fleet.unrest) + '% and rising. Fund revisions or win something.', 'bad');
    } else if (step === 21) {
      say(s, 'STEP 21. The Quiet Array is in range. Three listening passes, then the answer is yours.', 'info');
    } else if (step === 22) {
      s.pints = Math.max(s.pints, 40);
      s.se = Math.max(s.se, 10);
      say(s, 'STEP 22. The White Hart opens as an idle department: rooms, patrons, noise, Silence Energy and prototype checks.', 'good');
    } else if (step === 23) {
      s.fleet.enemy = Math.round(200 + 40 * s.phase + Math.min(700, s.fleet.ships * 0.6));
      s.fleet.armadaStart = s.fleet.enemy;
      s.fleet.capital = 100;
      s.fleet.crisis = false;
      s.mobilised = true;
      s.fleet.adapt = Math.min(12, s.fleet.adapt + 0.5);
      say(s, 'STEP 23. TOTAL MOBILISATION. All output doubled. The armada is in the corridor and it will not be replaced.', 'bad');
    } else if (step === 24) {
      s.mobilised = false;
      s.fleet.field = false;
      say(s, 'STEP 24. The corridor is won. There is exactly one order left, and it is a reckoning.', 'good');
    }
  }

  function checkStep(s) {
    let guard = 0;
    while (s.step < 24 && guard++ < 24) {
      const info = stepInfo(s);
      if (!info.done) break;
      s.step += 1;
      if (!Array.isArray(s.stepsSeen)) s.stepsSeen = [1];
      s.stepsSeen.push(s.step);
      say(s, `STEP ${String(s.step).padStart(2, '0')} / 24 — ${stepDef(s.step).title}. ${stepDef(s.step).unlock}`, 'step');
      enterStep(s, s.step);
    }
    if (s.step === 24 && !s.seen.reckoning) {
      s.seen.reckoning = true;
      pushLog(s, 'The Calculus has been asked for a new estimate. It has declined to give one, which is the closest it has ever come to applause.');
    }
  }

  function tickMoments(s, dt) {
    if (s.event.id && s.runSeconds > s.event.until) {
      const def = MOMENTS.find((moment) => moment.id === s.event.id);
      if (def && def.penalty) {
        const text = def.penalty(s);
        if (text) say(s, text, 'bad');
      }
      s.event.id = '';
      s.event.until = 0;
    }
    if (!s.event.id && s.runSeconds > 90 && Math.random() < dt / 140) {
      const def = MOMENTS[Math.floor(Math.random() * MOMENTS.length)];
      s.event.id = def.id;
      s.event.until = s.runSeconds + 40;
      say(s, `${def.title}. ${def.copy}`, 'event');
    }
  }

  function checkAchievements(s) {
    if (Math.floor(s.runSeconds) % 2 !== 0) return;
    ACHIEVEMENTS.forEach((achievement) => {
      if (s.achievements.includes(achievement.id)) return;
      if (achievement.test(s)) {
        s.achievements.push(achievement.id);
        say(s, `ACHIEVEMENT — ${achievement.name}. ${achievement.note}`, 'good');
      }
    });
  }

  function tick(s, delta, options = {}) {
    let dt = num(delta);
    if (!(dt > 0)) return;
    dt = clamp(dt, 0, options.offline ? 5 : 0.5);
    const offline = Boolean(options.offline);
    s.runSeconds += dt;
    if (!offline) s.playSeconds += dt;

    addTotals(s, derive(s), dt);
    tickWar(s, dt);
    tickResearch(s, dt);
    tickHearings(s, dt);
    tickPub(s, dt);
    tickMoments(s, dt);
    autoInvest(s, dt);
    checkAchievements(s);
    checkStep(s);

    if (!offline) s.lastSeen = Date.now();
    else s.lastSeen = Date.now();
  }

  /* -------------------------------------------------------------- actions */
  function act(s, action, id, amount) {
    switch (action) {
      case 'click': return clickAction(s);
      case 'study': return studyAction(s);
      case 'lobby': return lobbyAction(s);
      case 'buy': {
        const lists = { ore: ['gens'], foundry: ['gens'], press: ['gens'], magnet: ['gens'], rig: ['gens'], hauler: ['gens'], forge: ['gens'], pool: ['labs'], lab: ['labs'], bench: ['labs'], array: ['labs'], oracle: ['labs'], consul: ['cons'], whips: ['cons'], chancery: ['cons'], senate: ['cons'] };
        const kind = lists[id];
        if (!kind) return { ok: false, msg: 'Unknown machine.' };
        if (kind[0] === 'labs') return buyGenerator(s, LABS, 'labs', id, amount);
        if (kind[0] === 'cons') return buyGenerator(s, CONS, 'cons', id, amount);
        return buyGenerator(s, GENS, 'gens', id, amount);
      }
      case 'line': return buyLine(s);
      case 'upgrade': return buyUpgrade(s, id);
      case 'research': return authorize(s, PROJECTS[id]);
      case 'test': return startTest(s, PROJECTS[id]);
      case 'certify': return certify(s, PROJECTS[id]);
      case 'hearing': return resolveHearing(s, Number(id.index), id.choice);
      case 'focus':
        if (s.step < 5) return { ok: false, msg: 'The strategic map is not yet open.' };
        if (!['corridor', 'yards', 'vesper'].includes(id)) return { ok: false, msg: 'Unknown sector.' };
        if (s.fleet.focus === id) return { ok: true, msg: 'Already watching that sector.' };
        s.fleet.focus = id;
        say(s, id === 'corridor'
          ? 'Assessment: the Kepler corridor. Fire control gets the Calculus’s full attention; the fleet shoots straighter.'
          : id === 'yards'
            ? 'Assessment: the Vega yards. The Encyclopaedia Project is building hulls again, which is the only kind of bookkeeping that wins wars.'
            : 'Assessment: Vesper Reach. Six suns and a night that comes every 2,049 years. The Directorate reads faster when it is frightened.', 'good');
        return { ok: true, msg: `Watching the ${id}.` };
      case 'formation':
        if (s.step < 13) return { ok: false, msg: 'Formations are not yet open.' };
        if (!['line', 'escort', 'breakthrough'].includes(id)) return { ok: false, msg: 'Unknown formation.' };
        s.fleet.formation = id;
        return { ok: true, msg: `Formation: ${id}.` };
      case 'target':
        if (s.step < 14) return { ok: false, msg: 'Targeting priorities are not yet open.' };
        if (!['screen', 'support', 'command'].includes(id)) return { ok: false, msg: 'Unknown priority.' };
        s.fleet.target = id;
        return { ok: true, msg: `Targeting: ${id}.` };
      case 'volley': return fireVolley(s);
      case 'field':
        if (s.step < 16) return { ok: false, msg: 'The field is not installed.' };
        if (s.fleet.field) {
          s.fleet.field = false;
          s.fleet.blackout = 6;
          s.fleet.heat = clamp(s.fleet.heat, 0, 100);
          say(s, 'The exponential field is switched off. Hysteresis: six seconds of command blackout.', 'bad');
        } else if (s.fleet.blackout > 0) {
          return { ok: false, msg: 'The command link is still dark.' };
        } else {
          s.fleet.field = true;
          say(s, 'The exponential field engages. The flagship becomes a rumour with a hull.', 'good');
        }
        return { ok: true, msg: s.fleet.field ? 'Field engaged.' : 'Field disengaged.' };
      case 'repair': return repairCapital(s, Boolean(id));
      case 'revision': return fundRevisions(s);
      case 'overhaul': return overhaulFleet(s, true);
      case 'reform': return bureaucraticReform(s, true);
      case 'emergency': return emergency(s);
      case 'egg': {
        const egg = EGGS.find((entry) => entry.word === id);
        if (!egg) return { ok: false, msg: 'The pub does not answer to that.' };
        const key = `egg:${egg.word}`;
        if (s.seen[key]) return { ok: false, msg: 'It has already been said this phase.' };
        s.seen[key] = true;
        const result = egg.apply(s);
        say(s, `${egg.title.toUpperCase()} — ${egg.line} (${result})`, 'good');
        return { ok: true, msg: `${egg.title}: ${result}`, egg: egg.title };
      }
      case 'cede': return cedeOutpost(s);
      case 'doctrine': return setDoctrine(s, id);
      case 'listen': return listen(s, true);
      case 'answer': return answerSignal(s, id);
      case 'policy':
        if (!(id in s.policies)) return { ok: false, msg: 'Unknown policy.' };
        if (typeof s.policies[id] === 'boolean') s.policies[id] = !s.policies[id];
        else if (id === 'autoHearing') s.policies.autoHearing = s.policies.autoHearing === 'revise' ? 'endorse' : 'revise';
        return { ok: true, msg: `${id}: ${s.policies[id]}` };
      case 'pub-room': return buyRoom(s, id);
      case 'pub-staff': return buyPubItem(s, PUB_STAFF, id);
      case 'pub-amenity': return buyPubItem(s, PUB_AMENITIES, id);
      case 'pub-upgrade': return buyPubUpgrade(s, id);
      case 'pub-tier': return buyPubTier(s);
      case 'pub-vent': return ventPub(s, true);
      case 'pub-check': return checkPub(s);
      case 'prestige-upgrade': return buyPrestigeUpgrade(s, id);
      case 'prestige': {
        const result = doPrestige(s);
        if (result.ok) return result;
        return result;
      }
      case 'dismiss-event': {
        const def = MOMENTS.find((moment) => moment.id === s.event.id);
        if (!def) return { ok: false, msg: 'Nothing to attend to.' };
        const text = def.effect(s, derive(s));
        s.event.id = '';
        s.event.until = 0;
        say(s, text, 'good');
        checkAchievements(s);
        checkStep(s);
        return { ok: true, msg: text };
      }
      default:
        return { ok: false, msg: 'Unknown order.' };
    }
  }

  /* ------------------------------------------------------- save and load */
  function serialize(s) {
    const copy = JSON.parse(JSON.stringify(s));
    copy.news = [];
    copy.offlineReport = null;
    copy.lastSeen = Date.now();
    return JSON.stringify(copy);
  }

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.version !== VERSION) return null;
    const base = newGame();
    const merged = { ...base, ...raw };
    const count = (value) => Math.max(0, Math.floor(Number.isFinite(Number(value)) ? Number(value) : 0));
    const clampNumber = (value, low, high, fallback = 0) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
    };
    merged.gens = { ...base.gens, ...(raw.gens || {}) };
    merged.labs = { ...base.labs, ...(raw.labs || {}) };
    merged.cons = { ...base.cons, ...(raw.cons || {}) };
    Object.keys(merged.gens).forEach((id) => { merged.gens[id] = count(merged.gens[id]); });
    Object.keys(merged.labs).forEach((id) => { merged.labs[id] = count(merged.labs[id]); });
    Object.keys(merged.cons).forEach((id) => { merged.cons[id] = count(merged.cons[id]); });
    Object.keys(merged.up).forEach((id) => { merged.up[id] = count(merged.up[id]); });
    merged.up = { ...(raw.up || {}) };
    merged.totals = { ...base.totals, ...(raw.totals || {}) };
    merged.fleet = { ...base.fleet, ...(raw.fleet || {}) };
    merged.fleet.ships = Math.max(0, clampNumber(merged.fleet.ships, 0, 1e12));
    merged.fleet.enemy = Math.max(0, clampNumber(merged.fleet.enemy, 0, 1e9));
    merged.fleet.reliability = clampNumber(merged.fleet.reliability, 0, 100, 92);
    merged.fleet.chaos = clampNumber(merged.fleet.chaos, 0, 100, 20);
    merged.fleet.capital = clampNumber(merged.fleet.capital, 0, 100, 100);
    merged.fleet.unrest = clampNumber(merged.fleet.unrest, 0, 100, 5);
    merged.fleet.heat = clampNumber(merged.fleet.heat, 0, 100, 0);
    merged.fleet.volley = clampNumber(merged.fleet.volley, 0, 1, 0);
    merged.fleet.mastery = clampNumber(merged.fleet.mastery, 0, 5, 0);
    merged.fleet.adapt = clampNumber(merged.fleet.adapt, 0, 12, 0);
    merged.fleet.armadaStart = clampNumber(merged.fleet.armadaStart, 0, 1e9, 0);
    if (!['corridor', 'yards', 'vesper'].includes(merged.fleet.focus)) merged.fleet.focus = 'corridor';
    merged.lines = Math.max(0, Math.min(8, Math.floor(num(raw.lines))));
    merged.research = Array.isArray(raw.research) && raw.research.length === PROJECTS.length
      ? raw.research.map((rec, i) => ({ ...base.research[i], ...rec }))
      : base.research;
    merged.signal = { ...base.signal, ...(raw.signal || {}) };
    merged.pub = { ...base.pub, ...(raw.pub || {}) };
    merged.pub.rooms = { general: true, ...(raw.pub?.rooms || {}) };
    merged.pub.upgrades = { ...(raw.pub?.upgrades || {}) };
    merged.pub.staff = { ...(raw.pub?.staff || {}) };
    merged.pub.amenities = { ...(raw.pub?.amenities || {}) };
    merged.policies = { ...base.policies, ...(raw.policies || {}) };
    merged.click = { ...base.click, ...(raw.click || {}) };
    merged.event = { ...base.event, ...(raw.event || {}) };
    merged.hearings = Array.isArray(raw.hearings) ? raw.hearings.slice(0, 20) : [];
    merged.achievements = Array.isArray(raw.achievements) ? raw.achievements.slice(0, 40) : [];
    merged.log = Array.isArray(raw.log) ? raw.log.slice(0, 80) : [];
    merged.news = [];
    merged.step = clamp(Math.floor(num(raw.step, 1)), 1, 24);
    merged.phase = Math.max(1, Math.floor(num(raw.phase, 1)));
    merged.forecast = Math.max(0, num(raw.forecast));
    merged.ip = Math.max(0, num(raw.ip));
    merged.sp = Math.max(0, num(raw.sp));
    merged.pc = Math.max(0, num(raw.pc));
    merged.se = Math.max(0, num(raw.se));
    merged.pints = Math.max(0, num(raw.pints));
    merged.runSeconds = Math.max(0, num(raw.runSeconds));
    merged.stepsSeen = Array.isArray(raw.stepsSeen) ? raw.stepsSeen.filter((n) => Number.isInteger(n) && n >= 1 && n <= 24).slice(-24) : [merged.step];
    merged.playSeconds = Math.max(0, num(raw.playSeconds));
    merged.prestiges = Math.max(0, Math.floor(num(raw.prestiges)));
    return merged;
  }

  function load() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SAVE_KEY) : null;
      if (!raw) return null;
      const state = sanitize(JSON.parse(raw));
      if (!state) return null;
      const elapsed = Math.max(0, (Date.now() - Number(state.lastSeen || Date.now())) / 1000);
      const offlineLevel = num(state.forecastUp.offline, 0);
      const cap = OFFLINE_BASE_HOURS * 3600 + offlineLevel * 4 * 3600;
      const seconds = Math.min(elapsed, cap);
      if (seconds > 30) {
        const efficiency = Math.min(0.9, 0.6 + 0.15 * offlineLevel);
        const before = {
          ip: state.totals.ip, sp: state.totals.sp, kills: state.totals.kills,
          checks: state.totals.checks, step: state.step,
        };
        let remaining = seconds;
        while (remaining > 0) {
          const chunk = Math.min(1, remaining);
          tick(state, chunk * efficiency, { offline: true });
          remaining -= chunk;
        }
        state.news = [];
        state.offlineReport = {
          seconds,
          efficiency,
          ip: state.totals.ip - before.ip,
          sp: state.totals.sp - before.sp,
          kills: state.totals.kills - before.kills,
          checks: state.totals.checks - before.checks,
          steps: state.step - before.step,
        };
      }
      state.lastSeen = Date.now();
      return state;
    } catch (_) {
      return null;
    }
  }

  function save(s) {
    try {
      if (typeof localStorage === 'undefined') return false;
      localStorage.setItem(SAVE_KEY, serialize(s));
      return true;
    } catch (_) {
      return false;
    }
  }

  function reset() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVE_KEY);
    } catch (_) { /* ignore */ }
  }

  window.ASIdle = {
    VERSION, SAVE_KEY, STEP_COUNT, STEP_DEFS, GENS, LABS, CONS, PROJECTS, UPGRADES,
    PRESTIGE_UPGRADES, PUB_STAFF, PUB_AMENITIES, PUB_UPGRADES, PUB_TIERS, WEATHERS,
    MOMENTS, ACHIEVEMENTS, EGGS, OFFLINE_BASE_HOURS, LEGACY_KEYS,
    newGame, tick, act, derive, stepInfo, stepDef, checkStep, enterStep, prestigeGain, prestigeBreakdown, ending,
    prestigeUpgradeCost: (s, def) => def.cost[Math.min(num(s.forecastUp[def.id], 0), def.cost.length - 1)],
    forecastMult, globalMult, upgradeCost, upgradeLevel, bulkCost, maxAffordable,
    upgradeBy, pubRoomCost, pubItemEffect, seUpgradeLevel, pubEffect,
    save, load, serialize, sanitize, reset, pushLog, fmt, fmtInt, fmtRate, pct, clock,
    formationOff, formationLoss, formationCapital, targetOff, overhaulFleet, bureaucraticReform,
  };
})();
