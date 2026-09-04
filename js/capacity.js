/** Capacity tab — checkpoint TSO / STSO / LTSO demand from airfield config */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function costFor(terminal, program) {
    var c = (terminal && terminal.baseTSOCost) || {};
    if (program === "PRE") return Number(c.PRE) || 0;
    if (program === "MIX") return Number(c.MIX) || 0;
    return Number(c.STD) || 0;
  }

  function pool() {
    var st = S.state || {};
    return {
      tso: (st.ftM || 0) + (st.ftF || 0) + (st.ptM || 0) + (st.ptF || 0),
      ltso: (st.ltsoM || 0) + (st.ltsoF || 0),
      stso: (st.stsoM || 0) + (st.stsoF || 0)
    };
  }

  S.computeCapacity = function () {
    var cfg = S.getAirportConfig ? S.getAirportConfig() : { terminals: [] };
    var terminals = (cfg && cfg.terminals) || [];
    var rows = [];
    var peakTso = 0;
    var openCheckpoints = 0;
    var openTerminals = 0;

    terminals.forEach(function (term) {
      var termTso = 0;
      var cps = term.checkpoints || [];
      if (cps.length) openTerminals++;
      cps.forEach(function (cp) {
        openCheckpoints++;
        var sets = (cp.modSets && cp.modSets.length)
          ? cp.modSets.slice()
          : [{ startTime: cp.startTime, lanes: 0, program: "STD" }];
        sets.sort(function (a, b) {
          return S.timeToMin(a.startTime || "00:00") - S.timeToMin(b.startTime || "00:00");
        });
        var first = sets[0];
        var tsoNeed = (Number(first.lanes) || 0) * costFor(term, first.program);
        termTso += tsoNeed;
        sets.forEach(function (ms) {
          rows.push({
            terminal: term.name,
            checkpoint: cp.name,
            start: ms.startTime || cp.startTime || "—",
            lanes: Number(ms.lanes) || 0,
            program: ms.program || "STD",
            tsoPerLane: costFor(term, ms.program || "STD"),
            tsoNeed: (Number(ms.lanes) || 0) * costFor(term, ms.program || "STD"),
            stsoNeed: 1,
            ltsoNeed: 1
          });
        });
      });
      peakTso += termTso;
    });

    var p = pool();
    var stdCost = 0, preCost = 0, mixCost = 0;
    terminals.forEach(function (term) {
      var c = term.baseTSOCost || {};
      if (!stdCost && c.STD) stdCost = +c.STD;
      if (!preCost && c.PRE) preCost = +c.PRE;
      if (!mixCost && c.MIX) mixCost = +c.MIX;
    });
    if (!stdCost) stdCost = 3;
    if (!preCost) preCost = 2;
    if (!mixCost) mixCost = 3;

    return {
      pool: p,
      rows: rows,
      peakTso: peakTso,
      openCheckpoints: openCheckpoints,
      openTerminals: openTerminals,
      stsoNeed: openCheckpoints,
      ltsoNeed: openTerminals,
      canRun: {
        STD: stdCost ? Math.floor(p.tso / stdCost) : 0,
        PRE: preCost ? Math.floor(p.tso / preCost) : 0,
        MIX: mixCost ? Math.floor(p.tso / mixCost) : 0
      },
      costs: { STD: stdCost, PRE: preCost, MIX: mixCost }
    };
  };

  S.renderCapacity = function () {
    var cap = S.computeCapacity();
    var sum = S.$("capacity-summary");
    var body = S.$("capacity-tbody");
    var p = cap.pool;
    if (sum) {
      sum.innerHTML =
        "On-hand TSO <strong>" + p.tso + "</strong> · STSO <strong>" + p.stso +
        "</strong> · LTSO <strong>" + p.ltso + "</strong><br>" +
        "Checkpoint demand (first mod set each) TSO <strong>" + cap.peakTso +
        "</strong> · STSO seats <strong>" + cap.stsoNeed +
        "</strong> · LTSO seats <strong>" + cap.ltsoNeed + "</strong><br>" +
        "With this TSO pool you could run " +
        "<strong>" + cap.canRun.STD + "</strong> STD lanes, " +
        "<strong>" + cap.canRun.PRE + "</strong> PRE lanes, or " +
        "<strong>" + cap.canRun.MIX + "</strong> MIX lanes " +
        "(cost " + cap.costs.STD + "/" + cap.costs.PRE + "/" + cap.costs.MIX + " TSO per lane).";
    }
    if (!body) return;
    if (!cap.rows.length) {
      body.innerHTML = '<tr><td colspan="8" class="muted">Add terminals and checkpoints in Airfield.</td></tr>';
      return;
    }
    body.innerHTML = cap.rows.map(function (r) {
      return "<tr><td>" + r.terminal + "</td><td>" + r.checkpoint +
        "</td><td>" + r.start + "</td><td>" + r.lanes +
        "</td><td>" + r.program + "</td><td>" + r.tsoPerLane +
        "</td><td>" + r.tsoNeed + "</td><td>STSO 1 / LTSO 1</td></tr>";
    }).join("");
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
