/** Team oddity flags: fill <70%, missing LTSO, sex split. */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function archTarget() {
    var stso = Math.max(0, +(S.$("arch-stso") && S.$("arch-stso").value) || 1);
    var ltso = Math.max(0, +(S.$("arch-ltso") && S.$("arch-ltso").value) || 0);
    var tso = Math.max(0, +(S.$("arch-tso") && S.$("arch-tso").value) || 0);
    return { stso: stso, ltso: ltso, tso: tso, size: stso + ltso + tso };
  }

  S.teamOddities = function (team) {
    var flags = [];
    if (!team) return flags;
    var c = S.teamMemberCounts(team);
    var arch = archTarget();
    var fill = arch.size ? c.total / arch.size : 1;
    if (arch.size && fill < 0.7) {
      flags.push({ code: "FILL", label: Math.round(fill * 100) + "% filled", tone: "warn" });
    }
    var ltsoHave = c.LTSO.M + c.LTSO.F;
    if (arch.ltso > 0 && ltsoHave < 1) {
      flags.push({ code: "NOLTSO", label: "no LTSO", tone: "bad" });
    }
    var m = c.STSO.M + c.LTSO.M + c.TSO.M;
    var f = c.STSO.F + c.LTSO.F + c.TSO.F;
    var tot = m + f;
    if (tot >= 3) {
      var share = Math.abs(m - f) / tot;
      if (share >= 0.4) {
        flags.push({
          code: "SEX",
          label: m + "M/" + f + "F",
          tone: share >= 0.6 ? "bad" : "warn"
        });
      }
    }
    return flags;
  };

  function flagHtml(flags) {
    if (!flags.length) return "";
    return flags.map(function (f) {
      var color = f.tone === "bad" ? "#c45c4a" : "#c47b2b";
      return '<span style="display:inline-block;margin-left:0.35rem;padding:0.05rem 0.35rem;border:1px solid ' +
        color + ";color:" + color + ';font-size:0.72rem;letter-spacing:0.04em">' +
        f.label + "</span>";
    }).join("");
  }

  function wrapStats() {
    if (typeof S.renderTeamStats !== "function" || S.renderTeamStats._oddWrapped) return;
    var orig = S.renderTeamStats;
    S.renderTeamStats = function () {
      orig.apply(this, arguments);
      var body = document.getElementById("team-stats-body");
      if (!body) return;
      var teams = (S.teams && S.teams.teams) || [];
      var lines = body.querySelectorAll(".team-stat-team-line");
      var alertBits = [];
      teams.forEach(function (t, i) {
        var flags = S.teamOddities(t);
        if (!flags.length) return;
        if (lines[i]) lines[i].insertAdjacentHTML("beforeend", flagHtml(flags));
        alertBits.push((t.name || t.id) + ": " + flags.map(function (f) { return f.label; }).join(", "));
      });
      var host = body.querySelector(".team-stat-summary") || body;
      var old = document.getElementById("team-oddity-banner");
      if (old) old.parentNode.removeChild(old);
      var banner = document.createElement("div");
      banner.id = "team-oddity-banner";
      banner.style.marginTop = "0.45rem";
      if (alertBits.length) {
        banner.innerHTML = '<span style="color:#c47b2b">Oddities (' + alertBits.length +
          "):</span> " + alertBits.join(" · ");
      } else if (teams.length) {
        banner.innerHTML = '<span class="muted">No fill / LTSO / sex oddities vs architecture.</span>';
      }
      host.appendChild(banner);
    };
    S.renderTeamStats._oddWrapped = true;
  }

  function init() {
    wrapStats();
    setTimeout(wrapStats, 0);
    if (S.renderTeamStats) S.renderTeamStats();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.Scheduler);
