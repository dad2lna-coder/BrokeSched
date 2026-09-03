/** Entry point — classic scripts, works from file:// and OneDrive */
window.Scheduler = window.Scheduler || {};

(function (S) {
  "use strict";

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

    // --- Instructions Modal Logic ---
    const instructionsModal = S.$('instructions-modal');
    const instructionsBtn = S.$('btn-instructions');
    const instructionsCloseBtn = S.$('instructions-modal-close');
    const instructionsContent = S.$('instructions-content');

    if (instructionsBtn && instructionsModal && instructionsCloseBtn && instructionsContent) {
      const showInstructions = async () => {
        try {
          const response = await fetch('INSTRUCTIONS.md');
          if (!response.ok) {
            throw new Error('Could not load INSTRUCTIONS.md. Make sure the file is in the same directory as index.html.');
          }
          const markdownText = await response.text();
          // To preserve formatting, including line breaks, we wrap the text in a <pre> tag.
          instructionsContent.innerHTML = `<pre>${markdownText}</pre>`;
          instructionsModal.style.display = 'block';
        } catch (error) {
          console.error('Error fetching instructions:', error);
          instructionsContent.innerHTML = `<p style="color: red;">${error.message}</p>`;
          instructionsModal.style.display = 'block';
        }
      };

      const hideInstructions = () => {
        instructionsModal.style.display = 'none';
      };

      instructionsBtn.addEventListener('click', showInstructions);
      instructionsCloseBtn.addEventListener('click', hideInstructions);

      // Close the modal if the user clicks on the background overlay
      window.addEventListener('click', (event) => {
        if (event.target === instructionsModal) {
          hideInstructions();
        }
      });
    }
    // --- End of Instructions Modal Logic ---

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

    S.initAirportConfig();
    S.renderShiftsTable();
    if (S.initTeams) S.initTeams();
    if (S.initShiftDayTimes) S.initShiftDayTimes();
    if (S.initFunctionCoverage) S.initFunctionCoverage();
    if (S.initReports) S.initReports();
    if (S.bindLinesUI) S.bindLinesUI();

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

    ["btn-team-new", "btn-team-new-2"].forEach(function (id) {
      var btn = S.$(id);
      if (btn) btn.addEventListener("click", onNewTeam);
    });

    S.updateStatus("Scheduler Pre v2 — build 20260902h · Excel xlsx + BAG yellow");
    S.renderAll();
  }

  document.addEventListener("DOMContentLoaded", init);

})(window.Scheduler);
