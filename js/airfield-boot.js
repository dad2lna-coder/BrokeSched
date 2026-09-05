/** Open airfield modal on boot. Web has no folder; localStorage + optional download. */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function payload() {
    var cfg = S.getAirportConfig ? S.getAirportConfig() : {};
    return {
      app: "blade-airfield",
      version: 1,
      airport: S.getAirportCode ? S.getAirportCode() : "",
      savedAt: new Date().toISOString(),
      config: cfg
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
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
    ensureConfirmButton();
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
      }).catch(function () {
        downloadJson(filename, data);
      });
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

  function ensureConfirmButton() {
    var modal = document.getElementById("airport-config-modal");
    if (!modal || modal.querySelector("#btn-airfield-confirm")) return;
    var header = modal.querySelector(".modal-header") || modal.querySelector(".modal-content");
    if (!header) return;
    var bar = document.createElement("div");
    bar.className = "toolbar";
    bar.style.margin = "0.5rem 0";
    bar.innerHTML =
      '<button type="button" class="btn btn-amber" id="btn-airfield-confirm">Confirm airfield</button>' +
      '<span class="muted">Web: saves in this browser and downloads JSON.</span>';
    header.appendChild(bar);
    document.getElementById("btn-airfield-confirm").addEventListener("click", function () {
      S.confirmAirfieldConfig();
    });
  }

  function tryStored() {
    try {
      var raw = localStorage.getItem("blade.airfieldJson");
      if (!raw) return;
      var data = JSON.parse(raw);
      var dest = S.getAirportConfig && S.getAirportConfig();
      var cfg = data && (data.config || data);
      if (!dest || !cfg) return;
      if (cfg.startTime) dest.startTime = cfg.startTime;
      if (cfg.endTime) dest.endTime = cfg.endTime;
      if (cfg.volumePerHour) dest.volumePerHour = cfg.volumePerHour;
      if (Array.isArray(cfg.terminals)) dest.terminals = cfg.terminals;
    } catch (e) {}
  }

  function boot() {
    tryStored();
    ensureConfirmButton();
    S.openAirfieldConfirm();
  }

  window.addEventListener("blade-intro-done", boot);
  document.addEventListener("DOMContentLoaded", function () {
    boot();
    setTimeout(boot, 600);
    setTimeout(boot, 1800);
    setTimeout(boot, 3200);
  });
  setTimeout(boot, 400);
})(window.Scheduler);
