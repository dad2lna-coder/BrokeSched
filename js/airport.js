/** Airport configuration modal — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var airportConfig = { startTime: "03:30", endTime: "23:00", volumePerHour: { STD: 150, PRE: 240, MIX: 195 }, terminals: [] };
  var nextTerminalId = 1, nextCheckpointId = 1, nextModSetId = 1;
  var activeDetailView = null;

  S.initAirportConfig = function () {
    var modal = S.$("airport-config-modal");
    var openBtn = S.$("btn-airport-config");
    var closeBtn = S.$("modal-close-btn");
    if (openBtn) openBtn.addEventListener("click", function () {
      if (modal) modal.style.display = "block";
      renderAirportConfig();
    });
    if (closeBtn) closeBtn.addEventListener("click", function () {
      if (modal) modal.style.display = "none";
    });
    window.addEventListener("click", function (event) {
      if (event.target == modal) modal.style.display = "none";
    });
    if (S.$("airport-start-time")) {
      S.$("airport-start-time").addEventListener("change", function (e) {
        airportConfig.startTime = e.target.value;
      });
    }
    if (S.$("airport-end-time")) {
      S.$("airport-end-time").addEventListener("change", function (e) {
        airportConfig.endTime = e.target.value;
      });
    }
    if (S.$("add-terminal-btn")) {
      S.$("add-terminal-btn").addEventListener("click", function () {
        airportConfig.terminals.push({
          id: nextTerminalId++,
          name: "Terminal " + (nextTerminalId - 1),
          startTime: airportConfig.startTime,
          endTime: airportConfig.endTime,
          baseTSOCost: { STD: 6, PRE: 5, MIX: 6 },
          checkpoints: []
        });
        renderAirportConfig();
      });
    }
    seedBaselineAirport();
    renderAirportConfig();
  };

  function seedBaselineAirport() {
    if (airportConfig.terminals && airportConfig.terminals.length) return;
    airportConfig.terminals = [{
      id: 1,
      name: "Terminal A",
      startTime: "03:30",
      endTime: "23:00",
      baseTSOCost: { STD: 6, PRE: 5, MIX: 6 },
      checkpoints: [
        {
          id: 1,
          name: "A Main",
          startTime: "03:30",
          endTime: "23:00",
          modSets: [
            { id: 1, startTime: "03:30", lanes: 2, program: "STD" },
            { id: 2, startTime: "05:00", lanes: 2, program: "MIX" }
          ]
        },
        {
          id: 2,
          name: "A PreCheck",
          startTime: "04:00",
          endTime: "21:00",
          modSets: [{ id: 3, startTime: "04:00", lanes: 2, program: "PRE" }]
        }
      ]
    }];
    nextTerminalId = 2;
    nextCheckpointId = 3;
    nextModSetId = 4;
  }
