/** Ops-console chrome: clock, airport, operator, F-key tabs. */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function tickClock() {
    var now = new Date();
    var t = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    var d = pad(now.getMonth() + 1) + "/" + pad(now.getDate()) + "/" + now.getFullYear();
    var timeEl = $("console-time");
    var dateEl = $("console-date");
    if (timeEl) timeEl.textContent = t;
    if (dateEl) dateEl.textContent = d;
  }

  function staffTotal() {
    var st = S.state || {};
    return (st.ftM || 0) + (st.ftF || 0) + (st.ptM || 0) + (st.ptF || 0) +
      (st.ltsoM || 0) + (st.ltsoF || 0) + (st.stsoM || 0) + (st.stsoF || 0);
  }

  function fillAirportSelect() {
    var sel = $("console-airport");
    if (!sel || sel.tagName !== "SELECT") return;
    if (!sel.options.length && S.AIRPORTS) {
      S.AIRPORTS.forEach(function (ap) {
        var opt = document.createElement("option");
        opt.value = ap.code;
        opt.textContent = ap.code;
        opt.title = ap.name;
        sel.appendChild(opt);
      });
    }
    if (S.getAirportCode) sel.value = S.getAirportCode();
    if (!sel._bound) {
      sel.addEventListener("change", function () {
        if (S.setAirportCode) S.setAirportCode(sel.value);
      });
      sel._bound = true;
    }
  }

  function refreshHeader() {
    var st = S.state || {};
    var weeks = $("console-weeks");
    var staff = $("console-staff");
    var lines = $("console-lines");
    var op = $("console-operator");
    if (weeks) weeks.textContent = String(st.weekCount || ($("cfg-weeks") && $("cfg-weeks").value) || 1);
    if (staff) staff.textContent = String(staffTotal());
    if (lines) lines.textContent = String((st.lines && st.lines.length) || 0);
    if (op && S.getOperator) op.textContent = S.getOperator();
    fillAirportSelect();
  }

  function bindFkeys() {
    document.addEventListener("keydown", function (e) {
      if (e.defaultPrevented) return;
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      var map = { F1: "setup", F2: "coverage", F3: "lines", F4: "teams", F5: "reports" };
      if (map[e.key] && S.switchTab) {
        e.preventDefault();
        S.switchTab(map[e.key]);
      }
    });
  }

  function init() {
    document.body.classList.add("console-skin");
    tickClock();
    setInterval(tickClock, 1000);
    bindFkeys();
    refreshHeader();
    if (S.detectOperator) S.detectOperator().then(refreshHeader);
    var linkBtn = $("btn-link-folder");
    if (linkBtn) {
      linkBtn.addEventListener("click", function () {
        if (S.pickSharedFolder) S.pickSharedFolder();
      });
    }
    var orig = S.renderAll;
    if (typeof orig === "function" && !orig._consoleWrapped) {
      S.renderAll = function () {
        var r = orig.apply(this, arguments);
        refreshHeader();
        return r;
      };
      S.renderAll._consoleWrapped = true;
    }
    ["cfg-weeks", "cfg-ft-m", "cfg-ft-f", "cfg-pt-m", "cfg-pt-f", "cfg-ltso-m", "cfg-ltso-f", "cfg-stso-m", "cfg-stso-f"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("change", refreshHeader);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  S.refreshConsoleChrome = refreshHeader;
})(window.Scheduler);
