/** Helpers — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";
  S.$ = function (id) { return document.getElementById(id); };
  S.safeNumber = function (v, def, min, max) {
    var n = +v;
    if (isNaN(n)) return def;
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return n;
  };
  S.timeToMin = function (t) {
    if (!t) return 0;
    var p = String(t).split(":");
    return (+p[0] || 0) * 60 + (+p[1] || 0);
  };
  S.minToTime = function (m) {
    m = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mi = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mi < 10 ? "0" : "") + mi;
  };
  S.parseStartDate = function (val) {
    if (val) {
      var d = new Date(val + "T12:00:00");
      if (!isNaN(d.getTime())) return d;
    }
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };
  S.toDateInputValue = function (d) {
    if (!d) return "";
    var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  };
  S.updateStatus = function (msg) {
    var el = S.$("status");
    if (el) el.textContent = msg || "";
  };
  S.dj = function () {
    return typeof dayjs !== "undefined" ? dayjs() : null;
  };
})(window.Scheduler);
