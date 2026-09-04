/** Flag shifts or time windows for a % coverage decrease by role and sex. */
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

  function cutAppliesToLine(cut, line) {
    if (!cut || !line) return false;
    var role = S.lineRoleKey ? S.lineRoleKey(line) : "TSO";
    if (cut.roles && cut.roles[role] === false) return false;
    var sx = line.sex === "F" ? "F" : "M";
    if (cut.sexes && cut.sexes[sx] === false) return false;
    if (cut.kind === "shift" && cut.shiftId && line.shiftId !== cut.shiftId) return false;
    return true;
  }

  function cutAppliesToSlot(cut, slotMin, dow) {
    if (cut.days && cut.days.length && cut.days.indexOf(dow) < 0) return false;
    if (cut.kind === "window") {
      var a = parseMin(cut.start || "00:00");
      var b = parseMin(cut.end || "23:59");
      return slotMin >= a && slotMin < b;
    }
    return true;
  }

  S.coverageCutFactor = function (line, slotMin, dow) {
    var factor = 1;
    ensureState().forEach(function (cut) {
      if (!cut.enabled) return;
      if (!cutAppliesToLine(cut, line)) return;
      if (!cutAppliesToSlot(cut, slotMin, dow)) return;
      var pct = Math.max(0, Math.min(90, +cut.pct || 0));
      factor *= (1 - pct / 100);
    });
    return factor;
  };

  function injectPanel() {
    var tab = $("tab-coverage");
    if (!tab || $("coverage-cuts-card")) return;
    var card = document.createElement("div");
    card.className = "card";
    card.id = "coverage-cuts-card";
    card.innerHTML =
      '<div class="section-title">Coverage cuts</div>' +
      '<p class="muted">Flag a shift or a clock window. Headcount in matching slots is shown as actual → target after the % drop, by role and sex. Hard-refresh after first load.</p>' +
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

    var daysHtml = dayNames().map(function (n, i) {
      return '<label class="follow-me-label"><input type="checkbox" data-cut-day="' + i + '" checked /> ' + n + "</label>";
    }).join("");
    $("cut-days").innerHTML = daysHtml;

    $("cut-kind").addEventListener("change", function () {
      var sh = this.value === "shift";
      $("cut-shift-wrap").style.display = sh ? "" : "none";
    });
    $("btn-cut-add").addEventListener("click", addCutFromForm);
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.getAttribute && t.getAttribute("data-cut-del")) {
        removeCut(t.getAttribute("data-cut-del"));
      }
      if (t.getAttribute && t.getAttribute("data-cut-toggle")) {
        toggleCut(t.getAttribute("data-cut-toggle"));
      }
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
    var cut = {
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
      sexes: {
        M: !!$("cut-sex-m").checked,
        F: !!$("cut-sex-f").checked
      },
      days: days
    };
    ensureState().push(cut);
    renderCutList();
    if (S.renderCoverageBars) S.renderCoverageBars();
    if (S.updateStatus) S.updateStatus("Coverage cut added: " + cut.pct + "% " + cut.kind);
  }

  function removeCut(id) {
    S.state.coverageCuts = ensureState().filter(function (c) { return c.id !== id; });
    renderCutList();
    if (S.renderCoverageBars) S.renderCoverageBars();
  }

  function toggleCut(id) {
    ensureState().forEach(function (c) {
      if (c.id === id) c.enabled = !c.enabled;
    });
    renderCutList();
    if (S.renderCoverageBars) S.renderCoverageBars();
  }

  function renderCutList() {
    var box = $("coverage-cuts-list");
    if (!box) return;
    var cuts = ensureState();
    if (!cuts.length) {
      box.innerHTML = "No cuts yet. Add one above; cells show actual → target.";
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

  if (typeof S.computeHourlyByDow === "function" && !S.computeHourlyByDow._cutsWrapped) {
    var orig = S.computeHourlyByDow;
    S.computeHourlyByDow = function () {
      var computed = orig.apply(this, arguments);
      var cuts = ensureState().filter(function (c) { return c.enabled; });
      if (!cuts.length || !computed || !computed.matrix) return computed;
      var slots = computed.slots || [];
      var cv = S.coverageView || { stso: false, ltso: false, tso: true };
      slots.forEach(function (slot, si) {
        for (var dow = 0; dow < 7; dow++) {
          var cell = computed.matrix[si][dow];
          if (!cell) continue;
          var tm = 0, tf = 0;
          (S.state.lines || []).forEach(function (line) {
            var role = S.lineRoleKey ? S.lineRoleKey(line) : "TSO";
            if (role === "STSO" && !cv.stso) return;
            if (role === "LTSO" && !cv.ltso) return;
            if (role === "TSO" && !cv.tso) return;
            var off = computed.dowToOffset ? computed.dowToOffset[dow] : dow;
            if (off == null) return;
            if ((S.state.schedule[line.id] || [])[off] !== "WORK") return;
            if (!S.getShift(line.shiftId)) return;
            var times = S.getEffectiveShiftTimes
              ? S.getEffectiveShiftTimes(line.shiftId, dow)
              : { start: S.getShift(line.shiftId).start, end: S.getShift(line.shiftId).end };
            var a = parseMin(times.start), b = parseMin(times.end);
            if (!(a < slot + 30 && b > slot)) return;
            var factor = S.coverageCutFactor(line, slot, dow);
            if (line.sex === "M") tm += factor;
            else tf += factor;
          });
          cell.tm = Math.round(tm * 10) / 10;
          cell.tf = Math.round(tf * 10) / 10;
          cell.tt = Math.round((tm + tf) * 10) / 10;
          cell.cut = (cell.tm + cell.tf) + 0.05 < cell.t;
        }
      });
      return computed;
    };
    S.computeHourlyByDow._cutsWrapped = true;
  }

  if (typeof S.renderCoverageBars === "function" && !S.renderCoverageBars._cutsHint) {
    var origRender = S.renderCoverageBars;
    S.renderCoverageBars = function () {
      origRender.apply(this, arguments);
      var body = $("coverage-matrix-body");
      if (!body) return;
      var computed = S.computeHourlyByDow();
      if (!computed || !computed.matrix) return;
      var rows = body.querySelectorAll("tr");
      computed.slots.forEach(function (slot, si) {
        var tr = rows[si];
        if (!tr) return;
        var tds = tr.querySelectorAll("td");
        for (var dow = 0; dow < 7; dow++) {
          var td = tds[dow + 1];
          var cell = computed.matrix[si][dow];
          if (!td || !cell || !cell.cut) continue;
          td.style.outline = "1px solid #c47b2b";
          td.title = "Target after cuts M/F/T " + cell.tm + "/" + cell.tf + "/" + cell.tt +
            " (was " + cell.m + "/" + cell.f + "/" + cell.t + ")";
          td.innerHTML =
            '<span class="sex-m">' + cell.m + "→" + cell.tm + "</span>/" +
            '<span class="sex-f">' + cell.f + "→" + cell.tf + "</span>/" +
            cell.t + "→" + cell.tt;
        }
      });
    };
    S.renderCoverageBars._cutsHint = true;
  }

  if (typeof S.exportJson === "function" && !S.exportJson._cutsWrapped) {
    var origExp = S.exportJson;
    S.exportJson = function () {
      if (S.state) S.state.coverageCuts = ensureState();
      return origExp.apply(this, arguments);
    };
    S.exportJson._cutsWrapped = true;
  }
  if (typeof S.applyPayload === "function" && !S.applyPayload._cutsWrapped) {
    var origApply = S.applyPayload;
    S.applyPayload = function (payload) {
      var r = origApply.apply(this, arguments);
      var cuts = (payload && payload.config && payload.config.coverageCuts) ||
        (payload && payload.coverageCuts) ||
        (S.state && S.state.coverageCuts) || [];
      S.state.coverageCuts = Array.isArray(cuts) ? cuts : [];
      renderCutList();
      return r;
    };
    S.applyPayload._cutsWrapped = true;
  }

  var origExportBuild;
  function hookPayload() {
    if (typeof S.exportJson !== "function") return;
  }

  function init() {
    injectPanel();
    fillShiftSelect();
    renderCutList();
    if (typeof S.renderShifts === "function" && !S.renderShifts._cutSel) {
      var rs = S.renderShifts;
      S.renderShifts = function () {
        var r = rs.apply(this, arguments);
        fillShiftSelect();
        return r;
      };
      S.renderShifts._cutSel = true;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.Scheduler);
