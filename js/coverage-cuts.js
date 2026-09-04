/** Coverage cuts: fewer matching lines on Generate. Shift times / RDOs / paid hours unchanged. */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function uid() {
    return "cut-" + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  }
  function dayNames() { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; }

  function ensureState() {
    if (!S.state) S.state = {};
    if (!Array.isArray(S.state.coverageCuts)) S.state.coverageCuts = [];
    return S.state.coverageCuts;
  }

  function parseMin(t) {
    if (S.timeToMin) return S.timeToMin(t);
    var m = String(t || "").match(/^(\d{1,2}):(\d{2})/);
    return m ? (+m[1]) * 60 + (+m[2]) : 0;
  }

  function lineRole(line) {
    if (S.lineRoleKey) return S.lineRoleKey(line);
    if (line.isStso || line.empClass === "STSO") return "STSO";
    if (line.isLtso || line.empClass === "LTSO") return "LTSO";
    return "TSO";
  }

  function lineOverlapsWindow(line, cut) {
    var days = cut.days && cut.days.length ? cut.days : [0, 1, 2, 3, 4, 5, 6];
    var wa = parseMin(cut.start || "00:00");
    var wb = parseMin(cut.end || "23:59");
    return days.some(function (dow) {
      if (!S.getShift(line.shiftId)) return false;
      var times = S.getEffectiveShiftTimes
        ? S.getEffectiveShiftTimes(line.shiftId, dow)
        : { start: S.getShift(line.shiftId).start, end: S.getShift(line.shiftId).end };
      var a = parseMin(times.start);
      var b = parseMin(times.end);
      return a < wb && b > wa;
    });
  }

  function cutMatchesLine(cut, line) {
    if (!cut || !cut.enabled || !line) return false;
    var role = lineRole(line);
    if (cut.roles && cut.roles[role] === false) return false;
    var sx = line.sex === "F" ? "F" : "M";
    if (cut.sexes && cut.sexes[sx] === false) return false;
    if (cut.kind === "shift") return !cut.shiftId || line.shiftId === cut.shiftId;
    return lineOverlapsWindow(line, cut);
  }

  /** Drop a % of matching lines. Remaining lines keep the same hours and RDOs. */
  S.applyCoverageCutsToLines = function () {
    var cuts = ensureState().filter(function (c) { return c.enabled && +c.pct > 0; });
    var lines = (S.state && S.state.lines) || [];
    if (!cuts.length || !lines.length) return 0;
    var drop = {};
    cuts.forEach(function (cut) {
      var pct = Math.max(0, Math.min(90, +cut.pct || 0));
      var bucket = {};
      lines.forEach(function (line) {
        if (drop[line.id]) return;
        if (!cutMatchesLine(cut, line)) return;
        var key = lineRole(line) + "|" + (line.sex === "F" ? "F" : "M") + "|" + (line.shiftId || "");
        if (!bucket[key]) bucket[key] = [];
        bucket[key].push(line);
      });
      Object.keys(bucket).forEach(function (key) {
        var group = bucket[key].slice().sort(function (a, b) { return (b.id || 0) - (a.id || 0); });
        var nDrop = Math.round(group.length * pct / 100);
        if (nDrop < 1 && pct >= 10 && group.length >= 2) nDrop = 1;
        group.slice(0, nDrop).forEach(function (line) { drop[line.id] = true; });
      });
    });
    var kept = lines.filter(function (l) { return !drop[l.id]; });
    var removed = lines.length - kept.length;
    if (!removed) return 0;
    S.state.lines = kept;
    var days = (S.state.weekCount || 1) * 7;
    var nextSched = {};
    kept.forEach(function (line) {
      if (S.state.schedule && S.state.schedule[line.id]) nextSched[line.id] = S.state.schedule[line.id];
      else if (S.buildScheduleForLine) nextSched[line.id] = S.buildScheduleForLine(line, days);
    });
    S.state.schedule = nextSched;
    if (S.state.issues) {
      S.state.issues.push("Coverage cuts removed " + removed + " line(s). Hours/RDOs on remaining lines unchanged.");
    }
    return removed;
  };

  function injectPanel() {
    var tab = $("tab-coverage");
    if (!tab || $("coverage-cuts-card")) return;
    var card = document.createElement("div");
    card.className = "card";
    card.id = "coverage-cuts-card";
    card.innerHTML =
      '<div class="section-title">Coverage cuts</div>' +
      '<p class="muted">Fine-tune until volume exists. On Generate, matching lines are removed by %. Shift start/end, paid hours, and RDOs on the lines that stay are not changed.</p>' +
      '<div class="toolbar" style="flex-wrap:wrap;gap:0.5rem;align-items:end" id="coverage-cut-form">' +
      '<label>Kind <select id="cut-kind"><option value="window">Time window</option><option value="shift">Whole shift</option></select></label>' +
      '<label id="cut-shift-wrap" style="display:none">Shift <select id="cut-shift"></select></label>' +
      '<label>From <input type="time" id="cut-start" value="14:00" /></label>' +
      '<label>To <input type="time" id="cut-end" value="18:00" /></label>' +
      '<label>% drop <input type="number" id="cut-pct" min="5" max="90" step="5" value="20" style="width:4rem" /></label>' +
      '<label class="follow-me-label"><input type="checkbox" id="cut-role-stso" checked /> STSO</label>' +
      '<label class="follow-me-label"><input type="checkbox" id="cut-role-ltso" checked /> LTSO</label>' +
      '<label class="follow-me-label"><input type="checkbox" id="cut-role-tso" checked /> TSO</label>' +
      '<label class="follow-me-label"><input type="checkbox" id="cut-sex-m" checked /> M</label>' +
      '<label class="follow-me-label"><input type="checkbox" id="cut-sex-f" checked /> F</label>' +
      '<span id="cut-days"></span>' +
      '<button type="button" class="btn btn-amber" id="btn-cut-add">Add cut</button>' +
      '</div>' +
      '<div id="coverage-cuts-list" class="muted" style="margin-top:0.6rem"></div>';
    var first = tab.querySelector(".card");
    if (first && first.parentNode) first.parentNode.insertBefore(card, first.nextSibling);
    else tab.appendChild(card);

    $("cut-days").innerHTML = dayNames().map(function (n, i) {
      return '<label class="follow-me-label"><input type="checkbox" data-cut-day="' + i + '" checked /> ' + n + "</label>";
    }).join("");
    $("cut-kind").addEventListener("change", function () {
      $("cut-shift-wrap").style.display = this.value === "shift" ? "" : "none";
    });
    $("btn-cut-add").addEventListener("click", addCutFromForm);
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      if (t.getAttribute("data-cut-del")) removeCut(t.getAttribute("data-cut-del"));
      if (t.getAttribute("data-cut-toggle")) toggleCut(t.getAttribute("data-cut-toggle"));
    });
  }

  function fillShiftSelect() {
    var sel = $("cut-shift");
    if (!sel) return;
    var shifts = (S.state && S.state.shifts) || [];
    sel.innerHTML = shifts.map(function (s) {
      return '<option value="' + s.id + '">' + (s.name || s.id) + "</option>";
    }).join("") || '<option value="">No shifts</option>';
  }

  function addCutFromForm() {
    var kind = $("cut-kind").value;
    var days = [];
    document.querySelectorAll("[data-cut-day]").forEach(function (el) {
      if (el.checked) days.push(+el.getAttribute("data-cut-day"));
    });
    ensureState().push({
      id: uid(),
      enabled: true,
      kind: kind,
      shiftId: kind === "shift" ? $("cut-shift").value : "",
      start: $("cut-start").value || "00:00",
      end: $("cut-end").value || "23:59",
      pct: Math.max(5, Math.min(90, +$("cut-pct").value || 20)),
      roles: {
        STSO: !!$("cut-role-stso").checked,
        LTSO: !!$("cut-role-ltso").checked,
        TSO: !!$("cut-role-tso").checked
      },
      sexes: { M: !!$("cut-sex-m").checked, F: !!$("cut-sex-f").checked },
      days: days
    });
    renderCutList();
    if (S.updateStatus) S.updateStatus("Cut saved. Generate again to apply it to line counts.");
  }

  function removeCut(id) {
    S.state.coverageCuts = ensureState().filter(function (c) { return c.id !== id; });
    renderCutList();
  }
  function toggleCut(id) {
    ensureState().forEach(function (c) { if (c.id === id) c.enabled = !c.enabled; });
    renderCutList();
  }
  function renderCutList() {
    var box = $("coverage-cuts-list");
    if (!box) return;
    var cuts = ensureState();
    if (!cuts.length) {
      box.innerHTML = "No cuts. Add one, then Generate.";
      return;
    }
    box.innerHTML = cuts.map(function (c) {
      var roles = ["STSO", "LTSO", "TSO"].filter(function (r) { return c.roles && c.roles[r]; }).join("/") || "—";
      var sexes = ["M", "F"].filter(function (x) { return c.sexes && c.sexes[x]; }).join("/") || "—";
      var when = c.kind === "shift"
        ? ("shift " + ((S.getShift && S.getShift(c.shiftId) && S.getShift(c.shiftId).name) || c.shiftId || "?"))
        : ((c.start || "?") + "–" + (c.end || "?"));
      var days = (c.days || []).map(function (d) { return dayNames()[d]; }).join(" ");
      return '<div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;margin:0.25rem 0">' +
        '<button type="button" class="btn" data-cut-toggle="' + c.id + '">' + (c.enabled ? "ON" : "off") + "</button>" +
        "<span><b>−" + c.pct + "%</b> " + when + " · " + roles + " · " + sexes + " · " + days + "</span>" +
        '<button type="button" class="btn" data-cut-del="' + c.id + '">Remove</button></div>';
    }).join("");
  }

  function wrapGenerate() {
    if (typeof S.generate !== "function" || S.generate._cutsApplyWrapped) return;
    var orig = S.generate;
    S.generate = function () {
      var r = orig.apply(this, arguments);
      var n = S.applyCoverageCutsToLines();
      if (n && S.renderAll) S.renderAll();
      if (n && S.updateStatus) {
        S.updateStatus("Coverage cuts removed " + n + " line(s). Hours and RDOs unchanged on what remains.");
      }
      return r;
    };
    S.generate._cutsApplyWrapped = true;
  }

  function init() {
    injectPanel();
    fillShiftSelect();
    renderCutList();
    wrapGenerate();
    setTimeout(wrapGenerate, 0);
    if (typeof S.renderShifts === "function" && !S.renderShifts._cutSel) {
      var rs = S.renderShifts;
      S.renderShifts = function () {
        var out = rs.apply(this, arguments);
        fillShiftSelect();
        return out;
      };
      S.renderShifts._cutSel = true;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.Scheduler);
