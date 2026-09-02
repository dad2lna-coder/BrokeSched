/** Paint RDO blue / BAG yellow on the Lines tab */
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

  function paintLinesTable() {
    var tbody = document.getElementById("lines-tbody");
    if (!tbody) return;
    var cells = tbody.querySelectorAll("td.cell-toggle");
    cells.forEach(function (cell) {
      var line = S.findLineById ? S.findLineById(cell.getAttribute("data-line-id")) : null;
      var day = +cell.getAttribute("data-day");
      if (!line || isNaN(day)) return;
      var sched = (S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [])[day] || "RDO";
      if (sched !== "WORK") {
        cell.classList.add("cell-rdo");
        cell.classList.remove("cell-bag", "cell-work", "cell-function-duty");
        cell.textContent = "RDO";
        return;
      }
      var duty = dutyFor(line, day);
      cell.classList.remove("cell-rdo");
      cell.classList.add("cell-work");
      if (duty === "BAG" || duty === "BAGS") {
        cell.classList.add("cell-bag", "cell-function-duty");
        cell.textContent = "BAG";
      } else {
        cell.classList.remove("cell-bag");
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
  wrap("generateFunctionAssignments");

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || t.getAttribute("data-field") !== "function") return;
    var line = S.findLineById ? S.findLineById(t.getAttribute("data-line-id")) : null;
    if (!line) return;
    var fv = t.value;
    line.function = fv === "DFO" || fv === "PAX" || fv === "BAG" ? fv : "";
    if (line.function === "BAG") applyBagDutyToWorkDays(line);
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
