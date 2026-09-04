/** Capacity: checkpoint lanes + half-hour throughput */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function cfg() {
    return (S.getAirportConfig && S.getAirportConfig()) || { startTime: "03:30", endTime: "23:00", terminals: [] };
  }
  function toMin(t) { return S.timeToMin ? S.timeToMin(t) : 0; }
  function label(m) { return S.slotLabel ? S.slotLabel(m) : (S.minToTime ? S.minToTime(m) : String(m)); }
  function lanesOf(ms) {
    var n = Number(ms && ms.lanes);
    return Number.isFinite(n) && n >= 0 ? n : 2;
  }
  function rates() {
    var v = cfg().volumePerHour || {};
    var std = Number(v.STD) || 150;
    var pre = Number(v.PRE) || 240;
    var mix = Number(v.MIX);
    if (!Number.isFinite(mix) || mix <= 0) mix = (std + pre) / 2;
    return { STD: std, PRE: pre, MIX: mix };
  }
  function paxHalf(program, laneCount) {
    var r = rates();
    var perHour = r[program] != null ? r[program] : r.STD;
    return laneCount * perHour / 2;
  }
  function windowOf(node, parent) {
    var start = toMin((node && node.startTime) || (parent && parent.startTime) || cfg().startTime || "03:30");
    var end = toMin((node && node.endTime) || (parent && parent.endTime) || cfg().endTime || "23:00");
    if (end <= start) end += 1440;
    return { start: start, end: end };
  }
  function setOpen(ms, cp, term, slotMin) {
    var win = windowOf(cp, term);
    if (slotMin < win.start || slotMin >= win.end) return false;
    var start = toMin((ms && ms.startTime) || cp.startTime);
    var end = ms && ms.endTime ? toMin(ms.endTime) : win.end;
    if (end <= start) end += 1440;
    return start <= slotMin && slotMin < end;
  }

  S.capacitySlots = function () {
    var c = cfg();
    var open = Math.floor(toMin(c.startTime || "03:30") / 30) * 30;
    var close = Math.ceil(toMin(c.endTime || "23:00") / 30) * 30;
    if (close <= open) close += 1440;
    var out = [];
    for (var m = open; m < close; m += 30) out.push(m);
    return out;
  };

  S.computeLaneCapacityMatrix = function () {
    var c = cfg();
    var slots = S.capacitySlots();
    var cps = [];
    (c.terminals || []).forEach(function (term) {
      (term.checkpoints || []).forEach(function (cp) {
        cps.push({
          key: "t" + term.id + "c" + cp.id,
          terminalId: term.id,
          terminal: term.name,
          checkpointId: cp.id,
          checkpoint: cp.name,
          term: term,
          cp: cp
        });
      });
    });
    var rows = slots.map(function (slot) {
      var byCp = {};
      var byTerm = {};
      var airportLanes = 0;
      var airportPax = 0;
      var paxByProg = { STD: 0, PRE: 0, MIX: 0 };
      cps.forEach(function (col) {
        var lanes = 0;
        var pax = 0;
        (col.cp.modSets || []).forEach(function (ms) {
          if (!setOpen(ms, col.cp, col.term, slot)) return;
          var n = lanesOf(ms);
          var prog = ms.program || "STD";
          lanes += n;
          var half = paxHalf(prog, n);
          pax += half;
          if (paxByProg[prog] != null) paxByProg[prog] += half;
        });
        byCp[col.key] = { lanes: lanes, pax: pax };
        if (!byTerm[col.terminalId]) byTerm[col.terminalId] = { lanes: 0, pax: 0 };
        byTerm[col.terminalId].lanes += lanes;
        byTerm[col.terminalId].pax += pax;
        airportLanes += lanes;
        airportPax += pax;
      });
      return {
        slot: slot,
        time: label(slot),
        byCheckpoint: byCp,
        byTerminal: byTerm,
        airportLanes: airportLanes,
        airportPax: airportPax,
        paxByProg: paxByProg
      };
    });
    var peakLanes = 0;
    var peakPax = 0;
    rows.forEach(function (r) {
      if (r.airportLanes > peakLanes) peakLanes = r.airportLanes;
      if (r.airportPax > peakPax) peakPax = r.airportPax;
    });
    return {
      checkpoints: cps,
      terminals: (c.terminals || []).map(function (t) { return { id: t.id, name: t.name }; }),
      rows: rows,
      rates: rates(),
      peakLanes: peakLanes,
      peakPax: peakPax
    };
  };

  S.computeCapacity = S.computeLaneCapacityMatrix;

  function heat(n, peak) {
    if (!n) return "hc-0";
    if (peak && n >= peak) return "hc-high";
    if (peak && n <= peak * 0.4) return "hc-low";
    return "hc-ok";
  }
  function num(n) {
    if (!n) return "";
    return Math.round(n * 10) / 10;
  }

  S.renderCapacity = function () {
    var host = S.$("tab-capacity");
    if (!host) return;
    var matrix = S.computeLaneCapacityMatrix();
    var filter = (S.$("cap-filter-term") && S.$("cap-filter-term").value) || "";
    var cols = matrix.checkpoints.filter(function (c) {
      return !filter || String(c.terminalId) === String(filter);
    });
    var opts = '<option value="">All terminals</option>';
    matrix.terminals.forEach(function (t) {
      opts += '<option value="' + t.id + '"' + (String(filter) === String(t.id) ? " selected" : "") + ">" +
        String(t.name).replace(/</g, "<") + "</option>";
    });
    var r = matrix.rates;
    var head = "<tr><th>Time</th>";
    var seen = {};
    cols.forEach(function (c) {
      if (!seen[c.terminalId]) {
        seen[c.terminalId] = 1;
        head += '<th class="muted">' + c.terminal + "</th>";
      }
      head += "<th>" + c.checkpoint + " lanes</th><th>" + c.checkpoint + " pax/30</th>";
    });
    head += "<th>Airport lanes</th><th>Airport pax/30</th></tr>";

    var body = matrix.rows.map(function (row) {
      var html = "<td>" + row.time + "</td>";
      seen = {};
      cols.forEach(function (c) {
        if (!seen[c.terminalId]) {
          seen[c.terminalId] = 1;
          var t = row.byTerminal[c.terminalId] || { lanes: 0, pax: 0 };
          html += '<td class="' + heat(t.lanes, matrix.peakLanes) + '"><strong>' + (t.lanes || "") + "</strong></td>";
        }
        var cell = row.byCheckpoint[c.key] || { lanes: 0, pax: 0 };
        html += '<td class="' + heat(cell.lanes, matrix.peakLanes) + '">' + (cell.lanes || "") + "</td>";
        html += '<td class="' + heat(cell.pax, matrix.peakPax) + '">' + num(cell.pax) + "</td>";
      });
      html += "<td><strong>" + (row.airportLanes || "") + "</strong></td>";
      html += "<td><strong>" + num(row.airportPax) + "</strong></td>";
      return "<tr>" + html + "</tr>";
    }).join("");
    if (!cols.length) body = '<tr><td class="muted" colspan="8">Add checkpoints in Airfield.</td></tr>';

    host.innerHTML =
      '<div class="card">' +
      '<div class="section-title">Half-hour checkpoint throughput</div>' +
      '<p class="muted">STD ' + r.STD + "/lane/hr · PRE " + r.PRE + "/lane/hr · MIX " + r.MIX +
      "/lane/hr (amalgam). Pax/30 = open lanes × rate ÷ 2.</p>" +
      '<div class="toolbar"><label>Terminal <select id="cap-filter-term">' + opts + "</select></label></div>" +
      '<div class="lines-scroll"><table class="data-table cov-matrix"><thead>' + head +
      "</thead><tbody>" + body + "</tbody></table></div></div>";

    var sel = S.$("cap-filter-term");
    if (sel) sel.addEventListener("change", function () { S.renderCapacity(); });
  };

  S.initCapacity = function () {
    var orig = S.switchTab;
    if (typeof orig === "function" && !S._capacityTabWrapped) {
      S._capacityTabWrapped = true;
      S.switchTab = function (name) {
        orig(name);
        if (name === "capacity") S.renderCapacity();
      };
    }
    S.renderCapacity();
  };
})(window.Scheduler);
