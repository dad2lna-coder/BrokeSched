/** C64 boot intro — plays on every open. Mobile pauses then auto-continues. */
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

  function $(id) {
    return document.getElementById(id);
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function cursorHtml() {
    return '<span class="cursor"></span>';
  }

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

  function dismissIntro() {
    var intro = $("blade-intro");
    if (intro) {
      intro.hidden = true;
      intro.setAttribute("hidden", "");
    }
    window.removeEventListener("keydown", onKey);
  }

  function shutdownIntro() {
    var greet = $("blade-greet");
    var crt = document.querySelector("#blade-intro .crt");
    if (greet) greet.innerHTML += "\n\nSHUTTING DOWN.";
    if (crt) crt.style.filter = "brightness(0.15)";
    window.removeEventListener("keydown", onKey);
  }

  function onKey(e) {
    var k = (e.key || "").toUpperCase();
    if (k === "Y") {
      e.preventDefault();
      dismissIntro();
    }
    if (k === "N") {
      e.preventDefault();
      shutdownIntro();
    }
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
    await typeInto(
      greet,
      "\nHELLO, OPERATOR.\nBLADE ALPHA BUILD ONLINE.\n\nCONTINUE? (Y/N)",
      40
    );

    window.addEventListener("keydown", onKey);

    if (isMobile()) {
      await sleep(2200);
      if (!intro.hidden) dismissIntro();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runIntro);
  } else {
    runIntro();
  }
})();
