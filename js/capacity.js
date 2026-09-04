/** 30-minute active-lane capacity from Airfield hierarchy */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function cfg() {
    return (S.getAirportConfig && S.getAirportConfig()) || { startTime: "03:30", endTime: "23:00", terminals: [] };
  }

  function toMin(t) {
    return S.timeToMin ? S.timeToMin(t) : 0;
  }

  function label(m) {
    return S.slotLabel ? S.slotLabel(m) : S.minToTime(m);
  }

  function windowOf(node, parent) {
    var start = toMin((node && node.startTime) || (parent && parent.startTime) || cfg().startTime || "03:30");
    var end = toMin((node && node.endTime) || (parent && parent.endTime) || cfg().endTime || "23:00");
    if (end <= start) end += 1440;
    return { start: start, end: end };
  }

  function sortedModSets(cp) {
    return (cp.modSets || []).slice().sort(function (a, b) {
      return toMin(a.startTime || "00:00") - toMin(b.startTime || "00:00");
    });
  }

  /** Every mod set is its own lane group. They add; they do not replace. */
  function openModSets(cp, term, slotMin) {
    var win = windowOf(cp, term);
    if (slotMin < win.start || slotMin >= win.end) return [];
    return sortedModSets(cp).filter(function (ms) {
      var start = toMin(ms.startTime || cp.startTime);
      var end = ms.endTime ? toMin(ms.endTime) : win.end;
      if (end <= start) end += 1440;
      return start <= slotMin && slotMin < end;
    });
  }

  function tallySets(sets) {
    var lanes = 0;
    var byProgram = { STD: 0, PRE: 0, MIX: 0 };
    (sets || []).forEach(function (ms) {
      var n = Number(ms.lanes);
      if (!n && n !== 0) n = 2;
      lanes += n;
      var p = ms.program || "STD";
      if (byProgram[p] == null) byProgram[p] = 0;
      byProgram[p] += n;
    });
    return { lanes: lanes, byProgram: byProgram, sets: sets || [] };
  }

  function physicalPlant(cp) {
    return tallySets(cp.modSets || []);
  }

  S.capacitySlots = function () {
    var c = cfg();
    var open = toMin(c.startTime || (S.state && S.state.open) || "03:30");
    var close = toMin(c.endTime || (S.state && S.state.close) || "23:00");
    open = Math.floor(open / 30) * 30;
    close = Math.ceil(close / 30) * 30;
    if (close <= open) close += 1440;
    var slots = [];
    for (var m = open; m < close; m += 30) slots.push(m);
    return slots;
  };

  S.laneCapacityAt = function (terminalId, checkpointId, timeText) {
    var slot = toMin(timeText);
    var c = cfg();
    var total = 0;
    var hits = [];
    (c.terminals || []).forEach(function (term) {
      if (terminalId != null && String(term.id) !== String(terminalId) && term.name !== terminalId) return;
      (term.checkpoints || []).forEach(function (cp) {
        if (checkpointId != null && String(cp.id) !== String(checkpointId) && cp.name !== checkpointId) return;
        var t = tallySets(openModSets(cp, term, slot));
        total += t.lanes;
        hits.push({
          terminalId: term.id,
          terminal: term.name,
          checkpointId: cp.id,
          checkpoint: cp.name,
          lanes: t.lanes,
          plant: physicalPlant(cp).lanes,
          byProgram: t.byProgram,
          modSetCount: t.sets.length
        });
      });
    });
    return { time: timeText, lanes: total, detail: hits };
  };

  S.computeLaneCapacityMatrix = function () {
    var c = cfg();
    var slots = S.capacitySlots();
    var columns = [];
    var plantAirport = 0;
    (c.terminals || []).forEach(function (term) {
      (term.checkpoints || []).forEach(function (cp) {
        var plant = physicalPlant(cp).lanes;
        plantAirport += plant;
        columns.push({
          key: "t" + term.id + "c" + cp.id,
          terminalId: term.id,
          terminal: term.name,
          checkpointId: cp.id,
          checkpoint: cp.name,
          plant: plant,
          sets: (cp.modSets || []).length
        });
      });
    });
    var rows = slots.map(function (slot) {
      var cells = {};
      var byTerm = {};
      var airport = 0;
      var byProgram = { STD: 0, PRE: 0, MIX: 0 };
      (c.terminals || []).forEach(function (term) {
        var termTot = 0;
        (term.checkpoints || []).forEach(function (cp) {
          var t = tallySets(openModSets(cp, term, slot));
          cells["t" + term.id + "c" + cp.id] = t;
          termTot += t.lanes;
          byProgram.STD += t.byProgram.STD;
          byProgram.PRE += t.byProgram.PRE;
          byProgram.MIX += t.byProgram.MIX;
        });
        byTerm[term.id] = termTot;
        airport += termTot;
      });
      return {
        slot: slot,
        time: label(slot),
        cells: cells,
        byTerminal: byTerm,
        airport: airport,
        byProgram: byProgram
      };
    });
    var peak = 0;
    var minOpen = Infinity;
    rows.forEach(function (r) {
      if (r.airport > peak) peak = r.airport;
      if (r.airport > 0 && r.airport < minOpen) minOpen = r.airport;
    });
    if (!isFinite(minOpen)) minOpen = 0;
    return {
      slots: slots,
      columns: columns,
      terminals: (c.terminals || []).map(function (t) { return { id: t.id, name: t.name }; }),
      rows: rows,
      peak: peak,
      minOpen: minOpen,
      plantAirport: plantAirport
    };
  };

  S.computeCapacity = S.computeLaneCapacityMatrix;

  function heat(n, peak) {
    if (!n) return "hc-0";
    if (!peak) return "hc-ok";
    if (n >= peak) return "hc-high";
    if (n <= peak * 0.4) return "hc-low";
    return "hc-ok";
  }

  function progLabel(bp) {
    var parts = [];
    if (bp.STD) parts.push(bp.STD + " STD");
    if (bp.PRE) parts.push(bp.PRE + " PRE");
    if (bp.MIX) parts.push(bp.MIX + " MIX");
    return parts.join(" / ");
  }

  S.renderCapacity = function () {
    var host = S.$("tab-capacity");
    if (!host) return;
    var matrix = S.computeLaneCapacityMatrix();
    var filter = (S.$("cap-filter-term") && S.$("cap-filter-term").value) || "";
    var cols = matrix.columns.filter(function (col) {
      return !filter || String(col.terminalId) === String(filter);
    });
    var termOpts = '<option value="">All terminals</option>';
    matrix.terminals.forEach(function (t) {
      termOpts += '<option value="' + t.id + '"' + (String(filter) === String(t.id) ? " selected" : "") + ">" +
        String(t.name).replace(/</g, "<") + "</option>";
    });
    var head = "<tr><th>Time</th>";
    var lastTerm = null;
    cols.forEach(function (col) {
      if (col.terminal !== lastTerm) {
        lastTerm = col.terminal;
        head += '<th class="muted">' + col.terminal + "</th>";
      }
      head += "<th>" + col.checkpoint + "<div class=\"muted\">plant " + col.plant +
        " / " + col.sets + " sets</div></th>";
    });
    head += "<th>Airport</th><th>STD</th><th>PRE</th><th>MIX</th></tr>";
    var body;
    if (!cols.length) {
      body = '<tr><td class="muted" colspan="8">Add terminals and checkpoints in Airfield.</td></tr>';
    } else {
      body = matrix.rows.map(function (r) {
        var html = "<td>" + r.time + "</td>";
        lastTerm = null;
        cols.forEach(function (col) {
          if (col.terminal !== lastTerm) {
            lastTerm = col.terminal;
            html += '<td class="' + heat(r.byTerminal[col.terminalId] || 0, matrix.peak) + '"><strong>' +
              (r.byTerminal[col.terminalId] || 0) + "</strong></td>";
          }
          var cell = r.cells[col.key] || { lanes: 0, byProgram: {} };
          var title = cell.lanes ? progLabel(cell.byProgram) : "closed";
          html += '<td class="' + heat(cell.lanes, matrix.peak) + '" title="' + title + '">' +
            (cell.lanes || "") +
            (cell.lanes ? '<div class="muted">' + progLabel(cell.byProgram) + "</div>" : "") +
            "</td>";
        });
        html += "<td><strong>" + r.airport + "</strong></td>";
        html += "<td>" + r.byProgram.STD + "</td><td>" + r.byProgram.PRE + "</td><td>" + r.byProgram.MIX + "</td>";
        return "<tr>" + html + "</tr>";
      }).join("");
    }
    var card = host.querySelector(".card") || host;
    if (!S.$("capacity-matrix-head")) {
      card.innerHTML =
        '<div class="section-title">30-minute active lanes</div>' +
        '<p class="muted" id="capacity-summary"></p>' +
        '<div class="toolbar" style="flex-wrap:wrap;gap:0.75rem">' +
        '<label>Terminal <select id="cap-filter-term">' + termOpts + "</select></label>" +
        "</div>" +
        '<div class="lines-scroll">' +
        '<table class="data-table cov-matrix" id="capacity-matrix">' +
        '<thead id="capacity-matrix-head"></thead>' +
        '<tbody id="capacity-matrix-body"></tbody>' +
        "</table></div>";
    } else if (S.$("cap-filter-term")) {
      S.$("cap-filter-term").innerHTML = termOpts;
    }
    if (S.$("capacity-matrix-head")) S.$("capacity-matrix-head").innerHTML = head;
    if (S.$("capacity-matrix-body")) S.$("capacity-matrix-body").innerHTML = body;
    if (S.$("capacity-summary")) {
      S.$("capacity-summary").textContent =
        "Each mod set is a lane group (default 2, can drop to 1). Groups add. " +
        "Physical plant " + matrix.plantAirport + " lanes. Open now peaks at " + matrix.peak + ".";
    }
    var sel = S.$("cap-filter-term");
    if (sel && !sel._capBound) {
      sel._capBound = true;
      sel.addEventListener("change", function () { S.renderCapacity(); });
    }
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
