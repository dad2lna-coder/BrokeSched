/** Capacity + checkpoint staff rules + line assignment */
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

  S.lineDuty = function (line, dayIndex) {
    var d = S.getRotationDuty ? S.getRotationDuty(line.id, dayIndex) : (line.function || null);
    if (d === "DFO" || d === "BAG") return d;
    return "PAX";
  };

  S.ensureCheckpointRules = function () {
    if (!S.state.checkpointStaff) S.state.checkpointStaff = {};
    var rules = S.state.checkpointStaff;
    var list = [];
    (cfg().terminals || []).forEach(function (term) {
      (term.checkpoints || []).forEach(function (cp, idx) {
        if (cp.staffRule) rules[cp.id] = cp.staffRule;
        if (!rules[cp.id]) rules[cp.id] = idx === 0 ? "PAX" : "MAY_DFO";
        cp.staffRule = rules[cp.id];
        list.push({ id: cp.id, name: cp.name, terminal: term.name, terminalId: term.id, rule: rules[cp.id] });
      });
    });
    return list;
  };

  S.setCheckpointStaffRule = function (checkpointId, rule) {
    S.ensureCheckpointRules();
    S.state.checkpointStaff[checkpointId] = rule === "MAY_DFO" ? "MAY_DFO" : "PAX";
    (cfg().terminals || []).forEach(function (term) {
      (term.checkpoints || []).forEach(function (cp) {
        if (String(cp.id) === String(checkpointId)) cp.staffRule = S.state.checkpointStaff[checkpointId];
      });
    });
  };

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
          terminalId: term.id, terminal: term.name,
          checkpointId: cp.id, checkpoint: cp.name,
          term: term, cp: cp
        });
      });
    });
    var rows = slots.map(function (slot) {
      var byCp = {}, byTerm = {}, airportLanes = 0, airportPax = 0;
      cps.forEach(function (col) {
        var lanes = 0, pax = 0;
        (col.cp.modSets || []).forEach(function (ms) {
          if (!setOpen(ms, col.cp, col.term, slot)) return;
          var n = lanesOf(ms);
          lanes += n;
          pax += paxHalf(ms.program || "STD", n);
        });
        byCp[col.key] = { lanes: lanes, pax: pax };
        if (!byTerm[col.terminalId]) byTerm[col.terminalId] = { lanes: 0, pax: 0 };
        byTerm[col.terminalId].lanes += lanes;
        byTerm[col.terminalId].pax += pax;
        airportLanes += lanes;
        airportPax += pax;
      });
      return { slot: slot, time: label(slot), byCheckpoint: byCp, byTerminal: byTerm, airportLanes: airportLanes, airportPax: airportPax };
    });
    var peakLanes = 0, peakPax = 0;
    rows.forEach(function (r) {
      if (r.airportLanes > peakLanes) peakLanes = r.airportLanes;
      if (r.airportPax > peakPax) peakPax = r.airportPax;
    });
    return { checkpoints: cps, terminals: (c.terminals || []).map(function (t) { return { id: t.id, name: t.name }; }), rows: rows, rates: rates(), peakLanes: peakLanes, peakPax: peakPax };
  };
  S.computeCapacity = S.computeLaneCapacityMatrix;

  S.assignLinesToCheckpoints = function () {
    var rules = S.ensureCheckpointRules();
    if (!S.state.lines || !S.state.lines.length) {
      if (S.updateStatus) S.updateStatus("Generate coverage first.");
      return { assigned: 0, message: "Generate coverage first." };
    }
    var paxCps = rules.filter(function (r) { return r.rule === "PAX"; });
    var dfoCps = rules.filter(function (r) { return r.rule === "MAY_DFO"; });
    S.state.checkpointAssignment = {};
    var days = (S.state.weekCount || 1) * 7;
    var rrPax = 0, rrDfo = 0, assigned = 0, bagSkip = 0, dfoNoHome = 0;
    function put(lineId, day, rec) {
      var key = String(lineId);
      if (!S.state.checkpointAssignment[key]) S.state.checkpointAssignment[key] = [];
      while (S.state.checkpointAssignment[key].length <= day) S.state.checkpointAssignment[key].push(null);
      S.state.checkpointAssignment[key][day] = rec;
    }
    for (var d = 0; d < days; d++) {
      (S.state.lines || []).forEach(function (line) {
        var sched = (S.state.schedule || {})[line.id] || (S.state.schedule || {})[String(line.id)] || [];
        if (sched[d] !== "WORK") { put(line.id, d, null); return; }
        var duty = S.lineDuty(line, d);
        if (duty === "BAG") {
          put(line.id, d, { id: null, name: "BAG", duty: "BAG" });
          bagSkip++;
          return;
        }
        var home = null;
        if (duty === "DFO") {
          if (!dfoCps.length) { dfoNoHome++; put(line.id, d, { id: null, name: "DFO unplaced", duty: "DFO" }); return; }
          home = dfoCps[rrDfo % dfoCps.length];
          rrDfo++;
        } else {
          var pool = paxCps.length ? paxCps : dfoCps;
          if (!pool.length) { put(line.id, d, { id: null, name: "No CP", duty: "PAX" }); return; }
          home = pool[rrPax % pool.length];
          rrPax++;
        }
        put(line.id, d, { id: home.id, name: home.name, terminal: home.terminal, duty: duty });
        assigned++;
      });
    }
    var msg = "Checkpoint assign: " + assigned + " line-days. BAG kept off CP: " + bagSkip + (dfoNoHome ? ". DFO with no MAY_DFO CP: " + dfoNoHome : "");
    if (S.updateStatus) S.updateStatus(msg);
    return { assigned: assigned, bagSkip: bagSkip, message: msg };
  };

  S.checkpointForLine = function (lineId, dayIndex) {
    var row = (S.state.checkpointAssignment || {})[String(lineId)];
    if (!row) return null;
    return row[dayIndex] || null;
  };

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
    var rules = S.ensureCheckpointRules();
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
      if (!seen[c.terminalId]) { seen[c.terminalId] = 1; head += '<th class="muted">' + c.terminal + "</th>"; }
      head += "<th>" + c.checkpoint + " lanes</th><th>" + c.checkpoint + " pax/30</th>";
    });
    head += "<th>Airport lanes</th><th>Airport pax/30</th></tr>";
    var body = matrix.rows.map(function (row) {
      var html = "<td>" + row.time + "</td>";
      seen = {};
      cols.forEach(function (c) {
        if (!seen[c.terminalId]) {
          seen[c.terminalId] = 1;
          var t = row.byTerminal[c.terminalId] || { lanes: 0 };
          html += '<td class="' + heat(t.lanes, matrix.peakLanes) + '"><strong>' + (t.lanes || "") + "</strong></td>";
        }
        var cell = row.byCheckpoint[c.key] || { lanes: 0, pax: 0 };
        html += '<td class="' + heat(cell.lanes, matrix.peakLanes) + '">' + (cell.lanes || "") + "</td>";
        html += '<td class="' + heat(cell.pax, matrix.peakPax) + '">' + num(cell.pax) + "</td>";
      });
      html += "<td><strong>" + (row.airportLanes || "") + "</strong></td><td><strong>" + num(row.airportPax) + "</strong></td>";
      return "<tr>" + html + "</tr>";
    }).join("");
    if (!cols.length) body = '<tr><td class="muted" colspan="8">Add checkpoints in Airfield.</td></tr>';
    var ruleRows = rules.map(function (cp) {
      return "<tr><td>" + cp.terminal + "</td><td>" + cp.name + "</td><td>" +
        '<select data-cp-rule="' + cp.id + '">' +
        '<option value="PAX"' + (cp.rule === "PAX" ? " selected" : "") + ">Must be PAX</option>" +
        '<option value="MAY_DFO"' + (cp.rule === "MAY_DFO" ? " selected" : "") + ">May be DFO</option>" +
        "</select></td></tr>";
    }).join("") || '<tr><td class="muted" colspan="3">No checkpoints.</td></tr>';
    var assign = S.state.checkpointAssignment || {};
    var aRows = "";
    (S.state.lines || []).slice(0, 80).forEach(function (line) {
      var rec = (assign[String(line.id)] || [])[0] || null;
      var duty = S.lineDuty(line, 0);
      aRows += "<tr><td>" + (line.lineCode || line.id) + "</td><td>" + (S.lineRoleKey ? S.lineRoleKey(line) : "") +
        "</td><td>" + duty + "</td><td>" + (rec && rec.name ? rec.name : "—") + "</td></tr>";
    });
    if (!(S.state.lines || []).length) aRows = '<tr><td class="muted" colspan="4">Generate coverage, then assign.</td></tr>';
    host.innerHTML =
      '<div class="card"><div class="section-title">Checkpoint staff rule</div>' +
      '<p class="muted">Must PAX = passenger only. May DFO = DFO or PAX. Anyone not DFO/BAG is PAX. BAG does not sit a passenger checkpoint.</p>' +
      '<div class="lines-scroll"><table class="data-table"><thead><tr><th>Terminal</th><th>Checkpoint</th><th>Rule</th></tr></thead><tbody>' +
      ruleRows + "</tbody></table></div></div>" +
      '<div class="card"><div class="section-title">Half-hour checkpoint throughput</div>' +
      '<p class="muted">STD ' + r.STD + "/lane/hr · PRE " + r.PRE + "/lane/hr · MIX " + r.MIX + "/lane/hr. Pax/30 = lanes × rate ÷ 2.</p>" +
      '<div class="toolbar"><label>Terminal <select id="cap-filter-term">' + opts + "</select></label></div>" +
      '<div class="lines-scroll"><table class="data-table cov-matrix"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div></div>" +
      '<div class="card"><div class="section-title">Line to checkpoint</div>' +
      '<div class="toolbar"><button type="button" class="btn btn-amber" id="btn-assign-cp">Assign lines to checkpoints</button>' +
      '<span class="muted" id="cp-assign-hint">Run after function coverage.</span></div>' +
      '<div class="lines-scroll"><table class="data-table"><thead><tr><th>Line</th><th>Role</th><th>Duty</th><th>Checkpoint (day 0)</th></tr></thead><tbody>' +
      aRows + "</tbody></table></div></div>";
    var sel = S.$("cap-filter-term");
    if (sel) sel.addEventListener("change", function () { S.renderCapacity(); });
    document.querySelectorAll("[data-cp-rule]").forEach(function (el) {
      el.addEventListener("change", function () {
        S.setCheckpointStaffRule(el.getAttribute("data-cp-rule"), el.value);
      });
    });
    var btn = S.$("btn-assign-cp");
    if (btn) btn.addEventListener("click", function () {
      var out = S.assignLinesToCheckpoints();
      var hint = S.$("cp-assign-hint");
      if (hint) hint.textContent = out.message;
      S.renderCapacity();
    });
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
    S.ensureCheckpointRules();
    S.renderCapacity();
  };
})(window.Scheduler);
