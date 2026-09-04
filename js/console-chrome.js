/** Ops-console chrome + OS operator + shared-folder export */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var LS_AIRPORT = "blade.airportCode";
  var LS_OPERATOR = "blade.operator";

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function fileSafe(name) {
    return String(name || "OPERATOR").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "OPERATOR";
  }
  function invoke(cmd, args) {
    var core = window.__TAURI__ && window.__TAURI__.core;
    if (core && typeof core.invoke === "function") return core.invoke(cmd, args || {});
    return Promise.reject(new Error("no-tauri"));
  }

  S.getAirportCode = function () {
    var st = (S.state && S.state.airportCode) || localStorage.getItem(LS_AIRPORT) || "";
    return String(st).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  };
  S.setAirportCode = function (code) {
    var c = String(code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    if (!S.state) S.state = {};
    S.state.airportCode = c;
    try { localStorage.setItem(LS_AIRPORT, c); } catch (e) {}
    var el = $("console-airport");
    if (el) el.textContent = c || "—";
    return c;
  };
  S.getOperator = function () {
    return (S.state && S.state.operator) || localStorage.getItem(LS_OPERATOR) || "OPERATOR";
  };
  S.setOperator = function (name) {
    var n = String(name || "OPERATOR").trim() || "OPERATOR";
    if (!S.state) S.state = {};
    S.state.operator = n;
    try { localStorage.setItem(LS_OPERATOR, n); } catch (e) {}
    var el = $("console-operator");
    if (el) el.textContent = n;
    return n;
  };
  S.exportDateStamp = function (d) {
    d = d || new Date();
    return pad(d.getMonth() + 1) + pad(d.getDate()) + d.getFullYear();
  };
  S.exportFileName = function (kind, ext) {
    var code = S.getAirportCode() || "XXX";
    var user = fileSafe(S.getOperator());
    return code + "_" + user + "_" + (kind || "Config") + "_" + S.exportDateStamp() + (ext || ".json");
  };
  S.isTauri = function () {
    return !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke);
  };
  S.detectOperator = function () {
    return invoke("get_operator").then(S.setOperator).catch(function () {
      return S.getOperator();
    });
  };

  S.writeSharedFile = function (blob, filename) {
    return blob.arrayBuffer().then(function (buf) {
      return invoke("write_shared_bytes", {
        filename: filename,
        bytes: Array.from(new Uint8Array(buf))
      });
    }).then(function (path) {
      if (S.updateStatus) S.updateStatus("Wrote " + path);
      return true;
    }).catch(function (err) {
      if (S.updateStatus) S.updateStatus("Share write failed: " + err);
      return false;
    });
  };

  function interceptDownloadClick(runFn) {
    var proto = HTMLAnchorElement.prototype;
    var origClick = proto.click;
    proto.click = function () {
      var a = this;
      var name = a.download || "";
      if (S.exportFileName) {
        if (/scheduler-pre-v4-export|scheduler.*\.json$/i.test(name)) a.download = S.exportFileName("Config", ".json");
        else if (/scheduler-lines-|scheduler.*\.xlsx$/i.test(name)) a.download = S.exportFileName("Lines", ".xlsx");
      }
      if (S.isTauri() && a.href && a.href.indexOf("blob:") === 0) {
        fetch(a.href).then(function (r) { return r.blob(); }).then(function (blob) {
          return S.writeSharedFile(blob, a.download);
        }).then(function (ok) {
          if (!ok) origClick.apply(a, []);
        });
        return;
      }
      return origClick.apply(this, arguments);
    };
    try { return runFn(); }
    finally { proto.click = origClick; }
  }

  function hookIo() {
    if (typeof S.exportJson === "function" && !S.exportJson._bladeHooked) {
      var origJson = S.exportJson;
      S.exportJson = function () {
        return interceptDownloadClick(function () { return origJson.apply(S, arguments); });
      };
      S.exportJson._bladeHooked = true;
    }
    if (typeof S.exportLinesExcel === "function" && !S.exportLinesExcel._bladeHooked) {
      var origX = S.exportLinesExcel;
      S.exportLinesExcel = function () {
        return interceptDownloadClick(function () { return origX.apply(S, arguments); });
      };
      S.exportLinesExcel._bladeHooked = true;
    }
  }

  function tickClock() {
    var now = new Date();
    if ($("console-time")) $("console-time").textContent = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    if ($("console-date")) $("console-date").textContent = pad(now.getMonth() + 1) + "/" + pad(now.getDate()) + "/" + now.getFullYear();
  }
  function staffTotal() {
    var st = S.state || {};
    return (st.ftM || 0) + (st.ftF || 0) + (st.ptM || 0) + (st.ptF || 0) +
      (st.ltsoM || 0) + (st.ltsoF || 0) + (st.stsoM || 0) + (st.stsoF || 0);
  }
  function ensureOperatorChip() {
    var airportMeta = $("console-airport") && $("console-airport").closest(".console-meta");
    if (airportMeta && !$("console-operator")) {
      var wrap = document.createElement("div");
      wrap.className = "console-meta";
      wrap.innerHTML = 'OPERATOR: <b id="console-operator">' + S.getOperator() + "</b>";
      airportMeta.parentNode.insertBefore(wrap, airportMeta.nextSibling);
    }
    if ($("console-airport")) $("console-airport").textContent = S.getAirportCode() || "—";
    if ($("console-operator")) $("console-operator").textContent = S.getOperator();
  }
  function refreshHeader() {
    var st = S.state || {};
    if ($("console-weeks")) $("console-weeks").textContent = String(st.weekCount || ($("cfg-weeks") && $("cfg-weeks").value) || 1);
    if ($("console-staff")) $("console-staff").textContent = String(staffTotal());
    if ($("console-lines")) $("console-lines").textContent = String((st.lines && st.lines.length) || 0);
    ensureOperatorChip();
  }

  function init() {
    document.body.classList.add("console-skin");
    if (!S.state) S.state = {};
    S.state.airportCode = S.getAirportCode();
    tickClock();
    setInterval(tickClock, 1000);
    hookIo();
    setTimeout(hookIo, 0);
    refreshHeader();
    S.detectOperator().then(refreshHeader);
    invoke("shared_folder_path").then(function (p) {
      if (S.updateStatus) S.updateStatus("Share target: " + p);
    }).catch(function () {});
    document.addEventListener("keydown", function (e) {
      if (e.defaultPrevented) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      var map = { F1: "setup", F2: "coverage", F3: "lines", F4: "teams", F5: "reports" };
      if (map[e.key] && S.switchTab) { e.preventDefault(); S.switchTab(map[e.key]); }
    });
    var orig = S.renderAll;
    if (typeof orig === "function" && !orig._consoleWrapped) {
      S.renderAll = function () {
        var r = orig.apply(this, arguments);
        refreshHeader();
        return r;
      };
      S.renderAll._consoleWrapped = true;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
  S.refreshConsoleChrome = refreshHeader;
})(window.Scheduler);
