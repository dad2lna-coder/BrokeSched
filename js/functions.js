/** Function coverage — role-based DFO pools, 50/50 AM-PM, daily rotation */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function defaultBands() {
    return [
      { start: "03:30", end: "04:00", stso: 1, ltso: 1, tso: 2 },
      { start: "04:00", end: "20:30", stso: 1, ltso: 1, tso: 6 },
      { start: "20:30", end: "23:00", stso: 1, ltso: 1, tso: 3 }
    ];
  }

  S.ensureFunctionCoverage = function () {
    if (!S.state.functionCoverage) S.state.functionCoverage = {};
    var fc = S.state.functionCoverage;
    if (fc.poolStsoDfo == null) fc.poolStsoDfo = 0;
    if (fc.poolLtsoDfo == null) fc.poolLtsoDfo = 0;
    if (fc.poolTsoDfo == null) fc.poolTsoDfo = 0;
    if (fc.poolBag == null) fc.poolBag = 0;
    if (fc.amPmSplit == null) fc.amPmSplit = true;
    if (fc.phaseThresholdMin == null) fc.phaseThresholdMin = 15;
    if (!Array.isArray(fc.bands) || !fc.bands.length) fc.bands = defaultBands();
    // strip legacy flags
    delete fc.stsoIsDfo;
    delete fc.poolDfo;
    delete fc.poolPax;
    if (!S.state.functionRotation) S.state.functionRotation = {};
    return fc;
  };

  /** Anchors + phases: Opening / AM / PM / Closing */
  S.computeShiftAnchors = S.computeShiftAnchors || function () {
    var starts = {};
    (S.state.lines || []).forEach(function (l) {
      var sh = S.getShift(l.shiftId);
      if (!sh) return;
      var m = S.timeToMin(sh.start);
      starts[m] = (starts[m] || 0) + 1;
    });
    var entries = Object.keys(starts)
      .map(function (k) { return { min: +k, n: starts[k] }; })
      .sort(function (a, b) { return a.min - b.min; });
    if (!entries.length) return { am: 8 * 60, pm: 14 * 60 };
    var am = entries[0].min, amN = 0;
    entries.forEach(function (e) {
      if (e.min < 11 * 60 && e.n > amN) { amN = e.n; am = e.min; }
    });
    var pm = entries[entries.length - 1].min, pmN = 0;
    entries.forEach(function (e) {
      if (e.min >= 11 * 60 + 15 && e.n > pmN) { pmN = e.n; pm = e.min; }
    });
    if (pmN === 0) {
      entries.forEach(function (e) {
        if (e.min >= 12 * 60 && e.n > pmN) { pmN = e.n; pm = e.min; }
      });
    }
    return { am: am, pm: pm };
  };

  /**
   * Opening: start <= AM anchor - threshold (and before 11:00)
   * AM: main morning cluster through before PM
   * PM: from PM anchor
   * Closing: start >= PM anchor + threshold and after 11:15
   */
  S.phaseOfStart = function (startMin, anchors, threshold) {
    threshold = threshold != null ? threshold : 15;
    anchors = anchors || S.computeShiftAnchors();
    if (startMin <= anchors.am - threshold && startMin < 11 * 60) return "Opening";
    if (startMin >= anchors.pm + threshold && startMin >= 11 * 60 + 15) return "Closing";
    if (startMin < anchors.pm) return "AM";
    return "PM";
  };

  S.isAmSide = function (startMin, anchors, threshold) {
    var p = S.phaseOfStart(startMin, anchors, threshold);
    return p === "Opening" || p === "AM";
  };

  S.lineStartMin = function (line) {
    var sh = S.getShift(line.shiftId);
    return sh ? S.timeToMin(sh.start) : 0;
  };

  S.lineRoleKey = function (line) {
    if (line.isStso || line.empClass === "STSO") return "STSO";
    if (line.isLtso || line.empClass === "LTSO") return "LTSO";
    return "TSO";
  };

  S.getRotationDuty = function (lineId, dayIndex) {
    var rot = S.state.functionRotation || {};
    var row = rot[String(lineId)] || rot[lineId];
    if (!row) return null;
    return row[dayIndex] != null ? row[dayIndex] : null;
  };

  S.lineCoversSlot = function (line, dayIndex, slotMin) {
    var sched = S.state.schedule[line.id] || S.state.schedule[String(line.id)];
    if (!sched || sched[dayIndex] !== "WORK") return false;
    var dow = dayIndex % 7;
    var times = S.getEffectiveShiftTimes
      ? S.getEffectiveShiftTimes(line.shiftId, dow)
      : null;
    if (!times) {
      var sh = S.getShift(line.shiftId);
      if (!sh) return false;
      times = { start: sh.start, end: sh.end };
    }
    var a = S.timeToMin(times.start);
    var c = S.timeToMin(times.end);
    if (c <= a) return slotMin >= a || slotMin < c;
    return slotMin >= a && slotMin < c;
  };

  S.bandForMinute = function (m, bands) {
    bands = bands || S.ensureFunctionCoverage().bands;
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      var s = S.timeToMin(b.start);
      var e = S.timeToMin(b.end);
      if (e <= s) e += 1440;
      var mm = m;
      if (e > 1440 && mm < s) mm += 1440;
      if (mm >= s && mm < e) return b;
    }
    return null;
  };

  S.openFunctionCoverageModal = function () {
    var fc = S.ensureFunctionCoverage();
    function setVal(id, v) { var el = S.$(id); if (el) el.value = v; }
    function setChk(id, v) { var el = S.$(id); if (el) el.checked = !!v; }
    setVal("fc-pool-stso", fc.poolStsoDfo);
    setVal("fc-pool-ltso", fc.poolLtsoDfo);
    setVal("fc-pool-tso", fc.poolTsoDfo);
    setVal("fc-pool-bag", fc.poolBag);
    setVal("fc-phase-thr", fc.phaseThresholdMin);
    setChk("fc-ampm-split", fc.amPmSplit);
    S.renderFunctionBandsTable();
    S.updateFunctionCoveragePreview();
    var modal = S.$("func-coverage-modal");
    if (modal) modal.style.display = "block";
  };

  S.closeFunctionCoverageModal = function () {
    var modal = S.$("func-coverage-modal");
    if (modal) modal.style.display = "none";
  };

  S.renderFunctionBandsTable = function () {
    var tbody = S.$("fc-bands-tbody");
    if (!tbody) return;
    var bands = S.ensureFunctionCoverage().bands;
    tbody.innerHTML = bands.map(function (b, i) {
      function num(key) {
        return '<td><input type="number" min="0" max="99" data-fc-band="' + i +
          '" data-fc-field="' + key + '" value="' + (b[key] != null ? b[key] : 0) +
          '" style="width:3.5rem"></td>';
      }
      return "<tr>" +
        '<td><input type="time" data-fc-band="' + i + '" data-fc-field="start" value="' + (b.start || "00:00") + '" step="900"></td>' +
        '<td><input type="time" data-fc-band="' + i + '" data-fc-field="end" value="' + (b.end || "00:00") + '" step="900"></td>' +
        num("stso") + num("ltso") + num("tso") +
        '<td><button type="button" class="btn btn-red btn-sm" data-fc-remove="' + i + '">✕</button></td></tr>';
    }).join("");
  };

  S.readFunctionBandsFromDom = function () {
    var fc = S.ensureFunctionCoverage();
    var ps = S.$("fc-pool-stso");
    var pl = S.$("fc-pool-ltso");
    var pt = S.$("fc-pool-tso");
    var pb = S.$("fc-pool-bag");
    var thr = S.$("fc-phase-thr");
    var split = S.$("fc-ampm-split");
    if (ps) fc.poolStsoDfo = Math.max(0, Math.floor(+ps.value || 0));
    if (pl) fc.poolLtsoDfo = Math.max(0, Math.floor(+pl.value || 0));
    if (pt) fc.poolTsoDfo = Math.max(0, Math.floor(+pt.value || 0));
    if (pb) fc.poolBag = Math.max(0, Math.floor(+pb.value || 0));
    if (thr) fc.phaseThresholdMin = Math.max(0, Math.floor(+thr.value || 15));
    if (split) fc.amPmSplit = !!split.checked;
    for (var i = 0; i < fc.bands.length; i++) {
      var b = fc.bands[i] || {};
      ["start", "end", "stso", "ltso", "tso"].forEach(function (field) {
        var el = document.querySelector('[data-fc-band="' + i + '"][data-fc-field="' + field + '"]');
        if (!el) return;
        if (field === "start" || field === "end") b[field] = el.value || b[field];
        else b[field] = Math.max(0, Math.floor(+el.value || 0));
      });
      fc.bands[i] = b;
    }
    fc.bands.sort(function (a, b) {
      return S.timeToMin(a.start) - S.timeToMin(b.start);
    });
    return fc;
  };

  S.updateFunctionCoveragePreview = function () {
    var el = S.$("fc-preview");
    if (!el) return;
    var fc = S.ensureFunctionCoverage();
    var anchors = S.computeShiftAnchors();
    var thr = fc.phaseThresholdMin || 15;
    var bandTxt = (fc.bands || []).map(function (b) {
      return (b.start || "?") + "–" + (b.end || "?") + " need " +
        (b.stso || 0) + "-" + (b.ltso || 0) + "-" + (b.tso || 0);
    }).join("  |  ");
    el.textContent =
      "Pools DFO STSO " + (fc.poolStsoDfo || 0) +
      " · LTSO " + (fc.poolLtsoDfo || 0) +
      " · TSO " + (fc.poolTsoDfo || 0) +
      " · BAG " + (fc.poolBag || 0) +
      " · AM anchor " + S.slotLabel(anchors.am) +
      " · PM anchor " + S.slotLabel(anchors.pm) +
      " · phase ±" + thr + "m · " +
      (bandTxt || "no bands");
  };

  function ensureEligible(line) {
    if (!line.functionEligible || typeof line.functionEligible !== "object") {
      line.functionEligible = { dfo: false, bag: false, pax: false };
    }
    return line.functionEligible;
  }

  /**
   * Mark DFO/BAG eligible pools by role with optional 50/50 AM-PM split.
   * STSO may be marked DFO for pool accounting but STSO never *needs* DFO to cover baggage STSO slots.
   */
  S.buildCertifiedPools = function (fc) {
    S.state.lines.forEach(function (l) {
      l.functionEligible = { dfo: false, bag: false, pax: false };
      l.function = "";
    });

    var anchors = S.computeShiftAnchors();
    var thr = fc.phaseThresholdMin || 15;

    function byRole(role) {
      return S.state.lines.filter(function (l) { return S.lineRoleKey(l) === role; });
    }

    function markPool(role, n, key) {
      if (!n || n <= 0) return { am: 0, pm: 0, total: 0 };
      var lines = byRole(role).slice();
      lines.sort(function (a, b) {
        return S.lineStartMin(a) - S.lineStartMin(b) || String(a.id).localeCompare(String(b.id));
      });
      var amSide = lines.filter(function (l) {
        return S.isAmSide(S.lineStartMin(l), anchors, thr);
      });
      var pmSide = lines.filter(function (l) {
        return !S.isAmSide(S.lineStartMin(l), anchors, thr);
      });

      var needAm = fc.amPmSplit ? Math.ceil(n / 2) : n;
      var needPm = fc.amPmSplit ? Math.floor(n / 2) : 0;
      // Adjust if one side is short
      if (amSide.length < needAm) {
        needPm += needAm - amSide.length;
        needAm = amSide.length;
      }
      if (pmSide.length < needPm) {
        needAm = Math.min(amSide.length, needAm + (needPm - pmSide.length));
        needPm = pmSide.length;
      }
      // Cap total at n
      while (needAm + needPm > n) {
        if (needPm >= needAm && needPm > 0) needPm--;
        else if (needAm > 0) needAm--;
        else break;
      }

      function take(arr, count) {
        var taken = 0;
        for (var i = 0; i < arr.length && taken < count; i++) {
          var el = ensureEligible(arr[i]);
          if (el[key]) continue;
          el[key] = true;
          taken++;
        }
        return taken;
      }

      var gotAm = take(amSide, needAm);
      var gotPm = take(pmSide, needPm);
      // Fill remainder from either side if short
      var short = n - gotAm - gotPm;
      if (short > 0) {
        var rest = lines.filter(function (l) { return !ensureEligible(l)[key]; });
        gotPm += take(rest, short); // count into total
      }
      return { am: gotAm, pm: gotPm, total: gotAm + gotPm };
    }

    var stso = markPool("STSO", fc.poolStsoDfo, "dfo");
    var ltso = markPool("LTSO", fc.poolLtsoDfo, "dfo");
    var tso = markPool("TSO", fc.poolTsoDfo, "dfo");
    var bag = markPool("TSO", fc.poolBag, "bag");

    return { stso: stso, ltso: ltso, tso: tso, bag: bag, anchors: anchors };
  };

  /**
   * Daily rotation to meet per-band role minimums every day.
   * STSO: any working STSO counts (no DFO required).
   * LTSO: prefer DFO-eligible LTSO on duty that day.
   * TSO: prefer DFO or BAG eligible on duty that day.
   */
  S.generateFunctionAssignments = function () {
    var fc = S.readFunctionBandsFromDom();
    if (!S.state.lines || !S.state.lines.length) {
      if (S.updateStatus) S.updateStatus("Generate lines first.");
      return;
    }

    var poolStats = S.buildCertifiedPools(fc);
    S.state.functionRotation = {};
    var days = (S.state.weekCount || 1) * 7;
    var dutyCount = {}; // fairness: days already given duty

    function setDuty(lineId, dayIndex, fn) {
      var key = String(lineId);
      if (!S.state.functionRotation[key]) S.state.functionRotation[key] = [];
      while (S.state.functionRotation[key].length <= dayIndex) {
        S.state.functionRotation[key].push(null);
      }
      if (S.state.functionRotation[key][dayIndex]) return false;
      S.state.functionRotation[key][dayIndex] = fn;
      dutyCount[key] = (dutyCount[key] || 0) + 1;
      return true;
    }

    function getDuty(lineId, dayIndex) {
      var row = S.state.functionRotation[String(lineId)];
      return row ? row[dayIndex] || null : null;
    }

    function worksDay(line, d) {
      var sched = S.state.schedule[line.id] || S.state.schedule[String(line.id)] || [];
      return sched[d] === "WORK";
    }

    function bandSlots(band) {
      var start = S.timeToMin(band.start);
      var end = S.timeToMin(band.end);
      if (end <= start) end += 1440;
      var slots = [];
      for (var m = start; m < end; m += 30) slots.push(m % 1440);
      if (!slots.length) slots.push(start % 1440);
      return slots;
    }

    function fairSort(arr) {
      return arr.slice().sort(function (a, b) {
        var ca = dutyCount[String(a.id)] || 0;
        var cb = dutyCount[String(b.id)] || 0;
        if (ca !== cb) return ca - cb;
        // Prefer later starts when filling later bands so open doesn't consume everyone
        var sa = S.lineStartMin(a);
        var sb = S.lineStartMin(b);
        if (sa !== sb) return sa - sb;
        return String(a.id).localeCompare(String(b.id));
      });
    }

    /** Count coverage at a single slot for one day */
    function countsAtSlot(d, slotMin) {
      var c = { STSO: 0, LTSO: 0, TSO: 0 };
      S.state.lines.forEach(function (l) {
        if (!worksDay(l, d)) return;
        if (!S.lineCoversSlot(l, d, slotMin)) return;
        var role = S.lineRoleKey(l);
        var duty = getDuty(l.id, d);
        if (role === "STSO") c.STSO++; // STSO never needs DFO flag
        else if (role === "LTSO" && duty === "DFO") c.LTSO++;
        else if (role === "TSO" && (duty === "DFO" || duty === "BAG")) c.TSO++;
      });
      return c;
    }

    /**
     * For each day and each band, enforce absolute minimums at EVERY 30-min slot
     * in the band. Example: open 1/1/2 all day for that window; day band 1/1/6
     * for its entire window — not "pile everyone into 03:30".
     */
    for (var d = 0; d < days; d++) {
      (fc.bands || []).forEach(function (band) {
        var needS = band.stso || 0;
        var needL = band.ltso || 0;
        var needT = band.tso || 0;
        if (needS + needL + needT <= 0) return;

        var slots = bandSlots(band);
        var bandStart = S.timeToMin(band.start);

        // Multi-pass over slots so later parts of a long band get filled too
        var guard = 0;
        var changed = true;
        while (changed && guard < 200) {
          changed = false;
          guard++;
          for (var si = 0; si < slots.length; si++) {
            var slotMin = slots[si];
            var have = countsAtSlot(d, slotMin);
            var defS = Math.max(0, needS - have.STSO);
            var defL = Math.max(0, needL - have.LTSO);
            var defT = Math.max(0, needT - have.TSO);
            if (defS + defL + defT <= 0) continue;

            // Candidates working this day and covering THIS slot, not yet on duty
            var covering = S.state.lines.filter(function (l) {
              return worksDay(l, d) && S.lineCoversSlot(l, d, slotMin);
            });

            // STSO deficit — any STSO covering the slot (tag DFO if eligible)
            if (defS > 0) {
              var stsoCands = fairSort(covering.filter(function (l) {
                return S.lineRoleKey(l) === "STSO";
              }));
              // Prefer those already counted only need more unique STSOs at this slot
              // STSOs always count; we only need enough physical STSOs covering the slot.
              // If short, cannot invent people — skip assign. Tag eligible for rotation record.
              stsoCands.forEach(function (l) {
                if (ensureEligible(l).dfo && !getDuty(l.id, d)) setDuty(l.id, d, "DFO");
              });
            }

            // LTSO deficit — assign DFO duty to LTSO covering this slot
            if (defL > 0) {
              var ltsoElig = fairSort(covering.filter(function (l) {
                return S.lineRoleKey(l) === "LTSO" && !getDuty(l.id, d) && ensureEligible(l).dfo;
              }));
              var ltsoAny = fairSort(covering.filter(function (l) {
                return S.lineRoleKey(l) === "LTSO" && !getDuty(l.id, d);
              }));
              function takeL(arr) {
                for (var i = 0; i < arr.length && defL > 0; i++) {
                  if (setDuty(arr[i].id, d, "DFO")) {
                    defL--;
                    changed = true;
                  }
                }
              }
              takeL(ltsoElig);
              takeL(ltsoAny);
            }

            // TSO deficit — BAG first, then DFO. Prefer people whose start is near this band
            // so open (0330) doesn't consume all TSOs before 0400 is filled.
            if (defT > 0) {
              function tsoRank(l) {
                var start = S.lineStartMin(l);
                // Prefer starts at or after band start for this band's fill
                var delta = start - bandStart;
                if (delta < -30) return 10000 - delta; // much earlier starts deprioritized
                return Math.abs(delta);
              }
              function sortTso(arr) {
                return arr.slice().sort(function (a, b) {
                  var ca = dutyCount[String(a.id)] || 0;
                  var cb = dutyCount[String(b.id)] || 0;
                  if (ca !== cb) return ca - cb;
                  var ra = tsoRank(a);
                  var rb = tsoRank(b);
                  if (ra !== rb) return ra - rb;
                  return String(a.id).localeCompare(String(b.id));
                });
              }
              var tsoBag = sortTso(covering.filter(function (l) {
                return S.lineRoleKey(l) === "TSO" && !getDuty(l.id, d) && ensureEligible(l).bag;
              }));
              var tsoDfo = sortTso(covering.filter(function (l) {
                return S.lineRoleKey(l) === "TSO" && !getDuty(l.id, d) && ensureEligible(l).dfo;
              }));
              var tsoAny = sortTso(covering.filter(function (l) {
                return S.lineRoleKey(l) === "TSO" && !getDuty(l.id, d);
              }));
              function takeT(arr, fn) {
                for (var i = 0; i < arr.length && defT > 0; i++) {
                  if (setDuty(arr[i].id, d, fn)) {
                    defT--;
                    changed = true;
                  }
                }
              }
              takeT(tsoBag, "BAG");
              takeT(tsoDfo, "DFO");
              takeT(tsoAny, "DFO");
            }
          }
        }
      });
    }

    // Audit shortfalls per day/band (worst slot in band)
    var shortfalls = [];
    for (var d2 = 0; d2 < Math.min(7, days); d2++) {
      (fc.bands || []).forEach(function (band) {
        var needS = band.stso || 0;
        var needL = band.ltso || 0;
        var needT = band.tso || 0;
        if (needS + needL + needT <= 0) return;
        var worst = { STSO: 99, LTSO: 99, TSO: 99 };
        bandSlots(band).forEach(function (slotMin) {
          var c = countsAtSlot(d2, slotMin);
          if (c.STSO < worst.STSO) worst.STSO = c.STSO;
          if (c.LTSO < worst.LTSO) worst.LTSO = c.LTSO;
          if (c.TSO < worst.TSO) worst.TSO = c.TSO;
        });
        var miss = [];
        if (worst.STSO < needS) miss.push("STSO " + worst.STSO + "/" + needS);
        if (worst.LTSO < needL) miss.push("LTSO " + worst.LTSO + "/" + needL);
        if (worst.TSO < needT) miss.push("TSO " + worst.TSO + "/" + needT);
        if (miss.length) {
          shortfalls.push(
            (S.DAYS[d2 % 7] || d2) + " " + band.start + "–" + band.end + ": " + miss.join(", ")
          );
        }
      });
    }

    if (S.renderLines) S.renderLines();
    if (S.renderCoverageBars) S.renderCoverageBars();
    if (S.renderReports) S.renderReports();

    var msg =
      "DFO pools STSO " + poolStats.stso.total +
      " · LTSO " + poolStats.ltso.total +
      " · TSO " + poolStats.tso.total +
      " · BAG " + poolStats.bag.total;
    if (shortfalls.length) {
      msg += " · SHORT " + shortfalls.length + " day/band(s) — check pool size / who works those windows";
      if (S.state.issues) {
        shortfalls.slice(0, 10).forEach(function (s) {
          S.state.issues.push("DFO band: " + s);
        });
        if (S.renderIssues) S.renderIssues();
      }
    } else {
      msg += " · all band minimums met every day across each window";
    }
    var hint = S.$("cert-assign-hint");
    if (hint) hint.textContent = msg;
    if (S.updateStatus) S.updateStatus(msg);
    S.closeFunctionCoverageModal();
  };

  S.clearLineFunctions = function () {
    (S.state.lines || []).forEach(function (l) {
      l.function = "";
      l.functionEligible = { dfo: false, bag: false, pax: false };
    });
    S.state.functionRotation = {};
  };

  S.initFunctionCoverage = function () {
    if (S._funcCoverageBound) return;
    S._funcCoverageBound = true;
    S.ensureFunctionCoverage();

    var openBtn = S.$("btn-open-func-coverage");
    if (openBtn) openBtn.addEventListener("click", S.openFunctionCoverageModal);
    var closeBtn = S.$("func-coverage-close");
    if (closeBtn) closeBtn.addEventListener("click", S.closeFunctionCoverageModal);
    var cancelBtn = S.$("fc-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", S.closeFunctionCoverageModal);
    var saveBtn = S.$("fc-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        S.readFunctionBandsFromDom();
        S.renderFunctionBandsTable();
        S.updateFunctionCoveragePreview();
        if (S.updateStatus) S.updateStatus("Function coverage settings saved.");
      });
    }
    var genBtn = S.$("fc-generate");
    if (genBtn) genBtn.addEventListener("click", S.generateFunctionAssignments);
    var addBtn = S.$("fc-add-band");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        S.readFunctionBandsFromDom();
        S.ensureFunctionCoverage().bands.push({
          start: "12:00", end: "16:00", stso: 0, ltso: 0, tso: 0
        });
        S.renderFunctionBandsTable();
        S.updateFunctionCoveragePreview();
      });
    }
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var rm = t.getAttribute("data-fc-remove");
      if (rm == null) return;
      S.readFunctionBandsFromDom();
      var idx = +rm;
      var bands = S.ensureFunctionCoverage().bands;
      if (idx >= 0 && idx < bands.length) {
        bands.splice(idx, 1);
        S.renderFunctionBandsTable();
        S.updateFunctionCoveragePreview();
      }
    });
    document.addEventListener("change", function (e) {
      var t = e.target;
      if (!t) return;
      if (
        (t.getAttribute && t.getAttribute("data-fc-band") != null) ||
        (t.id && t.id.indexOf("fc-") === 0)
      ) {
        S.readFunctionBandsFromDom();
        S.updateFunctionCoveragePreview();
      }
    });
  };
})(window.Scheduler);
