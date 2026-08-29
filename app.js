/* Bagnolify Consulting — ledger interactions */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    new URLSearchParams(window.location.search).get("static") === "1";

  /* ---------- year ---------- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- topbar: shrink + hide on scroll down ---------- */
  var topbar = document.getElementById("topbar");
  var progressBar = document.getElementById("progressBar");
  var lastY = window.scrollY;
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    if (topbar) {
      topbar.classList.toggle("scrolled", y > 24);
      if (!reduceMotion) {
        if (y > lastY && y > 320 && !topbar.contains(document.activeElement)) {
          topbar.classList.add("hidden-bar");
        } else if (y < lastY - 2 || y <= 320) {
          topbar.classList.remove("hidden-bar");
        }
      }
    }
    if (progressBar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
    }
    lastY = y;
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------- scroll reveal + stamps ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("in"); });
    document.querySelectorAll(".stamp").forEach(function (s) { s.classList.add("stamped"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        var stamp = entry.target.querySelector(".stamp");
        if (stamp) {
          window.setTimeout(function () { stamp.classList.add("stamped"); }, reduceMotion ? 0 : 260);
        }
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- count-up figures ---------- */
  function renderCount(el, value) {
    var pad = parseInt(el.getAttribute("data-pad") || "0", 10);
    var text = String(value);
    while (text.length < pad) text = "0" + text;
    el.textContent = text;
  }
  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (reduceMotion) { renderCount(el, target); return; }
    var start = null;
    var dur = 950;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      renderCount(el, Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var counts = document.querySelectorAll(".count");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    counts.forEach(function (el) { renderCount(el, parseInt(el.getAttribute("data-count"), 10) || 0); });
  } else {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animateCount(entry.target);
        cio.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    counts.forEach(function (el) { cio.observe(el); });
  }

  /* ---------- ledger rows: wrap panel content, expand/collapse ---------- */
  var rows = document.querySelectorAll(".row");
  rows.forEach(function (row) {
    var inner = row.querySelector(".row-panel-inner");
    if (inner && !inner.querySelector(".row-panel-grid")) {
      var grid = document.createElement("div");
      grid.className = "row-panel-grid";
      while (inner.firstChild) grid.appendChild(inner.firstChild);
      inner.appendChild(grid);
    }

    var head = row.querySelector(".row-head");
    var preview = row.querySelector(".row-preview");
    var url = row.getAttribute("data-preview");

    if (url && preview) {
      row.classList.add("has-frame");
    } else if (preview) {
      preview.remove(); /* slot reserved — add data-preview on the row to activate */
    }

    if (!head) return;
    head.addEventListener("click", function () {
      var open = row.classList.toggle("open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && url && preview && !preview.hasChildNodes()) {
        buildFrame(preview, url, row.getAttribute("data-preview-label") || url.replace(/^https?:\/\//, ""));
      }
    });
  });

  /* ---------- deep links: ?open=BGF-001 (&live=1 to auto-load preview), or #BGF-001 ---------- */
  var params = new URLSearchParams(window.location.search);
  var openCode = params.get("open") || (window.location.hash || "").replace(/^#/, "");
  if (/^bgf-\d+$/i.test(openCode)) {
    rows.forEach(function (row) {
      var no = row.querySelector(".row-no");
      if (!no || no.textContent.trim().toLowerCase() !== openCode.trim().toLowerCase()) return;
      var head = row.querySelector(".row-head");
      if (head) head.click();
      if (params.get("live") === "1") {
        var b = row.querySelector(".frame-load");
        if (b) b.click();
      }
      var jump = function () {
        var top = row.getBoundingClientRect().top + window.scrollY - 84;
        window.scrollTo({ top: top, behavior: "auto" });
      };
      window.setTimeout(jump, 350);
      window.addEventListener("load", function () { window.setTimeout(jump, 150); });
    });
  }

  /* ---------- deliverable frame (click-to-load iframe) ---------- */
  function buildFrame(mount, url, label) {
    var frame = document.createElement("div");
    frame.className = "frame";

    var bar = document.createElement("div");
    bar.className = "frame-bar";
    var urlEl = document.createElement("span");
    urlEl.className = "frame-url";
    urlEl.textContent = label;
    var tag = document.createElement("span");
    tag.className = "frame-tag";
    tag.textContent = "Live";
    bar.appendChild(urlEl);
    bar.appendChild(tag);

    var body = document.createElement("div");
    body.className = "frame-body";

    var load = document.createElement("button");
    load.className = "frame-load";
    load.type = "button";
    load.setAttribute("aria-label", "Load live preview of " + label);
    load.innerHTML =
      '<span class="frame-load-hint">Deliverable on file</span>' +
      '<span class="frame-load-btn">Load live preview<span aria-hidden="true">→</span></span>';

    load.addEventListener("click", function () {
      var shimmer = document.createElement("div");
      shimmer.className = "shimmer";
      body.appendChild(shimmer);
      load.remove();

      var iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.loading = "lazy";
      iframe.title = "Live preview: " + label;
      iframe.addEventListener("load", function () { shimmer.remove(); });
      body.appendChild(iframe);
    });

    body.appendChild(load);
    frame.appendChild(bar);
    frame.appendChild(body);
    mount.appendChild(frame);

    var open = document.createElement("a");
    open.className = "frame-open";
    open.href = url;
    open.target = "_blank";
    open.rel = "noopener";
    open.textContent = "Open in a new tab ↗";
    mount.appendChild(open);
  }

  /* ---------- ticker: duplicate track for seamless loop ---------- */
  document.querySelectorAll("[data-ticker]").forEach(function (ticker) {
    var track = ticker.querySelector(".ticker-track");
    if (!track) return;
    if (reduceMotion) { ticker.classList.add("static"); return; }
    track.innerHTML += track.innerHTML;
    track.setAttribute("aria-hidden", "false");
  });

  /* ---------- magnetic primary CTA (fine pointers only) ---------- */
  var cta = document.getElementById("magneticCta");
  if (cta && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    var strength = 6;
    cta.addEventListener("mousemove", function (e) {
      var r = cta.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      cta.style.transform = "translate(" + (dx * strength).toFixed(1) + "px," + (dy * strength).toFixed(1) + "px)";
    });
    cta.addEventListener("mouseleave", function () {
      cta.style.transition = "transform 0.35s cubic-bezier(0.22, 0.9, 0.3, 1)";
      cta.style.transform = "translate(0,0)";
      window.setTimeout(function () { cta.style.transition = ""; }, 380);
    });
  }
})();
