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
    var tbody = S.$("lines-tbody");
    if (!tbody) return;
    var cells = tbody.querySelectorAll("td.cell-toggle");
    cells.forEach(function (cell) {
      var line = S.findLineById(cell.getAttribute("data-line-id"));
      var day = +cell.getAttribute("data-day");
      if (!line || isNaN(day)) return;
      var sched = (S.state.schedule[line.id] || [])[day] || "RDO";
      if (sched !== "WORK") {
        cell.classList.add("cell-rdo");
        cell.classList.remove("cell-bag", "cell-work");
        return;
      }
      var duty = dutyFor(line, day);
      if (duty === "BAG" || duty === "BAGS") {
        cell.classList.add("cell-bag", "cell-function-duty");
        cell.textContent = "BAG";
      }
    });
  }

  var origRender = S.renderLines;
  if (origRender) {
    S.renderLines = function () {
      origRender.apply(this, arguments);
      paintLinesTable();
    };
  }

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || t.getAttribute("data-field") !== "function") return;
    var line = S.findLineById(t.getAttribute("data-line-id"));
    if (!line) return;
    var fv = t.value;
    line.function = fv === "DFO" || fv === "PAX" || fv === "BAG" ? fv : "";
    if (S.renderLines) S.renderLines();
  });
})(window.Scheduler);
