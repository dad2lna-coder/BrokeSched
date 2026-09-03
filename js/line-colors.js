/** Paint RDO blue / BAG light red / DFO yellow on the Lines tab */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function dutyFor(line, dayIndex) {
    var duty = S.getRotationDuty ? S.getRotationDuty(line.id, dayIndex) : null;
    if (duty) return duty;
    return line.function || null;
  }

  function applyBagDutyToWorkDays(line) {
    if (!line || line.function !== "BAG") return;
    if (!S.state.functionRotation) S.state.functionRotation = {};
    var key = String(line.id);
    if (!S.state.functionRotation[key]) S.state.functionRotation[key] = [];
    var sched = S.state.schedule[line.id] || S.state.schedule[key] || [];
    var days = Math.max(sched.length, (S.state.weekCount || 1) * 7);
    for (var i = 0; i < days; i++) {
      while (S.state.functionRotation[key].length <= i) S.state.functionRotation[key].push(null);
      if (sched[i] === "WORK") S.state.functionRotation[key][i] = "BAG";
    }
  }

  function applyDfoDutyToWorkDays(line) {
    if (!line || line.function !== "DFO") return;
    if (!S.state.functionRotation) S.state.functionRotation = {};
    var key = String(line.id);
    if (!S.state.functionRotation[key]) S.state.functionRotation[key] = [];
    var sched = S.state.schedule[line.id] || S.state.schedule[key] || [];
    var days = Math.max(sched.length, (S.state.weekCount || 1) * 7);
    for (var i = 0; i < days; i++) {
      while (S.state.functionRotation[key].length <= i) S.state.functionRotation[key].push(null);
      if (sched[i] === "WORK") S.state.functionRotation[key][i] = "DFO";
    }
  }

  function fixDayHeaders() {
    var thead = document.getElementById("lines-thead");
    if (!thead) return;
    var ths = thead.querySelectorAll("th");
    if (!ths.length) return;
    var names = S.DAYS || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var start = 7;
    var end = ths.length - 1;
    var di = 0;
    for (var i = start; i < end; i++, di++) {
      ths[i].textContent = names[di % 7];
    }
  }

  function paintLinesTable() {
    fixDayHeaders();
    var tbody = document.getElementById("lines-tbody");
    if (!tbody) return;
    var cells = tbody.querySelectorAll("td.cell-toggle");
    cells.forEach(function (cell) {
      var line = S.findLineById ? S.findLineById(cell.getAttribute("data-line-id")) : null;
      var day = +cell.getAttribute("data-day");
      if (!line || isNaN(day)) return;
      var sched = (S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [])[day] || "RDO";
      if (sched !== "WORK") {
        cell.className = "cell-rdo cell-toggle";
        cell.textContent = "RDO";
        return;
      }
      var duty = dutyFor(line, day);
      var isBag = duty === "BAG" || duty === "BAGS" || duty === "baggage";
      var isDfo = duty === "DFO";
      var extra = "";
      var label = line.shiftLabel || "WORK";
      if (isBag) {
        extra = " cell-function-duty cell-bag";
        label = "BAG";
      } else if (isDfo) {
        extra = " cell-function-duty cell-dfo";
        label = "DFO";
      } else if (duty) {
        extra = " cell-function-duty";
      }
      cell.className = "cell-work cell-toggle" + extra;
      cell.textContent = label;
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
  wrap("generateFunctionAssignments");

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || t.getAttribute("data-field") !== "function") return;
    var line = S.findLineById ? S.findLineById(t.getAttribute("data-line-id")) : null;
    if (!line) return;
    var fv = t.value;
    line.function = fv === "DFO" || fv === "PAX" || fv === "BAG" ? fv : "";
    if (line.function === "BAG") applyBagDutyToWorkDays(line);
    if (line.function === "DFO") applyDfoDutyToWorkDays(line);
    if (S.renderLines) S.renderLines();
    else paintLinesTable();
  });

  document.addEventListener("DOMContentLoaded", function () {
    wrap("renderLines");
    wrap("renderAll");
    wrap("generateFunctionAssignments");
    paintLinesTable();
  });
})(window.Scheduler);
