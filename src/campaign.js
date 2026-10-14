/* Absolute Superiority: standalone, offline campaign shell. No build step. */
(() => {
  "use strict";
  const Combat = window.ASCombat;
  const Directorate = window.ASDirectorate;
  const KEY = Directorate.KEY;
  const fresh = () => ({
    version: 1,
    campaignId: Directorate.identity(),
    pubChecks: [0, 0, 0],
    pubReports: [],
    turn: 12,
    ip: 240,
    sp: 85,
    pc: 60,
    reliability: 87,
    chaos: 24,
    ships: 8,
    enemy: 24,
    capital: 100,
    halt: 0,
    queue: 2,
    progress: 1,
    norden: true,
    theorists: false,
    tech: [0, 0, 0],
    tests: [0, 0, 0],
    suspended: [false, false, false],
    sortieTurn: 0,
    unrest: 0,
    hearings: [],
    adapted: false,
    lastBattle: null,
    victories: 0,
    certifiedUsed: false,
    ceded: false,
    signal: { fragments: 0, choice: "", eggFound: false, starFound: false },
    gagsSeen: [],
    ending: "",
    logs: [
      "A narrowband pulse arrived from an uncharted object beyond the Kepler corridor. It repeats every 101 seconds.",
      "Forward reconnaissance reports enemy movement near the Kepler corridor.",
      "Standard Cruiser production is on schedule. Two hulls await completion.",
    ],
    battle: null,
  });
  function validArchive(state) {
    const base = fresh();
    // Older v1 saves inherit new fields, but malformed values must not reach renderers.
    for (const [key, value] of Object.entries(base)) {
      if (
        typeof value === "number" &&
        (!Number.isFinite(state[key]) || Math.abs(state[key]) > 100000)
      )
        return false;
      if (typeof value === "boolean" && typeof state[key] !== "boolean")
        return false;
      if (typeof value === "string" && typeof state[key] !== "string")
        return false;
    }
    const triple = (value, predicate) =>
      Array.isArray(value) && value.length === 3 && value.every(predicate);
    if (
      !triple(state.tech, (n) => [0, 1, 2].includes(n)) ||
      !triple(state.tests, (n) => [0, 1, 2].includes(n)) ||
      !triple(state.suspended, (n) => typeof n === "boolean")
    )
      return false;
    const textList = (value) =>
      Array.isArray(value) &&
      value.length <= 100 &&
      value.every((n) => typeof n === "string" && n.length < 5000);
    if (
      !textList(state.logs) ||
      !Array.isArray(state.hearings) ||
      state.hearings.length > 100
    )
      return false;
    if (
      !state.hearings.every(
        (h) =>
          h &&
          [0, 1, 2].includes(h.id) &&
          Number.isFinite(h.turn) &&
          typeof h.text === "string",
      )
    )
      return false;
    if (
      state.lastBattle &&
      (!Number.isFinite(state.lastBattle.turn) ||
        !Number.isFinite(state.lastBattle.losses) ||
        !Number.isFinite(state.lastBattle.destroyed))
    )
      return false;
    if (
      !triple(state.pubChecks, (n) => Number.isInteger(n) && n >= 0) ||
      !Array.isArray(state.pubReports)
    )
      return false;
    if (
      !state.signal ||
      !Number.isInteger(state.signal.fragments) ||
      state.signal.fragments < 0 ||
      state.signal.fragments > 3 ||
      !["", "reply", "silence"].includes(state.signal.choice) ||
      typeof state.signal.eggFound !== "boolean" ||
      typeof state.signal.starFound !== "boolean" ||
      !Array.isArray(state.gagsSeen) ||
      state.gagsSeen.length > 12 ||
      !state.gagsSeen.every((turn) => Number.isInteger(turn) && turn >= 12 && turn <= 24)
    )
      return false;
    const b = state.battle;
    if (
      b &&
      (![
        "ours",
        "foes",
        "initialShips",
        "count",
        "tick",
        "shield",
        "blackout",
      ].every((k) => Number.isFinite(b[k]) && b[k] >= 0 && b[k] <= 100000) ||
        !Array.isArray(b.used) ||
        !b.used.every((n) => [0, 1, 2].includes(n)) ||
        !textList(b.signals))
    )
      return false;
    if (
      b?.analyzer &&
      (!Number.isFinite(b.analyzer.hp) || !Number.isFinite(b.analyzer.age))
    )
      return false;
    return (
      state.ships >= 0 &&
      state.enemy >= 0 &&
      state.turn >= 12 &&
      state.turn <= 24
    );
  }
  const escapeHTML = (text) =>
    String(text).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  let s = fresh(),
    view = location.hash === "#research" ? "research" : location.hash === "#signal" ? "signal" : location.hash === "#white-hart" ? "white-hart" : "headquarters",
    selected = location.hash === "#signal" ? 8 : location.hash === "#white-hart" ? 7 : 2,
    toastTimer,
    secretBuffer = "";
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (
      stored?.version === 1 &&
      Array.isArray(stored.tech) &&
      Array.isArray(stored.logs)
    ) {
      const candidate = {
        ...s,
        ...stored,
        battle: stored.battle ? Combat.restore(stored.battle) : null,
      };
      if (validArchive(candidate)) {
        s = candidate;
        if (s.battle) s.sortieTurn = s.turn;
      }
    }
  } catch (e) {
    /* Corrupt or unavailable archive: start safely. */
  }
  const $ = (id) => document.getElementById(id);
  const techs = Directorate.PROJECTS;
  const systems = [
    {
      name: "SOL INVICTA",
      x: 130,
      y: 195,
      kind: "friendly",
      sub: "Capital system · Home Fleet",
    },
    {
      name: "VEGA",
      x: 245,
      y: 90,
      kind: "friendly",
      sub: "Industrial hub · +40 IP / turn",
    },
    {
      name: "KEPLER VII",
      x: 340,
      y: 180,
      kind: "contested",
      sub: "Frontier system · Enemy contact imminent",
    },
    {
      name: "TAU CETI",
      x: 260,
      y: 285,
      kind: "friendly",
      sub: "Forward base · Prototype storage",
    },
    {
      name: "RESEARCH DIRECTORATE",
      x: 405,
      y: 65,
      kind: "friendly",
      sub: "Norden Deep · All White Hart scientists clock in here",
    },
    {
      name: "ASHEN REACH",
      x: 515,
      y: 235,
      kind: "enemy",
      sub: "Hostile territory · 14 enemy vessels",
    },
    {
      name: "PROXIMA",
      x: 598,
      y: 120,
      kind: "enemy",
      sub: "Enemy staging ground · 10 vessels",
    },
    {
      name: "THE WHITE HART",
      x: 470,
      y: 154,
      kind: "friendly",
      sub: "Fleet Street, Norden Deep · Directorate local & prototype test annex",
    },
    {
      name: "THE QUIET ARRAY",
      x: 88,
      y: 90,
      kind: "anomaly",
      sub: "Unregistered object · Narrowband transmission · No known crew",
    },
  ];
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
      $("save-status").textContent = "CAMPAIGN ARCHIVED";
    } catch (e) {
      $("save-status").textContent = "ARCHIVE UNAVAILABLE";
    }
  }
  function toast(text) {
    const notice = $("command-toast");
    notice.textContent = text;
    notice.classList.remove("is-gag");
    notice.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => notice.classList.remove("visible", "is-gag"), 4200);
  }
  function log(text) {
    s.logs.unshift(text);
    s.logs = s.logs.slice(0, 35);
  }
  const CAMPAIGN_GAGS = [
    { turn: 13, reward: ["sp", 8], text: "The array answers with a kettle whistle. The signal-analysis unit has classified this as ‘probably a colleague.’ +8 SP." },
    { turn: 17, reward: ["ip", 10], text: "A supply drone returns carrying its own customs form. Procurement stamps it ‘mission accomplished.’ +10 IP." },
    { turn: 21, reward: ["pc", 3], text: "The admiral rotates the star chart 180 degrees so the enemy looks smaller. The scale is now classified. +3 PC." },
  ];
  function campaignGag() {
    const gag = CAMPAIGN_GAGS.find((entry) => entry.turn === s.turn && !s.gagsSeen.includes(entry.turn));
    if (!gag) return;
    s.gagsSeen.push(gag.turn);
    s[gag.reward[0]] += gag.reward[1];
    if (gag.reward[0] === "pc") s.pc = Math.min(100, s.pc);
    log(`FIELD GAG: ${gag.text}`);
    toast(gag.text);
    $("command-toast").classList.add("is-gag");
  }
  function findSignalEgg(which) {
    const key = which === "star" ? "starFound" : "eggFound";
    if (s.signal[key]) return false;
    s.signal[key] = true;
    const reward = which === "star" ? "+10 IP" : "+8 SP";
    if (which === "star") s.ip += 10;
    else s.sp += 8;
    log(which === "star"
      ? "Easter egg: a pinprick on the listener's glass was a navigation mark, left by the night crew. The coordinates point to a forgotten tea locker. +10 IP."
      : "Easter egg: the observatory's old password was LIGHTHOUSE. A margin note reads: ‘If the sky ever answers, leave a lamp on.’ +8 SP.");
    toast(`Easter egg found · ${reward} · The archive has gained a new note.`);
    return true;
  }
  function modal(title, copy) {
    if (s.battle) {
      s.battle.paused = true;
      save();
    }
    $("dialog-title").textContent = title;
    $("dialog-copy").innerHTML = copy;
    $("briefing").showModal();
  }
  function spend(ip, sp = 0, pc = 0) {
    if (s.ip < ip || s.sp < sp || s.pc < pc) {
      toast("Requisition denied. Insufficient resources.");
      return false;
    }
    s.ip -= ip;
    s.sp -= sp;
    s.pc -= pc;
    return true;
  }
  function checkEnd() {
    if (s.ending) return;
    const victory = s.enemy <= 0 && !s.hearings.length;
    if (s.capital <= 0 || s.reliability <= 0 || s.pc <= 0 || s.unrest >= 100)
      s.ending = "The final letter";
    else if (victory) {
      s.ending = s.signal.choice === "reply"
        ? "A greeting in the dark"
        : s.certifiedUsed && s.norden
          ? "A working theory"
          : !s.norden
            ? "Reliability outweighs genius"
            : "An expensive peace";
    } else if (s.turn >= 24) s.ending = "The capital falls";
    if (!s.ending) return;
    log(s.ending);
    const won = victory && s.capital > 0 && s.reliability > 0 && s.pc > 0 && s.unrest < 100;
    const endingCopy = won
      ? s.signal.choice === "reply"
        ? "The last hostile ship leaves the corridor. Far beyond the reach of any fleet, the old transmitter answers with a new pulse. It is not a weapon, nor an order. It is a welcome—and the beginning of a much larger map."
        : s.signal.choice === "silence"
          ? "The enemy retreats from a capital they can no longer locate. The array remains quiet. Somewhere beyond the charted dark, a patient intelligence keeps listening."
          : s.norden
            ? "The enemy has surrendered. For once, the fleet returned with results instead of justifications."
            : "The shipyards never stopped. The torpedoes worked. That was enough."
      : s.unrest >= 100
        ? "The Military High Command has relieved you of duty. The admirals refuse to lose another crew to a scientifically impeccable excuse."
        : "To the tribunal: our specifications were flawless. Our fleet was not. The capital has fallen silent.";
    modal(s.ending, `<p>${endingCopy}</p><p>Your campaign is archived. Start a new campaign from Dispatches.</p>`);
  }
  function resources() {
    const rows = [
      ["▥ INDUSTRIAL POINTS", s.ip, "IP", `+40 / turn`, ""],
      [
        "⚛ SCIENTIFIC POINTS",
        s.sp,
        "SP",
        `+${s.norden ? (s.theorists ? 30 : 15) : 5} / turn`,
        "",
      ],
      ["⚑ POLITICAL CAPITAL", s.pc, "PC", "COMMAND AUTHORITY", ""],
      [
        "◇ FLEET RELIABILITY",
        s.reliability,
        "%",
        s.reliability >= 70 ? "OPERATIONAL" : "DEGRADING",
        s.reliability < 50 ? "warn" : "",
      ],
      [
        "≋ BUREAUCRATIC CHAOS",
        s.chaos,
        "%",
        s.chaos < 40 ? "MANAGEABLE" : "SPECIFICATION DRIFT",
        "warn",
      ],
    ];
    $("resources").innerHTML = rows
      .map(
        (r) =>
          `<div class="resource ${r[4]}"><div class="label">${r[0]}</div><div class="value">${r[1]} <small>${r[2]}</small></div><div class="rate">${r[3]}</div></div>`,
      )
      .join("");
    $("cycle").innerHTML =
      `TURN ${String(s.turn).padStart(3, "0")} <small>/ 024</small>`;
    $("end-turn").disabled = !!s.ending || !!s.battle || !!s.hearings.length;
  }
  function map() {
    const stars = Array.from({ length: 118 }, (_, i) => {
      const x = (i * 137 + 23) % 690;
      const y = (i * 83 + 15) % 350;
      const radius = i % 9 === 0 ? 1.25 : i % 3 === 0 ? 0.9 : 0.55;
      const delay = -((i * 17) % 55) / 10;
      return `<circle class="map-star ${i % 9 === 0 ? "bright" : ""}" cx="${x}" cy="${y}" r="${radius}" style="--star-delay:${delay}s"/>`;
    }).join("");
    const routes = [
      "M130 195L245 90L340 180L260 285L130 195",
      "M130 195L340 180L405 65L245 90",
      "M405 65L470 154L515 235L598 120L405 65",
      "M88 90L130 195L245 90L405 65",
      "M88 90L130 195L260 285",
    ];
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
          ${routes.map((route, i) => `<path class="route-line ${i >= 2 ? "hostile-route" : ""} ${i >= 3 ? "signal-route" : ""}" d="${route}"/>`).join("")}
          <text x="540" y="315" class="hostile-space-label">HOSTILE SPACE</text>
          <text x="31" y="326" class="map-coordinate-label">GALACTIC PLANE  /  014.8 LY</text>
        </g>
        ${systems.map((original, i) => {
          const n = systemInfo(i);
          const color = n.kind === "enemy" ? "#e98b75" : n.kind === "contested" ? "#e3c574" : n.kind === "anomaly" ? "#7de6ef" : "#9ed3b2";
          const isSignal = i === 8;
          const sublabel = i === 0 ? "CAPITAL" : i === 2 ? (s.victories ? "SECURED" : "⚠ CONTESTED") : i === 1 ? "SHIPYARDS" : i === 4 ? "NORDEN DEEP" : i === 7 ? "PUB / TEST ANNEX" : isSignal ? (s.signal.fragments === 3 ? "PATTERN RESOLVED" : "UNKNOWN CARRIER") : "";
          return `<g class="map-node ${isSignal ? "map-node-anomaly" : ""} ${i === selected ? "selected" : ""}" data-system="${i}" role="button" tabindex="0" aria-label="${n.name}: ${n.sub}">
            <circle class="node-orbit" cx="${n.x}" cy="${n.y}" r="${i === selected ? 25 : 17}" style="--node-color:${color}"/>
            ${isSignal ? `<circle class="anomaly-ring anomaly-ring-a" cx="${n.x}" cy="${n.y}" r="11"/><circle class="anomaly-ring anomaly-ring-b" cx="${n.x}" cy="${n.y}" r="16"/><circle class="anomaly-core" cx="${n.x}" cy="${n.y}" r="7"/>` : `<circle class="node-core" cx="${n.x}" cy="${n.y}" r="${i === 0 || i === 7 ? 5 : 3.8}" style="--node-color:${color}"/>`}
            ${i === selected ? `<circle class="node-selection" cx="${n.x}" cy="${n.y}" r="30"/>` : ""}
            <text x="${n.x}" y="${n.y + 38}" class="node-label" text-anchor="middle" style="--node-color:${color}">${n.name}</text>
            <text x="${n.x}" y="${n.y + 50}" class="node-sublabel" text-anchor="middle">${sublabel}</text>
          </g>`;
        }).join("")}
        <g transform="translate(196 183)" class="fleet-marker"><path d="M0 0L-6 12L0 9L6 12Z"/><path d="M-13 10L-17 18L-13 16L-9 18Z"/><path d="M13 10L9 18L13 16L17 18Z"/></g>
      </svg>
      <div class="map-coordinate">X 034.77 / Y 092.18 <span>·</span> NAV SOLUTION LOCKED</div>
    </div>
    <div class="map-legend"><span><i></i> IMPERIAL SYSTEM</span><span><i class="contested"></i> CONTESTED</span><span><i class="enemy"></i> ENEMY CONTROL</span><span><i class="anomaly"></i> UNIDENTIFIED SIGNAL</span></div>`;
  }
  const ship = `<svg viewBox="0 0 120 70" fill="none" stroke="#6d8063" stroke-width="1"><path d="M7 39L25 30H63L78 22H98L113 34L100 42H32L22 48H8Z M33 30V42M63 30V42M78 22V42M8 36H26M12 33V45M18 33V45M46 30V23H58V30M52 23V15M69 31H101M68 37H94M32 48H90"/><path d="M2 55H118M2 12V58M117 12V58" stroke-dasharray="2 3" opacity=".3"/></svg>`;
  function productionSummary() {
    return `<section class="panel"><div class="panel-head"><h2>Assembly line</h2><span class="tag">${s.halt ? "RETOOLING" : "IN PRODUCTION"}</span></div><div class="production-body"><div class="ship-art">${ship}</div><div><h3>Standard Cruiser Mk. IV</h3><p>${s.queue} VESSELS QUEUED · ${s.halt ? `${s.halt} TURNS HALTED` : "2 CYCLES / BATCH"}</p><div class="meter"><i style="width:${s.progress * 50}%"></i></div><span class="mini-status">${s.halt ? "PRODUCTION SUSPENDED" : s.queue ? "Reliable. Reproducible. Remarkably unfashionable." : "AWAITING REQUISITION"}</span></div></div></section>`;
  }
  function dispatchList(limit = 3) {
    return s.logs
      .slice(0, limit)
      .map(
        (text, i) =>
          `<div class="dispatch"><span class="dispatch-icon">${i % 2 ? "▥" : "⌁"}</span><div><strong>${escapeHTML(text.split(".")[0])}.</strong><p>${escapeHTML(text.split(".").slice(1).join("."))}</p></div><time>${i === 0 ? "LATEST" : "ARCHIVE"}</time></div>`,
      )
      .join("");
  }
  function headquarters() {
    const selectedSystem = systemInfo(selected);
    const signalStatus = s.signal.choice
      ? (s.signal.choice === "reply" ? "REPLY TRANSMITTED" : "ARRAY HELD SILENT")
      : `${s.signal.fragments} / 3 FRAGMENTS`;
    const signalCopy = s.signal.fragments === 3
      ? "An old intelligence has left a question in the dark. The answer is now yours to choose."
      : "A pattern repeats beyond the mapped lanes. It is older than our charts, and it is getting louder.";
    return `<div class="grid"><section class="panel"><div class="panel-head"><div><span class="eyebrow">NAVIGATION CHART / SECTOR 07</span><h2>Strategic theatre</h2></div><span class="tag live-tag">● LIVE INTELLIGENCE</span></div>${map()}<div class="system-detail"><div><strong>${selectedSystem.name}</strong><p>${selectedSystem.sub}</p></div>${selected === 7 ? '<button class="text-button" data-view="white-hart">Enter the pub →</button>' : selected === 4 ? '<button class="text-button" data-view="research">Enter Directorate ↗</button>' : selected === 8 ? '<button class="text-button" data-view="signal">Open signal archive ↗</button>' : '<button class="text-button" data-action="system">View intelligence ↗</button>'}</div></section><aside class="right-column"><section class="alert-card"><div class="eyebrow">RESEARCH DIRECTORATE</div><span class="stamp">URGENT</span><h3>${s.norden ? "“A minor adjustment to the laws of physics.”" : "Standardization is now doctrine."}</h3><p>${s.norden ? "Professor Norden requests authorization for Project Sphere. Assembly line interruption is considered “negligible.”" : "The directorate has been reassigned. Veteran engineers have returned to the assembly floor."}</p><div class="quote">${s.norden ? "“We cannot allow the inconvenience of a war to impede scientific progress.”" : "“The bolts fit the nuts again. We regard this as a breakthrough.”"}</div><div class="author">— ${s.norden ? "PROF. E. NORDEN" : "CHIEF ENGINEER VOSS"}</div><button class="outline wide" data-view="research">${s.norden ? "Review proposal" : "View research archive"} <span>→</span></button></section><section class="panel"><div class="panel-head"><h2>The balance of power</h2><span>⌁</span></div><div class="status-body"><div class="meter-row"><span>Our operational vessels</span><strong>${s.ships}</strong></div><div class="meter"><i style="width:${Math.min(100, (s.ships / 32) * 100)}%"></i></div><div class="meter-row"><span>Estimated enemy strength</span><strong>${s.enemy}</strong></div><div class="meter red"><i style="width:${Math.min(100, (s.enemy / 32) * 100)}%"></i></div><div class="meter-row"><span>Military unrest</span><strong>${s.unrest}%</strong></div><div class="meter red"><i style="width:${s.unrest}%"></i></div><p class="status-note">“Their ships are inferior in every measurable way. Except quantity.”</p></div></section></aside></div>
      <section class="signal-brief panel ${s.signal.fragments === 3 ? "decoded" : ""}" aria-labelledby="signal-brief-title">
        <div class="signal-brief-orbit" aria-hidden="true"><span class="signal-brief-core">◉</span><i></i><b></b></div>
        <div class="signal-brief-copy"><span class="eyebrow">THE QUIET ARRAY / UNREGISTERED TRANSMISSION</span><h2 id="signal-brief-title">${s.signal.fragments === 3 ? "A question, left for us." : "Something is listening."}</h2><p>${signalCopy}</p></div>
        <div class="signal-brief-status"><span>${signalStatus}</span><button class="outline" data-view="signal">${s.signal.fragments === 3 ? "Choose our answer ↗" : "Investigate the signal ↗"}</button></div>
      </section>
      <section class="pub-dispatch panel"><div><span class="eyebrow">NORDEN DEEP / FLEET STREET</span><h2>A short walk from theory to the bar.</h2><p>The Research Directorate is next door. Every prototype can be checked at The White Hart. Claimed statistical deviation: <strong>0.000001%</strong>. ${s.pubChecks.reduce((a, b) => a + b, 0)} pub checks filed.</p></div><button class="outline" data-view="white-hart">Walk over to The White Hart →</button></section><div class="bottom-grid">${productionSummary()}<section class="panel"><div class="panel-head"><h2>Incoming dispatches</h2><button class="text-button" data-view="dispatches">All dispatches ↗</button></div>${dispatchList(2)}</section></div>`;
  }
  function research() {
    return `<div class="cards">${techs.map((t, i) => `<article class="panel research-card"><span class="eyebrow">PROJECT 0${i + 1} / ${s.suspended[i] ? "GROUNDED" : s.tech[i] === 2 ? "FIELD CERTIFIED" : s.tech[i] ? "EXPERIMENTAL" : "AWAITING APPROVAL"}</span><div class="research-icon">${t.icon}</div><h2>${t.name}</h2><p>${t.desc}</p>${s.tests[i] ? `<p><b>Field report:</b> ${t.flaw}</p>` : '<p class="quote">“No significant limitations in the theoretical model.”</p>'}<button class="primary wide" data-action="research" data-id="${i}" ${s.tech[i] || !s.norden ? "disabled" : ""}>Authorize · ${t.cost} SP / 60 IP</button><button class="outline wide" data-action="test" data-id="${i}" ${!s.tech[i] || s.tech[i] === 2 ? "disabled" : ""}>Field test ${s.tests[i]}/2 · 15 SP / 20 IP</button><button class="outline wide" data-action="fix" data-id="${i}" ${s.tests[i] < 2 || s.tech[i] === 2 ? "disabled" : ""}>Engineer safeguards · 60 IP / 10 PC</button><button type="button" class="pub-check-link" data-action="pub-check" data-id="${i}">Check at The White Hart →<small>${s.pubChecks[i]} pub checks · claimed deviation 0.000001%</small></button></article>`).join("")}</div><section class="panel report" style="margin-top:22px"><h2>Personnel & doctrine</h2><p>Every new project halts cruiser production for two turns and increases bureaucratic chaos. Two field tests expose a flaw; engineering safeguards make the weapon safe. Replacing practical engineers doubles research income, but erodes fleet reliability.</p><div class="toolbar"><button class="outline" data-action="hr" ${!s.norden ? "disabled" : ""}>${s.theorists ? "Restore veteran engineers" : "Hire young theorists"} · 10 PC</button><button class="outline" data-action="fire" ${!s.norden ? "disabled" : ""}>Dismiss Norden · 35 PC</button></div></section>`;
  }
  function production() {
    return `${productionSummary()}<div class="bottom-grid"><section class="panel report"><span class="eyebrow">BUREAU OF NAVAL PROCUREMENT</span><h2>Ships, not promises.</h2><p>Commission a batch of two standard cruisers. Construction takes two uninterrupted turns. ${s.ships} ships are currently operational.</p><button class="primary" data-action="build">Queue 2 cruisers · 80 IP</button></section><section class="panel report"><span class="eyebrow">TECHNICAL SPECIFICATION 004</span><h2>One standard. One fleet.</h2><p>Recalibrate instruments and restore interchangeable components: +15 reliability, −15 chaos. Capital integrity: ${s.capital}%.</p><button class="outline" data-action="standardize">Standardize fleet · 50 IP</button></section></div><section class="panel report" style="margin-top:22px"><h2>Trophy technology operation</h2><p>Cede Tau Ceti with a raw prototype intact. Enemy reverse-engineering will consume six vessels’ worth of resources, but abandoning the base costs 20 capital integrity. Requires an uncertified prototype.</p><button class="outline" data-action="cede" ${s.ceded ? "disabled" : ""}>${s.ceded ? "Tau Ceti ceded" : "Leave a poisoned gift · 10 PC"}</button></section>`;
  }
  function signalArchive() {
    const fragments = [
      "The carrier is a sequence of prime intervals. It has repeated without drift for longer than our observatories have existed.",
      "The gaps between the numbers encode a map—not of a place, but of a moment when our sun was young.",
      "The last coordinate is this receiver. The sender knew we would build it, and left the channel open.",
    ];
    const costs = [
      { ip: 15, sp: 8 },
      { ip: 20, sp: 12 },
      { ip: 25, sp: 15 },
    ];
    const found = s.signal.fragments;
    const cost = costs[Math.min(found, costs.length - 1)];
    const steps = fragments.map((fragment, i) => {
      const status = i < found ? "RECOVERED" : i === found ? "READY TO LISTEN" : "ENCRYPTED";
      return `<article class="signal-fragment ${i < found ? "recovered" : i === found ? "active" : "locked"}"><span class="fragment-index">0${i + 1}</span><span class="fragment-status">${status}</span><h3>${i < found ? ["A clock without a clockmaker", "A map hidden in the pauses", "A coordinate aimed at us"][i] : "Unresolved interval"}</h3><p>${i < found ? fragment : "The analyzer has not isolated this layer yet. The gaps may be carrying as much information as the signal."}</p></article>`;
    }).join("");
    const decoded = found >= 3;
    const response = s.signal.choice;
    const choiceMarkup = !decoded
      ? `<div class="signal-choice-locked"><span class="choice-lock">⌁</span><div><strong>Response protocol locked</strong><p>Recover all three fragments to choose whether to answer the signal.</p></div></div>`
      : response
        ? `<div class="signal-response-filed ${response}"><span class="response-check">${response === "reply" ? "↗" : "◌"}</span><div><span class="eyebrow">RESPONSE FILED</span><h3>${response === "reply" ? "A greeting, sent into the dark." : "We chose to listen."}</h3><p>${response === "reply" ? "The transmission has left the array. Nothing answers yet. On the console, every clock begins to run a little faster." : "The array has gone quiet. For the first time in weeks, the enemy's long-range tracking has lost our capital's outline."}</p></div></div>`
        : `<div class="signal-choice-grid"><button class="signal-choice reply" data-action="signal-choice" data-id="reply" ${s.pc < 12 ? "disabled" : ""}><span class="choice-icon">↗</span><span class="eyebrow">OPTION A · FIRST CONTACT</span><strong>Send a reply</strong><small>Spend 12 PC. Gain 15 SP. Open a channel to the unknown sender.</small></button><button class="signal-choice silence" data-action="signal-choice" data-id="silence"><span class="choice-icon">◌</span><span class="eyebrow">OPTION B · STRATEGIC CAUTION</span><strong>Keep the array silent</strong><small>Reduce enemy strength by 4 and restore 8% fleet reliability. The channel may not wait forever.</small></button></div>`;
    return `<div class="signal-page">
      <section class="signal-hero panel ${decoded ? "decoded" : ""}">
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
          <button class="signal-easter-star ${s.signal.starFound ? "found" : ""}" type="button" data-action="signal-star" aria-label="Inspect the faint star in the signal chart" title="A dim point outside the plotted field"><span>${s.signal.starFound ? "✦" : "·"}</span></button>
          <span class="signal-art-caption">UNREGISTERED SOURCE · DISTANCE UNKNOWN</span>
        </div>
        <div class="signal-hero-copy"><span class="eyebrow"><i class="live-dot"></i> THE LONG QUIET / DEEP-SKY LISTENER</span><h2>The universe did not have to answer.</h2><p>At the edge of the mapped lanes, an impossible transmission repeats through the static. It carries no voice, no threat—only an invitation to notice that we are not alone.</p><div class="signal-meta"><span><strong>101s</strong> repeat interval</span><span><strong>${found}/3</strong> fragments recovered</span><span><strong>${response ? "FILED" : "OPEN"}</strong> response protocol</span></div></div>
      </section>
      <div class="signal-dashboard"><section class="panel signal-transcript"><div class="panel-head"><div><span class="eyebrow">LISTENING POST / AUTOMATIC TRANSCRIPT</span><h2>Three intervals. One message.</h2></div><span class="tag ${decoded ? "tag-resolved" : ""}">${decoded ? "PATTERN RESOLVED" : `${found} / 3 DECODED`}</span></div><div class="signal-fragments">${steps}</div><div class="signal-scan-row"><div><span class="eyebrow">NEXT ANALYSIS PASS</span><strong>${decoded ? "No further pass required" : `${cost.ip} IP  /  ${cost.sp} SP`}</strong></div><button class="primary" data-action="signal-scan" ${decoded || s.ip < cost.ip || s.sp < cost.sp ? "disabled" : ""}>${decoded ? "Signal parsed" : `Listen to next interval  ${found + 1}/3 →`}</button></div></section>
        <aside class="panel signal-console"><span class="eyebrow">ARRAY STATUS</span><div class="console-readout"><span class="console-dot ${decoded ? "resolved" : ""}"></span><strong>${decoded ? "PATTERN RESOLVED" : "RECEIVING"}</strong><small>${decoded ? "Awaiting command authorization" : "Carrier stability 99.8%"}</small></div><div class="console-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="console-meter"><span>DECODING</span><strong>${Math.round(found / 3 * 100)}%</strong><div><i style="width:${found / 3 * 100}%"></i></div></div><p class="console-note">“It is not a voice. It is a knock on a door that has been waiting a very long time.”<small>— Dr. Imani Vale, Night Shift</small></p></aside></div>
      <section class="panel signal-response-panel"><div class="panel-head"><div><span class="eyebrow">COMMAND AUTHORITY / RESPONSE PROTOCOL</span><h2>What should we send back?</h2></div><span class="tag">${response ? "DECISION ARCHIVED" : decoded ? "AWAITING YOUR ORDER" : "LOCKED"}</span></div>${choiceMarkup}</section>
      <p class="signal-secret-hint"><span>✦</span> The night archivist insists the old telescope has one more message in it. Some words are keys.</p>
      <section class="signal-gag panel"><span class="gag-badge">FIELD NOTE</span><p>${found ? "The analyzer's first draft classified the signal as “possibly a colleague with a very long commute.” A revised report is pending." : "A junior analyst asked if the signal could be turned down. The duty physicist has requested a different junior analyst."}</p><span class="gag-signature">NIGHT SHIFT / UNOFFICIAL</span></section>
    </div>`;
  }

  function systemInfo(i) {
    const n = { ...systems[i] };
    if (i === 3 && s.ceded) {
      n.kind = "enemy";
      n.sub = "Ceded base · Enemy reverse-engineering facility destroyed";
    }
    if (i === 2 && s.victories) {
      n.kind = "friendly";
      n.sub = `Corridor secured · ${s.victories} successful fleet actions`;
    }
    if (i === 5 || i === 6)
      n.sub = `Hostile territory · ${s.enemy} enemy vessels remain across the theatre`;
    if (i === 4)
      n.sub = `Norden Deep · +${s.norden ? (s.theorists ? 30 : 15) : 5} SP / turn · The White Hart next door`;
    if (i === 7)
      n.sub = `Directorate local · ${s.pubChecks.reduce((a, b) => a + b, 0)} checks filed · Claimed deviation 0.000001%`;
    if (i === 0)
      n.sub = `Capital system · ${Math.max(0, s.capital)}% integrity`;
    if (i === 8)
      n.sub = s.signal.choice
        ? `Unknown source · ${s.signal.choice === "reply" ? "a reply was transmitted" : "radio silence maintained"}`
        : `Unregistered object · ${s.signal.fragments}/3 signal fragments decoded · No known crew`;
    return n;
  }
  function commandNotice() {
    const h = s.hearings[0];
    if (!h || s.ending) return "";
    const copy = [
      "“The launch assembly performed exactly as predicted by the annihilation equations. The admiralty neglected to place it outside the universe.”",
      "“The analyzer was mathematically perfect. Its loss demonstrates an insufficient appreciation of scientific personnel by the escort commander.”",
      "“Hysteresis is not a defect. It is the metric remembering its previous configuration. The admirals should have anticipated memory.”",
    ];
    return `<section class="hearing panel" aria-label="Unresolved failure report"><div class="hearing-heading"><div><span class="eyebrow">SCIENTIFIC COUNCIL / REPORT ${String(h.turn).padStart(3, "0")}</span><h2>${techs[h.id].name}: a question of responsibility</h2></div><span class="stamp">RULING REQUIRED</span></div><p>${escapeHTML(h.text)}</p><blockquote>${copy[h.id]}</blockquote><div class="hearing-bottom"><span>MILITARY UNREST <strong>${s.unrest}%</strong> / MUTINY AT 100%</span><span>${s.hearings.length} REPORT${s.hearings.length === 1 ? "" : "S"} PENDING</span></div><div class="toolbar"><button class="primary" data-action="resolve" data-id="0" ${s.battle || s.ip < 30 || s.pc < 12 ? "disabled" : ""}>Order revisions · 30 IP / 12 PC</button><button class="outline" data-action="resolve" data-id="1" ${s.battle ? "disabled" : ""}>Endorse justification · +25 unrest</button></div><p class="hearing-help">Revisions suspend the prototype until certified, add one production-halt cycle, and reduce unrest by 15. Endorsement adds 8 chaos. ${s.battle ? "Rulings unlock after fleet recovery." : "No new deployment or turn advance until all reports are resolved."}</p></section>`;
  }
  function pubCheck(id) {
    if (!techs[id]) return;
    view = "white-hart";
    save();
    render();
    window.ASPubAnnex?.requisition(id);
  }
  function resolveHearing(choice) {
    const h = s.hearings[0];
    if (!h || s.battle || ![0, 1].includes(choice)) return;
    if (choice === 0) {
      if (!spend(30, 0, 12)) return;
      s.suspended[h.id] = true;
      s.halt++;
      s.tests[h.id] = Math.min(2, s.tests[h.id] + 1);
      s.unrest = Math.max(0, s.unrest - 15);
      s.chaos = Math.max(0, s.chaos - 8);
      log(
        `${techs[h.id].name} returned for revisions. A failure counts as one field test; deployment is suspended pending certification.`,
      );
    } else {
      s.unrest = Math.min(100, s.unrest + 25);
      s.chaos = Math.min(100, s.chaos + 8);
      log(
        `Norden's justification endorsed. Military unrest rises to ${s.unrest}%. The admirals have requested a private meeting.`,
      );
    }
    s.hearings.shift();
    toast(
      choice === 0
        ? "Revision order signed. Prototype grounded pending safeguards."
        : "Justification filed. The High Command is not convinced.",
    );
  }
  function tacticalPlot(b) {
    const ours = b ? b.ours : s.ships * 30,
      foes = b ? b.foes : Math.min(8, s.enemy) * 18;
    const glyph = (x, y, hostile, hp, index) =>
      `<g transform="translate(${x} ${y})" class="tactical-ship ${hostile ? "hostile" : ""}"><title>${hostile ? "Enemy vessel" : "Cruiser"} ${index + 1}: ${Math.ceil(hp)} hull</title><path d="${hostile ? "M16 -8L-15 0L16 8L9 0Z" : "M16 0L-12 -9L-6 0L-12 9Z"}"/><path class="ship-detail" d="M-6 -4L5 0L-6 4"/><rect class="hull-track" x="-18" y="16" width="36" height="3"/><rect class="hull-level" x="-18" y="16" width="${(36 * hp) / (hostile ? 18 : 30)}" height="3"/></g>`;
    let units = "";
    for (let i = 0; i < Math.min(16, Math.ceil(ours / 30)); i++) {
      const offset =
        b?.formation === "screen"
          ? (i % 2) * -30
          : b?.formation === "assault"
            ? -Math.abs((i % 4) - 1.5) * 25
            : 0;
      units += glyph(
        190 + Math.floor(i / 4) * 65 + offset,
        95 + (i % 4) * 55,
        false,
        Math.min(30, ours - i * 30),
        i,
      );
    }
    for (let i = 0; i < Math.ceil(foes / 18); i++)
      units += glyph(
        555 - Math.floor(i / 4) * 65,
        95 + (i % 4) * 55,
        true,
        Math.min(18, foes - i * 18),
        i,
      );
    return `<div class="tactical-plot"><svg viewBox="0 0 760 350" role="img" aria-label="Fleet tactical display: ${Math.ceil(ours / 30)} imperial ships, ${Math.ceil(foes / 18)} hostile ships."><defs><pattern id="tac-grid" width="35" height="35" patternUnits="userSpaceOnUse"><path d="M35 0H0V35" fill="none" stroke="#74917b" stroke-opacity=".14"/></pattern></defs><rect width="760" height="350" fill="url(#tac-grid)"/><circle cx="380" cy="175" r="128" fill="none" stroke="#78967c" stroke-opacity=".13"/><circle cx="380" cy="175" r="75" fill="none" stroke="#78967c" stroke-opacity=".13"/><path d="M380 35V315" stroke="#78967c" stroke-dasharray="3 7" stroke-opacity=".3"/><text x="28" y="30">IMPERIAL TASK FORCE</text><text x="530" y="30">HOSTILE CONTACTS</text>${units}${b?.shield ? '<ellipse cx="190" cy="95" rx="30" ry="25" fill="#a5c7d015" stroke="#a5c7d0" stroke-dasharray="4 3"/>' : ""}${b?.analyzer?.hp > 0 ? `<g transform="translate(75 180)" class="analyzer-marker"><rect x="-18" y="-12" width="36" height="24"/><path d="M-25 0H25M0-20V20"/><text x="-32" y="38">ANALYZER</text><text x="-24" y="52">${Math.ceil(b.analyzer.hp)} HULL</text></g>` : ""}${b && !b.paused && b.foes > 0 ? '<path class="torpedo-trace" d="M280 155L470 130M275 213L478 240"/>' : ""}<text x="28" y="328">${b?.blackout ? "WARNING: COMMAND LINK LOST" : b?.adapted ? "ENEMY DOCTRINE: SUPPORT INTERDICTION" : "PASSIVE RADAR / TRACKING CONTACTS"}</text></svg></div>`;
  }
  function bridge() {
    const b = s.battle,
      blocked = s.sortieTurn === s.turn || s.hearings.length;
    const report = s.lastBattle;
    return `<div class="bridge-layout"><section class="panel"><div class="panel-head"><h2>Kepler corridor / Fleet engagement</h2><span class="tag">${b ? (b.paused ? "TACTICAL PAUSE" : b.blackout ? "LINK LOST" : "LIVE ENGAGEMENT") : blocked ? "FLEET RECOVERING" : "AWAITING ORDERS"}</span></div>${tacticalPlot(b)}<div class="battle-stats"><span>IMPERIAL HULL ${b ? Math.ceil(b.ours) : s.ships * 30}</span><span>${b ? `${b.tick} / 60 SEC` : "1 SORTIE / CYCLE"}</span><span>HOSTILE HULL ${b ? Math.ceil(b.foes) : Math.min(8, s.enemy) * 18}</span></div><div class="bridge-controls"><button class="primary" data-action="battle" ${s.ending || (!b && (!s.ships || !s.enemy || blocked)) ? "disabled" : ""}>${b ? (b.paused ? "Resume engagement" : "Pause engagement") : blocked ? "Await next cycle" : "Deploy fleet →"}</button><button class="outline" data-action="retreat" ${!b ? "disabled" : ""}>Withdraw · −10 capital</button></div></section><aside class="panel orders-panel"><div class="panel-head"><h2>Fleet orders</h2><span class="tag">${b?.blackout ? "OFFLINE" : "COMMAND"}</span></div><div class="orders-body"><span class="eyebrow">FORMATION</span>${Object.entries(
      Combat.formations,
    )
      .map(
        ([id, f]) =>
          `<button class="order-button ${b?.formation === id ? "selected" : ""}" aria-pressed="${b?.formation === id}" data-action="formation" data-id="${id}" ${!b || b.blackout ? "disabled" : ""}><strong>${f.name}</strong><small>${f.hint}</small></button>`,
      )
      .join("")}<span class="eyebrow">TARGET PRIORITY</span>${Object.entries(
      Combat.targets,
    )
      .map(
        ([id, t]) =>
          `<button class="order-button ${b?.target === id ? "selected" : ""}" aria-pressed="${b?.target === id}" data-action="target" data-id="${id}" ${!b || b.blackout ? "disabled" : ""}><strong>${t.name}</strong><small>${t.hint}</small></button>`,
      )
      .join(
        "",
      )}</div></aside></div><div class="weapon-rack">${techs.map((t, i) => `<button class="weapon-button" data-action="weapon" data-id="${i}" ${!b || !s.tech[i] || s.suspended[i] || b.used.includes(i) || b.blackout ? "disabled" : ""}><span>${t.icon}</span><div><strong>${t.name}</strong><small>${s.suspended[i] ? "GROUNDED FOR REVISION" : b?.used.includes(i) ? "DEPLOYED" : s.tech[i] === 2 ? "FIELD CERTIFIED" : s.tech[i] ? "EXPERIMENTAL / RISK UNKNOWN" : "NOT AUTHORIZED"}</small></div></button>`).join("")}</div>${b ? `<section class="panel report signal-log"><span class="eyebrow">BRIDGE SIGNALS ${b.shield ? `/ FIELD ACTIVE: ${b.shield}s` : ""} ${b.blackout ? `/ LINK RESTORE: ${b.blackout}s` : ""}</span>${b.signals.length ? b.signals.map((text) => `<p>${escapeHTML(text)}</p>`).join("") : "<p>Torpedo crews ready. Awaiting contact.</p>"}</section>` : report ? `<section class="panel report after-action"><span class="eyebrow">AFTER-ACTION REPORT / CYCLE ${report.turn}</span><h2>${report.won ? "Corridor secured" : report.withdraw ? "Tactical withdrawal" : "Fleet action unsuccessful"}</h2><p>${report.destroyed} enemy vessels destroyed · ${report.losses} imperial cruisers lost · ${s.ships} ships returned.</p><p>${s.hearings.length ? "Unresolved scientific failure reports require your ruling." : "The fleet must refuel before another sortie. Advance the cycle to redeploy."}</p></section>` : ""}<p class="quote">Space to pause. Give orders while paused or during combat. The field protects the flagship, not its escorts. Changing departments pauses the engagement; strategic changes require fleet recovery.</p>`;
  }
  function render() {
    document.querySelector('nav [data-view="dispatches"] b').textContent =
      s.hearings.length || s.logs.length;
    document.querySelector('nav [data-view="research"] b').textContent =
      s.tech.filter((n) => !n).length;
    document.getElementById("signal-secret-count").textContent =
      `${Number(s.signal.eggFound) + Number(s.signal.starFound)}/2`;
    const active = document.activeElement;
    const focus = active?.closest("#view")
      ? {
          action: active.dataset.action,
          id: active.dataset.id,
          system: active.dataset.system,
        }
      : null;
    resources();
    document
      .querySelectorAll("nav button")
      .forEach((el) => el.classList.toggle("active", el.dataset.view === view));
    const titles = {
      headquarters: [
        "Headquarters",
        "A war is underway. Somewhere beyond it, something has answered.",
      ],
      research: [
        "Research Directorate",
        "The future is promising. The requisitions are immediate.",
      ],
      production: [
        "Fleet & Production",
        "A working ship is worth a thousand theoretical victories.",
      ],
      bridge: [
        "Tactical Bridge",
        "Superior technology. Consequential decisions.",
      ],
      signal: [
        "Deep Signal",
        "A patient intelligence has left a question in the dark. The answer is yours to choose.",
      ],
      dispatches: [
        "Command dispatches",
        "For the record. For the war. For the eventual tribunal.",
      ],
      "white-hart": [
        "The White Hart",
        "Fleet Street, Norden Deep. The Research Directorate’s local, and its most honest laboratory.",
      ],
    };
    const realm = $("pub-realm");
    const inPub = view === "white-hart";
    document.body.classList.toggle("pub-mode", inPub);
    if (realm) {
      const wasHidden = realm.hidden;
      realm.hidden = !inPub;
      $("view").hidden = inPub;
      if (inPub && wasHidden) {
        window.dispatchEvent(new Event("resize"));
        window.ASPubAnnex?.shown();
      }
    }
    $("page-title").textContent = titles[view][0];
    $("page-subtitle").textContent = titles[view][1];
    if (inPub) {
      $("page-title").textContent = titles[view][0];
      $("page-subtitle").textContent = titles[view][1];
      return;
    }
    $("view").innerHTML =
      commandNotice() +
      (view === "headquarters"
        ? headquarters()
        : view === "research"
          ? research()
          : view === "production"
            ? production()
            : view === "bridge"
              ? bridge()
              : view === "signal"
                ? signalArchive()
                : `<section class="panel"><div class="panel-head"><h2>Classified correspondence</h2><span class="tag">${s.logs.length} RECORDS</span></div>${dispatchList(35)}</section><div class="toolbar"><button class="outline" data-action="reset">Start new campaign</button><button class="outline" data-view="white-hart">Walk over to The White Hart →</button></div>${s.ending ? `<h2>${escapeHTML(s.ending)}</h2>` : ""}`);
    if (focus) {
      const selector = focus.action
        ? `[data-action="${focus.action}"]${focus.id !== undefined ? `[data-id="${focus.id}"]` : ""}`
        : focus.system !== undefined
          ? `[data-system="${focus.system}"]`
          : null;
      if (selector)
        $("view").querySelector(selector)?.focus({ preventScroll: true });
    }
  }
  function syncArchive() {
    const stored = Directorate.read();
    if (!stored) return;
    const candidate = {
      ...fresh(),
      ...stored,
      battle: stored.battle ? Combat.restore(stored.battle) : null,
    };
    if (validArchive(candidate)) {
      s = candidate;
      render();
    }
  }
  window.ASCampaign = { sync: syncArchive, get view() { return view; } };
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) syncArchive();
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) syncArchive();
  });
  window.addEventListener("pagehide", () => {
    if (s.battle) {
      s.battle.paused = true;
      save();
    }
  });
  function endTurn() {
    if (s.battle || s.ending || s.hearings.length) return;
    s.turn++;
    s.ip += 40;
    s.sp += s.norden ? (s.theorists ? 30 : 15) : 5;
    s.pc = Math.min(100, s.pc + 3);
    if (s.halt) s.halt--;
    else if (s.queue) {
      s.progress++;
      if (s.progress >= 2) {
        s.ships += 2;
        s.queue -= 2;
        s.progress = 0;
        log(
          "Two Standard Cruisers commissioned. The yard reports that every bolt fits.",
        );
      }
    }
    if (s.theorists) s.reliability -= 5;
    if (s.chaos >= 40) {
      s.reliability -= Math.ceil(s.chaos / 10);
      log(
        "Frequency desynchronization reported. The fleet is now communicating through strongly worded letters.",
      );
    }
    s.capital -= Math.max(2, Math.ceil(s.enemy / 4));
    if (s.turn % 3 === 0) s.enemy += 3;
    log(
      `Cycle ${s.turn}: capital integrity ${Math.max(0, s.capital)}%. Enemy pressure continues; engage at the Tactical Bridge.`,
    );
    campaignGag();
    checkEnd();
    save();
    render();
    if (!s.gagsSeen.includes(s.turn))
      toast("Cycle advanced. Industrial and scientific allocations received.");
  }
  function action(name, id) {
    if (name === "pub-check") return pubCheck(id);
    if (name === "signal-star") {
      if (findSignalEgg("star")) {
        save();
        render();
      }
      return;
    }
    if (name === "reset") {
      modal(
        "Start a new campaign?",
        '<p>This replaces the current campaign archive. The White Hart save is unaffected.</p><button class="outline" id="confirm-reset">Confirm new campaign</button>',
      );
      $("confirm-reset").onclick = () => {
        s = fresh();
        view = "headquarters";
        $("briefing").close();
        save();
        render();
      };
      return;
    }
    if (name === "system") {
      const n = systemInfo(selected);
      modal(
        n.name,
        `<p>${n.sub}.</p><p>${selected === 0 ? `Capital integrity: ${s.capital}%. Enemy pressure reduces this every turn.` : selected === 2 ? "An enemy squadron blocks the corridor. Deploy from the Tactical Bridge to break their advance." : selected === 3 ? (s.ceded ? "This base has been ceded to the enemy." : "A forward laboratory offers an opportunity to leave an unfinished prototype for enemy intelligence.") : "Intelligence is current as of this campaign cycle. Maintain fleet reliability before committing to an engagement."}</p>`,
      );
      return;
    }
    if (s.ending) {
      toast("Campaign concluded. Start a new campaign in Dispatches.");
      return;
    }
    if (
      s.battle &&
      !["battle", "retreat", "weapon", "formation", "target"].includes(name)
    ) {
      toast("Recall the fleet before changing strategic specifications.");
      return;
    }
    if (name === "resolve") {
      resolveHearing(id);
      checkEnd();
      save();
      render();
      return;
    }
    if (name === "signal-scan") {
      if (s.signal.fragments >= 3 || s.signal.choice) return;
      const costs = [{ ip: 15, sp: 8 }, { ip: 20, sp: 12 }, { ip: 25, sp: 15 }];
      const fee = costs[s.signal.fragments];
      if (!spend(fee.ip, fee.sp)) return;
      s.signal.fragments++;
      const excerpts = [
        "First interval isolated: prime-number pulses, stable across an unknown span of time.",
        "Second interval isolated: the silence between pulses carries a map of our system at a younger age.",
        "Third interval isolated: the final coordinate is this receiver. The sender expected us to build it.",
      ];
      log(`Deep-sky listening pass ${s.signal.fragments}/3. ${excerpts[s.signal.fragments - 1]}`);
      toast(s.signal.fragments === 3 ? "Signal parsed. The receiver is part of the message." : `Signal fragment ${s.signal.fragments}/3 recovered. The pattern is getting clearer.`);
    }
    if (name === "signal-choice") {
      if (s.signal.fragments < 3 || s.signal.choice || !["reply", "silence"].includes(id)) return;
      if (id === "reply") {
        if (!spend(0, 0, 12)) return;
        s.sp += 15;
        s.signal.choice = "reply";
        log("First-contact protocol authorized. A short sequence of prime intervals leaves the array, carrying our name and no demands.");
        toast("Reply transmitted. The next message may take a long time to arrive.");
      } else {
        s.signal.choice = "silence";
        s.enemy = Math.max(0, s.enemy - 4);
        s.reliability = Math.min(100, s.reliability + 8);
        log("Radio silence maintained. The array's anomalous carrier masks the capital from four hostile vessels; fleet reliability improves by 8%.");
        toast("The array goes quiet. Enemy tracking weakens; fleet reliability +8%.");
      }
    }
    if (name === "formation" || name === "target") {
      if (s.battle && !Combat.order(s.battle, name, id))
        toast("Command link unavailable during hysteresis.");
    }
    if (name === "research") {
      if (!s.norden || s.tech[id] || !spend(60, techs[id].cost)) return;
      s.tech[id] = 1;
      s.halt += 2;
      s.chaos = Math.min(100, s.chaos + 15);
      log(
        `${techs[id].name} authorized. Production halted for two additional cycles.`,
      );
      toast("Project authorized. The assembly line has stopped.");
    }
    if (name === "test") {
      if (!s.tech[id] || s.tests[id] >= 2 || !spend(20, 15)) return;
      s.tests[id]++;
      log(`Field test: ${techs[id].name}. ${techs[id].flaw}`);
      modal(
        "Field test / limitation identified",
        `<p>${techs[id].flaw}</p><p>${s.tests[id] === 2 ? "Two tests completed. An engineering safeguard can now be commissioned." : "Repeat the field test before commissioning safeguards."}</p>`,
      );
    }
    if (name === "fix") {
      if (s.tests[id] < 2 || s.tech[id] === 2 || !spend(60, 0, 10)) return;
      s.tech[id] = 2;
      s.suspended[id] = false;
      s.chaos = Math.max(0, s.chaos - 10);
      log(
        `${techs[id].name} field certified. Scientists and practical engineers have signed the same report.`,
      );
      toast("Safeguards installed. Weapon certified for deployment.");
    }
    if (name === "build") {
      if (!spend(80)) return;
      s.queue += 2;
      toast("Two cruisers added to the assembly queue.");
    }
    if (name === "standardize") {
      if (!spend(50)) return;
      s.reliability = Math.min(100, s.reliability + 15);
      s.chaos = Math.max(0, s.chaos - 15);
      toast("Fleet recalibrated. Reliability +15; chaos −15.");
    }
    if (name === "hr") {
      if (!s.norden || !spend(0, 0, 10)) return;
      s.theorists = !s.theorists;
      log(
        s.theorists
          ? "Veteran engineers replaced. Research income doubled; manufacturing quality deteriorates."
          : "Veteran engineers reinstated. The theoretical bolt has been replaced with an actual bolt.",
      );
    }
    if (name === "fire") {
      if (!s.norden || !spend(0, 0, 35)) return;
      s.norden = false;
      s.theorists = false;
      s.halt = 0;
      s.chaos = Math.max(0, s.chaos - 20);
      log(
        "Professor Norden reassigned to a theoretical institute in the deep rear. Production resumes immediately.",
      );
      toast("Standardization doctrine adopted.");
    }
    if (name === "cede") {
      if (s.ceded) return;
      if (!s.tech.includes(1)) {
        toast("An uncertified prototype is required.");
        return;
      }
      if (!spend(0, 0, 10)) return;
      s.ceded = true;
      s.capital -= 20;
      s.enemy = Math.max(0, s.enemy - 6);
      log(
        "Tau Ceti ceded. Enemy reverse-engineering has produced an exceptionally large crater.",
      );
    }
    if (name === "battle") {
      if (s.battle) s.battle.paused = !s.battle.paused;
      else if (s.ships && s.enemy) {
        if (s.sortieTurn === s.turn || s.hearings.length) {
          toast(
            "Deployment withheld. Resolve reports and advance the campaign cycle.",
          );
          return;
        }
        s.battle = Combat.create(s.ships, s.enemy, s.adapted);
        s.sortieTurn = s.turn;
      }
    }
    if (name === "retreat" && s.battle) finishBattle(true);
    if (name === "weapon" && s.battle && s.tech[id] && !s.suspended[id]) {
      if (Combat.weapon(s.battle, id, s.tech[id] === 2)) {
        if (s.tech[id] === 2) s.certifiedUsed = true;
        processBattleEvents();
        finishBattle();
      } else
        toast(
          "Weapon unavailable: already expended or command link disrupted.",
        );
    }
    checkEnd();
    save();
    render();
  }
  function processBattleEvents() {
    const b = s.battle;
    if (!b) return;
    for (const event of b.events) {
      if (event.type === "adaptation") {
        s.adapted = true;
        log(
          "Enemy doctrine updated. Support vessels are now priority targets in future engagements.",
        );
      } else {
        s.reliability = Math.max(0, s.reliability - event.loss);
        s.hearings.push({ id: event.id, turn: s.turn, text: event.text });
        log(event.text);
        toast("A failure report awaits your ruling after the engagement.");
      }
    }
    b.events = [];
  }
  function finishBattle(withdraw = false) {
    const b = s.battle;
    if (!b || (!withdraw && !Combat.result(b))) return;
    // Recovery always requires deactivation, even if the battle ends early.
    Combat.deactivate(b);
    processBattleEvents();
    const won = !withdraw && b.foes <= 0 && b.ours > 0;
    s.ships = Math.max(0, Math.ceil(b.ours / 30));
    const destroyed = won
      ? b.count
      : Math.min(b.count, Math.floor((b.count * 18 - b.foes) / 18));
    s.enemy = Math.max(0, s.enemy - destroyed);
    s.lastBattle = {
      turn: s.turn,
      won,
      withdraw,
      losses: b.initialShips - s.ships,
      destroyed,
      signals: b.signals,
    };
    if (won) {
      s.victories++;
      s.pc = Math.min(100, s.pc + 8);
      s.capital = Math.min(100, s.capital + 8);
      log(
        "Kepler engagement won. The enemy squadron is destroyed; the frontier holds.",
      );
    } else {
      s.capital -= withdraw ? 10 : 15;
      log(
        withdraw
          ? "Fleet withdrawn. The enemy advances into the abandoned corridor."
          : "Engagement lost. The survivors request reliable equipment.",
      );
    }
    s.battle = null;
    toast(
      won
        ? "Engagement won. Review the after-action report."
        : "Fleet action concluded. Regroup and rebuild.",
    );
  }
  setInterval(() => {
    const b = s.battle;
    if (!b || b.paused || s.ending) return;
    Combat.step(b, s.reliability);
    processBattleEvents();
    finishBattle();
    checkEnd();
    save();
    if (view === "bridge" || !s.battle) render();
  }, 1000);
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-view],[data-action],[data-system]");
    if (!el) return;
    if (el.dataset.view) {
      if (s.battle) s.battle.paused = true;
      view = el.dataset.view;
      save();
      render();
    } else if (el.dataset.system !== undefined) {
      selected = Number(el.dataset.system);
      render();
    } else
      action(
        el.dataset.action,
        ["formation", "target", "signal-choice"].includes(el.dataset.action)
          ? el.dataset.id
          : Number(el.dataset.id),
      );
  });
  document.addEventListener("keydown", (e) => {
    const textEntry = e.target?.closest?.("input, textarea, select, [contenteditable='true']");
    if (!textEntry && view !== "white-hart" && !$("briefing").open && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      secretBuffer = (secretBuffer + e.key.toLowerCase()).slice(-10);
      if (secretBuffer.endsWith("lighthouse") && findSignalEgg("word")) {
        secretBuffer = "";
        save();
        render();
      }
    }
    if (
      e.target?.closest?.("[data-system]") &&
      (e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      selected = Number(e.target.closest("[data-system]").dataset.system);
      render();
    } else if (
      e.code === "Space" &&
      view === "bridge" &&
      s.battle &&
      !$("briefing").open &&
      e.target.tagName !== "BUTTON"
    ) {
      e.preventDefault();
      s.battle.paused = !s.battle.paused;
      save();
      render();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && s.battle) {
      s.battle.paused = true;
      save();
      render();
    }
  });
  $("end-turn").onclick = endTurn;
  $("close-dialog").onclick = () => $("briefing").close();
  const fullscreenButton = $("fullscreen-toggle");
  const updateFullscreenLabel = () => {
    const active = Boolean(document.fullscreenElement);
    fullscreenButton.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
    fullscreenButton.title = active ? "Exit fullscreen" : "Toggle fullscreen";
    fullscreenButton.textContent = active ? "⤢" : "⛶";
  };
  fullscreenButton.onclick = async () => {
    try {
      if (!document.fullscreenEnabled) {
        toast("Fullscreen is not available in this browser. The interface will still fit your screen.");
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) {
      toast("Fullscreen was blocked by the browser. Try again from a direct click.");
    }
  };
  document.addEventListener("fullscreenchange", updateFullscreenLabel);
  $("help").onclick = () => {
    if (s.battle) {
      s.battle.paused = true;
      render();
    }
    modal(
      "Your orders, Commander.",
      "<p>Defeat the enemy before cycle 24. Every turn grants 40 IP and 15 SP, but enemy pressure damages the capital. Zero capital integrity, reliability, or political capital means defeat.</p><p>Queue standard cruisers in Fleet & Production. Authorizing research halts production. Test prototypes twice, then fund safeguards—or risk their flaws in battle.</p><p>One sortie is available per campaign cycle. At the Tactical Bridge, deploy and pause to choose a formation and target priority. Torpedoes fire automatically. Escort screens protect analyzer vessels; enemies learn to target them. Unsafe fields cause hysteresis when deactivated, even after victory. Resolve failure reports in Dispatches: fund revisions or risk a military mutiny.</p><p>The Deep Signal chapter is a Clarke-inspired, original first-contact story: spend IP and SP to decode three fragments, then choose to reply for a new ending or stay silent for a tactical advantage. The night shift also left two Easter eggs in the archive. Some words are keys.</p><p>The White Hart is your officers’ recreation annex: the Directorate’s local on Fleet Street, Norden Deep. Authorize a project here, then check it over a control pint at the pub. Each check credits one field test; safeguards are still required. The pub and campaign saves remain separate. Use the ⛶ button for browser fullscreen; layouts also adapt to narrow screens. Campaign progress saves locally after each action.</p>",
    );
  };
  save();
  render();
})();
