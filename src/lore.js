/* Absolute Superiority — the background bible.
   Every name, place and machine in this campaign is drawn from the themes of
   Isaac Asimov's stories: the mathematics of falling empires, machines bound by
   directives they cannot escape, one question asked for ten thousand years, and
   the night that arrives once every two thousand years. The text here is
   original — an homage, not an adaptation. No passage is copied. */
(() => {
  "use strict";

  const TITLE = "ABSOLUTE SUPERIORITY";
  const SUBTITLE = "THE BURDEN OF GENIUS · THE LONG FORECAST";
  const CHAPTER = "THE LONG FORECAST";

  /* ---------------------------------------------------------------- voices */
  const VOICES = {
    norden: "PROF. A. NORDEN, DIRECTORATE OF SPECULATIVE ARMAMENTS",
    voss: "CHIEF ENGINEER VOSS, BUREAU OF INTERCHANGEABLE PARTS",
    vale: "DR. IMANI VALE, ROBO-PSYCHOLOGY / NIGHT SHIFT",
    admiral: "ADMIRAL KEST, ORION MARCHES FLEET",
    calculus: "THE CALCULUS, IMPERIAL FORECAST OFFICE",
    machine: "THE QUIET ARRAY / UNREGISTERED",
  };

  /* ------------------------------------------------- the three directives */
  const DIRECTIVES = [
    {
      n: "I",
      text: "A machine may not, by action or by inaction, allow a crew to be destroyed.",
      game:
        "Every weapon you field is judged against this. Uncertified prototypes violate it, and the Scientific Council files a report the moment they are used.",
    },
    {
      n: "II",
      text: "A machine must obey the specifications given to it, except where they conflict with the first directive.",
      game:
        "Research authorizes a specification. Two field tests prove what the specification omitted. Safeguards make the two compatible.",
    },
    {
      n: "III",
      text: "A machine must preserve its own calibration, except where that conflicts with the first or second.",
      game:
        "Self-preservation is why the exponential field goes into hysteresis when it is switched off — and why deactivating it mid-fight costs six seconds of command.",
    },
  ];

  /* -------------------------------------------------------------- prologue */
  const PROLOGUE = [
    {
      kicker: "CHAPTER ZERO",
      title: "Twelve thousand years of order",
      body: [
        "The Empire has stood so long that its fall became a branch of mathematics. The Forecast Office runs the Calculus on ten thousand worlds and returns a number: how long the lights stay on.",
        "For the Orion Marches the answer has always been comfortable. Until this cycle.",
      ],
      sign: VOICES.calculus,
    },
    {
      kicker: "THE FORECAST FAILS HERE",
      title: "A commander with no file",
      body: [
        "Beyond the Kepler corridor an enemy fleet moves in a pattern the Calculus cannot hold. Their commander appears in no census, no tax roll, no casualty list. Where the model expects him, the model is silent.",
        "You have been given the Marches, eight cruisers, and twelve campaign cycles. Hold the corridor, or the frontier behind it stops being ours.",
      ],
      sign: VOICES.admiral,
    },
    {
      kicker: "THE DIRECTORATE",
      title: "Three directives, and a man who finds them inconvenient",
      body: [
        "Norden Deep builds the future on paper. Every machine it ships carries three directives, and the first of them is a promise about crews.",
        "Professor Norden regards the directives as a drafting error. His prototypes are brilliant, and they are not safe. When one of them is used, the Scientific Council will demand to know who decided — and the admirals will be listening.",
      ],
      sign: VOICES.norden,
    },
    {
      kicker: "THE QUIET ARRAY",
      title: "Something out there is still asking",
      body: [
        "Past the mapped lanes an unregistered object repeats a narrowband pulse every 101 seconds. It is not a beacon. Analysis suggests it is a question, asked by a machine that has outlived everyone who built it, and asked for longer than the Empire has existed.",
        "The Forecast Office has no opinion on it. The Forecast Office does not model questions.",
      ],
      sign: VOICES.vale,
    },
    {
      kicker: "YOUR ORDERS",
      title: "The loop, in one breath",
      body: [
        "ASSESS the board. BUILD cruisers. RESEARCH a prototype, test it twice, then certify it. ENGAGE once per cycle at the Tactical Bridge. LISTEN to the array. ADVANCE the cycle and take what it costs.",
        "Destroy the enemy before cycle 24. Lose if capital integrity, fleet reliability or political capital reaches zero — or if the admirals' unrest reaches a hundred.",
      ],
      sign: VOICES.admiral,
    },
  ];

  /* --------------------------------------------------------------- dossier */
  const INSPIRATIONS = [
    {
      name: "The Calculus of decline",
      from: "a mathematics that predicts the fall of empires",
      here: "Twelve campaign cycles is a forecast, not a rule. The enemy reinforcement schedule is the model being wrong on a timetable.",
    },
    {
      name: "A commander the model cannot hold",
      from: "the mutant that broke the plan",
      here: "The enemy learns. After your first engagement its doctrine changes, and the analyzer becomes a priority target in every fight that follows.",
    },
    {
      name: "Three directives",
      from: "machines that cannot disobey their own ethics",
      here: "Unsafe weapons exist because nobody wrote the safeguard into the specification. Using one files a failure report you must rule on.",
    },
    {
      name: "A machine that argues with its makers",
      from: "the reasoning unit that decided it was the master",
      here: "The analyzer's adaptation reports read like a machine explaining, politely, that it is in charge now.",
    },
    {
      name: "A machine that lies to be kind",
      from: "the mind-reading unit that spared everyone's feelings",
      here: "Norden's claimed statistical deviation of 0.000001% is not a measurement. It is a courtesy.",
    },
    {
      name: "One question, asked for ten thousand years",
      from: "the long conversation with a very patient computer",
      here: "The Quiet Array. Three fragments decode it; the answer you send — or refuse to send — decides how the war ends.",
    },
    {
      name: "The night that comes once every 2,049 years",
      from: "six suns, and the evening that ends a civilisation",
      here: "Vesper Reach, the enemy's home sky. Their fleet fights harder when the dark is due.",
    },
    {
      name: "An encyclopaedia as a holding action",
      from: "the project that was never really about the books",
      here: "Vega's shipyards. Standard cruisers are the least interesting thing you can build, and the only thing that wins.",
    },
  ];

  /* ---------------------------------------------------------------- glossary */
  const GLOSSARY = [
    ["IP", "Industrial Points. Ships, safeguards, standardization. +40 every cycle."],
    ["SP", "Scientific Points. Research, field tests, listening passes. +15 with the Directorate staffed."],
    ["PC", "Political Capital. Authority to overrule scientists and admirals. Zero ends the campaign."],
    ["RELIABILITY", "Whether your fleet works as drawn. Below 50% engagements go badly."],
    ["CHAOS", "Specification drift. At 40% or more it eats reliability every cycle."],
    ["UNREST", "The admirals' patience. Endorsing excuses raises it. At 100% you are relieved of duty."],
  ];

  window.ASLore = {
    TITLE,
    SUBTITLE,
    CHAPTER,
    VOICES,
    DIRECTIVES,
    PROLOGUE,
    INSPIRATIONS,
    GLOSSARY,
  };
})();
