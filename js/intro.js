/** C64 boot intro — airport code (3 letters) then Y/N. */
(function () {
  "use strict";

  var BLADE = [
    "              /\\",
    "             /##\\",
    "            /####\\",
    "           /######\\",
    "           |##||##|",
    "           |##||##|",
    "            \\#||#/",
    "             #||#",
    "             #||#",
    "             #||#",
    "             #||#",
    "            /#||#\\",
    "           [======]",
    "              ||",
    "             _||_",
    "            [BLADE]",
    "",
    "     {B}id {L}ine {A}ssignment",
    "         {D}uty {E}ngine"
  ].join("\n");

  function $(id) { return document.getElementById(id); }
  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }
  function cursorHtml() { return '<span class="cursor"></span>'; }
  function isMobile() {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia && window.matchMedia("(max-width: 900px)").matches) return true;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  }

  async function typeInto(el, text, speed) {
    el.innerHTML = "";
    var acc = "";
    var i;
    for (i = 0; i < text.length; i++) {
      acc += text.charAt(i);
      el.innerHTML = acc + cursorHtml();
      await sleep(text.charAt(i) === "\n" ? speed * 1.6 : speed);
    }
  }

  async function drawAscii(el, block, rowDelay) {
    var rows = block.split("\n");
    var shown = [];
    var i;
    el.textContent = "";
    for (i = 0; i < rows.length; i++) {
      shown.push(rows[i]);
      el.textContent = shown.join("\n");
      await sleep(rowDelay);
    }
  }

  function applyAirport(code) {
    var c = String(code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    if (c.length !== 3) return "";
    if (window.Scheduler && Scheduler.setAirportCode) Scheduler.setAirportCode(c);
    else {
      try { localStorage.setItem("blade.airportCode", c); } catch (e) {}
    }
    if (window.Scheduler && Scheduler.refreshConsoleChrome) Scheduler.refreshConsoleChrome();
    return c;
  }

  function dismissIntro() {
    var intro = $("blade-intro");
    if (intro) {
      intro.hidden = true;
      intro.setAttribute("hidden", "");
    }
    window.removeEventListener("keydown", onConfirmKey);
    window.removeEventListener("keydown", onAirportKey);
  }

  function shutdownIntro() {
    var greet = $("blade-greet");
    var crt = document.querySelector("#blade-intro .crt");
    if (greet) greet.innerHTML += "\n\nSHUTTING DOWN.";
    if (crt) crt.style.filter = "brightness(0.15)";
    window.removeEventListener("keydown", onConfirmKey);
    window.removeEventListener("keydown", onAirportKey);
  }

  var airportBuf = "";
  var airportDone = false;
  var greetBase = "";

  function renderAirportLine() {
    var greet = $("blade-greet");
    if (!greet) return;
    greet.innerHTML = greetBase + airportBuf + cursorHtml();
  }

  function onAirportKey(e) {
    if (airportDone) return;
    var key = e.key || "";
    if (key === "Backspace") {
      e.preventDefault();
      airportBuf = airportBuf.slice(0, -1);
      renderAirportLine();
      return;
    }
    if (key === "Enter" && airportBuf.length === 3) {
      e.preventDefault();
      finishAirport();
      return;
    }
    if (/^[a-zA-Z]$/.test(key) && airportBuf.length < 3) {
      e.preventDefault();
      airportBuf += key.toUpperCase();
      renderAirportLine();
      if (airportBuf.length === 3) finishAirport();
    }
  }

  function finishAirport() {
    if (airportDone) return;
    var code = applyAirport(airportBuf);
    if (!code) return;
    airportDone = true;
    window.removeEventListener("keydown", onAirportKey);
    var greet = $("blade-greet");
    if (greet) {
      greet.innerHTML =
        greetBase + code +
        "\nAIRPORT LOCKED: " + code +
        "\n\nCONTINUE? (Y/N)" + cursorHtml();
    }
    window.addEventListener("keydown", onConfirmKey);
  }

  function onConfirmKey(e) {
    var k = (e.key || "").toUpperCase();
    if (k === "Y") { e.preventDefault(); dismissIntro(); }
    if (k === "N") { e.preventDefault(); shutdownIntro(); }
  }

  async function runIntro() {
    var term = $("blade-term");
    var art = $("blade-art");
    var greet = $("blade-greet");
    var intro = $("blade-intro");
    if (!term || !art || !greet || !intro) return;

    intro.hidden = false;
    intro.removeAttribute("hidden");

    await typeInto(term, "READY.\nLOAD \"BID-LINE-GEN\",8,1\n", 32);
    await sleep(280);
    await typeInto(
      term,
      "READY.\nLOAD \"BID-LINE-GEN\",8,1\n\nSEARCHING FOR BID-LINE-GEN\nLOADING\n",
      22
    );
    await drawAscii(art, BLADE, 65);

    greetBase = "\nHELLO, OPERATOR.\nBLADE ALPHA BUILD ONLINE.\n\nAIRPORT CODE (3 LETTERS): ";
    await typeInto(greet, greetBase, 36);
    airportBuf = "";
    airportDone = false;
    renderAirportLine();
    window.addEventListener("keydown", onAirportKey);

    if (isMobile()) {
      var last = "";
      try { last = localStorage.getItem("blade.airportCode") || ""; } catch (e) {}
      if (/^[A-Z]{3}$/.test(last)) {
        airportBuf = last;
        renderAirportLine();
        await sleep(900);
        finishAirport();
        await sleep(1400);
        if (!intro.hidden) dismissIntro();
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runIntro);
  } else {
    runIntro();
  }
})();
