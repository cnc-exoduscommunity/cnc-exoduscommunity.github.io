// Theme toggle: switches between the dark (default) and light theme and remembers the choice.
(function () {
  var root = document.documentElement;
  var button = document.querySelector(".theme-toggle");

  function label() {
    if (!button) return;
    var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    button.setAttribute("aria-label", "Switch to " + next + " theme");
  }

  if (button) {
    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      label();
    });
  }
  label();
})();

// Collapsible sections: following a link to something inside a closed section opens it.
(function () {
  function openTarget() {
    if (!location.hash) return;
    var target;
    try { target = document.querySelector(decodeURIComponent(location.hash)); } catch (e) { return; }
    if (!target) return;
    for (var el = target; el; el = el.parentElement) {
      if (el.tagName === "DETAILS") el.open = true;
    }
    target.scrollIntoView();
  }
  window.addEventListener("hashchange", openTarget);
  openTarget();
  // Also open on click, for links to the section the URL already points at.
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (link && link.getAttribute("href") === location.hash) openTarget();
  });

  var expand = document.querySelector("[data-expand-all]");
  var collapse = document.querySelector("[data-collapse-all]");
  function setAll(open) {
    document.querySelectorAll("details.panel").forEach(function (d) { d.open = open; });
  }
  if (expand) expand.addEventListener("click", function () { setAll(true); });
  if (collapse) collapse.addEventListener("click", function () { setAll(false); });
})();

// Map previews: clicking a map name that has an image opens it in a dialog,
// with previous/next buttons (and the left/right arrow keys) to step through
// every map that has an image. Without JavaScript the link just opens the image.
(function () {
  var dialog = document.querySelector(".map-dialog");
  var links = Array.prototype.slice.call(document.querySelectorAll(".map-link"));
  if (!dialog || !links.length || typeof dialog.showModal !== "function") return;

  var name = dialog.querySelector(".map-dialog-name");
  var comment = dialog.querySelector(".map-dialog-comment");
  var image = dialog.querySelector(".map-dialog-image");
  var credit = dialog.querySelector(".map-dialog-credit");
  var creditName = dialog.querySelector(".map-dialog-credit-name");
  var counter = dialog.querySelector(".map-dialog-counter");
  var navButtons = dialog.querySelectorAll("[data-map-step]");
  var current = 0;
  var zoom = makeZoom(dialog.querySelector(".map-dialog-viewport"), image, dialog.querySelector(".map-dialog-zoom-level"));
  dialog.querySelectorAll("[data-zoom]").forEach(function (b) {
    b.addEventListener("click", function () { zoom[b.getAttribute("data-zoom")](); });
  });

  navButtons.forEach(function (b) { b.hidden = links.length < 2; });

  // "Now playing" badge in the preview's top-right corner, when the map shown
  // is the one the live status says is being played.
  var nowBadge = dialog.querySelector(".map-dialog-now");
  function updateNowPlaying() {
    var row = links[current] && links[current].closest("tr");
    var playing = !!(row && row.classList.contains("is-current"));
    nowBadge.hidden = !playing;
    dialog.classList.toggle("is-now-playing", playing);
  }
  document.addEventListener("currentmapchange", updateNowPlaying);

  // Keep the box the same size for every map, so nothing jumps while stepping
  // through them:
  //  - the image area is shaped to fit the largest image (widest and tallest),
  //    and smaller or differently shaped images are centred inside it;
  //  - the title keeps the height of the longest name + comment.
  var viewport = dialog.querySelector(".map-dialog-viewport");
  var titleEl = dialog.querySelector(".map-dialog-title");
  var largest = null;
  function measureTitles() {
    var keepName = name.textContent, keepComment = comment.textContent, tallest = 0;
    titleEl.style.minHeight = "";
    links.forEach(function (l) {
      name.textContent = l.getAttribute("data-map-name");
      comment.textContent = l.getAttribute("data-map-description") || "";
      tallest = Math.max(tallest, titleEl.offsetHeight);
    });
    name.textContent = keepName;
    comment.textContent = keepComment;
    titleEl.style.minHeight = tallest + "px";
  }
  function sizeToLargest() {
    measureTitles();
    if (largest) return;
    largest = { w: 0, h: 0 };
    var pending = links.length;
    links.forEach(function (l) {
      var probe = new Image();
      probe.onload = probe.onerror = function () {
        largest.w = Math.max(largest.w, probe.naturalWidth || 0);
        largest.h = Math.max(largest.h, probe.naturalHeight || 0);
        if (--pending === 0 && largest.w && largest.h) {
          viewport.style.aspectRatio = largest.w + " / " + largest.h;
          zoom.refresh();
        }
      };
      probe.src = l.getAttribute("href");
    });
  }
  window.addEventListener("resize", function () { if (dialog.open) { measureTitles(); zoom.refresh(); } });

  function show(index) {
    current = (index + links.length) % links.length;
    var link = links[current];
    var mapName = link.getAttribute("data-map-name");
    var mapComment = link.getAttribute("data-map-description") || "";
    name.textContent = mapName;
    comment.textContent = mapComment;
    image.src = link.getAttribute("href");
    image.alt = "Overhead map of " + mapName;
    var url = link.getAttribute("data-credit-url");
    // visibility (not hidden) so the line keeps its space and the box never changes height.
    credit.hidden = false;
    credit.style.visibility = url ? "visible" : "hidden";
    if (url) {
      creditName.textContent = link.getAttribute("data-credit-name");
      creditName.href = url;
    }
    counter.textContent = (current + 1) + " / " + links.length;
    updateNowPlaying();
    // The zoom level and position carry over from map to map (Reset or 0 to undo).
    if (!dialog.open) {
      dialog.showModal();
      sizeToLargest();
    }
    zoom.refresh();
  }

  links.forEach(function (link, i) {
    link.addEventListener("click", function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return; // keep "open in new tab"
      e.preventDefault();
      show(i);
    });
    // Clicking anywhere on the map's row opens the preview too.
    var row = link.closest("tr");
    if (row) row.addEventListener("click", function (e) {
      if (e.target.closest("a, button")) return;             // the link handles its own clicks
      if (window.getSelection && String(window.getSelection())) return; // don't fight text selection
      show(i);
    });
  });

  dialog.querySelector(".map-dialog-close").addEventListener("click", function () { dialog.close(); });
  navButtons.forEach(function (b) {
    b.addEventListener("click", function () { show(current + Number(b.getAttribute("data-map-step"))); });
  });
  // Clicking the dimmed area around the map closes it.
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog || e.target.classList.contains("map-dialog-stage")) dialog.close();
  });
  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); show(current + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); show(current - 1); }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoom.in(); }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); zoom.out(); }
    if (e.key === "0") { e.preventDefault(); zoom.reset(); }
  });
  // Preload the neighbours so stepping through feels instant.
  image.addEventListener("load", function () {
    [current - 1, current + 1].forEach(function (i) {
      var l = links[(i + links.length) % links.length];
      new Image().src = l.getAttribute("href");
    });
  });
})();

// Zoom and pan for the map preview: mouse wheel or pinch to zoom (towards the
// cursor / fingers), drag to move, double-click / double-tap to zoom in or out.
function makeZoom(viewport, img, label) {
  var MIN = 1, MAX = 4; // the map images are 512px, so more than 4x is just blurry
  var scale = 1, tx = 0, ty = 0;
  var pointers = {};
  var start = null;

  function size() { return { w: viewport.clientWidth, h: viewport.clientHeight }; }
  function clamp() {
    var s = size();
    tx = Math.min(0, Math.max(s.w - s.w * scale, tx));
    ty = Math.min(0, Math.max(s.h - s.h * scale, ty));
  }
  function apply() {
    clamp();
    img.style.transform = "translate(" + tx + "px, " + ty + "px) scale(" + scale + ")";
    viewport.classList.toggle("is-zoomed", scale > 1);
    if (label) label.textContent = Math.round(scale * 100) + "%";
  }
  // Zoom so the point (x, y) inside the viewport stays under the cursor.
  function zoomAt(next, x, y) {
    next = Math.min(MAX, Math.max(MIN, next));
    var px = (x - tx) / scale, py = (y - ty) / scale;
    scale = next;
    tx = x - px * scale;
    ty = y - py * scale;
    apply();
  }
  function center() { var s = size(); return { x: s.w / 2, y: s.h / 2 }; }
  function local(e) { var r = viewport.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function list() { return Object.keys(pointers).map(function (k) { return pointers[k]; }); }

  viewport.addEventListener("wheel", function (e) {
    e.preventDefault();
    var p = local(e);
    zoomAt(scale * Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });

  viewport.addEventListener("pointerdown", function (e) {
    viewport.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = local(e);
    var ps = list();
    if (ps.length === 1) start = { mode: "pan", x: ps[0].x, y: ps[0].y, tx: tx, ty: ty };
    if (ps.length === 2) {
      var mid = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      start = { mode: "pinch", dist: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), scale: scale, mid: mid,
                px: (mid.x - tx) / scale, py: (mid.y - ty) / scale };
    }
  });
  viewport.addEventListener("pointermove", function (e) {
    if (!(e.pointerId in pointers) || !start) return;
    pointers[e.pointerId] = local(e);
    var ps = list();
    if (start.mode === "pan" && ps.length === 1) {
      tx = start.tx + (ps[0].x - start.x);
      ty = start.ty + (ps[0].y - start.y);
      apply();
    } else if (start.mode === "pinch" && ps.length === 2) {
      var dist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      var mid = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
      scale = Math.min(MAX, Math.max(MIN, start.scale * dist / start.dist));
      tx = mid.x - start.px * scale;
      ty = mid.y - start.py * scale;
      apply();
    }
  });
  function release(e) {
    delete pointers[e.pointerId];
    var ps = list();
    start = ps.length === 1 ? { mode: "pan", x: ps[0].x, y: ps[0].y, tx: tx, ty: ty } : null;
  }
  viewport.addEventListener("pointerup", release);
  viewport.addEventListener("pointercancel", release);

  viewport.addEventListener("dblclick", function (e) {
    var p = local(e);
    if (scale > 1) { scale = 1; tx = 0; ty = 0; apply(); } else { zoomAt(2.5, p.x, p.y); }
  });
  window.addEventListener("resize", apply);

  return {
    in: function () { var c = center(); zoomAt(scale * 1.5, c.x, c.y); },
    out: function () { var c = center(); zoomAt(scale / 1.5, c.x, c.y); },
    reset: function () { scale = 1; tx = 0; ty = 0; apply(); },
    refresh: apply
  };
}

// Footer revision line: show the commit time in the visitor's own time zone
// (the original, with the commit's time zone, stays in the hover text).
(function () {
  var el = document.querySelector(".site-revision-time[data-epoch]");
  if (!el) return;
  var d = new Date(Number(el.getAttribute("data-epoch")) * 1000);
  if (isNaN(d)) return;
  function pad(n) { return String(n).padStart(2, "0"); }
  var off = -d.getTimezoneOffset();
  var zone = (off >= 0 ? "+" : "-") + pad(Math.floor(Math.abs(off) / 60)) + pad(Math.abs(off) % 60);
  el.textContent = pad(d.getDate()) + "-" + pad(d.getMonth() + 1) + "-" + d.getFullYear() + " | " +
    pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + " " + zone;
})();

// Header that follows the page: the header scrolls away normally, and once the
// element marked data-pin-header-after (the Index box) reaches the top of the
// screen, a compact copy of it slides in and stays there. Scrolling back up
// above that point hides it again until the page top.
(function () {
  var header = document.querySelector(".site-header");
  var slot = document.querySelector(".site-header-slot");
  var marker = document.querySelector("[data-pin-header-after]");
  if (!header || !slot || !marker) return;

  var state = "";
  function measure() {
    if (state === "") slot.style.height = header.offsetHeight + "px";
  }
  function update() {
    var y = window.scrollY;
    var markerTop = marker.getBoundingClientRect().top + y;
    var next = y >= markerTop - 8 ? "pinned" : (y > slot.offsetHeight ? "hidden" : "");
    if (next === state) return;
    state = next;
    header.classList.toggle("is-floating", state !== "");
    header.classList.toggle("is-pinned", state === "pinned");
    header.classList.toggle("is-hidden", state === "hidden");
    if (state === "") measure();
  }

  var queued = false;
  window.addEventListener("scroll", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; update(); });
  }, { passive: true });
  window.addEventListener("resize", function () { measure(); update(); });
  window.addEventListener("load", measure);
  measure();
  update();
})();

// Live server status: reads CnCNet's public Renegade server list (the same
// data cncnet.org/renegade shows) straight from the visitor's browser, finds
// our server by its address, and shows the current map, players and time
// left. Refreshes itself every minute while the page is visible (CnCNet's
// own list only updates every so often, so a manual refresh button wouldn't help). If CnCNet can't be
// reached, it says so; nothing else on the page depends on it.
(function () {
  var box = document.querySelector(".live-status");
  if (!box || !window.fetch) return;
  box.hidden = false;

  var url = box.getAttribute("data-status-url");
  var address = box.getAttribute("data-address");
  var state = box.querySelector(".live-state");
  var mapEl = box.querySelector(".live-map");
  var playersEl = box.querySelector(".live-players");
  var timeEl = box.querySelector(".live-time");
  var list = box.querySelector(".live-player-list");
  var tbody = list.querySelector("tbody");
  var updated = box.querySelector(".live-updated");
  var busy = false;

  function setState(kind, text) {
    box.setAttribute("data-state", kind);
    state.textContent = text;
  }

  // "0.43.30" -> "0:43:30"
  function formatTime(t) {
    if (!t) return "-";
    return String(t).replace(/\./g, ":");
  }

  function markCurrentMap(name) {
    document.querySelectorAll("tr.is-current").forEach(function (tr) { tr.classList.remove("is-current"); });
    document.querySelectorAll("tr .now-playing").forEach(function (b) { b.remove(); });
    if (!name) return;
    document.querySelectorAll("tr[data-map]").forEach(function (tr) {
      if (tr.getAttribute("data-map").toLowerCase() !== name.toLowerCase()) return;
      tr.classList.add("is-current");
      var badge = document.createElement("span");
      badge.className = "now-playing";
      badge.innerHTML = '<span class="now-playing-dot" aria-hidden="true"></span>Now playing';
      (tr.querySelector(".map-cell") || tr.cells[0]).appendChild(badge);
    });
    // Lets an open map preview update its own "Now playing" badge.
    document.dispatchEvent(new CustomEvent("currentmapchange"));
  }

  function showMap(name) {
    mapEl.textContent = "";
    if (!name) { mapEl.textContent = "-"; return; }
    var preview = Array.prototype.find.call(document.querySelectorAll(".map-link"), function (a) {
      return a.getAttribute("data-map-name").toLowerCase() === name.toLowerCase();
    });
    var row = document.querySelector('tr[data-map]') && Array.prototype.find.call(document.querySelectorAll("tr[data-map]"), function (tr) {
      return tr.getAttribute("data-map").toLowerCase() === name.toLowerCase();
    });
    var label = document.createElement(preview ? "a" : "span");
    label.textContent = name;
    if (preview) {
      label.href = preview.getAttribute("href");
      label.title = "Open the map preview";
      label.addEventListener("click", function (e) { e.preventDefault(); preview.click(); });
    }
    mapEl.appendChild(label);
    if (row) {
      var note = document.createElement("span");
      note.className = "live-map-note";
      note.textContent = row.cells[1].textContent.trim();
      mapEl.appendChild(note);
    }
  }

  function showPlayers(players) {
    tbody.textContent = "";
    players = (players || []).slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    players.forEach(function (p) {
      var tr = document.createElement("tr");
      [p.name, p.team, p.score, p.ping].forEach(function (v, i) {
        var td = document.createElement("td");
        var empty = v === undefined || v === null || v === "";
        if (i === 1 && !empty) {
          // Team as a coloured badge: GDI gold, Nod red, anything else neutral.
          var team = String(v);
          var badge = document.createElement("span");
          badge.className = "team-badge team-" + (/gdi/i.test(team) ? "gdi" : /nod/i.test(team) ? "nod" : "other");
          badge.textContent = /^nod$/i.test(team) ? "Nod" : team;
          td.appendChild(badge);
        } else {
          td.textContent = empty ? "-" : (i === 3 ? v + " ms" : v);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    list.hidden = players.length === 0;
  }

  function refresh() {
    if (busy) return;
    busy = true;
    fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        // The list is plain JSON; strip a JSONP wrapper just in case.
        var data = JSON.parse(text.replace(/^[^\[{]*\(/, "").replace(/\)\s*;?\s*$/, ""));
        var servers = Array.isArray(data) ? data : Object.values(data);
        var server = servers.find(function (s) { return s.ip + ":" + s.hostport === address; });
        if (!server) {
          setState("offline", "Offline (not in the server list right now)");
          showMap(null); playersEl.textContent = "-"; timeEl.textContent = "-";
          showPlayers([]); markCurrentMap(null);
        } else {
          setState("online", "Online");
          showMap(server.mapname);
          playersEl.textContent = (server.numplayers || 0) + " / " + (server.maxplayers || "?");
          timeEl.textContent = formatTime(server.timeleft || server["Time Remaining"]);
          showPlayers(server.players);
          markCurrentMap(server.mapname);
        }
        var now = new Date();
        // Visitor's own time, with their UTC offset: "updated 11:32 (UTC+1)".
        var off = -now.getTimezoneOffset();
        var zone = "UTC" + (off === 0 ? "" : (off > 0 ? "+" : "-") + Math.floor(Math.abs(off) / 60) +
          (Math.abs(off) % 60 ? ":" + String(Math.abs(off) % 60).padStart(2, "0") : ""));
        updated.textContent = " · last checked " + String(now.getHours()).padStart(2, "0") + ":" +
          String(now.getMinutes()).padStart(2, "0") + " (" + zone + ")";
      })
      .catch(function () {
        setState("unknown", "Couldn't reach the server list - trying again in a minute");
      })
      .then(function () { busy = false; });
  }

  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
})();
