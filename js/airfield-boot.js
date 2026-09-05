/** Airfield boot: default layout, modal open, import/confirm */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function defaultConfig() {
    return {
      startTime: "03:30",
      endTime: "23:00",
      volumePerHour: { STD: 150, PRE: 240, MIX: 195 },
      terminals: [{
        id: 1,
        name: "Terminal 1",
        startTime: "03:30",
        endTime: "23:00",
        baseTSOCost: { STD: 6, PRE: 5, MIX: 6 },
        checkpoints: [{
          id: 1,
          name: "Checkpoint 1",
          startTime: "03:30",
          endTime: "23:00",
          modSets: [
            { id: 1, name: "MS-1", startTime: "03:30", lanes: 2, program: "STD" },
            { id: 2, name: "MS-2", startTime: "03:30", lanes: 2, program: "STD" },
            { id: 3, name: "MS-3", startTime: "03:30", lanes: 2, program: "STD" },
            { id: 4, name: "MS-4", startTime: "03:30", lanes: 2, program: "PRE" },
            { id: 5, name: "MS-5", startTime: "03:30", lanes: 2, program: "PRE" },
            { id: 6, name: "MS-6", startTime: "03:30", lanes: 2, program: "PRE" }
          ]
        }]
      }]
    };
  }

  function dest() {
    return S.getAirportConfig ? S.getAirportConfig() : null;
  }

  function applyCfg(cfg) {
    var d = dest();
    if (!d || !cfg) return false;
    if (cfg.startTime) d.startTime = cfg.startTime;
    if (cfg.endTime) d.endTime = cfg.endTime;
    if (cfg.volumePerHour) d.volumePerHour = cfg.volumePerHour;
    if (Array.isArray(cfg.terminals)) d.terminals = cfg.terminals;
    return true;
  }

  function applyDefault() {
    applyCfg(defaultConfig());
  }

  function payload() {
    return {
      app: "blade-airfield",
      version: 1,
      airport: S.getAirportCode ? S.getAirportCode() : "",
      savedAt: new Date().toISOString(),
      config: dest() || defaultConfig()
    };
  }

  function downloadJson(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  S.openAirfieldConfirm = function () {
    var modal = document.getElementById("airport-config-modal");
    if (!modal) return false;
    modal.style.display = "block";
    modal.style.zIndex = "10050";
    ensureButtons();
    return true;
  };

  S.exportAirfieldConfig = function () {
    var data = payload();
    var filename = (data.airport || "WEB") + "_airfield.json";
    try { localStorage.setItem("blade.airfieldJson", JSON.stringify(data)); } catch (e) {}
    var core = window.__TAURI__ && window.__TAURI__.core;
    if (core && typeof core.invoke === "function" && data.airport) {
      var bytes = Array.from(new TextEncoder().encode(JSON.stringify(data, null, 2)));
      return core.invoke("write_shared_bytes", {
        filename: "airfield.json",
        bytes: bytes,
        airport: data.airport
      }).then(function (path) {
        if (S.updateStatus) S.updateStatus("Saved airfield to " + path);
      }).catch(function () { downloadJson(filename, data); });
    }
    downloadJson(filename, data);
    if (S.updateStatus) S.updateStatus("Downloaded " + filename);
    return Promise.resolve();
  };

  S.confirmAirfieldConfig = function () {
    return S.exportAirfieldConfig().then(function () {
      var modal = document.getElementById("airport-config-modal");
      if (modal) modal.style.display = "none";
    });
  };

  S.importAirfieldFile = function (file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var raw = JSON.parse(String(reader.result || "{}"));
        var cfg = raw.config || raw.airportConfig || raw;
        if (!applyCfg(cfg)) throw new Error("not an airfield config");
        if (S.updateStatus) S.updateStatus("Imported " + file.name);
        if (typeof S.initAirportConfig === "function") {
          /* re-render via opening */
        }
        var list = document.getElementById("terminals-list");
        if (list && S.getAirportConfig) {
          var openBtn = document.getElementById("btn-airport-config");
          if (openBtn) openBtn.click();
          S.openAirfieldConfirm();
        }
      } catch (err) {
        if (S.updateStatus) S.updateStatus("Import failed: " + (err && err.message ? err.message : err));
      }
    };
    reader.readAsText(file);
  };

  function ensureButtons() {
    var modal = document.getElementById("airport-config-modal");
    if (!modal) return;
    var header = modal.querySelector(".modal-header") || modal.querySelector(".modal-content");
    if (!header) return;
    if (!modal.querySelector("#btn-airfield-import")) {
      var wrap = document.createElement("div");
      wrap.className = "toolbar";
      wrap.style.margin = "0.5rem 0";
      wrap.innerHTML =
        '<button type="button" class="btn" id="btn-airfield-import">Import configuration</button>' +
        '<input type="file" id="file-airfield-import" accept="application/json,.json" style="display:none" />' +
        '<button type="button" class="btn btn-amber" id="btn-airfield-confirm">Confirm airfield</button>';
      header.appendChild(wrap);
      document.getElementById("btn-airfield-import").addEventListener("click", function () {
        var inp = document.getElementById("file-airfield-import");
        if (inp) { inp.value = ""; inp.click(); }
      });
      document.getElementById("file-airfield-import").addEventListener("change", function (e) {
        S.importAirfieldFile(e.target.files && e.target.files[0]);
      });
      document.getElementById("btn-airfield-confirm").addEventListener("click", function () {
        S.confirmAirfieldConfig();
      });
    }
  }

  function boot() {
    applyDefault();
    ensureButtons();
    S.openAirfieldConfirm();
  }

  window.addEventListener("blade-intro-done", boot);
  document.addEventListener("DOMContentLoaded", function () {
    boot();
    setTimeout(boot, 700);
    setTimeout(boot, 2000);
  });
  setTimeout(boot, 400);
})(window.Scheduler);
