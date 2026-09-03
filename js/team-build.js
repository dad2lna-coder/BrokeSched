/** Teams Build overlay — loaded after teams.js */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  if (!S.teams) S.teams = {};
  if (typeof S.teams.buildOpen !== "boolean") S.teams.buildOpen = false;

  S.sexBarHtml = function (m, f, cls) {
    m = m || 0;
    f = f || 0;
    var tot = m + f;
    if (!tot) {
      return '<div class="' + (cls || "role-sex-bar") + '"><span class="muted" style="width:100%;color:var(--muted)">0</span></div>';
    }
    var mPct = Math.round((100 * m) / tot);
    var fPct = 100 - mPct;
    if (!f) {
      return '<div class="' + (cls || "role-sex-bar") + '"><span class="sex-bar-m" style="width:100%">' + m + "</span></div>";
    }
    if (!m) {
      return '<div class="' + (cls || "role-sex-bar") + '"><span class="sex-bar-f" style="width:100%">' + f + "</span></div>";
    }
    return (
      '<div class="' + (cls || "role-sex-bar") + '">' +
      '<span class="sex-bar-m" style="width:' + mPct + '%">' + m + "</span>" +
      '<span class="sex-bar-f" style="width:' + fPct + '%">' + f + "</span>" +
      "</div>"
    );
  };

  S.teamStsoRdoLabel = function (team) {
    var label = "\u2014";
    (team.members || []).forEach(function (mid) {
      var p = S.memberLine(mid);
      if (!p || p.role !== "STSO") return;
      if (p.rdoLabel && p.rdoLabel !== "\u2014") label = p.rdoLabel.replace(/,/g, " / ");
    });
    if (label === "\u2014") {
      (team.members || []).some(function (mid) {
        var p = S.memberLine(mid);
        if (p && p.rdoLabel && p.rdoLabel !== "\u2014") {
          label = p.rdoLabel.replace(/,/g, " / ");
          return true;
        }
        return false;
      });
    }
    return label;
  };

  S.teamSummaryCardHtml = function (t) {
    var c = S.teamMemberCounts(t);
    var allM = c.STSO.M + c.LTSO.M + c.TSO.M;
    var allF = c.STSO.F + c.LTSO.F + c.TSO.F;
    var phaseLbl = t.phase || (S.teamPhaseInfo ? S.teamPhaseInfo(t).phase : "") || "\u2014";
    var rdo = S.teamStsoRdoLabel(t);
    function roleBox(role) {
      return (
        '<div class="team-role-box">' +
        '<div class="role-name">' + role + "</div>" +
        S.sexBarHtml(c[role].M, c[role].F, "role-sex-bar") +
        "</div>"
      );
    }
    return (
      '<div class="team-summary-card" data-summary-team="' + t.id + '">' +
      '<div class="team-summary-top">' +
      '<div><div class="ts-label">TEAM</div><div class="team-summary-num">' +
      String(t.name || t.id).replace(/</g, "<") +
      "</div></div>" +
      '<div class="team-summary-edit"><div class="ts-label" style="text-align:center">EDIT</div>' +
      '<button type="button" class="btn" data-team-edit="' + t.id + '">\u270e Edit</button></div>' +
      '<div class="team-summary-phase"><div class="ts-label">PHASE</div>' +
      '<div class="team-phase-pill">' + phaseLbl + "</div></div>" +
      "</div>" +
      '<div class="team-summary-mid">' +
      '<span class="muted">RDOs</span><span class="team-rdo-pill">' + rdo + "</span>" +
      '<span class="muted">Sex</span>' + S.sexBarHtml(allM, allF, "team-sex-split") +
      '<span class="muted">Total</span><span class="team-total-pill">' + c.total + "</span>" +
      "</div>" +
      '<div class="team-role-row">' + roleBox("STSO") + roleBox("LTSO") + roleBox("TSO") + "</div>" +
      "</div>"
    );
  };

  S.openTeamEditModal = function (teamId) {
    var team = S.getTeamById(teamId);
    var modal = S.$("team-detail-modal");
    var title = S.$("team-detail-title");
    var content = S.$("team-detail-content");
    if (!team || !modal || !content) return;
    if (title) title.textContent = "Team " + (team.name || team.id);
    var roleRank = { STSO: 0, LTSO: 1, TSO: 2 };
    var members = (team.members || []).slice().sort(function (a, b) {
      var pa = S.memberLine(a);
      var pb = S.memberLine(b);
      var ra = pa ? (roleRank[pa.role] != null ? roleRank[pa.role] : 3) : 3;
      var rb = pb ? (roleRank[pb.role] != null ? roleRank[pb.role] : 3) : 3;
      if (ra !== rb) return ra - rb;
      return +a - +b;
    });
    var rows = members
      .map(function (mid) {
        var p = S.memberLine(mid);
        return p ? S.lineCardHtml(p, { removable: true, compact: true, teamId: team.id }) : "";
      })
      .join("");
    content.innerHTML =
      '<div class="team-line-cols muted"><span></span><span>Role</span><span>Sex</span><span>Hours</span><span>RDO</span><span>FT/PT</span><span></span></div>' +
      '<div class="team-board-list" data-team-id="' + team.id + '"' +
      (rows ? "" : ' data-empty="1"') + ">" +
      (rows || "") +
      "</div>" +
      '<p class="muted">Drag unassigned lines from the pool into this list. Use \u2715 to remove.</p>';
    modal.style.display = "block";
    if (S.initSortables) S.initSortables();
  };

  S.toggleFollowTeam = function (teamId) {
    var team = S.getTeamById(teamId);
    if (!team) return;
    team.followMe = !team.followMe;
    S.teams.buildOpen = true;
    S.renderTeams();
    if (S.updateStatus) S.updateStatus((team.followMe ? "Opened " : "Closed ") + (team.name || team.id));
  };

  var prevApply = S.applyFollowMe;
  S.applyFollowMe = function () {
    var following = S.teams.teams.some(function (t) { return !!t.followMe; });
    var open = !!S.teams.buildOpen || following;
    var docks = S.$("team-follow-docks");
    if (!docks) {
      if (typeof prevApply === "function") prevApply();
      return;
    }
    if (open) {
      docks.hidden = false;
      docks.classList.add("is-active");
      document.body.classList.add("team-follow-active");
      if (S.initFloatPanels) S.initFloatPanels();
    } else {
      docks.hidden = true;
      docks.classList.remove("is-active");
      document.body.classList.remove("team-follow-active");
    }
  };

  var prevBoards = S.renderTeamBoards;
  S.renderTeamBoards = function () {
    if (typeof prevBoards === "function") prevBoards();
    var dock = S.$("team-boards-follow");
    if (!dock) return;
    var following = (S.teams.teams || []).filter(function (t) { return !!t.followMe; });
    dock.innerHTML = following.length
      ? following.map(S.teamSummaryCardHtml).join("")
      : '<p class="muted">Tap a team in Assignment to open its card.</p>';
  };

  var prevStats = S.renderTeamStats;
  S.renderTeamStats = function () {
    if (typeof prevStats === "function") prevStats();
    var body = S.$("team-stats-body");
    if (!body) return;
    var lines = body.querySelectorAll(".team-stat-team-line");
    var rows = (S.computeTeamStats ? S.computeTeamStats().teamRows : []) || [];
    for (var i = 0; i < lines.length && i < rows.length; i++) {
      lines[i].setAttribute("data-build-team", rows[i].id);
      if (rows[i].followMe) lines[i].classList.add("is-followed");
      else lines[i].classList.remove("is-followed");
    }
  };

  if (!S._teamBuildBound) {
    S._teamBuildBound = true;
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === "btn-team-build") {
        S.teams.buildOpen = true;
        S.applyFollowMe();
        S.renderTeamStats();
        if (S.initFloatPanels) S.initFloatPanels();
      } else if (t.id === "btn-build-close") {
        S.teams.buildOpen = false;
        if (!(S.teams.teams || []).some(function (tm) { return tm.followMe; })) S.applyFollowMe();
      } else if (t.getAttribute && t.getAttribute("data-build-team")) {
        S.toggleFollowTeam(t.getAttribute("data-build-team"));
      } else if (t.closest && t.closest("[data-build-team]")) {
        S.toggleFollowTeam(t.closest("[data-build-team]").getAttribute("data-build-team"));
      } else if (t.getAttribute && t.getAttribute("data-team-edit")) {
        S.openTeamEditModal(t.getAttribute("data-team-edit"));
      } else if (t.id === "team-detail-close") {
        var md = S.$("team-detail-modal");
        if (md) md.style.display = "none";
      }
    });
  }
})(window.Scheduler);
