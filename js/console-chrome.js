/** Ops-console chrome + airport/operator/export names */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  var LS_AIRPORT = "blade.airportCode";
  var LS_OPERATOR = "blade.operator";
  var LS_FOLDER = "blade.sharedFolderHint";
  var SHARED_REL = "OneDrive - USTSA\\Schedule Builder";

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function fileSafe(name) {
    return String(name || "OPERATOR").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "OPERATOR";
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
    if (el) {
      if (el.tagName === "SELECT" || el.tagName === "INPUT") el.value = c;
      else el.textContent = c || "—";
    }
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
    if (S.isTauri()) {
      return window.__TAURI__.core.invoke("get_operator").then(S.setOperator).catch(function () {
        return S.getOperator();
      });
    }
    return Promise.resolve(S.getOperator());
  };

  S.sharedFolderPath = function () {
    var user = fileSafe(S.getOperator());
    if (S.isTauri() && user && user !== "OPERATOR") {
      return "C:\\Users\\" + user + "\\" + SHARED_REL;
    }
    return localStorage.getItem(LS_FOLDER) || "";
  };

  var dirHandle = null;
  S.pickSharedFolder = async function () {
    if (!window.showDirectoryPicker) {
      if (S.updateStatus) S.updateStatus("Use Chrome/Edge to link the shared folder, or the Tauri build.");
      return null;
    }
    dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    try { localStorage.setItem(LS_FOLDER, dirHandle.name || "Schedule Builder"); } catch (e) {}
    if (S.updateStatus) S.updateStatus("Shared folder linked: " + dirHandle.name);
    return dirHandle;
  };

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

  function paintAirport() {
    var el = $("console-airport");
    if (!el) return;
    var code = S.getAirportCode() || "—";
    if (el.tagName === "SELECT") {
      var b = document.createElement("b");
      b.id = "console-airport";
      b.textContent = code;
      el.parentNode.replaceChild(b, el);
      return;
    }
    el.textContent = code;
  }

  function ensureOperator() {
    var airportMeta = $("console-airport") && $("console-airport").closest(".console-meta");
    if (airportMeta && !$("console-operator")) {
      var wrap = document.createElement("div");
      wrap.className = "console-meta";
      wrap.innerHTML = 'OPERATOR: <b id="console-operator">' + S.getOperator() + "</b>";
      airportMeta.parentNode.insertBefore(wrap, airportMeta.nextSibling);
    }
  }

  function wrapExports() {
    var proto = HTMLAnchorElement.prototype;
    if (proto.click._bladeWrapped) return;
    var origClick = proto.click;
    proto.click = function () {
      var name = this.download || "";
      if (S.exportFileName) {
        if (/scheduler-pre-v4-export|scheduler.*\.json$/i.test(name)) this.download = S.exportFileName("Config", ".json");
        else if (/scheduler-lines-|scheduler.*\.xlsx$/i.test(name)) this.download = S.exportFileName("Lines", ".xlsx");
      }
      return origClick.apply(this, arguments);
    };
    proto.click._bladeWrapped = true;
  }

  function refreshHeader() {
    var st = S.state || {};
    if ($("console-weeks")) $("console-weeks").textContent = String(st.weekCount || ($("cfg-weeks") && $("cfg-weeks").value) || 1);
    if ($("console-staff")) $("console-staff").textContent = String(staffTotal());
    if ($("console-lines")) $("console-lines").textContent = String((st.lines && st.lines.length) || 0);
    if ($("console-operator")) $("console-operator").textContent = S.getOperator();
    paintAirport();
  }

  function init() {
    document.body.classList.add("console-skin");
    if (!S.state) S.state = {};
    S.state.airportCode = S.getAirportCode();
    tickClock();
    setInterval(tickClock, 1000);
    wrapExports();
    paintAirport();
    ensureOperator();
    refreshHeader();
    S.detectOperator().then(refreshHeader);
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
