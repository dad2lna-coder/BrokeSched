/** Capacity: mod sets are nested checkpoints. Their lanes add. */
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
    var units = [];
    var plantAirport = 0;
    (c.terminals || []).forEach(function (term) {
      (term.checkpoints || []).forEach(function (cp) {
        var sets = cp.modSets || [];
        if (!sets.length) {
          units.push({
            key: "t" + term.id + "c" + cp.id + "m0",
            terminalId: term.id, terminal: term.name,
            checkpointId: cp.id, checkpoint: cp.name,
            modSetId: 0, modLabel: "(none)", program: "STD", plant: 0, ms: null, term: term, cp: cp
          });
          return;
        }
        sets.forEach(function (ms, idx) {
          var plant = lanesOf(ms);
          plantAirport += plant;
          units.push({
            key: "t" + term.id + "c" + cp.id + "m" + (ms.id || idx),
            terminalId: term.id, terminal: term.name,
            checkpointId: cp.id, checkpoint: cp.name,
            modSetId: ms.id, modLabel: "Set " + (idx + 1),
            program: ms.program || "STD", plant: plant, ms: ms, term: term, cp: cp
          });
        });
      });
    });
    var rows = slots.map(function (slot) {
      var cells = {};
      var byCp = {};
      var byTerm = {};
      var byProgram = { STD: 0, PRE: 0, MIX: 0 };
      var airport = 0;
      units.forEach(function (u) {
        var open = u.ms ? setOpen(u.ms, u.cp, u.term, slot) : false;
        var n = open ? u.plant : 0;
        cells[u.key] = { lanes: n, program: u.program, open: open };
        var ck = "t" + u.terminalId + "c" + u.checkpointId;
        byCp[ck] = (byCp[ck] || 0) + n;
        byTerm[u.terminalId] = (byTerm[u.terminalId] || 0) + n;
        airport += n;
        if (n && byProgram[u.program] != null) byProgram[u.program] += n;
      });
      return { slot: slot, time: label(slot), cells: cells, byCheckpoint: byCp, byTerminal: byTerm, airport: airport, byProgram: byProgram };
    });
    var peak = 0;
    rows.forEach(function (r) { if (r.airport > peak) peak = r.airport; });
    return {
      units: units,
      terminals: (c.terminals || []).map(function (t) { return { id: t.id, name: t.name }; }),
      rows: rows,
      peak: peak,
      plantAirport: plantAirport
    };
  };

  S.computeCapacity = S.computeLaneCapacityMatrix;

  S.laneCapacityAt = function (terminalId, checkpointId, timeText) {
    var slot = toMin(timeText);
    var m = S.computeLaneCapacityMatrix();
    var row = null;
    m.rows.forEach(function (r) { if (r.slot === slot) row = r; });
    if (!row) {
      m.rows.forEach(function (r) { if (r.time === timeText) row = r; });
    }
    if (!row) return { time: timeText, lanes: 0, detail: [] };
    var detail = m.units.filter(function (u) {
      if (terminalId != null && String(u.terminalId) !== String(terminalId) && u.terminal !== terminalId) return false;
      if (checkpointId != null && String(u.checkpointId) !== String(checkpointId) && u.checkpoint !== checkpointId) return false;
      return true;
    }).map(function (u) {
      var cell = row.cells[u.key] || { lanes: 0 };
      return { terminal: u.terminal, checkpoint: u.checkpoint, modSet: u.modLabel, program: u.program, lanes: cell.lanes, plant: u.plant };
    });
    var lanes = 0;
    detail.forEach(function (d) { lanes += d.lanes; });
    return { time: timeText, lanes: lanes, detail: detail };
  };

  function heat(n, peak) {
    if (!n) return "hc-0";
    if (n >= peak && peak) return "hc-high";
    if (peak && n <= peak * 0.4) return "hc-low";
    return "hc-ok";
  }

  S.renderCapacity = function () {
    var host = S.$("tab-capacity");
    if (!host) return;
    var matrix = S.computeLaneCapacityMatrix();
    var filter = "";
    var existing = S.$("cap-filter-term");
    if (existing) filter = existing.value || "";
    var units = matrix.units.filter(function (u) {
      return !filter || String(u.terminalId) === String(filter);
    });
    var opts = '<option value="">All terminals</option>';
    matrix.terminals.forEach(function (t) {
      opts += '<option value="' + t.id + '"' + (String(filter) === String(t.id) ? " selected" : "") + ">" +
        String(t.name).replace(/</g, "<") + "</option>";
    });
    var plantRows = units.map(function (u) {
      return "<tr><td>" + u.terminal + "</td><td>" + u.checkpoint + "</td><td>" + u.modLabel +
        "</td><td>" + u.program + "</td><td>" + u.plant + "</td></tr>";
    }).join("") || '<tr><td class="muted" colspan="5">No mod sets in Airfield.</td></tr>';

    var head = "<tr><th>Time</th>";
    var seenTerm = {};
    var seenCp = {};
    units.forEach(function (u) {
      if (!seenTerm[u.terminalId]) {
        seenTerm[u.terminalId] = 1;
        head += '<th class="muted">' + u.terminal + " tot</th>";
      }
      var ck = "t" + u.terminalId + "c" + u.checkpointId;
      if (!seenCp[ck]) {
        seenCp[ck] = 1;
        head += "<th>" + u.checkpoint + " tot</th>";
      }
      head += "<th>" + u.checkpoint + " " + u.modLabel + "<div class=\"muted\">" + u.program + " · " + u.plant + "</div></th>";
    });
    head += "<th>Airport</th><th>STD</th><th>PRE</th><th>MIX</th></tr>";

    var body = matrix.rows.map(function (r) {
      var html = "<td>" + r.time + "</td>";
      seenTerm = {};
      seenCp = {};
      units.forEach(function (u) {
        if (!seenTerm[u.terminalId]) {
          seenTerm[u.terminalId] = 1;
          html += '<td class="' + heat(r.byTerminal[u.terminalId] || 0, matrix.peak) + '"><strong>' +
            (r.byTerminal[u.terminalId] || 0) + "</strong></td>";
        }
        var ck = "t" + u.terminalId + "c" + u.checkpointId;
        if (!seenCp[ck]) {
          seenCp[ck] = 1;
          html += '<td class="' + heat(r.byCheckpoint[ck] || 0, matrix.peak) + '"><strong>' +
            (r.byCheckpoint[ck] || 0) + "</strong></td>";
        }
        var cell = r.cells[u.key] || { lanes: 0 };
        html += '<td class="' + heat(cell.lanes, matrix.peak) + '">' + (cell.lanes || "") + "</td>";
      });
      html += "<td><strong>" + r.airport + "</strong></td>";
      html += "<td>" + r.byProgram.STD + "</td><td>" + r.byProgram.PRE + "</td><td>" + r.byProgram.MIX + "</td>";
      return "<tr>" + html + "</tr>";
    }).join("");
    if (!units.length) body = '<tr><td class="muted" colspan="8">Add terminals, checkpoints, and mod sets in Airfield.</td></tr>';

    host.innerHTML =
      '<div class="card">' +
      '<div class="section-title">Physical plant (mod sets add)</div>' +
      '<p class="muted" id="capacity-summary">Plant ' + matrix.plantAirport +
      ' lanes. Two checkpoints × three sets × two lanes = 12. Peak open ' + matrix.peak + ".</p>" +
      '<div class="toolbar"><label>Terminal <select id="cap-filter-term">' + opts + "</select></label></div>" +
      '<div class="lines-scroll"><table class="data-table"><thead><tr>' +
      "<th>Terminal</th><th>Checkpoint</th><th>Mod set</th><th>Program</th><th>Lanes</th></tr></thead>" +
      "<tbody>" + plantRows + "</tbody></table></div></div>" +
      '<div class="card">' +
      '<div class="section-title">30-minute open lanes</div>' +
      '<div class="lines-scroll"><table class="data-table cov-matrix">' +
      "<thead>" + head + "</thead><tbody>" + body + "</tbody></table></div></div>";

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
