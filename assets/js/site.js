// "16-08-2025 18:38" -> "Saturday, 16 August 2025, 18:38" (written out, so the day and month can't be mixed up).
function longDate(s) {
  var m = /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(s || "");
  if (!m) return "";
  var d = new Date(+m[3], +m[2] - 1, +m[1]);
  var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return days[d.getDay()] + ", " + (+m[1]) + " " + months[+m[2] - 1] + " " + m[3] + (m[4] ? ", " + m[4] + ":" + m[5] : "");
}

// Map marks (spawn points, secrets, vehicles...) drawn on the overhead map images.
// The marks come from _data/map_marks.yml; the Map marker tool (/tools/map-marker/)
// places them. Shared by the map preview and the tool.
var MapMarks = (function () {
  var KINDS = {
    spawn:   { label: "Spawn point", plural: "Spawn points",
               glyph: '<path d="M4 1.5h1.6v13H4z"/><path d="M6.2 2.2h7.3l-1.9 2.9 1.9 2.9H6.2z"/>' },
    secret:  { label: "Secret", plural: "Secrets",
               glyph: '<path d="M8 1.2l2 4.4 4.8.5-3.6 3.2 1 4.8L8 11.7l-4.2 2.4 1-4.8-3.6-3.2 4.8-.5z"/>' },
    vehicle: { label: "Vehicle", plural: "Vehicles",
               glyph: '<path d="M4.2 5.2h5.6l1.2 2.6H3z"/><path d="M8.6 5.8h6v1.2h-6z"/><path d="M1.2 8.4h13.6v2.8c0 .9-.7 1.6-1.6 1.6H2.8c-.9 0-1.6-.7-1.6-1.6z"/>' },
    other:   { label: "Other", plural: "Other",
               glyph: '<path d="M6.9 2.5h2.2v6.8H6.9z"/><circle cx="8" cy="12.2" r="1.3"/>' }
  };
  var ORDER = ["spawn", "secret", "vehicle", "other"];
  function kind(k) { return KINDS[k] ? k : "other"; }
  function icon(k) {
    return '<svg class="map-mark-glyph" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor">' + KINDS[kind(k)].glyph + "</svg>";
  }
  // A mark on the map: a round badge at x/y (percent of the image).
  function marker(mark) {
    var k = kind(mark.kind);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "map-mark map-mark-" + k;
    b.style.left = mark.x + "%";
    b.style.top = mark.y + "%";
    b.innerHTML = icon(k);
    b.setAttribute("aria-label", KINDS[k].label + (mark.label ? ": " + mark.label : ""));
    return b;
  }
  // Where an image of a mark lives (a full link is used as is).
  function imageUrl(base, name) { return /^(https?:)?\//.test(name) ? name : base + name; }
  return { KINDS: KINDS, ORDER: ORDER, kind: kind, icon: icon, marker: marker, imageUrl: imageUrl };
})();

// Debug mode (switch at the bottom of the page, or ?debug=1 / ?debug=0 in the URL):
// the map table shows every icon, with the missing ones in red.
(function () {
  var root = document.documentElement;
  var toggle = document.querySelector("[data-debug-toggle]");
  if (!toggle) return;
  toggle.checked = root.hasAttribute("data-debug");
  toggle.addEventListener("change", function () {
    var on = toggle.checked;
    if (on) root.setAttribute("data-debug", ""); else root.removeAttribute("data-debug");
    try { localStorage.setItem("debug", on ? "1" : "0"); } catch (e) {}
    // Keep the URL in step, so a copied link opens the page the same way.
    try {
      var u = new URL(location.href);
      if (on) u.searchParams.set("debug", "1"); else u.searchParams.delete("debug");
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    } catch (e) {}
  });
})();

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
  // Note text where `name` shows as a code box (like the map names in the table).
  function setNote(el, t) {
    el.textContent = "";
    keepWords(t).split("`").forEach(function (part, i) {
      if (!part) return;
      if (i % 2) { var c = document.createElement("code"); c.textContent = part; el.appendChild(c); }
      else el.appendChild(document.createTextNode(part));
    });
  }
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
  var creditDate = null, creditShort = null;
  // Wide screens: the objectives go in a card beside the map instead of below it.
  var side = dialog.querySelector(".map-dialog-side");
  var sideList = side && side.querySelector("ol");
  var sideNone = side && side.querySelector(".map-dialog-side-none");
  var panelEl = dialog.querySelector(".map-dialog-panel");
  // Weapons: a card on the left of the map, or below the map on narrow screens.
  var weaponsCard = dialog.querySelector(".map-dialog-weapons-card");
  var weaponLists = dialog.querySelectorAll(".map-dialog-weapons:not(.map-dialog-onmap-list)");
  var onmapBoxes = dialog.querySelectorAll(".map-dialog-onmap");
  var weaponsNone = dialog.querySelector(".map-dialog-weapons-none");
  var belowWeapons = dialog.querySelector(".map-dialog-below-weapons");
  var belowObjTitle = dialog.querySelector(".map-dialog-below-obj-title");
  function matchSideHeight() {
    if (side) side.style.height = panelEl.offsetHeight + "px";
    if (weaponsCard) weaponsCard.style.height = panelEl.offsetHeight + "px";
  }
  function hasImage(l) { return l.getAttribute("data-has-image") !== "0"; }

  // The purchase terminal's first page for the map's side (terminal: in _data/maps.yml),
  // with what isn't sold on that map greyed out. Returns whether there's anything to show.
  var terminalBoxes = dialog.querySelectorAll(".map-dialog-terminal");
  var noBeacons = dialog.hasAttribute("data-no-beacons");
  var TERMINAL_NOTES = {
    "full": "",
    "no-vehicles": "No vehicles on this map.",
    "vehicles-destroyed": "The vehicle building starts destroyed, so no vehicles.",
    "none": "This map has no purchase terminal."
  };
  function showTerminal(row) {
    var kind = row && row.getAttribute("data-terminal");
    var f = row && row.getAttribute("data-faction");
    var side = /nod/i.test(f || "") ? "nod" : "gdi";
    var tpl = dialog.ownerDocument.querySelector('template.terminal-template[data-side="' + side + '"]');
    Array.prototype.forEach.call(terminalBoxes, function (box) {
      var grid = box.querySelector(".terminal-grid"), note = box.querySelector(".map-dialog-terminal-note");
      grid.textContent = "";
      box.hidden = !kind || !tpl;
      if (box.hidden) return;
      grid.appendChild(tpl.content.cloneNode(true));
      box.classList.toggle("is-none", kind === "none");
      Array.prototype.forEach.call(grid.children, function (tile) {
        var slot = tile.getAttribute("data-slot"), off = null;
        if (kind === "none") off = "";
        else if (slot === "vehicles" && kind === "vehicles-destroyed") off = "Destroyed";
        else if (slot === "vehicles" && kind === "no-vehicles") off = "Not on this map";
        else if (slot === "beacon" && noBeacons) off = "Not sold here";
        if (off !== null) {
          tile.classList.add("is-off");
          tile.querySelector(".terminal-state").textContent = off;
        }
      });
      var text = TERMINAL_NOTES[kind] || "";
      if (noBeacons && kind !== "none") text = (text ? text + " " : "") + "Beacons aren't sold on this server.";
      note.textContent = text;
    });
    return !!kind;
  }
  // Map / in-game photo switch (one button next to the name, like "Show Photo" / "Show In-Game Map").
  var viewBtn = dialog.querySelector(".map-dialog-view");
  var wantPhoto = false; // stays as picked while stepping through the maps
  if (viewBtn) viewBtn.addEventListener("click", function () { wantPhoto = !wantPhoto; zoom.reset(); show(current); });
  var navButtons = dialog.querySelectorAll("[data-map-step]");
  var current = 0;
  // The image and its marks sit on one "canvas" that zooms and pans as a whole.
  var canvas = dialog.querySelector(".map-dialog-canvas") || image;
  var zoom = makeZoom(dialog.querySelector(".map-dialog-viewport"), canvas, dialog.querySelector(".map-dialog-zoom-level"), function () { placePop(); });

  // ---- Map marks (_data/map_marks.yml) on the overhead map ----
  // Hover a mark to see its card; click it to keep the card open (needed for
  // touch screens, and to step through its pictures).
  var marksLayer = dialog.querySelector(".map-marks");
  var marksBar = dialog.querySelector(".map-dialog-marks");
  var pop = dialog.querySelector(".map-mark-pop");
  var marksBase = dialog.getAttribute("data-marks-base") || "";
  var allMarks = {};
  try { allMarks = JSON.parse((document.getElementById("map-marks-data") || {}).textContent || "{}") || {}; } catch (e) {}
  var hiddenKinds = {};      // kinds switched off in the legend (kept while stepping through maps)
  var pinned = null, hovered = null, popImage = 0;
  function marksFor(link) {
    var key = link.getAttribute("data-marks-key");
    return (key && Array.isArray(allMarks[key])) ? allMarks[key] : [];
  }
  // The marks layer covers exactly the drawn image (the image is centred and
  // scaled to fit, so it doesn't always fill the box).
  function layoutMarks() {
    if (!marksLayer) return;
    var vw = canvas.clientWidth, vh = canvas.clientHeight;
    var iw = image.naturalWidth, ih = image.naturalHeight;
    if (!iw || !ih || !vw || !vh) { marksLayer.style.display = "none"; return; }
    var s = Math.min(vw / iw, vh / ih), w = iw * s, h = ih * s;
    marksLayer.style.display = "";
    marksLayer.style.left = (vw - w) / 2 + "px";
    marksLayer.style.top = (vh - h) / 2 + "px";
    marksLayer.style.width = w + "px";
    marksLayer.style.height = h + "px";
    placePop();
  }
  function markActive() {
    if (!marksLayer) return;
    Array.prototype.forEach.call(marksLayer.children, function (m) { m.classList.toggle("is-active", m === (pinned || hovered)); });
  }
  function hidePop() { pinned = hovered = null; if (pop) pop.hidden = true; markActive(); }
  // The card: kind, name, note and pictures of a mark.
  function fillPop(btn) {
    var mark = btn._mark, k = MapMarks.kind(mark.kind), info = MapMarks.KINDS[k];
    pop.textContent = "";
    pop.className = "map-mark-pop" + (btn === pinned ? " is-pinned" : "");
    var head = document.createElement("p");
    head.className = "map-mark-pop-head";
    head.innerHTML = '<span class="map-mark-dot map-mark-' + k + '">' + MapMarks.icon(k) + "</span>";
    var t = document.createElement("span");
    t.className = "map-mark-pop-title";
    t.textContent = mark.label || info.label;
    head.appendChild(t);
    if (mark.label) {
      var kk = document.createElement("span");
      kk.className = "map-mark-pop-kind";
      kk.textContent = info.label;
      head.appendChild(kk);
    }
    if (btn === pinned) {
      var x = document.createElement("button");
      x.type = "button"; x.className = "map-mark-pop-close"; x.setAttribute("aria-label", "Close"); x.innerHTML = "&#10005;";
      x.addEventListener("click", hidePop);
      head.appendChild(x);
    }
    pop.appendChild(head);
    if (mark.note) {
      var n = document.createElement("p");
      n.className = "map-mark-pop-note";
      n.textContent = mark.note;
      pop.appendChild(n);
    }
    var imgs = Array.isArray(mark.images) ? mark.images : [];
    if (imgs.length) {
      popImage = Math.min(popImage, imgs.length - 1);
      var fig = document.createElement("div");
      fig.className = "map-mark-pop-figure";
      var a = document.createElement("a");
      a.href = MapMarks.imageUrl(marksBase, imgs[popImage]);
      a.target = "_blank"; a.rel = "noopener"; a.title = "Open full size";
      var im = document.createElement("img");
      im.src = a.href; im.alt = mark.label || info.label;
      im.addEventListener("load", placePop);
      a.appendChild(im);
      fig.appendChild(a);
      if (imgs.length > 1) {
        var nav = document.createElement("div");
        nav.className = "map-mark-pop-nav";
        if (btn !== pinned) {
          nav.appendChild(document.createTextNode("1 / " + imgs.length + " · click the mark to see them all"));
        } else {
          [-1, 1].forEach(function (step) {
            var b = document.createElement("button");
            b.type = "button"; b.className = "btn btn-small";
            b.setAttribute("aria-label", step < 0 ? "Previous picture" : "Next picture");
            b.innerHTML = step < 0 ? "&#10094;" : "&#10095;";
            b.addEventListener("click", function () {
              popImage = (popImage + step + imgs.length) % imgs.length;
              fillPop(btn); placePop();
            });
            nav.appendChild(b);
          });
          var c = document.createElement("span");
          c.className = "map-mark-pop-count";
          c.textContent = (popImage + 1) + " / " + imgs.length;
          nav.insertBefore(c, nav.lastChild);
        }
        fig.appendChild(nav);
      }
      pop.appendChild(fig);
    }
    pop.hidden = false;
  }
  // Above the mark when there's room, otherwise below; always inside the map box.
  function placePop() {
    var btn = pinned || hovered;
    if (!pop || pop.hidden || !btn) return;
    var box = frame.getBoundingClientRect(), r = btn.getBoundingClientRect();
    var cx = r.left + r.width / 2 - box.left;
    var pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 8;
    var left = Math.max(4, Math.min(box.width - pw - 4, cx - pw / 2));
    var top = r.top - box.top - ph - gap;
    if (top < 4) top = r.bottom - box.top + gap;
    top = Math.max(4, Math.min(box.height - ph - 4, top));
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }
  function showMarks(link, noMarks) {
    if (!marksLayer) return;
    hidePop();
    marksLayer.textContent = "";
    var marks = noMarks ? [] : marksFor(link);
    var counts = {};
    marks.forEach(function (mark) {
      if (typeof mark.x !== "number" || typeof mark.y !== "number") return;
      var k = MapMarks.kind(mark.kind);
      counts[k] = (counts[k] || 0) + 1;
      var btn = MapMarks.marker(mark);
      btn._mark = mark;
      btn.hidden = !!hiddenKinds[k];
      // A mark is not a place to start dragging the map from.
      btn.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
      btn.addEventListener("dblclick", function (e) { e.stopPropagation(); });
      btn.addEventListener("mouseenter", function () {
        if (pinned) return;
        hovered = btn; popImage = 0; fillPop(btn); placePop(); markActive();
      });
      btn.addEventListener("mouseleave", function () {
        if (pinned || hovered !== btn) return;
        hovered = null; pop.hidden = true; markActive();
      });
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (pinned === btn) { hidePop(); return; }
        pinned = btn; hovered = null; popImage = 0; fillPop(btn); placePop(); markActive();
      });
      marksLayer.appendChild(btn);
    });
    // The legend: one switch per kind on this map, with how many there are.
    if (marksBar) {
      marksBar.textContent = "";
      MapMarks.ORDER.forEach(function (k) {
        if (!counts[k]) return;
        var info = MapMarks.KINDS[k];
        var b = document.createElement("button");
        b.type = "button";
        b.className = "map-mark-chip";
        b.setAttribute("aria-pressed", String(!hiddenKinds[k]));
        b.title = (hiddenKinds[k] ? "Show " : "Hide ") + info.plural.toLowerCase() + " on the map";
        b.innerHTML = '<span class="map-mark-dot map-mark-' + k + '">' + MapMarks.icon(k) + "</span>";
        b.appendChild(document.createTextNode((counts[k] === 1 ? info.label : info.plural) + " (" + counts[k] + ")"));
        b.addEventListener("click", function () {
          hiddenKinds[k] = !hiddenKinds[k];
          showMarks(link, noMarks);
        });
        marksBar.appendChild(b);
      });
      // Keeps its space (visibility) so the box doesn't change height between maps.
      marksBar.style.visibility = marksBar.children.length ? "" : "hidden";
    }
    layoutMarks();
  }
  if (pop) pop.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
  if (pop) pop.addEventListener("wheel", function (e) { e.stopPropagation(); });
  // Clicking the map (not a mark) closes a pinned card.
  canvas.addEventListener("click", function (e) { if (pinned && !e.target.closest(".map-mark")) hidePop(); });
  image.addEventListener("load", layoutMarks);
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
    var keepName = name.textContent, keepComment = comment.textContent, keepNote = noteEl.innerHTML, tallest = 0;
    titleEl.style.minHeight = "";
    links.forEach(function (l) {
      name.textContent = l.getAttribute("data-map-name");
      comment.textContent = keepWords(l.getAttribute("data-map-description"));
      setNote(noteEl, l.getAttribute("data-map-note"));
      tallest = Math.max(tallest, titleEl.offsetHeight);
    });
    name.textContent = keepName;
    comment.textContent = keepComment;
    noteEl.innerHTML = keepNote;
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
  window.addEventListener("resize", function () { if (dialog.open) { measureTitles(); zoom.refresh(); matchSideHeight(); layoutMarks(); } });

  function show(index) {
    current = (index + links.length) % links.length;
    var link = links[current];
    var mapName = link.getAttribute("data-map-name");
    var mapComment = link.getAttribute("data-map-description") || "";
    name.textContent = mapName;
    comment.textContent = keepWords(mapComment);
    setNote(noteEl, link.getAttribute("data-map-note"));
    // Faction badge after the name (from the map's row in the table).
    var factionBox = dialog.querySelector(".map-dialog-faction");
    if (factionBox) {
      factionBox.textContent = "";
      var f = link.closest("tr") && link.closest("tr").getAttribute("data-faction");
      if (f) {
        var key = /gdi/i.test(f) ? "gdi" : /nod/i.test(f) ? "nod" : "other";
        var b = document.createElement("span");
        b.className = "team-badge team-" + key;
        b.textContent = key === "nod" ? "Nod" : f;
        factionBox.appendChild(b);
      }
      if (link.closest("tr") && link.closest("tr").hasAttribute("data-scalable")) {
        var sd = document.createElement("span");
        sd.className = "map-tag";
        sd.textContent = "Scalable difficulty";
        factionBox.appendChild(sd);
      }
    }
    var withImage = hasImage(link);
    var photo = link.getAttribute("data-ingame");
    var showPhoto = !!(wantPhoto && photo && withImage);
    if (viewBtn) {
      viewBtn.hidden = !(photo && withImage);
      viewBtn.setAttribute("aria-pressed", String(showPhoto));   // CSS shows the matching label
    }
    if (withImage) {
      image.src = showPhoto ? photo : link.getAttribute("href");
      image.alt = (showPhoto ? "In-game view of " : "Overhead map of ") + mapName;
    } else {
      image.removeAttribute("src");
      image.alt = "";
      zoom.reset();
    }
    image.hidden = !withImage;
    showMarks(link, showPhoto || !withImage);
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
    var weapons = link.closest("tr") ? link.closest("tr").querySelectorAll(".map-weapons li") : [];
    Array.prototype.forEach.call(weaponLists, function (ul) {
      ul.textContent = "";
      Array.prototype.forEach.call(weapons, function (li) { ul.appendChild(li.cloneNode(true)); });
    });
    var onmap = link.closest("tr") ? link.closest("tr").querySelectorAll(".map-onmap-weapons li") : [];
    Array.prototype.forEach.call(onmapBoxes, function (box) {
      var ul = box.querySelector("ul");
      ul.textContent = "";
      Array.prototype.forEach.call(onmap, function (li) { ul.appendChild(li.cloneNode(true)); });
      box.hidden = !onmap.length;
    });
    if (weaponsNone) weaponsNone.hidden = !!weapons.length;
    var hasTerminal = showTerminal(link.closest("tr"));
    if (belowWeapons) belowWeapons.hidden = !weapons.length && !onmap.length && !hasTerminal;
    if (belowObjTitle) belowObjTitle.hidden = !steps.length;
    below.hidden = !steps.length && !weapons.length && !onmap.length && !hasTerminal;
    if (side) {
      sideList.textContent = "";
      Array.prototype.forEach.call(steps, function (li) { sideList.appendChild(li.cloneNode(true)); });
      sideList.hidden = !steps.length;
      sideNone.hidden = !!steps.length;
    }
    var url = link.getAttribute(showPhoto ? "data-ingame-credit-url" : "data-credit-url");
    var who = link.getAttribute(showPhoto ? "data-ingame-credit-name" : "data-credit-name");
    // visibility (not hidden) so the line keeps its space and the box never changes height.
    credit.hidden = false;
    credit.style.visibility = who ? "visible" : "hidden";
    if (who) {
      creditName.textContent = who;
      if (url) creditName.href = url; else creditName.removeAttribute("href");  // a name without a link (e.g. a player's own photo)
    }
    // A player's own photo: when it was taken, like the gallery captions.
    var taken = showPhoto ? link.getAttribute("data-ingame-date") : null;
    if (!creditDate) {
      creditShort = document.createElement("span"); creditName.insertAdjacentElement("afterend", creditShort);
      creditDate = document.createElement("span"); creditDate.className = "shot-date map-dialog-credit-date"; credit.appendChild(creditDate);
    }
    creditShort.textContent = taken ? " " + taken : "";
    creditDate.textContent = taken ? "(" + longDate(taken) + ")" : "\u00a0";
    counter.textContent = (current + 1) + " / " + links.length;
    updateNowPlaying();
    // The zoom level and position carry over from map to map (Reset or 0 to undo).
    if (!dialog.open) {
      dialog.showModal();
      sizeToLargest();
    }
    zoom.refresh();
    matchSideHeight();
    layoutMarks();
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
  dialog.addEventListener("close", hidePop);
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
function makeZoom(viewport, img, label, onChange) {
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
    img.style.setProperty("--zoom", scale);   // marks stay the same size on screen
    viewport.classList.toggle("is-zoomed", scale > 1);
    if (label) label.textContent = Math.round(scale * 100) + "%";
    if (onChange) onChange();
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
      if (extra) { var ex = el("span", "live-map-note live-map-note-extra"); ex.innerHTML = extra.innerHTML; mapEl.appendChild(ex); }
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
      ? "Read from the server itself, every ~5 minutes. On Nod maps the server can report 0 players."
      : "Fallback: the direct check is out of date or the server didn't answer it, so this comes from CnCNet's server list. On Nod maps it can show 0 players.";
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
      source.appendChild(document.createTextNode("Live from the server itself · checked " + clock(when) +
        (mins ? ", " + mins + " min ago" : ", just now") + " · new check every ~5 minutes"));
    } else {
      source.appendChild(document.createTextNode("Fallback: live data from "));
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
      warning.appendChild(document.createTextNode(") or join in game: use the "));
      // A small copy of the Join Server button, which works the same way.
      var join = el("a", "btn btn-primary btn-small join-inline");
      var src = box.querySelector(".live-join");
      join.href = src ? src.getAttribute("href") : "#";
      join.title = src ? src.title || "" : "";
      join.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>Join Server';
      warning.appendChild(join);
      warning.appendChild(document.createTextNode(" button, or the IP and port: "));
      warning.appendChild(el("code", null, address));
      warning.appendChild(document.createTextNode("."));
      // Why it happens (which BRenBot version, and where it was fixed), folded away.
      var tech = document.querySelector("template.live-tech-note");
      if (tech) warning.appendChild(tech.content.cloneNode(true));
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

  function ago(ms) {
    var m = Math.round(ms / 60000);
    if (m < 60) return m + " min ago";
    var h = Math.floor(m / 60);
    return h + " h" + (m % 60 ? " " + (m % 60) + " min" : "") + " ago";
  }
  var STALE_MAX_AGE = 24 * 60 * 60 * 1000;  // older than this, don't show it at all

  // The direct check (status.json from the "Server status" workflow, every ~5 minutes).
  // Resolves to { data, checked, age }, or null when there is none.
  function getDirect() {
    if (!directUrl) return Promise.resolve(null);
    return fetch(directUrl, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var checked = new Date(data.checked_at);
        if (isNaN(checked)) return null;
        return { data: data, checked: checked, age: Date.now() - checked.getTime() };
      })
      .catch(function () { return null; });
  }

  // CnCNet's public server list: resolves to our server's entry, or null when it isn't listed.
  function getCncnet() {
    return fetch(url, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        // The list is plain JSON; strip a JSONP wrapper just in case.
        var data = JSON.parse(text.replace(/^[^\[{]*\(/, "").replace(/\)\s*;?\s*$/, ""));
        var servers = Array.isArray(data) ? data : Object.values(data);
        return servers.find(function (s) { return s.ip + ":" + s.hostport === address; }) || null;
      });
  }

  function showDirect(d) { stateNote.textContent = ""; showServer(d.data, "direct", d.checked); }
  function showCncnet(server) { stateNote.textContent = ""; showServer(server, "cncnet", new Date()); }

  // Order: the direct check first; CnCNet only when the direct check is out of date or the
  // server didn't answer it; the last direct check ("last seen") when neither works.
  function refresh() {
    if (busy) return;
    busy = true;
    getDirect()
      .then(function (d) {
        var fresh = d && d.age <= DIRECT_MAX_AGE;
        if (fresh && d.data.online) { showDirect(d); return; }
        return getCncnet().then(function (server) {
          if (server) { showCncnet(server); return; }
          if (fresh) {
            // The server didn't answer a recent check, and CnCNet doesn't list it either.
            showMissing("offline", "Offline", function (n) {
              n.textContent = "The server didn't answer the last check (" + clock(d.checked) + ").";
            });
            setBadge("direct"); setSource("direct", d.checked);
            return;
          }
          if (d && d.data.online && d.age <= STALE_MAX_AGE) { showStale(d); return; }
          showMissing("offline", "Not on CnCNet's list right now", notListedNote);
        }, function () {
          // CnCNet can't be reached.
          if (fresh) {
            showMissing("offline", "Offline", function (n) {
              n.textContent = "The server didn't answer the last check (" + clock(d.checked) + ").";
            });
            setBadge("direct"); setSource("direct", d.checked);
            return;
          }
          if (d && d.data.online && d.age <= STALE_MAX_AGE) { showStale(d); return; }
          showMissing("unknown", "Couldn't reach the server - trying again in a minute");
        });
      })
      .then(function () { busy = false; }, function () { busy = false; });
  }

  // An older direct check, clearly marked as such.
  function showStale(d) {
    showDirect(d);
    setState("stale", "Last seen online " + ago(d.age));
    timeEl.textContent = "-";   // the time left from back then would be wrong
    stateNote.textContent = "Live data isn't available right now; this is the last check of the server.";
  }

  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
})();

// Gallery: clicking a screenshot opens it full size, with previous/next buttons and
// the left/right arrow keys. Without JavaScript the link just opens the image.
(function () {
  var dialog = document.querySelector(".gallery-dialog");
  var items = Array.prototype.slice.call(document.querySelectorAll(".gallery-item"));
  if (!dialog || !items.length || typeof dialog.showModal !== "function") return;
  var img = dialog.querySelector(".gallery-image");
  var caption = dialog.querySelector(".gallery-caption");
  var counter = dialog.querySelector(".gallery-counter");
  var current = 0;
  function show(i) {
    current = (i + items.length) % items.length;
    var a = items[current];
    img.src = a.getAttribute("href");
    img.alt = a.getAttribute("data-caption") || "";
    var date = a.getAttribute("data-date");
    caption.textContent = "";
    var text = a.getAttribute("data-caption") || "";
    var who = dialog.getAttribute("data-credit-name"), url = dialog.getAttribute("data-credit-url");
    var at = who && url ? text.indexOf(who) : -1;
    if (at < 0) caption.textContent = text;
    else {
      var link = document.createElement("a");
      link.href = url; link.textContent = who; link.target = "_blank"; link.rel = "noopener";
      caption.appendChild(document.createTextNode(text.slice(0, at)));
      caption.appendChild(link);
      caption.appendChild(document.createTextNode(text.slice(at + who.length)));
    }
    // Short date after the name; written out on the line below.
    if (date) caption.appendChild(document.createTextNode(" " + date));
    dialog.querySelector(".gallery-date").textContent = date ? "(" + longDate(date) + ")" : "";
    counter.textContent = (current + 1) + " / " + items.length;
    if (!dialog.open) dialog.showModal();
    // Preload the neighbours so stepping feels instant.
    [current - 1, current + 1].forEach(function (n) { new Image().src = items[(n + items.length) % items.length].getAttribute("href"); });
  }
  items.forEach(function (a, i) {
    a.addEventListener("click", function (e) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      show(i);
    });
  });
  dialog.querySelector(".gallery-close").addEventListener("click", function () { dialog.close(); });
  dialog.querySelectorAll("[data-gallery-step]").forEach(function (b) {
    b.addEventListener("click", function () { show(current + Number(b.getAttribute("data-gallery-step"))); });
  });
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog || e.target.classList.contains("gallery-stage")) dialog.close();
  });
  dialog.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); show(current + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); show(current - 1); }
  });
})();
