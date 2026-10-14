/* Deterministic fleet combat. Plain browser JS; no DOM or timers in the rules. */
(() => {
  "use strict";
  const formations = {
    line: {
      name: "Line ahead",
      attack: 1,
      defence: 1,
      escort: 1,
      hint: "Balanced fire and protection.",
    },
    screen: {
      name: "Escort screen",
      attack: 0.75,
      defence: 0.7,
      escort: 0.25,
      hint: "−25% firepower; −30% incoming fire; protects the analyzer.",
    },
    assault: {
      name: "Breakthrough",
      attack: 1.3,
      defence: 1.3,
      escort: 1.4,
      hint: "+30% firepower, but +30% incoming fire.",
    },
  };
  const targets = {
    line: {
      name: "Enemy battle line",
      hint: "Full torpedo damage against the squadron.",
    },
    command: {
      name: "Command vessels",
      hint: "−20% damage; disrupts enemy fire by 30%.",
    },
  };
  const defaults = () => ({
    formation: "line",
    target: "line",
    analyzer: null,
    shield: 0,
    fieldUnsafe: false,
    blackout: 0,
    adapted: false,
    events: [],
    signals: [],
  });
  function create(ships, enemies, adapted = false) {
    const count = Math.min(8, enemies);
    return {
      ...defaults(),
      ours: ships * 30,
      foes: count * 18,
      initialShips: ships,
      count,
      tick: 0,
      paused: false,
      used: [],
      adapted,
    };
  }
  function restore(b) {
    return {
      ...defaults(),
      ...b,
      formation: formations[b.formation] ? b.formation : "line",
      target: targets[b.target] ? b.target : "line",
      events: [],
      paused: true,
    };
  }
  function signal(b, text) {
    b.signals.unshift(text);
    b.signals = b.signals.slice(0, 5);
  }
  function failure(b, id, loss, text) {
    b.events.push({ type: "failure", id, loss, text });
    signal(b, text);
  }
  function order(b, kind, value) {
    if (b.blackout || !["formation", "target"].includes(kind)) return false;
    if (!(kind === "formation" ? formations : targets)[value]) return false;
    b[kind] = value;
    signal(
      b,
      `Order acknowledged: ${(kind === "formation" ? formations : targets)[value].name}.`,
    );
    return true;
  }
  function deactivate(b) {
    b.shield = 0;
    if (b.fieldUnsafe) {
      b.fieldUnsafe = false;
      b.blackout = 6;
      failure(
        b,
        2,
        25,
        "Field deactivated. Hysteresis has scrambled instruments; command link lost for six seconds.",
      );
    }
  }
  function weapon(b, id, certified) {
    if (![0, 1, 2].includes(id) || b.used.includes(id) || b.blackout)
      return false;
    b.used.push(id);
    if (id === 0) {
      b.foes = Math.max(0, b.foes - 95);
      signal(b, "Annihilation sphere detonated. Enemy formation erased.");
      if (!certified) {
        b.ours = Math.max(0, b.ours - 55);
        failure(
          b,
          id,
          12,
          "The sphere consumed its launch mechanisms. Two cruiser hulls are critically damaged.",
        );
      }
    }
    if (id === 1) {
      b.analyzer = {
        hp: certified ? 65 : 26,
        max: certified ? 65 : 26,
        certified,
        age: 0,
      };
      signal(
        b,
        "Analyzer online. Coordinated targeting increases fleet firepower by 55%.",
      );
    }
    if (id === 2) {
      b.shield = 8;
      b.fieldUnsafe = !certified;
      signal(
        b,
        "Exponential field active for eight seconds. Flagship protected; escorts remain exposed.",
      );
    }
    return true;
  }
  function step(b, reliability) {
    if (b.paused) return;
    b.tick++;
    const form = formations[b.formation];
    const suppression = b.target === "command" && !b.blackout ? 0.7 : 1;
    const attack =
      ((Math.max(1, Math.ceil(b.ours / 30)) * 1.5 * reliability) / 100) *
      form.attack *
      (b.target === "command" ? 0.8 : 1) *
      (b.analyzer?.hp > 0 ? 1.55 : 1) *
      (b.blackout ? 0.35 : 1);
    b.foes = Math.max(0, b.foes - Math.max(1, attack));
    // Destroyed squadrons do not return fire.
    if (b.foes > 0) {
      const incoming =
        Math.max(2, Math.ceil(b.foes / 18) * 1.4) * form.defence * suppression;
      const flagshipShare = 1 / Math.max(1, Math.ceil(b.ours / 30));
      b.ours = Math.max(
        0,
        b.ours - incoming * (b.shield ? 1 - flagshipShare : 1),
      );
      if (b.analyzer?.hp > 0) {
        b.analyzer.age++;
        if (b.adapted || b.analyzer.age >= 3) {
          if (!b.adapted) {
            b.adapted = true;
            b.events.push({ type: "adaptation" });
            signal(
              b,
              "Enemy doctrine updated: concentrated fire on the analyzer support vessel.",
            );
          }
          b.analyzer.hp = Math.max(
            0,
            b.analyzer.hp - 10 * form.escort * suppression,
          );
          if (!b.analyzer.hp) {
            if (!b.analyzer.certified)
              failure(
                b,
                1,
                12,
                "Analyzer support vessel lost with 500 engineers aboard. Perfect targeting has ceased.",
              );
            else
              signal(
                b,
                "Analyzer lost. Armored evacuation capsules recovered the engineering crew.",
              );
          }
        }
      }
    }
    if (b.blackout) b.blackout--;
    if (b.shield && --b.shield === 0) deactivate(b);
  }
  function result(b) {
    return b.foes <= 0 || b.ours <= 0 || b.tick >= 60;
  }
  window.ASCombat = {
    formations,
    targets,
    create,
    restore,
    order,
    weapon,
    step,
    deactivate,
    result,
  };
})();
