/** Setup boot: load airfield config, show modal, confirm to airport folder or download */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var CONFIRMED = "blade.airfieldConfirmed";

  function invoke(cmd, args) {
    var core = window.__TAURI__ && window.__TAURI__.core;
    if (core && typeof core.invoke === "function") return core.invoke(cmd, args || {});
    return Promise.reject(new Error("no-tauri"));
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

  function applyLoaded(raw) {
    var dest = S.getAirportConfig && S.getAirportConfig();
    if (!dest || !raw) return false;
    var cfg = raw.config || raw.airportConfig || raw;
    if (!cfg || typeof cfg !== "object") return false;
    if (cfg.startTime) dest.startTime = cfg.startTime;
    if (cfg.endTime) dest.endTime = cfg.endTime;
    if (cfg.volumePerHour) dest.volumePerHour = cfg.volumePerHour;
    if (Array.isArray(cfg.terminals)) dest.terminals = cfg.terminals;
    return true;
  }

  function tryFetchWeb() {
    var code = S.getAirportCode ? S.getAirportCode() : "";
    var names = [];
    if (code) names.push("airport/" + code + "-airfield.json");
    names.push("airport/airfield.json");
    var chain = Promise.reject();
    names.forEach(function (url) {
      chain = chain.catch(function () {
        return fetch(url, { cache: "no-store" }).then(function (r) {
          if (!r.ok) throw new Error("missing " + url);
          return r.json();
        });
      });
    });
    return chain;
  }

  function tryReadFolder() {
    var code = S.getAirportCode ? S.getAirportCode() : "";
    if (!code || !S.isTauri || !S.isTauri()) return Promise.reject(new Error("no-folder"));
    return invoke("read_shared_file", { filename: "airfield.json", airport: code }).then(function (text) {
      return JSON.parse(text);
    });
  }

  S.exportAirfieldConfig = function () {
    var data = payload();
    var code = data.airport || "XXX";
    var filename = code + "_airfield.json";
    if (S.isTauri && S.isTauri()) {
      var bytes = Array.from(new TextEncoder().encode(JSON.stringify(data, null, 2)));
      return invoke("write_shared_bytes", {
        filename: "airfield.json",
        bytes: bytes,
        airport: code
      }).then(function (path) {
        if (S.updateStatus) S.updateStatus("Saved airfield to " + path);
        return path;
      }).catch(function (err) {
        downloadJson(filename, data);
        if (S.updateStatus) S.updateStatus("Folder write failed, downloaded " + filename + " (" + err + ")");
      });
    }
    downloadJson(filename, data);
    if (S.updateStatus) S.updateStatus("Downloaded " + filename + " (web — drop it in the airport folder).");
    return Promise.resolve();
  };

  S.confirmAirfieldConfig = function () {
    try { sessionStorage.setItem(CONFIRMED, "1"); } catch (e) {}
    return S.exportAirfieldConfig().then(function () {
      var modal = S.$("airport-config-modal");
      if (modal) modal.style.display = "none";
    });
  };

  S.openAirfieldConfirm = function () {
    var modal = S.$("airport-config-modal");
    if (modal) modal.style.display = "block";
    if (S.initAirportConfig) {
      /* already inited; just re-render if present */
    }
    ensureConfirmButton();
  };

  function ensureConfirmButton() {
    var modal = S.$("airport-config-modal");
    if (!modal || modal.querySelector("#btn-airfield-confirm")) return;
    var header = modal.querySelector(".modal-header") || modal.querySelector(".modal-content");
    if (!header) return;
    var bar = document.createElement("div");
    bar.className = "toolbar";
    bar.style.margin = "0.5rem 0";
    bar.innerHTML =
      '<button type="button" class="btn btn-amber" id="btn-airfield-confirm">Confirm airfield</button>' +
      '<span class="muted">Saves airfield.json to the airport folder. Web downloads the file.</span>';
    header.appendChild(bar);
    S.$("btn-airfield-confirm").addEventListener("click", function () {
      S.confirmAirfieldConfig();
    });
  }

  S.loadAirfieldFromFolder = function () {
    return tryReadFolder().catch(function () {
      return tryFetchWeb();
    }).then(function (raw) {
      if (applyLoaded(raw) && S.updateStatus) S.updateStatus("Loaded airfield configuration.");
      return raw;
    }).catch(function () {
      if (S.updateStatus) S.updateStatus("No airfield file found. Confirm the seeded layout.");
      return null;
    });
  };

  function bootOnce() {
    if (S._airfieldBooted) return;
    S._airfieldBooted = true;
    ensureConfirmButton();
    S.loadAirfieldFromFolder().then(function () {
      var already = false;
      try { already = sessionStorage.getItem(CONFIRMED) === "1"; } catch (e) {}
      if (!already) S.openAirfieldConfirm();
    });
  }

  if (typeof S.initAirportConfig === "function" && !S.initAirportConfig._bootWrapped) {
    var orig = S.initAirportConfig;
    S.initAirportConfig = function () {
      orig.apply(this, arguments);
      bootOnce();
    };
    S.initAirportConfig._bootWrapped = true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(bootOnce, 300);
  });
})(window.Scheduler);
