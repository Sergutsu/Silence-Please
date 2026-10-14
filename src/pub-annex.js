/* The Directorate's local: live pub play becomes a campaign field-test report. */
(() => {
  "use strict";
  const D = window.ASDirectorate;
  let trial = null,
    trialPub = null,
    campaign = null,
    lastReport = null,
    lastSignature = "",
    message = "";
  const $ = (id) => document.getElementById(id);
  const escape = (text) =>
    String(text).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function read() {
    campaign = D.read();
  }
  function refresh(force = false) {
    const host = $("annex-projects");
    if (!host) return;
    const signature = JSON.stringify([
      campaign?.campaignId,
      campaign?.tech,
      campaign?.tests,
      campaign?.pubChecks,
      campaign?.ip,
      campaign?.sp,
      !!campaign?.battle,
      campaign?.ending,
      trial?.id,
    ]);
    if (force || signature !== lastSignature) {
      lastSignature = signature;
      const focused = document.activeElement?.dataset.pubProject;
      host.innerHTML = D.PROJECTS.map((t, id) => {
        const problem = D.eligibility(campaign, id),
          fee = campaign?.tech[id] ? D.price(campaign, id) : null;
        const report = campaign?.pubReports?.find((r) => r.id === id);
        return `<article class="annex-project ${trial?.id === id ? "under-test" : ""}"><div class="bench-number">EXPERIMENT 0${id + 1} <span>${t.icon}</span></div><h3>${t.name}</h3><p class="bench-name">${t.bench}</p><p>${t.procedure}</p><div class="annex-project-status">${report ? `LAST CHECK: ${D.DEVIATION} DEVIATION` : campaign?.tech[id] ? "PROTOTYPE DELIVERED" : "AWAITING DIRECTORATE AUTHORIZATION"}</div><button type="button" data-pub-project="${id}" ${problem || trial ? "disabled" : ""}>${trial?.id === id ? "Readings in progress" : fee?.credit ? "Check prototype" : "Repeat bench audit"} ${fee ? `· ${fee.ip} IP${fee.sp ? ` / ${fee.sp} SP` : ""}` : ""}</button>${problem ? `<small>${escape(problem)}</small>` : `<small>${campaign.tests[id]}/2 field tests · ${fee.credit ? "Credits one test towards safeguards." : "Audit only; no additional field-test credit."}</small>`}</article>`;
      }).join("");
      if (focused !== undefined)
        host
          .querySelector(`[data-pub-project="${focused}"]`)
          ?.focus({ preventScroll: true });
    }
    $("annex-link-state").textContent = campaign
      ? `DIRECTORATE UPLINK · CYCLE ${campaign.turn} · ${campaign.ip} IP / ${campaign.sp} SP`
      : "DIRECTORATE UPLINK · VISIT HEADQUARTERS TO BEGIN";
    $("annex-message").textContent = message;
    const pub = window.WH?.game?.state;
    const p = trial && pub ? D.progress(trial, pub) : { seconds: 0, served: 0 };
    $("annex-running").hidden = !trial;
    $("annex-seconds").textContent = `${Math.floor(p.seconds)} / 12 seconds`;
    $("annex-pint").textContent = `${p.served} / 1 control pint served`;
    $("annex-progress").value = ((p.seconds / 12 + p.served) / 2) * 100;
    $("annex-trial-name").textContent = trial ? D.PROJECTS[trial.id].bench : "";
    $("annex-pause-note").textContent = pub?.paused
      ? "Pub paused — readings resume when service does."
      : "Select a patron, pull a pint, then tap that patron again to serve. Keep the pub running for 12 seconds.";
    const filed = lastReport || campaign?.pubReports?.[0];
    $("annex-report").hidden = !filed;
    if (filed && D.PROJECTS[filed.id]) {
      $("annex-report-title").textContent = D.PROJECTS[filed.id].name;
      $("annex-report-finding").textContent = D.PROJECTS[filed.id].finding;
      $("annex-report-result").textContent =
        `Cycle ${filed.turn} · Wednesday ${filed.week} · ${filed.credit ? "+1 campaign field test" : "Repeat audit"} · ${D.DEVIATION} claimed statistical deviation`;
      $("annex-report-flaw").textContent = D.PROJECTS[filed.id].flaw;
    }
    const overlay = $("annex-stage-trial");
    overlay.hidden = !trial;
    overlay.dataset.project = trial?.id ?? "";
    $("annex-stage-icon").textContent = trial ? D.PROJECTS[trial.id].icon : "";
    $("annex-stage-label").textContent = trial
      ? D.PROJECTS[trial.id].bench
      : "";
  }
  function start(id) {
    if (trial) return;
    const pub = window.WH?.game?.state;
    const result = D.begin(id, pub);
    if (result.error) {
      message = result.error;
      refresh();
      return;
    }
    trial = result.trial;
    trialPub = pub;
    message =
      "Checking the whole universe, one pint at a time. Funding is charged only when the report is filed.";
    read();
    refresh(true);
    $("annex-running").scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "nearest",
    });
  }
  function cancel(
    reason = "Experiment cancelled. No campaign resources charged.",
  ) {
    trial = null;
    trialPub = null;
    message = reason;
    read();
    refresh(true);
  }
  function sample() {
    const pub = window.WH?.game?.state;
    if (trial && pub) {
      if (pub !== trialPub || pub.gameOver || pub.won) {
        cancel(
          "The Wednesday ended or was restarted. Begin a fresh check; no resources charged.",
        );
        return;
      }
      const p = D.progress(trial, pub);
      if (p.seconds >= 12 && p.served) {
        const result = D.complete(trial, pub);
        if (result.error) {
          cancel(result.error);
          return;
        }
        lastReport = result.report;
        trial = null;
        trialPub = null;
        message =
          "Report filed at Supreme Command. The landlord has declined co-authorship.";
        window.WH.game.saveState();
        window.WH.ui.toast(
          "Directorate report filed",
          `${D.DEVIATION} statistical deviation. ${result.report.credit ? "One field-test credit transferred to the campaign." : "Repeat audit recorded."} Safeguards still required.`,
          9000,
        );
        read();
        refresh(true);
        return;
      }
    }
    refresh();
  }
  function boot() {
    if (!$("pub-laboratory")) return;
    read();
    refresh(true);
    $("annex-projects").addEventListener("click", (e) => {
      const button = e.target.closest("[data-pub-project]");
      if (button && !button.disabled) start(Number(button.dataset.pubProject));
    });
    $("annex-cancel").addEventListener("click", () => cancel());
    const requested = Number(
      new URLSearchParams(location.search).get("project"),
    );
    if (location.search.includes("project=") && D.PROJECTS[requested]) {
      message = `Requisition received: ${D.PROJECTS[requested].name}. Begin its check below when the pub is ready.`;
      refresh();
    }
    setInterval(sample, 250);
  }
  window.addEventListener("storage", (e) => {
    if (e.key === D.KEY) {
      read();
      if (trial && campaign?.campaignId !== trial.campaignId)
        cancel("Campaign changed. Begin a new check.");
      else refresh(true);
    }
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      if (trial)
        cancel(
          "Re-entered the pub. Begin fresh readings; no resources were charged.",
        );
      else {
        read();
        refresh(true);
      }
    }
  });
  window.addEventListener("pagehide", () => {
    window.WH?.game?.saveState();
  });
  document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
