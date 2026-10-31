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
  var noteEl = dialog.querySelector(".map-dialog-note");
  // "co-op" must not break across lines: use a non-breaking hyphen between letters.
  function keepWords(t) { return (t || "").replace(/(\w)-(\w)/g, "$1\u2011$2"); }
  var image = dialog.querySelector(".map-dialog-image");
  var credit = dialog.querySelector(".map-dialog-credit");
  var creditName = dialog.querySelector(".map-dialog-credit-name");
  var counter = dialog.querySelector(".map-dialog-counter");
  // "No map data" message for maps without an image; objectives below the map (narrow screens).
  var frame = dialog.querySelector(".map-dialog-frame");
  var emptyMsg = dialog.querySelector(".map-dialog-empty");
  var below = dialog.querySelector(".map-dialog-below");
  var belowList = below && below.querySelector("ol");
  var zoomRow = dialog.querySelector(".map-dialog-zoom");
  // Wide screens: the objectives go in a card beside the map instead of below it.
  var side = dialog.querySelector(".map-dialog-side");
  var sideList = side && side.querySelector("ol");
  var sideNone = side && side.querySelector(".map-dialog-side-none");
  var panelEl = dialog.querySelector(".map-dialog-panel");
  function matchSideHeight() { if (side) side.style.height = panelEl.offsetHeight + "px"; }
  function hasImage(l) { return l.getAttribute("data-has-image") !== "0"; }
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
    var keepName = name.textContent, keepComment = comment.textContent, keepNote = noteEl.textContent, tallest = 0;
    titleEl.style.minHeight = "";
    links.forEach(function (l) {
      name.textContent = l.getAttribute("data-map-name");
      comment.textContent = keepWords(l.getAttribute("data-map-description"));
      noteEl.textContent = keepWords(l.getAttribute("data-map-note"));
      tallest = Math.max(tallest, titleEl.offsetHeight);
    });
    name.textContent = keepName;
    comment.textContent = keepComment;
    noteEl.textContent = keepNote;
    titleEl.style.minHeight = tallest + "px";
  }
  function sizeToLargest() {
    measureTitles();
    if (largest) return;
    largest = { w: 0, h: 0 };
    var withImages = links.filter(hasImage);
    var pending = withImages.length;
    withImages.forEach(function (l) {
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
  window.addEventListener("resize", function () { if (dialog.open) { measureTitles(); zoom.refresh(); matchSideHeight(); } });

  function show(index) {
    current = (index + links.length) % links.length;
    var link = links[current];
    var mapName = link.getAttribute("data-map-name");
    var mapComment = link.getAttribute("data-map-description") || "";
    name.textContent = mapName;
    comment.textContent = keepWords(mapComment);
    noteEl.textContent = keepWords(link.getAttribute("data-map-note"));
    var withImage = hasImage(link);
    if (withImage) {
      image.src = link.getAttribute("href");
      image.alt = "Overhead map of " + mapName;
    } else {
      image.removeAttribute("src");
      image.alt = "";
      zoom.reset();
    }
    image.hidden = !withImage;
    emptyMsg.hidden = withImage;
    frame.classList.toggle("is-empty", !withImage);
    // Zoom only makes sense with an image; keep its space so the box doesn't change size.
    Array.prototype.forEach.call(zoomRow.querySelectorAll("[data-zoom], .map-dialog-zoom-level"), function (e) {
      e.style.visibility = withImage ? "" : "hidden";
    });
    // Objectives from the map's row in the table.
    var steps = link.closest("tr") ? link.closest("tr").querySelectorAll(".map-objectives li") : [];
    belowList.textContent = "";
    Array.prototype.forEach.call(steps, function (li) { belowList.appendChild(li.cloneNode(true)); });
    below.hidden = !steps.length;
    if (side) {
      sideList.textContent = "";
      Array.prototype.forEach.call(steps, function (li) { sideList.appendChild(li.cloneNode(true)); });
      sideList.hidden = !steps.length;
      sideNone.hidden = !!steps.length;
    }
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
    matchSideHeight();
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
      if (e.target.closest("a, button, details")) return;    // links and the objectives toggle handle their own clicks
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
      if (hasImage(l)) new Image().src = l.getAttribute("href");
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

  // CnCNet reports the original maps with a "C&C_" prefix ("C&C_City"),
  // while the rotation table uses the short name ("City").
  function sameMap(a, b) {
    function norm(s) { return String(s || "").toLowerCase().replace(/^c&c_/, "").replace(/\.mix$/, ""); }
    return norm(a) === norm(b);
  }

  function markCurrentMap(name) {
    document.querySelectorAll("tr.is-current").forEach(function (tr) { tr.classList.remove("is-current"); });
    document.querySelectorAll("tr .now-playing").forEach(function (b) { b.remove(); });
    if (!name) return;
    document.querySelectorAll("tr[data-map]").forEach(function (tr) {
      if (!sameMap(tr.getAttribute("data-map"), name)) return;
      tr.classList.add("is-current");
      var badge = document.createElement("span");
      badge.className = "now-playing";
      badge.innerHTML = '<span class="now-playing-dot" aria-hidden="true"></span>Now playing';
      (tr.querySelector(".now-cell") || tr.cells[0]).appendChild(badge);
    });
    // Lets an open map preview update its own "Now playing" badge.
    document.dispatchEvent(new CustomEvent("currentmapchange"));
  }

  // The current map's objectives, copied from its row in the rotation table.
  var objBox = box.querySelector(".live-objectives");
  function showObjectives(row) {
    if (!objBox) return;
    var ol = objBox.querySelector("ol");
    ol.textContent = "";
    var items = row ? row.querySelectorAll(".map-objectives li") : [];
    Array.prototype.forEach.call(items, function (li) { ol.appendChild(li.cloneNode(true)); });
    var numbered = Array.prototype.filter.call(items, function (li) { return !li.classList.contains("objective-optional"); }).length;
    objBox.querySelector("summary").textContent = "Objectives" + (numbered ? " (" + numbered + ")" : "");
    objBox.hidden = items.length === 0;
  }

  function showMap(name) {
    mapEl.textContent = "";
    if (!name) { mapEl.textContent = "-"; showObjectives(null); return; }
    var preview = Array.prototype.find.call(document.querySelectorAll(".map-link"), function (a) {
      return sameMap(a.getAttribute("data-map-name"), name);
    });
    var row = document.querySelector('tr[data-map]') && Array.prototype.find.call(document.querySelectorAll("tr[data-map]"), function (tr) {
      return sameMap(tr.getAttribute("data-map"), name);
    });
    var label = document.createElement(preview ? "a" : "span");
    label.textContent = name;
    if (preview) {
      label.href = preview.getAttribute("href");
      label.title = "Open the map preview";
      label.addEventListener("click", function (e) { e.preventDefault(); preview.click(); });
    }
    mapEl.appendChild(label);
    showObjectives(row);
    if (row) {
      var note = document.createElement("span");
      note.className = "live-map-note";
      note.textContent = (row.querySelector(".map-desc") || row.cells[3]).textContent.trim();
      mapEl.appendChild(note);
      var extra = row.querySelector(".map-note-extra");
      if (extra) mapEl.appendChild(el("span", "live-map-note live-map-note-extra", extra.textContent.trim()));
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

  // Visitor's own time, with their UTC offset: "11:32 (UTC+1)".
  function clock(d) {
    var off = -d.getTimezoneOffset();
    var zone = "UTC" + (off === 0 ? "" : (off > 0 ? "+" : "-") + Math.floor(Math.abs(off) / 60) +
      (Math.abs(off) % 60 ? ":" + String(Math.abs(off) % 60).padStart(2, "0") : ""));
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + " (" + zone + ")";
  }
  // Appends text to parent, turning the words Nod and GDI into faction badges.
  function addText(parent, text) {
    text.split(/\b(Nod|GDI)\b/).forEach(function (part, i) {
      if (i % 2) parent.appendChild(el("span", "team-badge team-badge-inline team-" + part.toLowerCase(), part === "Nod" ? "Nod" : "GDI"));
      else if (part) parent.appendChild(document.createTextNode(part));
    });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Where the data comes from:
  //  - "cncnet" (first): CnCNet's public list, refreshed every minute.
  //  - "direct" (backup): status.json from the "Server status" workflow, which
  //    asks the server itself every few minutes; used when CnCNet doesn't list it.
  //  Both get the same answer from the server, which reports 0 players on Nod
  //  maps unless someone is on GDI.
  var directUrl = box.getAttribute("data-direct-url");
  var cncnetName = box.getAttribute("data-cncnet-name") || "CnCNet";
  var cncnetUrl = box.getAttribute("data-cncnet-url") || url;
  var DIRECT_MAX_AGE = 15 * 60 * 1000; // GitHub runs the workflow every 5 min at best, often later
  var badge = box.querySelector(".source-badge");
  var warning = box.querySelector(".live-warning");
  var source = box.querySelector(".live-source");
  var factionEl = box.querySelector(".live-faction");
  var ircLink = document.getElementById("irc") ? "#irc" : null;

  function factionOf(mapName) {
    if (!mapName) return null;
    var row = Array.prototype.find.call(document.querySelectorAll("tr[data-map]"), function (tr) {
      return sameMap(tr.getAttribute("data-map"), mapName);
    });
    return row && row.getAttribute("data-faction");
  }
  function showFaction(mapName) {
    factionEl.textContent = "";
    var f = factionOf(mapName);
    if (!f) { factionEl.textContent = "-"; return null; }
    var key = /gdi/i.test(f) ? "gdi" : /nod/i.test(f) ? "nod" : "other";
    factionEl.appendChild(el("span", "team-badge team-" + key, key === "nod" ? "Nod" : f));
    return key;
  }

  function setBadge(kind) {
    badge.hidden = !kind;
    if (!kind) return;
    badge.setAttribute("data-source", kind);
    badge.textContent = kind === "direct" ? "Direct" : "CnCNet";
    var tip = kind === "direct"
      ? "Backup: read from the server itself, used when CnCNet doesn't list the server. New check every ~5 minutes."
      : "From CnCNet's server list, refreshed every minute. On Nod maps it can show 0 players.";
    var tipEl = el("span", "source-tip");
    tipEl.setAttribute("role", "tooltip");
    addText(tipEl, tip);
    badge.appendChild(tipEl);
    badge.setAttribute("aria-label", badge.firstChild.textContent + " - " + tip);
  }

  function setSource(kind, when) {
    source.textContent = "";
    if (kind === "direct") {
      var mins = Math.max(0, Math.round((Date.now() - when.getTime()) / 60000));
      source.appendChild(document.createTextNode("Backup: from the server itself · checked " + clock(when) +
        (mins ? ", " + mins + " min ago" : ", just now") + " · new check every ~5 minutes"));
    } else {
      source.appendChild(document.createTextNode("Live data from "));
      var a = el("a", null, cncnetName); a.href = cncnetUrl;
      source.appendChild(a);
      source.appendChild(document.createTextNode(" · last checked " + clock(when) + " · refreshes every minute"));
    }
  }

  // The amber note under the numbers: on Nod maps the server reports 0 players
  // (to everyone) unless someone is on GDI; ExaBot's !pl in #Mission-Coop is right.
  function setWarning(faction, missing) {
    warning.textContent = "";
    if (faction === "nod" || missing) {
      addText(warning, missing
        ? "On Nod maps the server can drop off the lists or show 0 players, even while people are playing. Check "
        : "Nod map: the server lists can show 0 players here, even while people are playing. Check ");
      var a = el("a", null, "IRC"); if (ircLink) a.href = ircLink;
      warning.appendChild(ircLink ? a : document.createTextNode("IRC"));
      warning.appendChild(document.createTextNode(" (type "));
      warning.appendChild(el("code", null, "!pl"));
      warning.appendChild(document.createTextNode(" in "));
      warning.appendChild(el("code", null, "#Mission-Coop"));
      warning.appendChild(document.createTextNode(") or join in game: use "));
      warning.appendChild(el("strong", null, "Join Server"));
      warning.appendChild(document.createTextNode(" or "));
      warning.appendChild(el("code", null, address));
      warning.appendChild(document.createTextNode("."));
    }
    warning.hidden = !warning.textContent;
  }

  function showServer(server, kind, when) {
    setState("online", "Online");
    showMap(server.mapname);
    var faction = showFaction(server.mapname);
    playersEl.textContent = (server.numplayers || 0) + " / " + (server.maxplayers || "?");
    timeEl.textContent = formatTime(server.timeleft || server["Time Remaining"]);
    showPlayers(server.players);
    markCurrentMap(server.mapname);
    setBadge(kind);
    setSource(kind, when);
    setWarning(faction, false);
  }

  // note: an extra line under the state, e.g. that "not listed" doesn't mean offline.
  var stateNote = el("span", "live-state-note");
  state.insertAdjacentElement("afterend", stateNote);
  function showMissing(kind, text, note) {
    setState(kind, text);
    stateNote.textContent = "";
    if (note) note(stateNote);
    showMap(null); showFaction(null);
    playersEl.textContent = "-"; timeEl.textContent = "-";
    showPlayers([]); markCurrentMap(null);
    setBadge("cncnet");
    setSource("cncnet", new Date());
    setWarning(null, kind === "offline");
  }
  function notListedNote(n) {
    n.appendChild(document.createTextNode("This doesn't mean the server is "));
    n.appendChild(el("strong", null, "offline"));
    n.appendChild(document.createTextNode(" or that it has no players."));
  }

  // 1. CnCNet's public server list (refreshed every minute).
  //    Resolves true when the server is listed, false when it isn't.
  function tryCncnet() {
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        // The list is plain JSON; strip a JSONP wrapper just in case.
        var data = JSON.parse(text.replace(/^[^\[{]*\(/, "").replace(/\)\s*;?\s*$/, ""));
        var servers = Array.isArray(data) ? data : Object.values(data);
        var server = servers.find(function (s) { return s.ip + ":" + s.hostport === address; });
        if (!server) return false;
        stateNote.textContent = "";
        showServer(server, "cncnet", new Date());
        return true;
      });
  }

  // 2. Backup: the server itself (status.json from the "Server status" workflow), when recent.
  function tryDirect() {
    if (!directUrl) return Promise.reject(new Error("no direct status"));
    return fetch(directUrl, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var checked = new Date(data.checked_at);
        if (!data.online || isNaN(checked) || Date.now() - checked.getTime() > DIRECT_MAX_AGE) throw new Error("stale");
        stateNote.textContent = "";
        showServer(data, "direct", checked);
      });
  }

  function refresh() {
    if (busy) return;
    busy = true;
    tryCncnet()
      .then(function (listed) {
        if (listed) return;
        return tryDirect().catch(function () {
          showMissing("offline", "Not on CnCNet's list right now", notListedNote);
        });
      }, function () {
        return tryDirect().catch(function () {
          showMissing("unknown", "Couldn't reach the server list - trying again in a minute");
        });
      })
      .then(function () { busy = false; }, function () { busy = false; });
  }

  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
})();
