/* The White Hart — every scrap of content the pub owns: rooms, regulars, gossip, gags and secrets. */
(() => {
  'use strict';
  const WH = window.WH;

  /* ---------------------------------------------------------------- rooms */
  const ROOM_DEFS = [
    {
      id: 'general', name: 'General Bar', short: 'GENERAL', seats: 4, cost: 0,
      special: '+1 Pint / sec', style: 'general',
      blurb: 'The public bar. Sawdust, brass, and a brassier argument about the war.',
      palette: { wall: 0x3b4a3d, wallTop: 0x4d6150, floor: 0x453425, accent: 0xc8a25e, light: 0xf0c069 }
    },
    {
      id: 'saloon', name: 'Saloon Bar', short: 'SALOON', seats: 3, cost: 50,
      special: '+2 Scoops / sec', style: 'saloon',
      blurb: 'A smarter bar, for people who have read about the other one.',
      palette: { wall: 0x4a3f33, wallTop: 0x5a4a35, floor: 0x4a3524, accent: 0xd0a862, light: 0xf3c778 }
    },
    {
      id: 'snug', name: 'The Snug', short: 'SNUG', seats: 2, cost: 120,
      special: 'Scientists only · +3 Research / sec', style: 'snug', accepts: ['scientist'],
      blurb: 'Two seats, one blackboard, and a rule about tweed that nobody will explain.',
      palette: { wall: 0x374a4d, wallTop: 0x43605f, floor: 0x3d3122, accent: 0xbfae6a, light: 0xdfe08f }
    },
    {
      id: 'kitchen', name: 'The Kitchen', short: 'KITCHEN', seats: 0, cost: 200,
      special: 'Hot food · +2 Loyalty / sec · −10% noise everywhere', style: 'kitchen',
      blurb: 'Somewhere behind the bar, a person is doing all of the actual work.',
      palette: { wall: 0x4d4034, wallTop: 0x61513c, floor: 0x4a3a28, accent: 0xe0a85a, light: 0xffc46a }
    },
    {
      id: 'cellar', name: 'The Cellar', short: 'CELLAR', seats: 0, cost: 260,
      special: 'Silencer housing · half blast radius', style: 'cellar',
      blurb: 'Barrels, a very thick ceiling, and the apparatus itself, which hums.',
      palette: { wall: 0x2f3229, wallTop: 0x3c4034, floor: 0x33291d, accent: 0xb0864e, light: 0xd8b06a }
    },
    {
      id: 'backroom', name: 'Back Room', short: 'BACK ROOM', seats: 6, cost: 350,
      special: 'Events only · +5 Loyalty / sec', style: 'backroom',
      blurb: 'Bookable for wakes, weddings and one very loud darts team.',
      palette: { wall: 0x4b312c, wallTop: 0x5f3f36, floor: 0x462f22, accent: 0xd39a5c, light: 0xffb968 }
    },
    {
      id: 'upstairs', name: 'Upstairs', short: 'UPSTAIRS', seats: 8, cost: 500,
      special: 'Writers & editors · +4 Manuscripts / sec', style: 'upstairs', accepts: ['writer', 'editor'],
      blurb: 'Books from floor to ceiling, and a ban on the word “synergy”.',
      palette: { wall: 0x3a3b4f, wallTop: 0x474863, floor: 0x403023, accent: 0xc0a4d0, light: 0xe6cfa0 }
    },
    {
      id: 'roof', name: 'Roof Terrace', short: 'ROOF TERRACE', seats: 10, cost: 800,
      special: 'Summer only · +10 Pints / sec', style: 'roof',
      blurb: 'A terrace above Fleet Street, where the smoke goes to think.',
      palette: { wall: 0x33554a, wallTop: 0x3e6a5a, floor: 0x3d4636, accent: 0x8fd0b4, light: 0xbfe6c8 }
    },
    {
      id: 'green', name: 'The Green Room', short: 'GREEN ROOM', seats: 4, cost: 1200,
      special: 'Performers only · +4 Scoops / sec', style: 'green', accepts: ['choir', 'kendell'],
      secret: true, blurb: 'Not on any plan. The landlord denies it twice and then unlocks it.',
      palette: { wall: 0x2f4a3a, wallTop: 0x3a5b45, floor: 0x33422c, accent: 0x9ad07a, light: 0xd6f0a0 }
    }
  ];

  const ROOM_ADJACENCY = {
    general: ['saloon'], saloon: ['general', 'snug'], snug: ['saloon', 'kitchen'], kitchen: ['snug', 'cellar'],
    cellar: ['kitchen', 'backroom'], backroom: ['cellar', 'upstairs'], upstairs: ['backroom', 'roof'],
    roof: ['upstairs', 'green'], green: ['roof']
  };

  /* ------------------------------------------------------------- silencer */
  const SILENCER_TIERS = [
    { tier: 1, name: 'Prototype', capacity: 100, absorption: 5, vent: 0, cost: {}, note: 'Held together with optimism and one very good clamp.' },
    { tier: 2, name: 'Improved', capacity: 250, absorption: 10, vent: 2, cost: { research: 150 }, note: 'The valves are new. The humming is not.' },
    { tier: 3, name: 'Linearized', capacity: 500, absorption: 20, vent: 5, cost: { research: 400 }, note: 'Fenton says the word “linear” until everybody stops asking.' },
    { tier: 4, name: 'Purvis Modified', capacity: 1000, absorption: 40, vent: 15, cost: { research: 1000, manuscripts: 5 }, note: 'One note from Purvis, one afternoon from Fenton, one more rumour about the cellar.' },
    { tier: 5, name: 'Perfected', capacity: 2500, absorption: 80, vent: 50, cost: { research: 1800, scoops: 10, loyalty: 5 }, note: 'Perfect. In the sense that it will now do exactly what it was built to do.' },
    { tier: 6, name: 'Kendell-Proof', capacity: 6000, absorption: 160, vent: 120, cost: { research: 4200, manuscripts: 25, scoops: 30 }, note: 'Built after the opera. The opera has not been told.' }
  ];

  const SE_UPGRADES = [
    { id: 'filters', name: 'Better Filters', icon: '▤', cost: 50, max: 4, effect: '+50 SE capacity', body: 'A little more room for one very specific mistake.' },
    { id: 'microphones', name: 'Extra Microphone', icon: '⌕', cost: 75, max: 3, effect: '+5 dB/sec absorption', body: 'It hears things the first microphone was not told about.' },
    { id: 'absorber', name: 'Resonance Absorber', icon: '◍', cost: 120, max: 3, effect: '+10% absorption', body: 'A brass bowl that disagrees with noise on principle.' },
    { id: 'venting', name: 'Venting System', icon: '↧', cost: 100, max: 4, effect: '+2 SE/sec vent rate', body: 'The pipe leads to a strictly unmarked destination.' },
    { id: 'resonator', name: 'Tuning Resonator', icon: '♫', cost: 90, max: 2, effect: '+1.5 SE/sec vent rate', body: 'Hummed into shape by a man who will not say which note.' },
    { id: 'casing', name: 'Reinforced Casing', icon: '▣', cost: 150, max: 1, effect: '−25% explosion damage', body: 'Does not reduce the sound of the explosion.' },
    { id: 'dump', name: 'Emergency Dump', icon: '⌁', cost: 200, max: 1, effect: 'Vent 50% instantly', body: 'Once per session means once per session. Ask the inspector.' }
  ];

  /* -------------------------------------------------------------- patrons */
  const PATRONS = {
    journalist: {
      label: 'Journalist', weight: 20, noise: 15, leavesAt: 80, coat: 0x9b7542, hat: 0x44382a, prop: 'paper',
      production: { scoops: 2, seconds: 60 },
      names: ['Mavis Quill', 'Len Button', 'Iris Ledger', 'Percy Ink', 'Dora Deadline'],
      quips: ['“Off the record?”', '“That’s a headline.”', '“And you quote me…”', '“Who owns this pub?”']
    },
    writer: {
      label: 'Writer', weight: 22, noise: 10, leavesAt: 70, coat: 0x526d58, hat: 0x29362d, prop: 'pipe',
      production: { manuscripts: 1, seconds: 120 },
      names: ['Agnes Bell', 'Martin Page', 'E. C. Wren', 'Daphne Blot', 'Cyril Draft'],
      quips: ['“Chapter nine is fine.”', '“It’s a metaphor.”', '“Don’t mind me.”', '“Still thinking.”']
    },
    editor: {
      label: 'Editor', weight: 9, noise: 5, leavesAt: 60, coat: 0x773f37, hat: 0x372823, prop: 'spectacles',
      production: { scoops: 1, manuscripts: 1, seconds: 180 },
      names: ['Clive Redpen', 'Vera Proof', 'Nigel Copy', 'Edith Comma', 'Gordon Margin'],
      quips: ['“Cut it.”', '“Tighter.”', '“Who is the reader?”', '“Try it again.”']
    },
    scientist: {
      label: 'Scientist', weight: 15, noise: 3, leavesAt: 50, coat: 0x829087, hat: 0x36433d, prop: 'flask',
      production: { research: 2, seconds: 60 },
      names: ['Dr. Ada Vale', 'Prof. Bell', 'Dr. L. Finch', 'Mr. Purcell', 'Dr. N. Oates'],
      quips: ['“Fascinating.”', '“Not a pub, then?”', '“The metre says—”', '“Hold this.”']
    },
    regular: {
      label: 'Regular', weight: 18, noise: 12, leavesAt: Infinity, coat: 0x3c5660, hat: 0x28363a, prop: 'mug',
      production: { loyalty: 1, seconds: 60 },
      names: ['Mrs. Pottle', 'Old Tom', 'Maisie Pike', 'Arthur Bell', 'Nellie Crumb', 'Wilf Anvil'],
      quips: ['“Same again.”', '“I remember when…”', '“Weather’s turning.”', '“Mind the gap.”']
    },
    tourist: {
      label: 'Tourist', weight: 8, noise: 22, leavesAt: 95, coat: 0xa8703f, hat: 0xc9a45c, prop: 'map',
      production: { pints: 1, seconds: 45 },
      names: ['Mr. Ohio', 'The Kowalskis', 'Sven', 'A Coach Party', 'Two Backpacks'],
      quips: ['“Is it always this quiet?”', '“Say something British!”', '“We saw the Tower!”', '“Is that the Thames?”']
    },
    choir: {
      label: 'Choir Member', weight: 6, noise: 45, leavesAt: 100, coat: 0x6d4a7a, hat: 0x3a2a42, prop: 'music',
      production: { loyalty: 2, seconds: 60 }, avoid: ['snug', 'upstairs', 'cellar', 'kitchen'],
      names: ['Alto Three', 'A Tenor', 'The Whole Bass Section', 'Miss Treble'],
      quips: ['♪ laaaaaa ♪', '“Shall we take it from the top?”', '“It’s in Latin.”', '“Louder, then.”']
    },
    kendell: {
      label: 'Kendell', weight: 2, noise: 60, leavesAt: 120, coat: 0x8c2f3c, hat: 0x40161d, prop: 'music',
      production: { loyalty: 3, scoops: 1, seconds: 90 }, avoid: ['snug', 'cellar'],
      names: ['Kendell'],
      quips: ['“I WROTE THAT!”', '“You call that a cadence?”', '“HIGHER.”', '“I shall sing anyway.”']
    },
    inspector: {
      label: 'Health Inspector', weight: 3, noise: 4, leavesAt: 40, coat: 0x4a4f57, hat: 0x22262b, prop: 'clipboard',
      production: null, names: ['The Inspector', 'Mr. Fuss', 'Mrs. Torrance'],
      quips: ['“And this is…?”', '“I’ll measure that.”', '“Noted.”', '“We’ll be in touch.”']
    },
    burt: {
      label: 'Burt Huggins', weight: 5, noise: 40, leavesAt: Infinity, coat: 0x954939, hat: 0x33241c, prop: 'moustache',
      production: null, names: ['Burt Huggins'],
      quips: ['“I CAN STILL HEAR MYSELF THINK!”', '“RIGHT. LISTEN.”', '“HURRAH!”', '“AND ANOTHER THING!”']
    },
    harry: {
      label: 'Harry Purvis', weight: 3, noise: 2, leavesAt: Infinity, coat: 0x4b5552, hat: 0x272e2e, prop: 'shadow',
      production: null, names: ['Harry Purvis'],
      quips: ['“A word, old boy.”', '“Energy, you see.”', '“The cellar.”', '“Ask Fenton.”']
    },
    john: {
      label: 'John Christopher', weight: 2, noise: 8, leavesAt: Infinity, coat: 0x6b725a, hat: 0x30392b, prop: 'book',
      production: null, names: ['John Christopher'],
      quips: ['“I only write it down.”', '“Purvis again.”', '“One hears things.”', '“May I sit here?”']
    },
    ghost: {
      label: 'Fenton’s Ghost', weight: 1, noise: 0, leavesAt: Infinity, coat: 0x7f8fa8, hat: 0x3d4757, prop: 'ghost',
      production: { manuscripts: 1, seconds: 90 }, avoid: ['snug', 'upstairs', 'roof'],
      names: ['Fenton’s Ghost', 'The Gentleman in Grey'],
      quips: ['“Still running, is it?”', '“Do not touch the valves.”', '“I did warn him.”', '“………”']
    }
  };

  /* ---------------------------------------------------------------- staff */
  const STAFF_DEFS = [
    { id: 'barmaid', name: 'Barmaid', icon: '♙', cost: { pints: 100 }, effect: 'Auto-serves one patron every 5 seconds. Has opinions about the regulars.' },
    { id: 'cellarMaster', name: 'Cellar Master', icon: '⌁', cost: { pints: 200 }, effect: '+1 SE / sec to the safe vent rate. He calls the machine “she”.' },
    { id: 'physicist', name: 'Physicist', icon: '⚗', cost: { research: 300 }, effect: '+10% Silencer absorption. Insists this is not a pub.' },
    { id: 'journalistFriend', name: 'Journalist Friend', icon: '✎', cost: { scoops: 5 }, effect: '+1 patron seat in every room. The seats are imaginary; the patrons do not mind.' },
    { id: 'editor', name: 'Editor', icon: '¶', cost: { manuscripts: 10 }, effect: '+1 Manuscript / min. Will not discuss the headline.' },
    { id: 'bouncer', name: 'Bouncer', icon: '⛨', cost: { pints: 250 }, effect: 'Burt Huggins is redirected to the pavement. +1 Loyalty / min and a calmer bar.' },
    { id: 'pianist', name: 'Pianist', icon: '♫', cost: { pints: 120 }, effect: '+8 dB in the General Bar and +8 Loyalty / min. He knows one song. It is a long one.' },
    { id: 'apprentice', name: 'Apprentice', icon: '✚', cost: { research: 200 }, effect: 'Scientists work 25% faster. He has read the manual twice, which is once more than anybody.' },
    { id: 'catMinder', name: 'Cat Minder', icon: '❀', cost: { loyalty: 30 }, effect: '+1 Loyalty / sec and a small animal formally on the payroll.' }
  ];

  /* ------------------------------------------------------------ amenities */
  const AMENITY_DEFS = [
    { id: 'jukebox', name: 'Fix the Jukebox', icon: '♫', cost: { pints: 50 }, effect: '+10 dB in the General Bar and +5 Loyalty / min. It remains inexplicably silent.', room: 'general' },
    { id: 'dartboard', name: 'Dartboard', icon: '◎', cost: { pints: 75 }, effect: '+5 dB in the General Bar and +5 Loyalty / min. The wall has accepted its fate.', room: 'general' },
    { id: 'betterBeer', name: 'Better Beer', icon: '◉', cost: { pints: 150 }, effect: '+50% Pint income from the bar and from every grateful customer.' },
    { id: 'thamesView', name: 'Thames View', icon: '⌂', cost: { pints: 200 }, effect: '+2 Scientists / min. The window is technically in the toilet.' },
    { id: 'soundproofing', name: 'Soundproofing', icon: '▤', cost: { pints: 300 }, effect: '−20% noise in one chosen room. Requires an available room.' },
    { id: 'fireplace', name: 'Light the Fire', icon: '✷', cost: { pints: 90 }, effect: '+8 Loyalty / min. The fire is mostly decorative; the warmth is mostly enthusiasm.' },
    { id: 'pubCat', name: 'Adopt a Pub Cat', icon: '❀', cost: { pints: 60 }, effect: '+5 Loyalty / min and a cat. The cat does nothing else, which it considers a full day.' },
    { id: 'dartsTeam', name: 'Darts Team', icon: '⌖', cost: { pints: 110 }, effect: '+10 dB in the Back Room and +3 Scoops / min. They travel in a van.' },
    { id: 'neonSign', name: 'Neon Sign', icon: '✦', cost: { pints: 180 }, effect: '+15% patron arrivals. It says SILENCE PLEASE and buzzes at its own jokes.' },
    { id: 'cheeseBoard', name: 'Cheese Board', icon: '❖', cost: { pints: 130 }, effect: '−1 dB in every room. Nobody argues with cheese.' },
    { id: 'gramophone', name: 'Gramophone', icon: '◉', cost: { pints: 220 }, effect: '+12 dB in the Saloon and +10 Loyalty / min. One record, played thoughtfully.' }
  ];

  /* ---------------------------------------------------------------- gags */
  /* Props wander across the pub and can be poked. Moments are one-off flourishes. */
  const GAGS = [
    { id: 'cat', kind: 'prop', weight: 16, minWeek: 1, prop: 'cat', label: 'the pub cat', credit: 'It walks across the bar exactly as if the bar belongs to it.' },
    { id: 'mouse', kind: 'prop', weight: 10, minWeek: 1, prop: 'mouse', label: 'a cellar mouse', credit: 'The mouse has read the notes. The mouse is unimpressed.' },
    { id: 'ufo', kind: 'prop', weight: 5, minWeek: 2, prop: 'ufo', label: 'something in the sky', credit: 'Over Fleet Street, a light decides not to explain itself.' },
    { id: 'teapot', kind: 'prop', weight: 5, minWeek: 2, prop: 'teapot', label: 'a flying teapot', credit: 'Russell’s teapot, orbiting. It declines to be drawn into the argument.' },
    { id: 'ghost', kind: 'prop', weight: 6, minWeek: 3, prop: 'ghost', label: 'a former proprietor', credit: 'The gentleman in grey is checking the valves. Again.' },
    { id: 'pigeon', kind: 'prop', weight: 8, minWeek: 1, prop: 'pigeon', label: 'a pigeon', credit: 'A pigeon comes in through the window and behaves as though this were arranged.' },
    { id: 'cab', kind: 'prop', weight: 6, minWeek: 1, prop: 'cab', label: 'a hansom cab', credit: 'Outside, a cab goes by. Somebody in it is shouting about thermodynamics.' },
    { id: 'sneeze', kind: 'moment', weight: 10, minWeek: 1 },
    { id: 'glass', kind: 'moment', weight: 8, minWeek: 1 },
    { id: 'piano', kind: 'moment', weight: 7, minWeek: 1 },
    { id: 'chalk', kind: 'moment', weight: 9, minWeek: 1 },
    { id: 'crate', kind: 'moment', weight: 7, minWeek: 1 },
    { id: 'busker', kind: 'moment', weight: 6, minWeek: 1 },
    { id: 'thunder', kind: 'moment', weight: 7, minWeek: 1 },
    { id: 'spill', kind: 'moment', weight: 6, minWeek: 1 },
    { id: 'choirPractice', kind: 'moment', weight: 5, minWeek: 2 },
    { id: 'wrongPipe', kind: 'moment', weight: 5, minWeek: 2 },
    { id: 'laugh', kind: 'moment', weight: 6, minWeek: 1 }
  ];

  const PROP_TAPS = {
    cat: [
      'The cat allows this. +2 Loyalty.', 'The cat permits a second stroke. +2 Loyalty.',
      'The cat has reconsidered. +1 Loyalty.', 'You have used up the cat. It leaves pointedly.'
    ],
    mouse: [
      'The mouse looks at you. +1 Research.', 'The mouse has read Fenton’s notes. +1 Research.',
      'The mouse files a complaint. +1 Scoop.', 'The mouse leaves. You feel judged.'
    ],
    ufo: [
      'The light tilts, politely. +1 Research.', 'The light takes a photograph of the pub. +1 Scoop.',
      'The light considers abducting Burt. It decides against it.', 'The light leaves. Burt is disappointed.'
    ],
    teapot: [
      'The teapot orbits once more. +1 Research.', 'It is, arguably, a vessel. +1 Research.',
      'Bertrand would be insufferable about this. +1 Manuscript.', 'The teapot tips itself. Nothing comes out.'
    ],
    ghost: [
      'The ghost adjusts a valve. +1 Manuscript.', 'The ghost says: “Do not touch that one.” +1 Manuscript.',
      'The ghost apologises for the humming. +1 Research.', 'The ghost fades, whistling.'
    ],
    pigeon: [
      'The pigeon nods. +1 Loyalty.', 'The pigeon has opinions about the beer. +1 Loyalty.',
      'The pigeon leaves through the window it came in. Eventually.', 'The pigeon is now a regular. +2 Loyalty.'
    ],
    cab: [
      'The cab waves. +1 Loyalty.', 'Somebody throws a hat out of the cab. +1 Loyalty.',
      'The cab is going the wrong way down Fleet Street. +1 Scoop.', 'The cab is gone. The horse had notes.'
    ]
  };

  const CHALK_LINES = [
    'TONIGHT: QUIZ. PRIZE: A PINT. QUESTIONS: HARD.',
    'MIND THE SILENCER. IT MINDS YOU BACK.',
    'NO SINGING AFTER 11. (BURT EXCEPTED. BURT IS A SPECIAL CASE.)',
    'THE CHEESE BOARD IS NOT A SHARED BOARD.',
    'ASK PURVIS ABOUT THE CELLAR. THEN DON’T.',
    'PLEASE DO NOT FEED THE APPARATUS.',
    'TODAY’S SOUP: SILENCE.',
    'IF THE TUBES SMOKE, TELL SOMEONE QUIETLY.',
    'WEDNESDAY. AGAIN.',
    'THE LANDLORD IS IN A MEETING ABOUT THE HUMMING.',
    'FREE CRISP WITH EVERY SECOND OPINION.',
    'WE DO NOT SERVE TIME TRAVELLERS BEFORE 8.'
  ];

  const WEATHER = [
    { id: 'clear', name: 'CLEAR', tint: 0x1b251e, note: 'A clear night over Fleet Street. The river is behaving.' },
    { id: 'drizzle', name: 'DRIZZLE', tint: 0x161f22, note: 'Drizzle. London’s default setting.' },
    { id: 'rain', name: 'RAIN', tint: 0x141d20, note: 'Rain. The windows have begun to compose letters.' },
    { id: 'fog', name: 'FOG', tint: 0x1e2320, note: 'Fog. The pub has acquired a soft outline.' },
    { id: 'snow', name: 'SNOW', tint: 0x232833, note: 'Snow on the terrace. The roof room is optimistic.' },
    { id: 'storm', name: 'STORM', tint: 0x14181c, note: 'A storm. The apparatus enjoys thunder enormously.' }
  ];

  /* ------------------------------------------------------------- easter eggs */
  const EGG_WORDS = {
    purvis: { id: 'word-purvis', title: 'Harry Purvis', line: '“You can’t destroy energy, old boy. You can only move it somewhere else.”', reward: { research: 3 } },
    fenton: { id: 'word-fenton', title: 'Something in the cellar', line: 'A valve turns by itself. Somewhere below you, a man clears his throat.', reward: { manuscripts: 1 }, ghost: true },
    silence: { id: 'word-silence', title: 'A hush', line: 'Everybody shushes at once. For ten seconds the pub is a photograph.', shush: 10 },
    hush: { id: 'word-hush', title: 'A hush', line: 'The regulars shush, then look around to see who started it.', shush: 8 },
    tea: { id: 'word-tea', title: 'A pot of tea', line: 'A pot arrives. It is, technically, a vessel in orbit.', reward: { loyalty: 2 }, prop: 'teapot' },
    pint: { id: 'word-pint', title: 'One for the road', line: 'Somebody puts a pint in front of you. Nobody will admit to it.', reward: { pints: 25 } },
    42: { id: 'word-42', title: 'The answer', line: 'The answer is 42. The question, apparently, was about the cellar.', reward: { research: 42 } },
    kendell: { id: 'word-kendell', title: 'Kendell is cross', line: 'Kendell is cross. Somewhere, a soprano clears her throat.', opera: true },
    wibble: { id: 'word-wibble', title: 'Wibble', line: 'The landlord refuses to explain. “Wibble,” he says, “is a technical term.”', reward: { pints: 5 } },
    cheese: { id: 'word-cheese', title: 'The cheese board', line: 'A wedge of cheese appears. Noise drops by sheer authority.', reward: { loyalty: 3 } },
    cat: { id: 'word-cat', title: 'The cat', line: 'The cat arrives from an unspecified department.', prop: 'cat' },
    wednesday: { id: 'word-wednesday', title: 'It is Wednesday', line: 'It is always Wednesday here. The clock has made peace with this.', reward: { loyalty: 5 } },
    moom: { id: 'word-moom', title: 'Moom', line: '“Moom,” says the apparatus, thoughtfully.', reward: { research: 1 } }
  };

  /* ---------------------------------------------------------- achievements */
  const ACHIEVEMENTS = [
    { id: 'first-pint', icon: '🍺', name: 'One For The Road', desc: 'Serve your first pint.' },
    { id: 'round-ten', icon: '🍻', name: 'A Round, Then', desc: 'Serve 10 patrons in one session.' },
    { id: 'hundred-pints', icon: '💷', name: 'Taken At The Bar', desc: 'Earn 500 Pints in one session.' },
    { id: 'three-rooms', icon: '🚪', name: 'An Expanding Pub', desc: 'Open three rooms.' },
    { id: 'every-room', icon: '🏛', name: 'The Full Floor Plan', desc: 'Open every room on the plan.' },
    { id: 'first-boom', icon: '💥', name: 'Well, That Happened', desc: 'Experience your first Silencer explosion.' },
    { id: 'survivor', icon: '🕯', name: 'Still Open', desc: 'Survive five Wednesdays in a row.' },
    { id: 'legend', icon: '★', name: 'The White Hart Is Legendary', desc: 'Complete the pub. All of it.' },
    { id: 'perfect', icon: '✦', name: 'Not One Incident', desc: 'Win without a single explosion.' },
    { id: 'tier5', icon: '⚙', name: 'Perfected', desc: 'Research the Tier V Silencer.' },
    { id: 'tier6', icon: '⚛', name: 'Kendell-Proof', desc: 'Research the Tier VI Silencer. Somebody had to.' },
    { id: 'burt-served', icon: '🤫', name: 'HURRAH!', desc: 'Serve Burt Huggins without losing the room.' },
    { id: 'ghost-served', icon: '👻', name: 'Paid In Exact Change', desc: 'Serve a patron who was not, strictly, alive.' },
    { id: 'cat-person', icon: '🐈', name: 'Chosen By The Cat', desc: 'Stroke the pub cat three times.' },
    { id: 'eggs-three', icon: '🥚', name: 'A Nose For Secrets', desc: 'Find three Easter eggs.' },
    { id: 'eggs-all', icon: '🗝', name: 'The Whole Basket', desc: 'Find every Easter egg on the premises.' },
    { id: 'konami', icon: '🎮', name: 'Fenton’s Private Stock', desc: 'Enter the old code. Fenton kept it on a label inside the casing.' },
    { id: 'gags-ten', icon: '🎭', name: 'Anything Could Happen', desc: 'Witness ten pub gags.' },
    { id: 'opera', icon: '🎼', name: 'Silence!', desc: 'Survive an Opera Night.' },
    { id: 'powercut', icon: '🕯', name: 'Candles, Somewhere', desc: 'Survive a power cut with every zone still off.' },
    { id: 'hundred-db', icon: '📢', name: 'One Hundred Decibels', desc: 'Push a room to 100 dB and keep the doors open.' },
    { id: 'venter', icon: '↧', name: 'Carefully Released', desc: 'Vent 1,000 SE in total.' },
    { id: 'staff-five', icon: '🎩', name: 'A Full Payroll', desc: 'Employ five members of staff.' },
    { id: 'amenities-five', icon: '🪑', name: 'All Mod Cons', desc: 'Install five amenities.' },
    { id: 'loyal', icon: '♥', name: 'Beloved', desc: 'Hold 90 reputation while at least twenty patrons are in.' },
    { id: 'silence-fifty', icon: '🔇', name: 'The Quietest Room In London', desc: 'Run five Silencer zones at once.' },
    { id: 'sneeze', icon: '🤧', name: 'Bless You', hidden: true, desc: 'Be in the room when somebody sneezes.' },
    { id: 'time', icon: '⏳', name: 'The Clock Is A Suggestion', hidden: true, desc: 'Reach Wednesday 25.' }
  ];

  /* --------------------------------------------------------------- flavour */
  const NEWS_QUOTES = [
    '“I couldn’t hear myself think,” says one patron. “I couldn’t hear anything,” says another.',
    'The landlord says the humming is “almost certainly supposed to do that.”',
    'A visiting physicist has requested a quieter room. The pub has taken this as a compliment.',
    'Regulars report that the silence is getting louder. The landlord has declined to comment.',
    'The White Hart remains open, despite several compelling arguments to the contrary.',
    'Asked whether the machine is safe, Fenton said: “It is safe in the sense that I am still here.”',
    'The inspector has measured the quiet. The inspector has asked to be measured next.'
  ];

  const PURVIS_TIPS = [
    'You can’t destroy energy, old boy. You can only move it somewhere else. And somewhere else is usually where you least want it.',
    'A quiet room is not an empty room. It is merely a room whose complaints have been carefully filed.',
    'The meter is not a suggestion. It only looks like one because Fenton chose a friendly font.',
    'If the tubes begin to smoke, do try not to fan them. The air has enough to do already.',
    'A cellar is a splendid place to put anything you would rather not hear from again.',
    'One pint for the customer, one scoop for the paper, and absolutely no promises to the inspector.',
    'Listen: the machine is not loud. The machine is merely storing other people’s opinions about loudness.',
    'There is no such thing as a free silence. There is, however, a very reasonable one on Wednesdays.'
  ];

  const DIARY_PAGES = [
    { id: 'opening', title: 'Fenton’s notebook · Page I', unlock: 'At the opening', copy: 'The machine does not remove sound. It takes it, folds it into a neat little parcel, and leaves it somewhere behind the wall. I have asked where. Fenton has asked me to stop asking.' },
    { id: 'demo', title: 'Fenton’s notebook · Page II', unlock: 'Improved Silencer', copy: 'He demonstrated the improved valves after closing. The pipes flickered like a gas mantle and every glass in the room became suddenly fascinating.' },
    { id: 'explosion', title: 'Fenton’s notebook · Page III', unlock: 'The demonstration', copy: 'Fenton called it a controlled demonstration. The insurance man called it a second visit. Neither of them would explain the humming.' },
    { id: 'secret', title: 'Purvis’s folded note', unlock: 'Purvis Modified', copy: 'You can’t destroy energy, old boy. You can only move it somewhere else. And somewhere else is usually where you least want it.' },
    { id: 'ghost', title: 'A receipt with no handwriting', unlock: 'The Perfected Silencer', copy: 'One round, paid in full. No signature. The barman swears the gentleman wore a rather old-fashioned waistcoat.' },
    { id: 'cellar', title: 'A note pinned in the cellar', unlock: 'The Cellar', copy: 'IF THE DIAL PASSES NINETY, DO NOT LOOK DIRECTLY AT THE TUBES. Signed: somebody who has.' },
    { id: 'kendell', title: 'An opera score, annotated', unlock: 'Kendell’s Revenge', copy: 'The margins are entirely in Kendell’s hand. Most of the notes are simply the word “LOUDER”.' },
    { id: 'kitchen', title: 'A note from the kitchen', unlock: 'The Kitchen', copy: 'Whoever is taking the glasses: there are no more glasses. Whoever is taking the noise: carry on.' },
    { id: 'green', title: 'A key, with a green label', unlock: 'The Green Room', copy: 'The label reads GREEN ROOM. There is no green room on the plan. There is now.' }
  ];

  const CLIPPING_HEADLINES = [
    ['SILENCE! LOCAL PUB’S MIRACLE DEVICE STUNS OPERA CROWD', 'The soprano has been asked to stop. The soprano has not stopped.'],
    ['“IT IS NOT A PUB,” SAYS MAN IN PUB', 'The physicist was asked to leave. He asked whether leaving counts as a result.'],
    ['FENTON SILENCER EXPLODES: “WE TOLD YOU SO,” SAY PHYSICISTS', 'The physicists had written it down. Several times. On the wall.'],
    ['THE QUIETEST ROOM IN LONDON IS, APPARENTLY, BOOKED', 'The Back Room is fully reserved. Nobody will say by whom.'],
    ['A CAT HAS BEEN APPOINTED TO THE PAYROLL', 'The cat attended no interviews. The cat is respected.'],
    ['PUB MEASURES SOUND. SOUND MEASURES PUB.', 'The apparatus and the building have reached an understanding.'],
    ['MAN SHOUTS FOR FORTY MINUTES. PUB REMAINS OPEN.', 'Burt Huggins was unavailable for comment, being busy.']
  ];

  const GAG_COPY = {
    sneeze: ['Somebody sneezes. The apparatus records it at length.', 'A sneeze. Every glass in the room takes note.'],
    glass: ['A glass meets the floor. The floor wins, noisily.', 'Somebody drops a pint. Somebody else says “that’s the third one”.'],
    piano: ['The piano plays itself. Nobody investigates. This is the White Hart.', 'Somebody sits at the piano. It is not a somebody.'],
    chalk: ['The chalkboard has been changed again. Nobody saw who did it.', 'The chalkboard now reads something else entirely.'],
    crate: ['A crate arrives. It is not the crate anybody ordered.', 'A delivery. The invoice is in a language the cellar does not speak.'],
    busker: ['A busker outside has found the one note the apparatus cannot ignore.', 'Outside, a man is singing. Inside, a machine is taking notes.'],
    thunder: ['Thunder. The apparatus very much enjoys thunder.', 'A storm rolls over Fleet Street and the tubes brighten.'],
    spill: ['A pint goes over. The floor has seen worse and says nothing.', 'Spillage. Somebody mops it with a newspaper.'],
    choirPractice: ['The choir practises. The choir is practising in the wrong key.', 'Somebody starts a scale. Everybody joins in, unwisely.'],
    wrongPipe: ['A pipe knocks, somewhere behind the wall. It knocks back.', 'The plumbing has begun to express an opinion.'],
    laugh: ['Somebody laughs, and it sets everybody off. The apparatus stores all of it.', 'A laugh goes round the room like a round of drinks.']
  };

  const EVENT_DEFS = [
    { id: 'inspector', weight: 5 },
    { id: 'author', weight: 3 },
    { id: 'powercut', weight: 2 },
    { id: 'purvis', weight: 5 },
    { id: 'rival', weight: 1 },
    { id: 'prank', weight: 4 },
    { id: 'delivery', weight: 4 },
    { id: 'quiz', weight: 4 },
    { id: 'karaoke', weight: 3 },
    { id: 'darts', weight: 3 },
    { id: 'dog', weight: 2 },
    { id: 'gasleak', weight: 2 },
    { id: 'silentdisco', weight: 2 },
    { id: 'timeTravel', weight: 1 },
    { id: 'birthday', weight: 2 },
    { id: 'quiet', weight: 12 }
  ];

  const TOAST_GAGS = [
    'Somebody has put a hat on the fire extinguisher. Nobody will claim it.',
    'The landlord has been asked whether the humming is a problem. The landlord has asked what humming.',
    'A glass has been placed carefully in the middle of the ceiling. It stays there.',
    'The apparatus has been heard to say “moom”. The physicists are pretending this is normal.',
    'A visitor asks whether the cellar is haunted. The cellar answers first.'
  ];

  WH.content = {
    ROOM_DEFS, ROOM_ADJACENCY, SILENCER_TIERS, SE_UPGRADES, PATRONS, STAFF_DEFS, AMENITY_DEFS,
    GAGS, PROP_TAPS, CHALK_LINES, WEATHER, EGG_WORDS, ACHIEVEMENTS, NEWS_QUOTES, PURVIS_TIPS,
    DIARY_PAGES, CLIPPING_HEADLINES, GAG_COPY, EVENT_DEFS, TOAST_GAGS
  };
})();
