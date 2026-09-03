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
        mode: S.state.mode, issues: S.state.issues,
        functionRotation: S.state.functionRotation || {}
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
    S.state.functionRotation = results.functionRotation && typeof results.functionRotation === "object"
      ? results.functionRotation
      : {};
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
    S.state.functionRotation = {};
    S.state.mode = "—";
    S.renderAll();
    S.updateStatus("Cleared results. Configuration remains.");
  };

  function loadScript(src, cb) {
    var existing = document.querySelector('script[src^="lib/exceljs.min.js"]');
    if (existing && typeof ExcelJS !== "undefined") {
      cb();
      return;
    }
    var s = document.createElement("script");
    s.src = src;
    s.onload = cb;
    s.onerror = function () {
      if (S.updateStatus) S.updateStatus("Failed to load Excel library (lib/exceljs.min.js).");
    };
    document.head.appendChild(s);
  }

  function thinBlackBorder() {
    var edge = { style: "thin", color: { argb: "FF000000" } };
    return { top: edge, left: edge, bottom: edge, right: edge };
  }

  function applyBaseCell(cell, fillArgb, fontColor) {
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.font = { name: "Calibri", size: 11, color: { argb: fontColor || "FF000000" }, bold: false };
    cell.border = thinBlackBorder();
    if (fillArgb) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
    }
  }

  function dayDutyForExport(line, dayIndex) {
    var duty = S.getRotationDuty ? S.getRotationDuty(line.id, dayIndex) : null;
    if (duty) return duty;
    if (line.function === "BAG" || line.function === "DFO" || line.function === "PAX") {
      return line.function;
    }
    return null;
  }

  function generateAndDownloadXlsx() {
    var lines = S.state.lines || [];
    if (!lines.length) {
      if (S.updateStatus) S.updateStatus("No lines to export.");
      return;
    }

    var days = 7;
    var dayNames = S.DAYS || ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var metaHeaders = ["Team", "Line", "Shift", "Start", "End", "Emp", "Sex", "Function", "RDOs", "Paid"];
    var headers = metaHeaders.slice();
    for (var d = 0; d < days; d++) headers.push(dayNames[d]);
    headers.push("Hours");

    var workbook = new ExcelJS.Workbook();
    workbook.creator = "BrokeSched";
    workbook.created = new Date();
    var sheet = workbook.addWorksheet("Lines", {
      views: [{ state: "frozen", xSplit: 0, ySplit: 1, activeCell: "A2" }]
    });

    var tableRows = [];
    var rowMeta = [];

    lines.forEach(function (line) {
      var teamMeta = S.teamMetaForLine ? S.teamMetaForLine(line.id) : { name: "" };
      var sh = S.getShift ? S.getShift(line.shiftId) : null;
      var rdo = S.rdoTextForLine ? S.rdoTextForLine(line) : (line.rdoDays || []).join(",");
      var hours = 0;
      var dayValues = [];
      var dayFlags = [];
      for (var i = 0; i < days; i++) {
        var sched = S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [];
        var st = sched[i] || "RDO";
        var isWork = st === "WORK";
        var duty = isWork ? dayDutyForExport(line, i) : null;
        var isBag = isWork && (duty === "BAG" || duty === "BAGS" || duty === "baggage");
        var label;
        if (!isWork) {
          label = "RDO";
        } else if (isBag) {
          label = "BAG";
        } else {
          label = line.shiftLabel || (sh && sh.start) || "WORK";
        }
        if (isWork) hours += line.paid || 0;
        dayValues.push(label);
        dayFlags.push({ isRdo: !isWork, isBag: isBag });
      }

      tableRows.push([
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
      ].concat(dayValues, [hours]));
      rowMeta.push(dayFlags);
    });

    sheet.addRow(headers);
    tableRows.forEach(function (r) { sheet.addRow(r); });

    var lastCol = headers.length;
    var lastRow = tableRows.length + 1;
    var headerFill = "FF1F4E79";
    var zebraLight = "FFFFFFFF";
    var zebraGrey = "FFEDEDED";
    var rdoFill = "FF2E75B6";
    var bagFill = "FFFFC000";

    var headerRow = sheet.getRow(1);
    headerRow.height = 22;
    headerRow.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    for (var c = 1; c <= lastCol; c++) {
      var hc = headerRow.getCell(c);
      hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFill } };
      hc.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      hc.border = thinBlackBorder();
      hc.alignment = { vertical: "middle", horizontal: "center" };
    }

    for (var r = 2; r <= lastRow; r++) {
      var row = sheet.getRow(r);
      row.height = 18;
      var stripe = (r % 2 === 0) ? zebraLight : zebraGrey;
      var flags = rowMeta[r - 2] || [];
      for (var col = 1; col <= lastCol; col++) {
        var cell = row.getCell(col);
        var dayOffset = col - (metaHeaders.length + 1);
        var isDayCol = dayOffset >= 0 && dayOffset < days;
        if (isDayCol && flags[dayOffset] && flags[dayOffset].isRdo) {
          applyBaseCell(cell, rdoFill, "FFFFFFFF");
          cell.font.bold = true;
        } else if (isDayCol && flags[dayOffset] && flags[dayOffset].isBag) {
          applyBaseCell(cell, bagFill, "FF000000");
          cell.font.bold = true;
        } else {
          applyBaseCell(cell, stripe, "FF000000");
        }
      }
    }

    sheet.columns.forEach(function (col, idx) {
      var header = headers[idx] || "";
      var width = 10;
      if (header === "Team") width = 14;
      else if (header === "Line") width = 12;
      else if (header === "Shift") width = 12;
      else if (header === "Function") width = 12;
      else if (header === "RDOs") width = 14;
      else if (dayNames.indexOf(header) !== -1) width = 8;
      else if (header === "Hours") width = 8;
      col.width = width;
    });

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastRow, column: lastCol }
    };
    sheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9
    };

    return workbook.xlsx.writeBuffer().then(function (buffer) {
      var blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      var a = document.createElement("a");
      var url = URL.createObjectURL(blob);
      a.href = url;
      a.download = "scheduler-lines-" + (S.dj ? S.dj().format("YYYY-MM-DD") : "export") + ".xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (S.updateStatus) S.updateStatus("Exported styled Excel (.xlsx) lines table.");
    });
  }

  S.exportLinesExcel = function () {
    var lines = S.state.lines || [];
    if (!lines.length) {
      if (S.updateStatus) S.updateStatus("No lines to export. Generate first.");
      return;
    }
    if (S.updateStatus) S.updateStatus("Preparing Excel (.xlsx) export...");
    function run() {
      try {
        if (typeof ExcelJS === "undefined") throw new Error("ExcelJS not loaded");
        var p = generateAndDownloadXlsx();
        if (p && p.catch) {
          p.catch(function (err) {
            console.error(err);
            if (S.updateStatus) S.updateStatus("Excel export failed: " + (err && err.message ? err.message : err));
          });
        }
      } catch (err) {
        console.error(err);
        if (S.updateStatus) S.updateStatus("Excel export failed: " + (err && err.message ? err.message : err));
      }
    }
    if (typeof ExcelJS === "undefined") {
      loadScript("lib/exceljs.min.js?v=20260902h", run);
    } else {
      run();
    }
  };
})(window.Scheduler);
