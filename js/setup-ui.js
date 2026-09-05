/** Setup tab layout — schedule period, collapsed FTE, inline function coverage */
window.Scheduler = window.Scheduler || {};
(function (S) {
  "use strict";

  function val(id, fallback) {
    var el = document.getElementById(id);
    return el && el.value != null && el.value !== "" ? el.value : fallback;
  }

  function syncHoursFromAirfield() {
    var cfg = S.getAirportConfig && S.getAirportConfig();
    var open = (cfg && cfg.startTime) || "03:30";
    var close = (cfg && cfg.endTime) || "23:00";
    var o = document.getElementById("cfg-open");
    var c = document.getElementById("cfg-close");
    if (o) o.value = open;
    if (c) c.value = close;
    if (S.state) { S.state.open = open; S.state.close = close; }
  }

  function sexRow(maleId, femaleId, maleVal, femaleVal) {
    return (
      '<div class="fte-sex-row">' +
      '<label>Male <input type="number" id="' + maleId + '" min="0" value="' + maleVal + '" style="width:4.5rem"></label>' +
      '<label>Female <input type="number" id="' + femaleId + '" min="0" value="' + femaleVal + '" style="width:4.5rem"></label>' +
      "</div>"
    );
  }

  S.rebuildSetupTab = function () {
    var tab = document.getElementById("tab-setup");
    if (!tab || tab.getAttribute("data-setup-ui") === "v2") return;
    tab.setAttribute("data-setup-ui", "v2");

    var start = val("cfg-start", "");
    var weeks = val("cfg-weeks", "1");
    var ftM = val("cfg-ft-m", "10"), ftF = val("cfg-ft-f", "10");
    var ptM = val("cfg-pt-m", "4"), ptF = val("cfg-pt-f", "4");
    var ltM = val("cfg-ltso-m", "1"), ltF = val("cfg-ltso-f", "1");
    var stM = val("cfg-stso-m", "2"), stF = val("cfg-stso-f", "2");
    var open = val("cfg-open", "03:30"), close = val("cfg-close", "23:00");

    var shiftsBody = document.getElementById("shifts-tbody");
    var shiftsCard = shiftsBody;
    while (shiftsCard && !(shiftsCard.classList && shiftsCard.classList.contains("card"))) {
      shiftsCard = shiftsCard.parentElement;
    }
    var issues = document.getElementById("issues");
    var firstCard = tab.querySelector(".card");

    var html =
      '<div class="card" id="card-what">' +
        (firstCard ? firstCard.innerHTML : '<div class="section-title">What this is</div>') +
      "</div>" +
      '<input type="hidden" id="cfg-open" value="' + open + '">' +
      '<input type="hidden" id="cfg-close" value="' + close + '">' +
      '<div class="card" id="card-period">' +
        '<div class="section-title">Schedule period</div>' +
        '<div class="period-row">' +
          '<label>Schedule start <input type="date" id="cfg-start" value="' + start + '"></label>' +
          '<label>Weeks <input type="number" id="cfg-weeks" min="1" max="8" value="' + weeks + '" style="width:4.5rem"></label>' +
        "</div>" +
      "</div>" +
      '<details class="card setup-fold" id="card-fte">' +
        '<summary class="section-title">FTE</summary>' +
        '<div class="fte-block">' +
          '<div class="fte-role">FT TSO</div>' + sexRow("cfg-ft-m", "cfg-ft-f", ftM, ftF) +
          '<div class="fte-role">PT TSO</div>' + sexRow("cfg-pt-m", "cfg-pt-f", ptM, ptF) +
          '<div class="fte-role">LTSO</div>' + sexRow("cfg-ltso-m", "cfg-ltso-f", ltM, ltF) +
          '<div class="fte-role">STSO</div>' + sexRow("cfg-stso-m", "cfg-stso-f", stM, stF) +
          '<div class="toolbar" style="margin-top:0.75rem">' +
            '<button type="button" class="btn btn-amber" id="btn-save-staffing">Save staffing</button>' +
            '<span class="muted">FTE + function coverage only. No lines.</span>' +
          "</div>" +
        "</div>" +
      "</details>" +
      '<details class="card setup-fold" id="card-func">' +
        '<summary class="section-title">Function coverage</summary>' +
        '<div class="fc-inline">' +
          '<div class="fc-pool-row">' +
            '<label>DFO STSO <input type="number" id="fc-pool-stso" min="0" value="0" style="width:4rem"></label>' +
            '<label>DFO LTSO <input type="number" id="fc-pool-ltso" min="0" value="0" style="width:4rem"></label>' +
            '<label>DFO TSO <input type="number" id="fc-pool-tso" min="0" value="0" style="width:4rem"></label>' +
            '<label>Phase threshold (min) <input type="number" id="fc-phase-thr" min="0" max="120" value="15" style="width:4rem"></label>' +
            '<label class="follow-me-label"><input type="checkbox" id="fc-ampm-split" checked> 50/50 AM–PM split</label>' +
            '<button type="button" class="btn" id="fc-add-band">+ Add band</button>' +
          "</div>" +
          '<div class="lines-scroll" style="max-height:40vh;margin-top:0.75rem">' +
            '<table class="data-table"><thead><tr>' +
              '<th>Start</th><th>End</th><th>Min STSO</th><th>Min LTSO</th><th>Min TSO</th><th></th>' +
            "</tr></thead><tbody id="fc-bands-tbody"></tbody></table>" +
          "</div>" +
          '<p class="muted" id="fc-preview" style="margin-top:0.75rem"></p>' +
        "</div>" +
      "</details>";

    var keep = [];
    if (shiftsCard) keep.push(shiftsCard);
    if (issues) keep.push(issues);
    tab.innerHTML = html;
    keep.forEach(function (node) { tab.appendChild(node); });

    var modalBag = document.getElementById("fc-pool-bag");
    if (modalBag) { modalBag.id = "fc-pool-bag-unused"; }
    ["fc-pool-stso", "fc-pool-ltso", "fc-pool-tso", "fc-phase-thr", "fc-ampm-split", "fc-add-band", "fc-bands-tbody", "fc-preview"].forEach(function (id) {
      var nodes = document.querySelectorAll("#" + id);
      for (var i = 1; i < nodes.length; i++) nodes[i].removeAttribute("id");
    });

    var save = document.getElementById("btn-save-staffing");
    if (save) save.addEventListener("click", function () {
      if (S.exportStaffingConfig) S.exportStaffingConfig();
    });

    syncHoursFromAirfield();
    if (S.ensureFunctionCoverage) S.ensureFunctionCoverage();
    if (S.fillFunctionCoverageForm) S.fillFunctionCoverageForm();
    if (S.renderFunctionBandsTable) S.renderFunctionBandsTable();
    if (S.updateFunctionCoveragePreview) S.updateFunctionCoveragePreview();
  };

  S.snapshotFte = function () {
    return {
      ftM: +(val("cfg-ft-m", S.state && S.state.ftM) || 0),
      ftF: +(val("cfg-ft-f", S.state && S.state.ftF) || 0),
      ptM: +(val("cfg-pt-m", S.state && S.state.ptM) || 0),
      ptF: +(val("cfg-pt-f", S.state && S.state.ptF) || 0),
      ltsoM: +(val("cfg-ltso-m", S.state && S.state.ltsoM) || 0),
      ltsoF: +(val("cfg-ltso-f", S.state && S.state.ltsoF) || 0),
      stsoM: +(val("cfg-stso-m", S.state && S.state.stsoM) || 0),
      stsoF: +(val("cfg-stso-f", S.state && S.state.stsoF) || 0)
    };
  };

  S.applyFte = function (fte) {
    if (!fte) return;
    function put(id, v) {
      var el = document.getElementById(id);
      if (el && v != null) el.value = v;
    }
    put("cfg-ft-m", fte.ftM); put("cfg-ft-f", fte.ftF);
    put("cfg-pt-m", fte.ptM); put("cfg-pt-f", fte.ptF);
    put("cfg-ltso-m", fte.ltsoM); put("cfg-ltso-f", fte.ltsoF);
    put("cfg-stso-m", fte.stsoM); put("cfg-stso-f", fte.stsoF);
    if (!S.state) return;
    if (fte.ftM != null) S.state.ftM = +fte.ftM || 0;
    if (fte.ftF != null) S.state.ftF = +fte.ftF || 0;
    if (fte.ptM != null) S.state.ptM = +fte.ptM || 0;
    if (fte.ptF != null) S.state.ptF = +fte.ptF || 0;
    if (fte.ltsoM != null) S.state.ltsoM = +fte.ltsoM || 0;
    if (fte.ltsoF != null) S.state.ltsoF = +fte.ltsoF || 0;
    if (fte.stsoM != null) S.state.stsoM = +fte.stsoM || 0;
    if (fte.stsoF != null) S.state.stsoF = +fte.stsoF || 0;
  };

  var style = document.createElement("style");
  style.textContent =
    ".period-row{display:flex;flex-wrap:wrap;gap:1rem;align-items:center}" +
    ".setup-fold>summary{cursor:pointer;list-style:none;display:flex;align-items:center}" +
    ".setup-fold>summary::-webkit-details-marker{display:none}" +
    ".setup-fold>summary:before{content:'\u25b8';margin-right:0.5rem;color:var(--amber,#f0a500)}" +
    ".setup-fold[open]>summary:before{content:'\u25be'}" +
    ".fte-role{text-align:center;font-weight:700;margin:0.85rem 0 0.35rem;letter-spacing:0.04em}" +
    ".fte-sex-row{display:flex;justify-content:center;align-items:center;gap:2rem;flex-wrap:wrap}" +
    ".fte-sex-row label{display:flex;align-items:center;gap:0.45rem}" +
    ".fc-pool-row{display:flex;flex-wrap:wrap;gap:0.65rem 1rem;align-items:center}";
  document.head.appendChild(style);

  document.addEventListener("DOMContentLoaded", function () {
    S.rebuildSetupTab();
    syncHoursFromAirfield();
  });
  window.addEventListener("blade-intro-done", function () {
    S.rebuildSetupTab();
    syncHoursFromAirfield();
  });
})(window.Scheduler);
