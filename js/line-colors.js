/** Paint RDO black / BAG red / work days by that day's mod set */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var MODSET_COLORS = ["#2A9D8F", "#E76F51", "#6A4C93", "#90BE6D", "#F4A261", "#457B9D", "#E9C46A", "#D62828", "#2D6A4F", "#9B5DE5", "#00BBF9", "#FB5607"];
  var TEAM_COLORS = ["#BDE0FE", "#CDB4DB", "#A8DADC", "#FFC8DD", "#B5EAD7", "#FFDAC1", "#C7CEEA", "#E2F0CB"];

  function dutyFor(line, dayIndex) {
    var duty = S.getRotationDuty ? S.getRotationDuty(line.id, dayIndex) : null;
    return duty || line.function || null;
  }
  function workLabel(line) {
    if (line.shiftLabel) return line.shiftLabel;
    var sh = S.getShift ? S.getShift(line.shiftId) : null;
    if (sh && sh.start && sh.end) return sh.start + "\u2013" + sh.end;
    return "WORK";
  }
  function teamOf(line) {
    if (!S.teams || !S.teams.teams) return null;
    var id = line && line.id;
    for (var i = 0; i < S.teams.teams.length; i++) {
      var t = S.teams.teams[i], members = t.members || [];
      for (var j = 0; j < members.length; j++) {
        if (String(members[j]) === String(id)) return t;
      }
    }
    return null;
  }
  function modColor(line, day) {
    var team = teamOf(line);
    var msId = null;
    if (team && S.modSetForTeamDay) msId = S.modSetForTeamDay(team.id, day);
    if (msId == null && line && line.modSetId != null) msId = line.modSetId;
    var list = S.listModSets ? S.listModSets() : [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(msId)) return MODSET_COLORS[i % MODSET_COLORS.length];
    }
    return null;
  }
  function teamColor(line) {
    var team = teamOf(line);
    if (!team || !S.teams) return null;
    var idx = 0;
    for (var i = 0; i < S.teams.teams.length; i++) {
      if (S.teams.teams[i].id === team.id) { idx = i; break; }
    }
    return TEAM_COLORS[idx % TEAM_COLORS.length];
  }

  function paintLinesTable() {
    var tbody = document.getElementById("lines-tbody");
    if (!tbody) return;
    tbody.querySelectorAll("td.cell-toggle").forEach(function (cell) {
      var line = S.findLineById ? S.findLineById(cell.getAttribute("data-line-id")) : null;
      var day = +cell.getAttribute("data-day");
      if (!line || isNaN(day)) return;
      var sched = (S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [])[day] || "RDO";
      cell.style.background = "";
      cell.style.color = "";
      if (sched !== "WORK") {
        cell.className = "cell-rdo cell-toggle";
        cell.textContent = "RDO";
        cell.style.background = "#000";
        cell.style.color = "#fff";
        cell.style.opacity = "1";
        return;
      }
      var duty = dutyFor(line, day);
      var isBag = duty === "BAG" || duty === "BAGS";
      var extra = isBag ? " cell-function-duty cell-bag" : "";
      cell.className = "cell-work cell-toggle" + extra;
      cell.textContent = workLabel(line);
      var fill = isBag ? "" : modColor(line, day);
      if (fill) {
        cell.style.background = fill;
        cell.style.color = "#111";
        cell.style.opacity = "1";
      }
    });
    tbody.querySelectorAll("tr").forEach(function (tr) {
      var toggle = tr.querySelector("td.cell-toggle");
      if (!toggle) return;
      var line = S.findLineById ? S.findLineById(toggle.getAttribute("data-line-id")) : null;
      if (!line) return;
      var tc = teamColor(line);
      if (tr.children[0] && tc) {
        tr.children[0].style.background = tc;
        tr.children[0].style.color = "#111";
      }
    });
  }

  S.paintLineColors = paintLinesTable;
  function wrap(name) {
    var orig = S[name];
    if (typeof orig !== "function" || orig._lineColorsWrapped) return;
    var wrapped = function () {
      var result = orig.apply(this, arguments);
      setTimeout(paintLinesTable, 0);
      return result;
    };
    wrapped._lineColorsWrapped = true;
    S[name] = wrapped;
  }
  wrap("renderLines");
  wrap("renderAll");
  document.addEventListener("DOMContentLoaded", function () {
    wrap("renderLines");
    wrap("renderAll");
    paintLinesTable();
  });
})(window.Scheduler);
