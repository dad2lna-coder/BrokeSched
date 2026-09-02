/** Import / export — classic script */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function normalizeLine(raw) {
    if (!raw || typeof raw !== "object" || raw.id == null) return null;
    return {
      id: raw.id,
      lineCode: raw.lineCode || ("Line " + String(raw.id).padStart(3, "0")),
      shiftId: raw.shiftId || "",
      shiftName: raw.shiftName || "",
      shiftLabel: raw.shiftLabel || "",
      empClass: raw.empClass || "",
      position: raw.position || raw.empClass || "",
      isLtso: Boolean(raw.isLtso),
      isStso: Boolean(raw.isStso),
      sex: raw.sex === "F" ? "F" : "M",
      function:
        raw.function === "DFO" || raw.function === "PAX" || raw.function === "BAG"
          ? raw.function
          : "",
      rdoDays: Array.isArray(raw.rdoDays)
        ? raw.rdoDays.map(Number).filter(function (x) {
            return Number.isInteger(x) && x >= 0 && x <= 6;
          })
        : [],
      rdoHard: Boolean(raw.rdoHard),
      paid: S.safeNumber(raw.paid, 8, 1, 24)
    };
  }

  function normalizeSchedule(rawSchedule, validLineIds) {
    var out = {};
    if (!rawSchedule || typeof rawSchedule !== "object") return out;
    var valid = new Set(validLineIds.map(String));
    Object.keys(rawSchedule).forEach(function (key) {
      if (!valid.has(String(key))) return;
      var arr = Array.isArray(rawSchedule[key]) ? rawSchedule[key] : [];
      out[key] = arr.map(function (v) { return v === "WORK" ? "WORK" : "RDO"; });
    });
    return out;
  }

  S.exportJson = function () {
    S.readShiftsFromDom();
    S.state.open = (S.$("cfg-open") && S.$("cfg-open").value) || S.state.open;
    S.state.close = (S.$("cfg-close") && S.$("cfg-close").value) || S.state.close;
    S.state.weekCount = Math.max(1, Math.min(8, +(S.$("cfg-weeks") && S.$("cfg-weeks").value) || S.state.weekCount));
    S.state.ftM = Math.max(0, +(S.$("cfg-ft-m") && S.$("cfg-ft-m").value) || 0);
    S.state.ftF = Math.max(0, +(S.$("cfg-ft-f") && S.$("cfg-ft-f").value) || 0);
    S.state.ptM = Math.max(0, +(S.$("cfg-pt-m") && S.$("cfg-pt-m").value) || 0);
    S.state.ptF = Math.max(0, +(S.$("cfg-pt-f") && S.$("cfg-pt-f").value) || 0);
    S.state.ltsoM = Math.max(0, +(S.$("cfg-ltso-m") && S.$("cfg-ltso-m").value) || 0);
    S.state.ltsoF = Math.max(0, +(S.$("cfg-ltso-f") && S.$("cfg-ltso-f").value) || 0);
    S.state.stsoM = Math.max(0, +(S.$("cfg-stso-m") && S.$("cfg-stso-m").value) || 0);
    S.state.stsoF = Math.max(0, +(S.$("cfg-stso-f") && S.$("cfg-stso-f").value) || 0);
    var startDateValue = (S.$("cfg-start") && S.$("cfg-start").value) || null;
    var payload = {
      app: "scheduler-pre-v2",
      version: 4,
      exportedAt: S.dj().toISOString(),
      config: {
        open: S.state.open, close: S.state.close, startDate: startDateValue,
        weekCount: S.state.weekCount,
        useDynamicHours: !!S.state.useDynamicHours,
        dayHours: S.state.dayHours || null,
        ftM: S.state.ftM, ftF: S.state.ftF, ptM: S.state.ptM, ptF: S.state.ptF,
        ltsoM: S.state.ltsoM, ltsoF: S.state.ltsoF, stsoM: S.state.stsoM, stsoF: S.state.stsoF,
        shifts: S.state.shifts
      },
      results: {
        lines: S.state.lines, schedule: S.state.schedule,
        mode: S.state.mode, issues: S.state.issues
      }
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "scheduler-pre-v4-export-" + S.dj().format("YYYY-MM-DD") + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    S.updateStatus("Exported config and results JSON.");
  };

  S.applyPayload = function (payload) {
    if (!payload || typeof payload !== "object") throw new Error("Invalid JSON payload.");
    var cfg = payload.config || payload.legacy || payload;
    var results = payload.results || payload.legacy || payload;
    S.state.open = S.isValidTimeText(cfg.open) ? cfg.open : "03:30";
    S.state.close = S.isValidTimeText(cfg.close) ? cfg.close : "23:00";
    S.state.useDynamicHours = !!cfg.useDynamicHours;
    if (Array.isArray(cfg.dayHours) && cfg.dayHours.length === 7) {
      S.state.dayHours = cfg.dayHours.map(function (dh) {
        return {
          open: S.isValidTimeText(dh && dh.open) ? dh.open : S.state.open,
          close: S.isValidTimeText(dh && dh.close) ? dh.close : S.state.close
        };
      });
    } else if (S.defaultDayHours) {
      S.state.dayHours = S.defaultDayHours();
    }
    S.state.weekCount = Math.floor(S.safeNumber(cfg.weekCount, 1, 1, 8));
    S.state.ftM = Math.floor(S.safeNumber(cfg.ftM, 0, 0, null));
    S.state.ftF = Math.floor(S.safeNumber(cfg.ftF, 0, 0, null));
    S.state.ptM = Math.floor(S.safeNumber(cfg.ptM, 0, 0, null));
    S.state.ptF = Math.floor(S.safeNumber(cfg.ptF, 0, 0, null));
    S.state.ltsoM = Math.floor(S.safeNumber(cfg.ltsoM, 0, 0, null));
    S.state.ltsoF = Math.floor(S.safeNumber(cfg.ltsoF, 0, 0, null));
    S.state.stsoM = Math.floor(S.safeNumber(cfg.stsoM, 0, 0, null));
    S.state.stsoF = Math.floor(S.safeNumber(cfg.stsoF, 0, 0, null));
    S.state.startDate = S.parseStartDate(cfg.startDate || payload.startDate || null);
    if (Array.isArray(cfg.shifts) && cfg.shifts.length > 0) {
      S.state.shifts = cfg.shifts.map(S.normalizeShift);
    } else {
      S.state.shifts = S.defaultShifts();
    }
    var importedLines = Array.isArray(results.lines)
      ? results.lines.map(normalizeLine).filter(Boolean)
      : [];
    S.state.lines = importedLines;
    S.state.schedule = normalizeSchedule(results.schedule, S.state.lines.map(function (l) { return l.id; }));
    S.state.mode = typeof results.mode === "string" ? results.mode : "imported";
    S.state.issues = Array.isArray(results.issues) ? results.issues.map(String) : [];

    S.setInputValue("cfg-open", S.state.open);
    S.setInputValue("cfg-close", S.state.close);
    S.setInputValue("cfg-weeks", S.state.weekCount);
    S.setInputValue("cfg-ft-m", S.state.ftM);
    S.setInputValue("cfg-ft-f", S.state.ftF);
    S.setInputValue("cfg-pt-m", S.state.ptM);
    S.setInputValue("cfg-pt-f", S.state.ptF);
    S.setInputValue("cfg-ltso-m", S.state.ltsoM);
    S.setInputValue("cfg-ltso-f", S.state.ltsoF);
    S.setInputValue("cfg-stso-m", S.state.stsoM);
    S.setInputValue("cfg-stso-f", S.state.stsoF);
    if (S.$("cfg-start")) S.$("cfg-start").value = S.toDateInputValue(S.state.startDate);

    var maxShiftNum = 0;
    S.state.shifts.forEach(function (s) {
      var m = /^S(\d+)$/.exec(String(s.id));
      if (m) maxShiftNum = Math.max(maxShiftNum, Number(m[1]));
    });
    S.shiftSeq = Math.max(S.shiftSeq, maxShiftNum + 1);
    S.renderShiftsTable();
    S.renderAll();
    var resultText = S.state.lines.length ? "config and results" : "config only";
    S.updateStatus(
      "Imported " + resultText + " · " + S.state.lines.length + " line(s) · " +
      S.state.weekCount + " wk" + (S.state.issues.length ? " · " + S.state.issues.length + " note(s)" : "")
    );
  };

  S.importJsonFile = function (file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (event) {
      try {
        S.applyPayload(JSON.parse(event.target.result));
      } catch (err) {
        console.error(err);
        S.updateStatus("Import failed.");
        S.state.issues = ["Import failed: " + (err && err.message ? err.message : "Invalid JSON file.")];
        S.renderIssues();
      }
    };
    reader.onerror = function () {
      S.updateStatus("Import failed.");
      S.state.issues = ["Import failed: unable to read the selected file."];
      S.renderIssues();
    };
    reader.readAsText(file);
  };

  S.clearAll = function () {
    S.state.lines = [];
    S.state.schedule = {};
    S.state.issues = [];
    S.state.mode = "—";
    S.renderAll();
    S.updateStatus("Cleared results. Configuration remains.");
  };

  /** Excel-compatible CSV of all lines (opens in Excel; printable) */
  S.exportLinesExcel = function () {
    var lines = S.state.lines || [];
    if (!lines.length) {
      if (S.updateStatus) S.updateStatus("No lines to export.");
      return;
    }
    var days = (S.state.weekCount || 1) * 7;
    var headers = [
      "Team",
      "Line",
      "Shift",
      "Start",
      "End",
      "Emp",
      "Sex",
      "Function",
      "RDOs",
      "Paid"
    ];
    for (var d = 0; d < days; d++) {
      headers.push(S.dayLabel ? S.dayLabel(d) : "Day" + (d + 1));
    }
    headers.push("Hours");

    function esc(v) {
      var s = v == null ? "" : String(v);
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    var rows = [headers.map(esc).join(",")];
    lines.forEach(function (line) {
      var teamMeta = S.teamMetaForLine ? S.teamMetaForLine(line.id) : { name: "" };
      var sh = S.getShift ? S.getShift(line.shiftId) : null;
      var rdo =
        S.rdoTextForLine
          ? S.rdoTextForLine(line)
          : (line.rdoDays || []).join(",");
      var hours = 0;
      var dayCells = [];
      for (var i = 0; i < days; i++) {
        var st = (S.state.schedule[line.id] && S.state.schedule[line.id][i]) || "RDO";
        dayCells.push(st === "WORK" ? line.shiftLabel || "WORK" : "RDO");
        if (st === "WORK") hours += line.paid || 0;
      }
      var row = [
        teamMeta.name || "",
        line.lineCode || "",
        line.shiftName || (sh && sh.name) || line.shiftId || "",
        sh ? sh.start : "",
        sh ? sh.end : "",
        line.empClass || "",
        line.sex || "",
        line.function || "",
        rdo,
        line.paid || ""
      ].concat(dayCells, [hours]);
      rows.push(row.map(esc).join(","));
    });

    // BOM so Excel recognizes UTF-8
    var csv = "\uFEFF" + rows.join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    var url = URL.createObjectURL(blob);
    a.href = url;
    a.download =
      "scheduler-lines-" +
      (S.dj ? S.dj().format("YYYY-MM-DD") : "export") +
      ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (S.updateStatus) S.updateStatus("Exported lines CSV (open in Excel / print).");
  };
})(window.Scheduler);
