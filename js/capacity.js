/** Capacity + named mod sets + team assignment (sex balance on checkpoint pair) */
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
  function paxHalf(program, n) {
    var r = rates();
    return n * ((r[program] != null ? r[program] : r.STD) / 2);
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

  S.listModSets = function () {
    var out = [];
    (cfg().terminals || []).forEach(function (term) {
      (term.checkpoints || []).forEach(function (cp) {
        (cp.modSets || []).forEach(function (ms, idx) {
          if (!ms.name) ms.name = "MS-" + (ms.id != null ? ms.id : idx + 1);
          out.push({
            id: ms.id, name: ms.name, lanes: lanesOf(ms), program: ms.program || "STD", startTime: ms.startTime,
            terminalId: term.id, terminal: term.name, checkpointId: cp.id, checkpoint: cp.name,
            term: term, cp: cp, ms: ms
          });
        });
      });
    });
    return out;
  };

  S.teamSexCounts = function (team) {
    var c = S.teamMemberCounts ? S.teamMemberCounts(team) : null;
    if (c) {
      var m = (c.STSO.M || 0) + (c.LTSO.M || 0) + (c.TSO.M || 0);
      var f = (c.STSO.F || 0) + (c.LTSO.F || 0) + (c.TSO.F || 0);
      return { m: m, f: f, t: m + f, fPct: m + f ? Math.round((100 * f) / (m + f)) : 0 };
    }
    return { m: 0, f: 0, t: 0, fPct: 0 };
  };

  S.setTeamModSet = function (teamId, modSetId) {
    var team = S.getTeamById ? S.getTeamById(teamId) : null;
    if (!team) return;
    var rec = null;
    S.listModSets().forEach(function (m) { if (String(m.id) === String(modSetId)) rec = m; });
    team.modSetId = rec ? rec.id : null;
    team.modSetName = rec ? rec.name : "";
    team.checkpointId = rec ? rec.checkpointId : null;
    team.checkpointName = rec ? rec.checkpoint : "";
    (team.members || []).forEach(function (mid) {
      var line = null;
      (S.state.lines || []).forEach(function (l) { if (String(l.id) === String(mid)) line = l; });
      if (!line) return;
      line.modSetId = rec ? rec.id : null;
      line.modSetName = rec ? rec.name : "";
      line.checkpointName = rec ? rec.checkpoint : "";
    });
  };

  S.assignTeamsToModSets = function () {
    var sets = S.listModSets();
    var teams = (S.teams && S.teams.teams) ? S.teams.teams.slice() : [];
    if (!teams.length) {
      var msg = "Form teams first, then assign to mod sets.";
      if (S.updateStatus) S.updateStatus(msg);
      return { message: msg };
    }
    if (!sets.length) {
      var msg2 = "Name mod sets in Airfield first.";
      if (S.updateStatus) S.updateStatus(msg2);
      return { message: msg2 };
    }
    teams.forEach(function (team, i) { S.setTeamModSet(team.id, sets[i % sets.length].id); });
    S.balanceCheckpointPairings();
    var msg3 = "Assigned " + teams.length + " teams to " + sets.length + " named mod sets. Pairing pass ran for M/F.";
    if (S.updateStatus) S.updateStatus(msg3);
    if (S.renderTeams) S.renderTeams();
    if (S.renderCapacity) S.renderCapacity();
    return { message: msg3 };
  };

  S.balanceCheckpointPairings = function () {
    var teams = (S.teams && S.teams.teams) || [];
    var byCp = {};
    teams.forEach(function (t) {
      if (t.checkpointId == null) return;
      var k = String(t.checkpointId);
      if (!byCp[k]) byCp[k] = [];
      byCp[k].push(t);
    });
    Object.keys(byCp).forEach(function (k) {
      var group = byCp[k];
      if (group.length < 2) return;
      var sex = group.map(S.teamSexCounts);
      var allMale = sex.some(function (s) { return s.t && s.f === 0; });
      if (!allMale) return;
      var donor = null, needy = null;
      group.forEach(function (t, i) {
        if (sex[i].f > 0 && (!donor || sex[i].f > S.teamSexCounts(donor).f)) donor = t;
        if (sex[i].f === 0) needy = t;
      });
      if (!donor || !needy || donor === needy) return;
      var a = donor.modSetId;
      S.setTeamModSet(donor.id, needy.modSetId);
      S.setTeamModSet(needy.id, a);
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
    var sets = S.listModSets();
    var matrix = S.computeLaneCapacityMatrix();
    var teams = (S.teams && S.teams.teams) || [];
    var setRows = sets.map(function (s) {
      var on = teams.filter(function (t) { return String(t.modSetId) === String(s.id); });
      var m = 0, f = 0;
      on.forEach(function (t) { var sx = S.teamSexCounts(t); m += sx.m; f += sx.f; });
      var names = on.map(function (t) { return t.name || t.id; }).join(", ") || "—";
      return "<tr><td>" + s.name + "</td><td>" + s.checkpoint + "</td><td>" + s.program + "</td><td>" + s.lanes +
        "</td><td>" + names + "</td><td><span class=\"sex-m\">" + m + "M</span>/<span class=\"sex-f\">" + f + "F</span></td></tr>";
    }).join("") || '<tr><td class="muted" colspan="6">Name mod sets in Airfield (Configure checkpoint).</td></tr>';
    var pairRows = "";
    var byCp = {};
    teams.forEach(function (t) {
      var k = t.checkpointName || "Unassigned";
      if (!byCp[k]) byCp[k] = { m: 0, f: 0, teams: [] };
      var sx = S.teamSexCounts(t);
      byCp[k].m += sx.m; byCp[k].f += sx.f;
      byCp[k].teams.push((t.name || t.id) + (t.modSetName ? "→" + t.modSetName : ""));
    });
    Object.keys(byCp).forEach(function (k) {
      var g = byCp[k];
      pairRows += "<tr class=\"" + (g.m && !g.f ? "hc-high" : "") + "\"><td>" + k + "</td><td>" + g.teams.join(", ") +
        "</td><td><span class=\"sex-m\">" + g.m + "M</span>/<span class=\"sex-f\">" + g.f + "F</span></td></tr>";
    });
    if (!pairRows) pairRows = '<tr><td class="muted" colspan="3">Form teams, then assign to mod sets.</td></tr>';
    var r = matrix.rates;
    var filter = (S.$("cap-filter-term") && S.$("cap-filter-term").value) || "";
    var cols = matrix.checkpoints.filter(function (c) { return !filter || String(c.terminalId) === String(filter); });
    var opts = '<option value="">All terminals</option>';
    matrix.terminals.forEach(function (t) {
      opts += '<option value="' + t.id + '"' + (String(filter) === String(t.id) ? " selected" : "") + ">" + String(t.name).replace(/</g, "<") + "</option>";
    });
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
          var tv = row.byTerminal[c.terminalId] || { lanes: 0 };
          html += '<td class="' + heat(tv.lanes, matrix.peakLanes) + '"><strong>' + (tv.lanes || "") + "</strong></td>";
        }
        var cell = row.byCheckpoint[c.key] || { lanes: 0, pax: 0 };
        html += '<td class="' + heat(cell.lanes, matrix.peakLanes) + '">' + (cell.lanes || "") + "</td>";
        html += '<td class="' + heat(cell.pax, matrix.peakPax) + '">' + num(cell.pax) + "</td>";
      });
      html += "<td><strong>" + (row.airportLanes || "") + "</strong></td><td><strong>" + num(row.airportPax) + "</strong></td>";
      return "<tr>" + html + "</tr>";
    }).join("");
    host.innerHTML =
      '<div class="card"><div class="section-title">Named mod sets</div>' +
      '<p class="muted">Teams stay 1/1/6–8. Assign the whole team to a numbered mod set. Sex mix is first inside the team, then again when teams share a checkpoint.</p>' +
      '<div class="toolbar"><button type="button" class="btn btn-amber" id="btn-assign-ms">Assign teams to mod sets</button>' +
      '<span class="muted" id="ms-assign-hint">Airfield names the sets. Teams tab can move a team.</span></div>' +
      '<div class="lines-scroll"><table class="data-table"><thead><tr><th>Mod set</th><th>Checkpoint</th><th>Program</th><th>Lanes</th><th>Teams</th><th>M/F</th></tr></thead><tbody>' +
      setRows + "</tbody></table></div></div>" +
      '<div class="card"><div class="section-title">Checkpoint pairing (second M/F pass)</div>' +
      '<div class="lines-scroll"><table class="data-table"><thead><tr><th>Checkpoint</th><th>Teams → sets</th><th>Combined M/F</th></tr></thead><tbody>' +
      pairRows + "</tbody></table></div></div>" +
      '<div class="card"><div class="section-title">Half-hour throughput</div>' +
      '<p class="muted">STD ' + r.STD + " · PRE " + r.PRE + " · MIX " + r.MIX + " /lane/hr</p>" +
      '<div class="toolbar"><label>Terminal <select id="cap-filter-term">' + opts + "</select></label></div>" +
      '<div class="lines-scroll"><table class="data-table cov-matrix"><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div></div>";
    var sel = S.$("cap-filter-term");
    if (sel) sel.addEventListener("change", function () { S.renderCapacity(); });
    var btn = S.$("btn-assign-ms");
    if (btn) btn.addEventListener("click", function () {
      var out = S.assignTeamsToModSets();
      var hint = S.$("ms-assign-hint");
      if (hint) hint.textContent = out.message;
    });
  };

  S.decorateTeamModSetSelects = function () {
    var sets = S.listModSets();
    document.querySelectorAll(".team-board").forEach(function (board) {
      if (board.querySelector("[data-team-ms]")) return;
      var id = board.getAttribute("data-team-id");
      var team = S.getTeamById ? S.getTeamById(id) : null;
      if (!team) return;
      var sel = document.createElement("select");
      sel.setAttribute("data-team-ms", id);
      var html = '<option value="">Mod set</option>';
      sets.forEach(function (s) {
        html += '<option value="' + s.id + '"' + (String(team.modSetId) === String(s.id) ? " selected" : "") + ">" +
          s.name + " · " + s.checkpoint + "</option>";
      });
      sel.innerHTML = html;
      var head = board.querySelector(".team-board-head");
      if (head) head.appendChild(sel);
      sel.addEventListener("change", function () {
        S.setTeamModSet(id, sel.value);
        if (S.renderCapacity) S.renderCapacity();
      });
    });
  };

  S.initCapacity = function () {
    if (typeof S.switchTab === "function" && !S._capacityTabWrapped) {
      S._capacityTabWrapped = true;
      var orig = S.switchTab;
      S.switchTab = function (name) {
        orig(name);
        if (name === "capacity") S.renderCapacity();
        if (name === "teams") S.decorateTeamModSetSelects();
      };
    }
    if (typeof S.renderTeams === "function" && !S.renderTeams._msDecorated) {
      var rt = S.renderTeams;
      S.renderTeams = function () {
        rt.apply(this, arguments);
        S.decorateTeamModSetSelects();
      };
      S.renderTeams._msDecorated = true;
    }
    S.renderCapacity();
  };
})(window.Scheduler);
