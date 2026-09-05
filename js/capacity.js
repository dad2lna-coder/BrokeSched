/** Capacity: PAX vs dual checkpoints; team home CP; BAG off checkpoint */
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
  function findLine(id) {
    var list = S.state.lines || [];
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
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
        if (rules[cp.id] === "MAY_BAG" || rules[cp.id] === "MAY_BOTH") rules[cp.id] = "MAY_DFO";
        cp.staffRule = rules[cp.id];
        list.push({ id: cp.id, name: cp.name, terminal: term.name, terminalId: term.id, rule: rules[cp.id] });
      });
    });
    return list;
  };

  S.setCheckpointStaffRule = function (checkpointId, rule) {
    S.ensureCheckpointRules();
    S.state.checkpointStaff[checkpointId] = rule === "MAY_DFO" || rule === "DUAL" ? "MAY_DFO" : "PAX";
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
        cps.push({ key: "t" + term.id + "c" + cp.id, terminalId: term.id, terminal: term.name, checkpointId: cp.id, checkpoint: cp.name, term: term, cp: cp });
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

  S.setTeamCheckpoint = function (teamId, checkpointId) {
    var team = S.getTeamById ? S.getTeamById(teamId) : null;
    if (!team) return;
    var rec = null;
    S.ensureCheckpointRules().forEach(function (r) { if (String(r.id) === String(checkpointId)) rec = r; });
    team.checkpointId = rec ? rec.id : null;
    team.checkpointName = rec ? rec.name : "";
    var days = (S.state.weekCount || 1) * 7;
    if (!S.state.checkpointAssignment) S.state.checkpointAssignment = {};
    (team.members || []).forEach(function (mid) {
      var line = findLine(mid);
      if (!line) return;
      line.checkpointId = rec ? rec.id : null;
      line.checkpointName = rec ? rec.name : "";
      var key = String(line.id);
      if (!S.state.checkpointAssignment[key]) S.state.checkpointAssignment[key] = [];
      for (var d = 0; d < days; d++) {
        var duty = S.lineDuty(line, d);
        if (duty === "BAG") S.state.checkpointAssignment[key][d] = { id: null, name: "BAG", duty: "BAG" };
        else if (rec) S.state.checkpointAssignment[key][d] = { id: rec.id, name: rec.name, terminal: rec.terminal, duty: duty, teamId: team.id };
        else S.state.checkpointAssignment[key][d] = null;
      }
    });
    if (S.renderLines) S.renderLines();
  };

  S.assignLinesToCheckpoints = function () {
    var rules = S.ensureCheckpointRules();
    if (!S.state.lines || !S.state.lines.length) {
      if (S.updateStatus) S.updateStatus("Generate lines first.");
      return { assigned: 0, message: "Generate lines first." };
    }
    var paxCps = rules.filter(function (r) { return r.rule === "PAX"; });
    var dualCps = rules.filter(function (r) { return r.rule === "MAY_DFO" || r.rule === "DUAL"; });
    S.state.checkpointAssignment = {};
    var days = (S.state.weekCount || 1) * 7;
    var rrPax = 0, rrDual = 0, assigned = 0, bagSkip = 0, dfoNoHome = 0;
    function put(id, d, rec) {
      var key = String(id);
      if (!S.state.checkpointAssignment[key]) S.state.checkpointAssignment[key] = [];
      while (S.state.checkpointAssignment[key].length <= d) S.state.checkpointAssignment[key].push(null);
      S.state.checkpointAssignment[key][d] = rec;
    }
    function stamp(members, rec, teamId) {
      (members || []).forEach(function (mid) {
        var line = findLine(mid);
        if (!line) return;
        line.checkpointId = rec ? rec.id : null;
        line.checkpointName = rec ? rec.name : "";
        for (var d = 0; d < days; d++) {
          var sched = (S.state.schedule || {})[line.id] || (S.state.schedule || {})[String(line.id)] || [];
          var duty = S.lineDuty(line, d);
          if (sched[d] !== "WORK") { put(line.id, d, null); continue; }
          if (duty === "BAG") { put(line.id, d, { id: null, name: "BAG", duty: "BAG" }); bagSkip++; continue; }
          if (!rec) { put(line.id, d, { id: null, name: duty === "DFO" ? "DFO unplaced" : "No CP", duty: duty }); continue; }
          put(line.id, d, { id: rec.id, name: rec.name, terminal: rec.terminal, duty: duty, teamId: teamId });
          assigned++;
        }
      });
    }
    var teams = (S.teams && S.teams.teams) ? S.teams.teams : [];
    if (teams.length) {
      teams.forEach(function (team) {
        var hasDfo = false, onlyBag = true, any = false;
        (team.members || []).forEach(function (mid) {
          var line = findLine(mid);
          if (!line) return;
          any = true;
          var duty = S.lineDuty(line, 0);
          if (duty !== "BAG") onlyBag = false;
          if (duty === "DFO") hasDfo = true;
        });
        if (!any) return;
        if (onlyBag) { team.checkpointId = null; team.checkpointName = "BAG"; stamp(team.members, null, team.id); return; }
        var rec = null;
        if (hasDfo) {
          if (!dualCps.length) { dfoNoHome++; stamp(team.members, null, team.id); return; }
          rec = dualCps[rrDual++ % dualCps.length];
        } else {
          var pool = paxCps.length ? paxCps : dualCps;
          if (!pool.length) { stamp(team.members, null, team.id); return; }
          rec = pool[rrPax++ % pool.length];
        }
        team.checkpointId = rec.id;
        team.checkpointName = rec.name;
        stamp(team.members, rec, team.id);
      });
    } else {
      (S.state.lines || []).forEach(function (line) { stamp([line.id], null, null); });
    }
    var msg = "Home CP is on the team. BAG stays in baggage (" + bagSkip + ")." + (dfoNoHome ? " Need a Dual CP for DFO teams." : "");
    if (S.updateStatus) S.updateStatus(msg);
    if (S.renderTeams) S.renderTeams();
    if (S.renderLines) S.renderLines();
    return { assigned: assigned, bagSkip: bagSkip, message: msg };
  };

  S.checkpointForLine = function (lineId, dayIndex) {
    var line = findLine(lineId);
    if (line && line.checkpointName) return { id: line.checkpointId, name: line.checkpointName };
    var row = (S.state.checkpointAssignment || {})[String(lineId)];
    return row ? (row[dayIndex] || null) : null;
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
    var cols = matrix.checkpoints.filter(function (c) { return !filter || String(c.terminalId) === String(filter); });
    var opts = '<option value="">All terminals</option>';
    matrix.terminals.forEach(function (t) {
      opts += '<option value="' + t.id + '"' + (String(filter) === String(t.id) ? " selected" : "") + ">" + String(t.name).replace(/</g, "<") + "</option>";
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
      return "<tr><td>" + cp.terminal + "</td><td>" + cp.name + "</td><td><select data-cp-rule="' + cp.id + '"><option value="PAX"' +
        (cp.rule === "PAX" ? " selected" : "") + ">PAX only</option><option value="MAY_DFO"' +
        (cp.rule !== "PAX" ? " selected" : "") + ">Dual (PAX + DFO)</option></select></td></tr>";
    }).join("") || '<tr><td class="muted" colspan="3">Open Airfield and add a checkpoint first.</td></tr>';
    var aRows = "";
    (S.state.lines || []).slice(0, 80).forEach(function (line) {
      var rec = S.checkpointForLine(line.id, 0);
      aRows += "<tr><td>" + (line.lineCode || line.id) + "</td><td>" + (S.lineRoleKey ? S.lineRoleKey(line) : "") +
        "</td><td>" + S.lineDuty(line, 0) + "</td><td>" + (rec && rec.name ? rec.name : "—") + "</td></tr>";
    });
    if (!(S.state.lines || []).length) aRows = '<tr><td class="muted" colspan="4">Airfield → function coverage → generate → form teams → assign home CP.</td></tr>';
    host.innerHTML =
      '<div class="card"><div class="section-title">SET CHECKPOINT RULES HERE</div>' +
      '<p class="muted">BAG never sits a checkpoint. PAX only vs Dual (PAX + DFO). Home CP lives on the TEAM so members stay together. Move the team to move everyone.</p>' +
      '<div class="lines-scroll"><table class="data-table"><thead><tr><th>Terminal</th><th>Checkpoint</th><th>Rule</th></tr></thead><tbody>' + ruleRows + "</tbody></table></div></div>" +
      '<div class="card"><div class="section-title">Half-hour checkpoint throughput</div>' +
      '<p class="muted">STD ' + r.STD + " / PRE " + r.PRE + " / MIX " + r.MIX + " per lane per hour. Pax/30 = lanes × rate ÷ 2.</p>" +
      '<div class="toolbar"><label>Terminal <select id="cap-filter-term">' + opts + "</select></label></div>" +
      '<div class="lines-scroll"><table class="data-table cov-matrix"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div></div>" +
      '<div class="card"><div class="section-title">Team home checkpoint</div>' +
      '<div class="toolbar"><button type="button" class="btn btn-amber" id="btn-assign-cp">Assign team homes</button>' +
      '<span class="muted" id="cp-assign-hint">Form teams first, then assign. BAG stays baggage.</span></div>' +
      '<div class="lines-scroll"><table class="data-table"><thead><tr><th>Line</th><th>Role</th><th>Duty</th><th>Home CP</th></tr></thead><tbody>' + aRows + "</tbody></table></div></div>";
    var sel = S.$("cap-filter-term");
    if (sel) sel.addEventListener("change", function () { S.renderCapacity(); });
    document.querySelectorAll("[data-cp-rule]").forEach(function (el) {
      el.addEventListener("change", function () { S.setCheckpointStaffRule(el.getAttribute("data-cp-rule"), el.value); });
    });
    var btn = S.$("btn-assign-cp");
    if (btn) btn.addEventListener("click", function () {
      var out = S.assignLinesToCheckpoints();
      var hint = S.$("cp-assign-hint");
      if (hint) hint.textContent = out.message;
      S.renderCapacity();
    });
  };

  S.decorateTeamCheckpointSelects = function () {
    var rules = S.ensureCheckpointRules();
    document.querySelectorAll(".team-board").forEach(function (board) {
      if (board.querySelector("[data-team-cp]")) return;
      var id = board.getAttribute("data-team-id");
      var team = S.getTeamById ? S.getTeamById(id) : null;
      if (!team) return;
      var sel = document.createElement("select");
      sel.setAttribute("data-team-cp", id);
      var html = '<option value="">Home CP</option>';
      rules.forEach(function (r) {
        html += '<option value="' + r.id + '"' + (String(team.checkpointId) === String(r.id) ? " selected" : "") + ">" +
          r.name + (r.rule === "PAX" ? " PAX" : " dual") + "</option>";
      });
      sel.innerHTML = html;
      var head = board.querySelector(".team-board-head");
      if (head) head.appendChild(sel);
      sel.addEventListener("change", function () { S.setTeamCheckpoint(id, sel.value); });
    });
  };

  S.decorateLinesCheckpointColumn = function () {
    var thead = S.$("lines-thead");
    var tbody = S.$("lines-tbody");
    if (!thead || !tbody) return;
    var hr = thead.querySelector("tr");
    if (hr && !hr.querySelector(".th-cp")) {
      var th = document.createElement("th");
      th.className = "th-cp";
      th.textContent = "Checkpoint";
      if (hr.children.length > 6) hr.insertBefore(th, hr.children[6]);
      else hr.appendChild(th);
    }
    Array.prototype.forEach.call(tbody.querySelectorAll("tr"), function (tr) {
      if (tr.querySelector(".td-cp") || tr.querySelector("td[colspan]")) return;
      var lineId = tr.getAttribute("data-line-id");
      if (!lineId) {
        var inp = tr.querySelector("[data-line-id]");
        if (inp) lineId = inp.getAttribute("data-line-id");
      }
      var rec = lineId != null ? S.checkpointForLine(lineId, 0) : null;
      if (!rec) {
        var code = (tr.querySelector(".line-code") || tr.children[1] || {}).textContent;
        (S.state.lines || []).forEach(function (l) {
          if ((l.lineCode || "") === (code || "").trim()) rec = S.checkpointForLine(l.id, 0);
        });
      }
      var td = document.createElement("td");
      td.className = "td-cp";
      td.textContent = rec && rec.name ? rec.name : "—";
      if (tr.children.length > 6) tr.insertBefore(td, tr.children[6]);
      else tr.appendChild(td);
    });
  };

  S.initCapacity = function () {
    var orig = S.switchTab;
    if (typeof orig === "function" && !S._capacityTabWrapped) {
      S._capacityTabWrapped = true;
      S.switchTab = function (name) {
        orig(name);
        if (name === "capacity") S.renderCapacity();
        if (name === "teams" && S.decorateTeamCheckpointSelects) S.decorateTeamCheckpointSelects();
      };
    }
    if (typeof S.renderTeams === "function" && !S.renderTeams._cpDecorated) {
      var origRT = S.renderTeams;
      S.renderTeams = function () {
        origRT.apply(this, arguments);
        S.decorateTeamCheckpointSelects();
      };
      S.renderTeams._cpDecorated = true;
    }
    if (typeof S.renderLines === "function" && !S.renderLines._cpDecorated) {
      var origRL = S.renderLines;
      S.renderLines = function () {
        origRL.apply(this, arguments);
        S.decorateLinesCheckpointColumn();
      };
      S.renderLines._cpDecorated = true;
    }
    S.ensureCheckpointRules();
    S.renderCapacity();
  };
})(window.Scheduler);
