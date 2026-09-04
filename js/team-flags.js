/** Team oddity flags: fill <70%, missing LTSO, sex split — stats list + forming cards. */
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
    return '<div class="team-oddity-row">' + flags.map(function (f) {
      var color = f.tone === "bad" ? "#c45c4a" : "#c47b2b";
      return '<span class="team-oddity-pill" style="display:inline-block;margin:0.15rem 0.25rem 0 0;padding:0.08rem 0.4rem;border:1px solid ' +
        color + ";color:" + color + ';font-size:0.72rem;letter-spacing:0.04em">' +
        f.label + "</span>";
    }).join("") + "</div>";
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

  function wrapCards() {
    if (typeof S.teamSummaryCardHtml !== "function" || S.teamSummaryCardHtml._oddWrapped) return;
    var orig = S.teamSummaryCardHtml;
    S.teamSummaryCardHtml = function (t) {
      var html = orig.apply(this, arguments);
      var flags = S.teamOddities(t);
      if (!flags.length) return html;
      return html.replace("</div></div>", flagHtml(flags) + "</div></div>");
    };
    S.teamSummaryCardHtml._oddWrapped = true;
  }

  function stampExistingCards() {
    document.querySelectorAll(".team-summary-card[data-summary-team]").forEach(function (el) {
      if (el.querySelector(".team-oddity-row")) return;
      var id = el.getAttribute("data-summary-team");
      var team = S.getTeamById ? S.getTeamById(id) : null;
      var flags = S.teamOddities(team);
      if (!flags.length) return;
      el.insertAdjacentHTML("beforeend", flagHtml(flags));
    });
    document.querySelectorAll("#team-boards .team-board, #team-boards [data-team-id]").forEach(function () {});
  }

  function wrapBoards() {
    if (typeof S.renderTeamBoards !== "function" || S.renderTeamBoards._oddWrapped) return;
    var orig = S.renderTeamBoards;
    S.renderTeamBoards = function () {
      var r = orig.apply(this, arguments);
      stampExistingCards();
      return r;
    };
    S.renderTeamBoards._oddWrapped = true;
  }

  function init() {
    wrapStats();
    wrapCards();
    wrapBoards();
    setTimeout(function () {
      wrapStats();
      wrapCards();
      wrapBoards();
      if (S.renderTeamStats) S.renderTeamStats();
      if (S.renderTeamBoards) S.renderTeamBoards();
    }, 0);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.Scheduler);
