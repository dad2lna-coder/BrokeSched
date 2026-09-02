/** Entry point — classic scripts, works from file:// and OneDrive */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  S.switchTab = function (tabId) {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    document.querySelectorAll(".panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-" + tabId);
    });
    if (tabId === "lines" && S.renderLines) S.renderLines();
    if (tabId === "coverage" && S.renderCoverage) S.renderCoverage();
    if (tabId === "teams" && S.renderTeams) S.renderTeams();
    if (tabId === "reports" && S.renderReports) S.renderReports();
  };

  function init() {
    if (S.$("cfg-start") && !S.$("cfg-start").value) {
      var d = S.parseStartDate(null);
      S.$("cfg-start").value = S.toDateInputValue(d);
      S.state.startDate = d;
    }

    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        S.switchTab(btn.dataset.tab);
      });
    });

    if (S.$("btn-generate")) S.$("btn-generate").addEventListener("click", S.generate);
    if (S.$("btn-export")) S.$("btn-export").addEventListener("click", S.exportJson);
    if (S.$("btn-import")) {
      S.$("btn-import").addEventListener("click", function () {
        var fileInput = S.$("file-import");
        if (fileInput) {
          fileInput.value = "";
          fileInput.click();
        }
      });
    }
    if (S.$("file-import")) {
      S.$("file-import").addEventListener("change", function (event) {
        var file = event.target.files && event.target.files[0];
        S.importJsonFile(file);
      });
    }
    if (S.$("btn-clear")) S.$("btn-clear").addEventListener("click", S.clearAll);

    if (S.$("btn-clear-certs")) {
      S.$("btn-clear-certs").addEventListener("click", function () {
        if (S.clearLineFunctions) S.clearLineFunctions();
        if (S.renderLines) S.renderLines();
        if (S.updateStatus) S.updateStatus("Cleared all line functions.");
        var hint = S.$("cert-assign-hint");
        if (hint) hint.textContent = "Functions cleared.";
      });
    }
    if (S.$("btn-export-lines-excel")) {
      S.$("btn-export-lines-excel").addEventListener("click", function () {
        if (S.exportLinesExcel) S.exportLinesExcel();
      });
    }

    if (S.$("btn-add-shift")) {
      S.$("btn-add-shift").addEventListener("click", function () {
        S.readShiftsFromDom();
        var id = "S" + S.shiftSeq++;
        S.state.shifts.push({
          id: id,
          name: "Shift",
          start: "08:00",
          end: "16:30",
          paid: 8,
          force: 0,
          ltsoForce: 0,
          stsoForce: 0,
          rdoHard: []
        });
        S.renderShiftsTable();
      });
    }

    if(S.initAirportConfig) S.initAirportConfig();
    if(S.renderShiftsTable) S.renderShiftsTable();
    if(S.initTeams) S.initTeams();
    if(S.initShiftDayTimes) S.initShiftDayTimes();
    if(S.initFunctionCoverage) S.initFunctionCoverage();
    if(S.initReports) S.initReports();
    if(S.bindLinesUI) S.bindLinesUI();
    if(S.initCoverageView) S.initCoverageView();

    function onNewTeam(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!S.createTeam) return;
      var t = S.createTeam();
      if (S.renderTeams) S.renderTeams();
      if (S.updateStatus) S.updateStatus("Created " + (t && t.name ? t.name : "team"));
    }
    S.onNewTeam = onNewTeam;
    ["btn-team-new", "btn-team-new-2", "btn-team-new-dock"].forEach(function (id) {
      var btn = S.$(id);
      if (btn) btn.addEventListener("click", onNewTeam);
    });

    S.updateStatus("Scheduler ready.");
    S.renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window.Scheduler);
