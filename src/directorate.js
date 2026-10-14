/* Shared Research Directorate / White Hart contract. Both pages use the same archive. */
(() => {
  "use strict";
  const KEY = "absolute-superiority-campaign-v1";
  const DEVIATION = "0.000001%";
  const PROJECTS = [
    {
      name: "Sphere of Annihilation",
      icon: "◎",
      cost: 45,
      desc: "Total matter disintegration within a controlled radius. An elegant end to numerical inferiority.",
      flaw: "The sphere also annihilates its own launcher. Unmanned launch drones are required.",
      bench: "The disappearing beer mat",
      procedure:
        "A micro-sphere inside a brass bell jar. Serve the control pint while Fenton measures the absence of its beer mat.",
      finding:
        "Beer mat and miniature launcher both vanished. The pint, being outside the radius, remained entirely British.",
    },
    {
      name: "Battle Analyzer",
      icon: "⌘",
      cost: 35,
      desc: "Perfect targeting. Perfect coordination. Five hundred minds, working as one.",
      flaw: "The 500 engineers require a massive unarmed support ship. The enemy targets it first.",
      bench: "The infallible darts committee",
      procedure:
        "A valve computer predicts the next round. Serve its control pint while the entire scientific staff crowds behind the dartboard.",
      finding:
        "Every dart predicted. Every visiting scientist stood in the line of fire. The committee requests an armoured snug.",
    },
    {
      name: "Exponential Field",
      icon: "◈",
      cost: 40,
      desc: "A spatial envelope that renders the flagship completely invulnerable to enemy fire.",
      flaw: "Hysteresis scrambles fleet instruments after deactivation. Communications collapse.",
      bench: "The absolutely unspillable pint",
      procedure:
        "Enclose a tankard in a spatial field. Serve the control pint while the landlord prepares to switch the apparatus off.",
      finding:
        "Not a drop spilled. On shutdown, every clock disagreed and the beer engine calibrated itself in furlongs.",
    },
  ];
  const identity = () =>
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function read() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (
        s?.version !== 1 ||
        ![s.tech, s.tests].every(
          (a) =>
            Array.isArray(a) &&
            a.length === 3 &&
            a.every((n) => [0, 1, 2].includes(n)),
        ) ||
        ![s.ip, s.sp].every(Number.isFinite) ||
        !Array.isArray(s.logs)
      )
        return null;
      return s;
    } catch (_) {
      return null;
    }
  }
  function eligibility(s, id) {
    if (!s)
      return "Visit Supreme Command to establish a campaign archive first.";
    if (s.ending)
      return "This campaign has concluded. The landlord will still serve you.";
    if (s.battle)
      return "Recall the deployed fleet before checking strategic prototypes.";
    if (!PROJECTS[id] || !s.tech[id])
      return "Authorize this project at the Research Directorate first.";
    return "";
  }
  function price(s, id) {
    const credit = s.tech[id] === 1 && s.tests[id] < 2;
    return { credit, ip: credit ? 20 : 5, sp: credit ? 15 : 0 };
  }
  function begin(id, pub) {
    const s = read(),
      problem = eligibility(s, id);
    if (problem) return { error: problem };
    if (!pub || pub.gameOver || pub.won)
      return {
        error: "Open a playable Wednesday before beginning the experiment.",
      };
    const fee = price(s, id);
    if (s.ip < fee.ip || s.sp < fee.sp)
      return {
        error:
          "The Directorate cannot cover this check. Allocate more IP / SP at Headquarters.",
      };
    return {
      trial: {
        id,
        run: identity(),
        campaignId: s.campaignId,
        level: s.tech[id],
        tests: s.tests[id],
        startSeconds: pub.gameSeconds,
        startServed: pub.stats.patronsServed,
        fee,
      },
    };
  }
  function progress(trial, pub) {
    return {
      seconds: Math.max(0, Math.min(12, pub.gameSeconds - trial.startSeconds)),
      served: Math.max(
        0,
        Math.min(1, pub.stats.patronsServed - trial.startServed),
      ),
    };
  }
  function complete(trial, pub) {
    const p = progress(trial, pub);
    if (pub.gameOver || pub.won || p.seconds < 12 || !p.served)
      return {
        error:
          "Collect twelve seconds of live readings and serve one control pint first.",
      };
    // Re-read, never write a snapshot taken when the player entered the pub.
    const s = read(),
      problem = eligibility(s, trial.id);
    if (problem) return { error: problem };
    if (
      s.campaignId !== trial.campaignId ||
      s.tech[trial.id] !== trial.level ||
      s.tests[trial.id] !== trial.tests
    )
      return {
        error:
          "The campaign or specification changed. Begin a fresh check; nothing has been charged.",
      };
    if (s.pubReports?.some((r) => r.run === trial.run))
      return { error: "This check has already been filed." };
    const fee = price(s, trial.id);
    if (s.ip < fee.ip || s.sp < fee.sp)
      return {
        error:
          "Funding was reassigned during the experiment. Nothing has been charged.",
      };
    const report = {
      run: trial.run,
      id: trial.id,
      turn: s.turn,
      week: pub.week,
      deviation: DEVIATION,
      credit: fee.credit,
      seconds: Math.round(p.seconds),
      served: p.served,
    };
    s.ip -= fee.ip;
    s.sp -= fee.sp;
    if (fee.credit) s.tests[trial.id]++;
    if (!Array.isArray(s.pubChecks) || s.pubChecks.length !== 3)
      s.pubChecks = [0, 0, 0];
    s.pubChecks[trial.id]++;
    s.pubReports = [
      report,
      ...(Array.isArray(s.pubReports) ? s.pubReports : []),
    ].slice(0, 20);
    const t = PROJECTS[trial.id];
    s.logs.unshift(
      `White Hart check: ${t.name}. ${t.finding} Claimed statistical deviation ${DEVIATION}. ${fee.credit ? "One field-test credit awarded." : "Repeat audit filed."} Engineering safeguards remain mandatory.`,
    );
    s.logs = s.logs.slice(0, 35);
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (_) {
      return {
        error:
          "The campaign archive could not be written. No campaign resources were charged.",
      };
    }
    return { report };
  }
  window.ASDirectorate = {
    KEY,
    DEVIATION,
    PROJECTS,
    identity,
    read,
    eligibility,
    price,
    begin,
    progress,
    complete,
  };
})();
