/** Paint RDO blue / BAG yellow on the Lines tab */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function dutyFor(line, dayIndex) {
    var duty = S.getRotationDuty ? S.getRotationDuty(line.id, dayIndex) : null;
    if (duty) return duty;
    return line.function || null;
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
        return;
      }
      var duty = dutyFor(line, day);
      if (duty === "BAG" || duty === "BAGS") {
        cell.classList.add("cell-bag", "cell-function-duty");
        cell.classList.remove("cell-rdo");
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
      paintLinesTable();
      return result;
    };
    wrapped._lineColorsWrapped = true;
    S[name] = wrapped;
  }

  wrap("renderLines");
  wrap("renderAll");

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || t.getAttribute("data-field") !== "function") return;
    var line = S.findLineById ? S.findLineById(t.getAttribute("data-line-id")) : null;
    if (!line) return;
    var fv = t.value;
    line.function = fv === "DFO" || fv === "PAX" || fv === "BAG" ? fv : "";
    if (S.renderLines) S.renderLines();
    else paintLinesTable();
  });

  document.addEventListener("DOMContentLoaded", function () {
    wrap("renderLines");
    wrap("renderAll");
    paintLinesTable();
  });
})(window.Scheduler);
