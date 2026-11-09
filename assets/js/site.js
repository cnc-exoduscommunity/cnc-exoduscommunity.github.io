// A time on the server's clock (offsetHours from UTC), then the visitor's own time:
// "12:29 UTC+1 (11:29 your time)", or "(same as your time)".
function serverClock(d, offsetHours) {
  var off = +offsetHours || 0;
  function hm(h, m) { return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"); }
  var s = new Date(d.getTime() + off * 3600000);
  var zone = "UTC" + (off ? (off > 0 ? "+" : "-") + Math.abs(off) : "");
  var mine = -d.getTimezoneOffset() / 60;
  return hm(s.getUTCHours(), s.getUTCMinutes()) + " " + zone +
    (mine === off ? " (same as your time)" : " (" + hm(d.getHours(), d.getMinutes()) + " your time)");
}
// "Server time" in the Message Of The Day, kept up to date.
(function () {
  var el = document.querySelector(".server-time[data-utc-offset]");
  if (!el) return;
  function tick() { el.textContent = serverClock(new Date(), el.getAttribute("data-utc-offset")); }
  tick();
  setInterval(tick, 15000);
})();

// Floor picker on the map (like RenegadeViewer's): up / down buttons, a bar per floor with
// "All" on top, and the floor's name. onPick("") = all floors, onPick("2") = floor 2.
function makeFloorWidget(onPick) {
  var w = document.createElement("div");
  w.className = "floor-widget";
  w.hidden = true;
  w.innerHTML = '<button type="button" class="fw-btn" data-fw="up" title="Floor up (Page Up)" aria-label="Floor up"><span class="fw-tri fw-up"></span></button>' +
    '<div class="fw-bars" role="group" aria-label="Floors"></div>' +
    '<button type="button" class="fw-btn" data-fw="down" title="Floor down (Page Down)" aria-label="Floor down"><span class="fw-tri fw-down"></span></button>' +
    '<div class="fw-label">All</div>';
  var bars = w.querySelector(".fw-bars"), label = w.querySelector(".fw-label");
  var floors = [], cur = "";
  ["pointerdown", "dblclick", "wheel", "click"].forEach(function (t) { w.addEventListener(t, function (e) { e.stopPropagation(); }, t === "wheel" ? { passive: true } : false); });
  function index() { for (var i = 0; i < floors.length; i++) if (String(floors[i].n) === cur) return i; return -1; }
  function pick(i) { onPick(i < 0 ? "" : String(floors[i].n)); }
  function step(d) {   // d = +1 up (towards All), -1 down
    if (w.hidden) return false;
    var i = index();
    var next = d > 0 ? (i <= 0 ? -1 : i - 1) : (i < 0 ? 0 : Math.min(floors.length - 1, i + 1));
    if (next !== i) pick(next);
    return true;
  }
  w.querySelector('[data-fw="up"]').addEventListener("click", function () { step(1); });
  w.querySelector('[data-fw="down"]').addEventListener("click", function () { step(-1); });
  function render() {
    var i = index();
    bars.textContent = "";
    [{ n: "", name: "All floors" }].concat(floors).forEach(function (f, k) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "fw-bar" + ((k === 0 ? i < 0 : k - 1 === i) ? " is-cur" : "") + (i < 0 ? " is-lit" : "");
      b.title = k === 0 ? "All floors" : f.n + ": " + f.name;
      b.setAttribute("aria-pressed", String(k === 0 ? i < 0 : k - 1 === i));
      b.addEventListener("click", function () { pick(k - 1); });
      bars.appendChild(b);
    });
    label.textContent = i < 0 ? "All" : floors[i].name || "Floor " + floors[i].n;
  }
  return {
    el: w,
    step: step,
    // floors: [{ n, name }] from the map's layers.json; current: "" or the floor number.
    set: function (fl, current) {
      floors = Array.isArray(fl) ? fl : [];
      cur = current ? String(current) : "";
      w.hidden = floors.length < 2;
      if (!w.hidden) render();
    }
  };
}

// "16-08-2025 18:38" -> "Saturday, 16 August 2025, 18:38" (written out, so the day and month can't be mixed up).
function longDate(s) {
  var m = /^(\d{2})-(\d{2})-(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(s || "");
  if (!m) return "";
  var d = new Date(+m[3], +m[2] - 1, +m[1]);
  var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return days[d.getDay()] + ", " + ordinalDate(s) + (m[4] ? ", " + m[4] + ":" + m[5] : "");
}
// "09-11-2026" -> "9th of November 2026".
function ordinalDate(s) {
  var m = /^(\d{2})-(\d{2})-(\d{4})/.exec(s || "");
  if (!m) return s || "";
  var d = +m[1], t = d % 100 >= 11 && d % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][d % 10] || "th";
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return d + t + " of " + months[+m[2] - 1] + " " + m[3];
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
    objective: { label: "Objective", plural: "Objectives",
               glyph: '<circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="8" r="2.2"/>' },
    pickup:  { label: "Pickup", plural: "Pickups",
               glyph: '<path d="M2 4.5h12v9H2z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7.1 6h1.8v2h2v1.8h-2v2H7.1v-2h-2V8h2z"/>' },
    note:    { label: "Note", plural: "Notes",
               glyph: '<circle cx="8" cy="8" r="3.2"/>' },
    teleport: { label: "Teleport", plural: "Teleports",
               glyph: '<path d="M8 1.6a6.4 6.4 0 1 0 6.4 6.4h-1.8A4.6 4.6 0 1 1 8 3.4z"/><path d="M8 5.2a2.8 2.8 0 1 0 2.8 2.8H9.2A1.2 1.2 0 1 1 8 6.8z"/><path d="M10.6 1.4l3.6 1.4-2.4 3z"/>' },
    line:    { label: "Line", plural: "Lines",
               glyph: '<path d="M2.2 12.6L12.6 2.2l1.2 1.2L3.4 13.8z"/>' },
    arrow:   { label: "Arrow", plural: "Arrows",
               glyph: '<path d="M2 12.6l8.4-8.4H6.6V2.6H13.4v6.8h-1.6V5.6L3.4 14z"/>' },
    other:   { label: "Other", plural: "Other",
               glyph: '<path d="M6.9 2.5h2.2v6.8H6.9z"/><circle cx="8" cy="12.2" r="1.3"/>' }
  };
  var ORDER = ["objective", "spawn", "secret", "vehicle", "pickup", "teleport", "other", "note", "line", "arrow"];
  // Kinds drawn as a line from x/y to x2/y2 instead of a badge.
  var LINES = { arrow: 1, line: 1 };
  // Styles of a line (style:): a visible wall (default) or an invisible one.
  var LINE_STYLES = { visible: "Visible wall", invisible: "Invisible wall" };
  // Icons a mark can show instead of its glyph (icon: in map_marks.yml): the GDI / Nod
  // logos and the pickups (_data/pickups.yml), all HUD icons from assets/images/hud/.
  var ICON_BASE = "/assets/images/hud/";
  var iconGroups = null, iconNames = {};
  function icons() {
    if (iconGroups) return iconGroups;
    iconGroups = [{ title: "Sides", items: [{ hud: "hud_c&c_gdilogo", name: "GDI" }, { hud: "hud_c&c_nodlogo", name: "Nod" }] }];
    try {
      var d = JSON.parse((document.getElementById("pickups-data") || {}).textContent || "{}") || {};
      Object.keys(d).forEach(function (g) {
        var seen = {}, items = [];
        (d[g].items || []).forEach(function (it) {
          if (!it.hud) return;
          if (seen[it.hud]) { seen[it.hud].name += " / " + it.name; return; }
          items.push(seen[it.hud] = { hud: it.hud, name: it.name });
        });
        if (items.length) iconGroups.push({ title: d[g].title || g, items: items });
      });
    } catch (e) {}
    iconGroups.forEach(function (g) { g.items.forEach(function (it) { iconNames[it.hud] = it.name; }); });
    return iconGroups;
  }
  function iconName(hud) { icons(); return iconNames[hud] || ""; }
  function iconUrl(hud) { return ICON_BASE + encodeURIComponent(hud) + ".png"; }
  // Objective pictures (_data/objective_pogs.yml), read from the page.
  var POG_BASE = "/assets/images/objectives/";
  var pogs = null;
  function pogInfo(key) {
    if (!pogs) {
      pogs = {};
      try {
        var d = JSON.parse((document.getElementById("objective-pogs-data") || {}).textContent || "{}") || {};
        Object.keys(d).forEach(function (m) { (d[m].pogs || []).forEach(function (p) { pogs[p.file.replace(/^pog_/, "")] = p; }); });
      } catch (e) {}
    }
    return pogs[key] || null;
  }
  function kind(k) { return KINDS[k] ? k : "other"; }
  // Kinds that can say how many there are (count:).
  var COUNTED = { secret: 1, vehicle: 1, pickup: 1, other: 1 };
  function countText(mark) { return +mark.count > 0 ? String(+mark.count) : "Infinite"; }
  // A mark's name for lists and cards: its label, else its objective picture's or icon's name, else its kind.
  function name(mark) {
    var k = kind(mark.kind);
    if (mark.label) return mark.label;
    if (k === "objective" && mark.pog) { var pi = pogInfo(mark.pog); if (pi) return pi.name; }
    if (k !== "objective" && mark.icon && iconName(mark.icon)) return iconName(mark.icon);
    return KINDS[k].label;
  }
  // Arrows (kind: arrow, from x/y to x2/y2) and links between marks (links: [id, ...], a
  // dash-dot line from the mark to the one it leads to), drawn in an SVG under the marks.
  // Sizes are in screen pixels, so call it again after zooming. show(mark) says if a mark is on.
  var SVGNS = "http://www.w3.org/2000/svg";
  function lines(layer, marks, show) {
    var svg = layer.querySelector("svg.map-mark-lines");
    if (!svg) { svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("class", "map-mark-lines"); layer.insertBefore(svg, layer.firstChild); }
    var w = layer.clientWidth, h = layer.clientHeight;
    var z = parseFloat(getComputedStyle(layer).getPropertyValue("--zoom")) || 1;
    svg.setAttribute("viewBox", "0 0 " + (w || 1) + " " + (h || 1));
    svg.textContent = "";
    var byId = {};
    marks.forEach(function (m) { if (m.id) byId[m.id] = m; });
    function el(n, a, parent) { var e = document.createElementNS(SVGNS, n); for (var k in a) e.setAttribute(k, a[k]); (parent || svg).appendChild(e); return e; }
    function pt(x, y) { return [x / 100 * w, y / 100 * h]; }
    function head(a, b, size, cls) {
      var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, s = size / z;
      var p = [b, [b[0] - ux * s - uy * s * 0.55, b[1] - uy * s + ux * s * 0.55], [b[0] - ux * s + uy * s * 0.55, b[1] - uy * s - ux * s * 0.55]];
      el("polygon", { points: p.map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" "), "class": cls });
    }
    marks.forEach(function (m) {
      (Array.isArray(m.links) ? m.links : []).forEach(function (id) {
        var t = byId[id];
        if (!t || !show(m) || !show(t)) return;
        var a = pt(m.x, m.y), b = pt(t.x, t.y), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), r = 15 / z;
        if (L < r * 2.2) return;
        var a2 = [a[0] + dx / L * r, a[1] + dy / L * r], b2 = [b[0] - dx / L * r, b[1] - dy / L * r];
        var dash = [10, 4, 2, 4].map(function (v) { return (v / z).toFixed(2); }).join(" ");
        el("line", { x1: a2[0], y1: a2[1], x2: b2[0], y2: b2[1], "class": "map-link-under", "stroke-width": 4 / z });
        el("line", { x1: a2[0], y1: a2[1], x2: b2[0], y2: b2[1], "class": "map-link-line", "stroke-width": 2 / z, "stroke-dasharray": dash });
        head(a2, b2, 9, "map-link-head");
      });
    });
    marks.forEach(function (m, i) {
      var k = kind(m.kind);
      if (!LINES[k] || !show(m) || typeof m.x2 !== "number") return;
      var a = pt(m.x, m.y), b = pt(m.x2, m.y2);
      if (k === "arrow") {
        el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "class": "map-arrow-under", "stroke-width": 6 / z });
        el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "class": "map-arrow-line", "stroke-width": 3 / z });
        head(a, b, 13, "map-arrow-head");
      } else {                            // a wall: solid (visible) or dashed (invisible), no head
        var inv = m.style === "invisible";
        el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "class": "map-wall-under", "stroke-width": 6 / z });
        var ln = { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "class": "map-wall-line" + (inv ? " is-invisible" : ""), "stroke-width": 3 / z };
        if (inv) ln["stroke-dasharray"] = (7 / z).toFixed(2) + " " + (5 / z).toFixed(2);
        el("line", ln);
      }
      var hit = el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], "class": "map-arrow-hit", "stroke-width": 16 / z, "data-index": i });
      var tip = [m.label || (k === "line" ? LINE_STYLES[m.style === "invisible" ? "invisible" : "visible"] : ""), m.note].filter(Boolean).join(" - ");
      if (tip) el("title", {}, hit).textContent = tip;
    });
    return svg;
  }

  // Marks on (nearly) the same spot fan out side by side, overlapping a little, so each
  // one can be seen and clicked. Works in screen pixels, so call it again after zooming.
  function spread(layer) {
    var all = Array.prototype.filter.call(layer.querySelectorAll(".map-mark"), function (m) { return !m.hidden; });
    var w = layer.clientWidth, h = layer.clientHeight;
    var z = parseFloat(getComputedStyle(layer).getPropertyValue("--zoom")) || 1;
    var size = 28, pts = all.map(function (m) {
      m.style.removeProperty("--dx"); m.style.removeProperty("--dy");
      return { m: m, x: parseFloat(m.style.left) / 100 * w * z, y: parseFloat(m.style.top) / 100 * h * z };
    });
    var used = [];
    pts.forEach(function (p, i) {
      if (used[i]) return;
      var group = [p]; used[i] = true;
      for (var j = i + 1; j < pts.length; j++) {
        if (used[j]) continue;
        if (group.some(function (g) { return Math.hypot(g.x - pts[j].x, g.y - pts[j].y) < size * 0.8; })) { group.push(pts[j]); used[j] = true; }
      }
      if (group.length < 2) return;
      var n = group.length, step = size * 0.62;
      group.forEach(function (g, k) {
        var dx, dy;
        if (n <= 4) { dx = (k - (n - 1) / 2) * step; dy = 0; }
        else { var a = k / n * Math.PI * 2 - Math.PI / 2, r = step * n / (Math.PI * 2) + step * 0.3; dx = Math.cos(a) * r; dy = Math.sin(a) * r; }
        g.m.style.setProperty("--dx", dx.toFixed(1) + "px");
        g.m.style.setProperty("--dy", dy.toFixed(1) + "px");
      });
    });
  }
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
    // An objective with a picture shows the game's own objective picture.
    if (k === "objective" && mark.pog) {
      b.classList.add("has-pog");
      b.innerHTML = '<img class="map-mark-pog" alt="" src="' + POG_BASE + "pog_" + encodeURIComponent(mark.pog) + '.png">';
    }
    // Any other mark can show a HUD icon (a pickup, the GDI / Nod logo).
    else if (k !== "objective" && mark.icon) {
      b.classList.add("has-icon");
      b.innerHTML = '<img class="map-mark-icon" alt="" src="' + iconUrl(mark.icon) + '">';
    }
    // How many it gives (count: N); none or 0 = infinite, which needs no badge.
    if (COUNTED[k] && +mark.count > 0) {
      var c = document.createElement("span"); c.className = "map-mark-count"; c.textContent = "x" + (+mark.count);
      b.appendChild(c);
    }
    if (mark.floor) b.setAttribute("data-floor", mark.floor);
    var pi = k === "objective" && mark.pog && pogInfo(mark.pog);
    var nm = mark.label || (pi ? pi.name : "") || (k !== "objective" && mark.icon ? iconName(mark.icon) : "");
    b.setAttribute("aria-label", KINDS[k].label + (nm ? ": " + nm : ""));
    return b;
  }
  // Where an image of a mark lives (a full link is used as is).
  function imageUrl(base, name) { return /^(https?:)?\//.test(name) ? name : base + name; }
  return { KINDS: KINDS, ORDER: ORDER, kind: kind, icon: icon, marker: marker, imageUrl: imageUrl, pogInfo: pogInfo, POG_BASE: POG_BASE,
           icons: icons, iconName: iconName, iconUrl: iconUrl, COUNTED: COUNTED, countText: countText, spread: spread,
           name: name, lines: lines, LINES: LINES, LINE_STYLES: LINE_STYLES };
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

// Puts a setting in the address (or takes it out when it's the default), so a copied
// link opens the page the same way.
// The look in the address: ?theme= with light and/or nod (dark and GDI are the defaults),
// e.g. ?theme=light,nod.
function setThemeUrl() {
  var root = document.documentElement, parts = [];
  if (root.getAttribute("data-theme") === "light") parts.push("light");
  if (root.getAttribute("data-side") === "nod") parts.push("nod");
  setUrlParam("side", null);
  setUrlParam("theme", parts.join(","), "");
}
function setUrlParam(key, value, fallback) {
  try {
    var u = new URL(location.href);
    if (value && value !== fallback) u.searchParams.set(key, value); else u.searchParams.delete(key);
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  } catch (e) {}
}

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
      setThemeUrl();
      label();
    });
  }
  label();
})();

// Side colours: GDI gold (the default) or Nod red, remembered like the theme.
(function () {
  var root = document.documentElement;
  var button = document.querySelector(".side-toggle");
  if (!button) return;
  function label() {
    var nod = root.getAttribute("data-side") === "nod";
    button.setAttribute("aria-label", nod ? "Switch to GDI colours" : "Switch to Nod colours");
    button.setAttribute("aria-pressed", String(nod));
  }
  button.addEventListener("click", function () {
    var nod = root.getAttribute("data-side") !== "nod";
    if (nod) root.setAttribute("data-side", "nod"); else root.removeAttribute("data-side");
    try { localStorage.setItem("side", nod ? "nod" : "gdi"); } catch (e) {}
    setThemeUrl();
    label();
  });
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
  var weaponLists = dialog.querySelectorAll(".map-dialog-weapons:not(.map-dialog-onmap-list):not(.mdw-always):not(.mdw-onmap-list)");
  var onmapBoxes = dialog.querySelectorAll(".map-dialog-onmap");
  var weaponsNone = dialog.querySelector(".map-dialog-weapons-none");
  var belowWeapons = dialog.querySelector(".map-dialog-below-weapons");
  var belowObjTitle = dialog.querySelector(".map-dialog-below-obj-title");
  // Wide screens: the map box takes whatever height the window has left after the title,
  // the buttons and the margins, so the whole preview always fits (no cut-off top).
  function fitViewport() {
    var vp = dialog.querySelector(".map-dialog-viewport");
    if (!vp) return;
    vp.style.height = "";
    if (window.innerWidth < 1100) return;            // narrow screens scroll instead (CSS height)
    var stage = dialog.querySelector(".map-dialog-stage");
    var cs = stage ? getComputedStyle(stage) : null;
    var pad = cs ? parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) : 112;
    var other = panelEl.offsetHeight - vp.offsetHeight;
    vp.style.height = Math.max(288, window.innerHeight - pad - other) + "px";
  }
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
  // Weapons tabs (Starting weapons / Map / Secrets): the one picked stays picked between maps.
  var wantWTab = "start";
  var wTabs = dialog.querySelectorAll(".mdw-tab");
  function showWTab() {
    Array.prototype.forEach.call(wTabs, function (t) { t.setAttribute("aria-selected", String(t.getAttribute("data-wtab") === wantWTab)); });
    Array.prototype.forEach.call(dialog.querySelectorAll(".mdw-panel"), function (p) { p.hidden = p.getAttribute("data-wpanel") !== wantWTab; });
  }
  Array.prototype.forEach.call(wTabs, function (t) {
    t.addEventListener("click", function () { wantWTab = t.getAttribute("data-wtab"); showWTab(); });
  });
  // The purchase terminal folds away; open or closed is remembered.
  var termFold = dialog.querySelector(".mdw-terminal");
  if (termFold) {
    try { if (localStorage.getItem("terminalOpen") === "0") termFold.open = false; } catch (e) {}
    termFold.addEventListener("toggle", function () { try { localStorage.setItem("terminalOpen", termFold.open ? "1" : "0"); } catch (e) {} });
  }
  // Buildings on the map (_data/buildings.yml).
  var buildings = {};
  try { buildings = JSON.parse((document.getElementById("buildings-data") || {}).textContent || "{}") || {}; } catch (e) {}
  var hudBase = dialog.getAttribute("data-hud-base") || "";
  var bBox = dialog.querySelector(".mdw-buildings");
  function showBuildings(mapName) {
    if (!bBox) return;
    var rows = bBox.querySelector(".mdw-buildings-rows");
    rows.textContent = "";
    var b = buildings.maps && buildings.maps[mapName];
    bBox.hidden = !b;
    if (!b) return;
    var sides = b.players === "nod" ? ["nod", "gdi"] : ["gdi", "nod"];
    sides.forEach(function (sd) {
      var row = document.createElement("div");
      row.className = "mdw-brow mdw-brow-" + sd;
      var lab = document.createElement("span");
      lab.className = "mdw-bside";
      lab.textContent = sd === "nod" ? "Nod" : "GDI";
      lab.setAttribute("data-tip-name", (sd === "nod" ? "Nod" : "GDI") + (b.players ? (sd === b.players ? ": the players' side" : ": the enemy side") : " buildings"));
      if (b.players && sd === b.players) lab.classList.add("is-players");
      if (b.note) lab.setAttribute("data-tip-extra", b.note);
      row.appendChild(lab);
      (b[sd] || []).forEach(function (entry) {
        var m = String(entry).split("*"), type = (buildings.types || {})[m[0]] || { name: m[0] }, count = +m[1] || 1;
        var it = document.createElement("span");
        it.className = "mdw-building";
        it.setAttribute("data-tip-name", type.name + (count > 1 ? " x" + count : ""));
        if (type.hud) {
          var im = document.createElement("img");
          im.src = hudBase + encodeURI(type.hud + ".png").replace(/&/g, "%26");
          im.alt = type.name;
          it.appendChild(im);
        } else {
          it.classList.add("is-text");
          it.textContent = type.short || type.name.slice(0, 4);
        }
        if (count > 1) {
          var c = document.createElement("span"); c.className = "mdw-bcount"; c.textContent = count; it.appendChild(c);
        }
        row.appendChild(it);
      });
      if (!(b[sd] || []).length) {
        var none = document.createElement("span"); none.className = "mdw-bnone"; none.textContent = "None"; row.appendChild(none);
      }
      rows.appendChild(row);
    });
    terminalTip(bBox).hidden = true;
  }
  // ---- Layering test ("Try out layering system?"): the export's layers stacked over each
  // other (map, units and objects, editor), or one storey on its own. Remembered per browser.
  var layerPanel = dialog.querySelector(".layer-panel");
  var layerImgs = dialog.querySelectorAll(".map-layer-img");
  var layering = { wanted: false, info: {}, on: { empty: true, filled: true, editor: true }, floor: "" };
  try { layering.wanted = localStorage.getItem("mapLayering") === "1"; } catch (e) {}   // off unless picked
  function layerBase(url) { return url.replace(/layers\.json(\?.*)?$/, ""); }
  function clearLayers() {
    Array.prototype.forEach.call(layerImgs, function (im) { im.hidden = true; im.removeAttribute("src"); });
    image.style.visibility = "";
  }
  // Fills the floor list and the layer switches for a map (loads its layers.json once).
  function layerOptions(link, then) {
    var url = link.getAttribute("data-layers");
    var meta = layering.info[url];
    if (!meta) {
      fetch(url).then(function (r) { return r.json(); }).then(function (m) {
        layering.info[url] = m;
        if (links[current] === link) then(link);
      }).catch(function () {});
      return null;
    }
    var floorSel = layerPanel.querySelector("[data-layer-floor]");
    var keep = layering.floor;
    floorSel.textContent = "";
    floorSel.appendChild(new Option("All floors", ""));
    (meta.floors || []).forEach(function (f) { floorSel.appendChild(new Option(f.n + ": " + f.name, String(f.n))); });
    if (!(meta.floors || []).some(function (f) { return String(f.n) === keep; })) keep = "";
    floorSel.value = layering.floor = keep;
    var hasEditor = (meta.layers || []).indexOf("editor") >= 0;
    layerPanel.querySelector('[data-layer-has="editor"]').hidden = !hasEditor;
    var lq = layerPanel.querySelector(".layer-quality");
    if (lq) lq.hidden = !link.getAttribute("data-hd");
    return meta;
  }
  function applyLayers(link) {
    var url = link.getAttribute("data-layers"), base = layerBase(url);
    var meta = layerOptions(link, applyLayers);
    if (!meta) return;
    var floor = layering.floor;
    // Details: High uses the big layer pictures (layers/<map>/hd/) where they exist.
    var big = quality === "high" && !!link.getAttribute("data-hd");
    function src(key) { return base + (big && (meta.hd_layers || []).indexOf(key) >= 0 ? "hd/" : "") + key + ".webp"; }
    // One storey on its own (it has the map and the units together), or the stack.
    image.src = src(floor ? "floor-" + floor : "empty");
    image.style.visibility = floor || layering.on.empty ? "" : "hidden";
    Array.prototype.forEach.call(layerImgs, function (im) {
      var key = im.getAttribute("data-layer");
      var show = !floor && layering.on[key] && (meta.layers || []).indexOf(key) >= 0;
      im.hidden = !show;
      if (show) im.src = src(key); else im.removeAttribute("src");
    });
    Array.prototype.forEach.call(layerPanel.querySelectorAll("[data-layer-toggle]"), function (c) { c.disabled = !!floor; });
  }
  // The floor picker on the map: picking a floor turns the layering test on and shows that
  // floor (and its marks); "All" is the whole map again.
  var floorWidget = makeFloorWidget(function (f) {
    if (f && !layering.wanted) {
      layering.wanted = true;
      try { localStorage.setItem("mapLayering", "1"); } catch (e) {}
      if (layerPanel) layerPanel.querySelector("[data-layer-try]").checked = true;
    }
    layering.floor = marksFloor = f;
    show(current);
  });
  var fwViewport = dialog.querySelector(".map-dialog-viewport");
  if (fwViewport) fwViewport.appendChild(floorWidget.el);
  function updateFloorWidget(link, view) {
    var url = view === "map" && link && link.getAttribute("data-layers");
    if (!url) { floorWidget.set([]); return; }
    var meta = layering.info[url];
    if (!meta) {
      fetch(url).then(function (r) { return r.json(); }).then(function (m) {
        layering.info[url] = m;
        if (links[current] === link) updateFloorWidget(link, view);
      }).catch(function () {});
      floorWidget.set([]);
      return;
    }
    floorWidget.set(meta.floors, layering.wanted ? layering.floor : "");
  }
  if (layerPanel) {
    var tryBox = layerPanel.querySelector("[data-layer-try]");
    tryBox.checked = layering.wanted;
    layerPanel.querySelector(".layer-opts").hidden = !layering.wanted;
    tryBox.addEventListener("change", function () {
      layering.wanted = tryBox.checked;
      try { localStorage.setItem("mapLayering", layering.wanted ? "1" : "0"); } catch (e) {}
      layerPanel.querySelector(".layer-opts").hidden = !layering.wanted;
      show(current);
    });
    Array.prototype.forEach.call(layerPanel.querySelectorAll("[data-layer-toggle]"), function (c) {
      c.addEventListener("change", function () { layering.on[c.getAttribute("data-layer-toggle")] = c.checked; show(current); });
    });
    // Picking a floor to look at also shows only that floor's marks.
    layerPanel.querySelector("[data-layer-floor]").addEventListener("change", function (e) { layering.floor = marksFloor = e.target.value; show(current); });
    // Clicks on the panel aren't map drags.
    layerPanel.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    layerPanel.addEventListener("dblclick", function (e) { e.stopPropagation(); });
  }
  var purchase = { maps: {}, flying: [] };
  try { purchase = JSON.parse((document.getElementById("purchase-data") || {}).textContent || "{}") || purchase; } catch (e) {}
  function pageTemplate(side, page, mapName) {
    var doc = dialog.ownerDocument;
    return doc.querySelector('template.terminal-template[data-side="' + side + '"][data-page="' + page + '"][data-map="' + mapName + '"]') ||
      doc.querySelector('template.terminal-template[data-side="' + side + '"][data-page="' + page + '"]:not([data-map])');
  }
  function showTerminal(row) {
    var kind = row && row.getAttribute("data-terminal");
    var f = row && row.getAttribute("data-faction");
    var side = /nod/i.test(f || "") ? "nod" : "gdi";
    var tpl = dialog.ownerDocument.querySelector('template.terminal-template[data-side="' + side + '"]:not([data-page])');
    var flyingMap = (purchase.flying || []).indexOf(row && row.getAttribute("data-map")) >= 0;
    Array.prototype.forEach.call(terminalBoxes, function (box) {
      var grid = box.querySelector(".terminal-grid");
      var head = box.querySelector(".terminal-page-head");
      grid.textContent = "";
      if (head) head.hidden = true;
      box.classList.remove("is-page");
      box.hidden = !kind || !tpl;
      if (box.hidden) return;
      grid.appendChild(tpl.content.cloneNode(true));
      terminalTip(box).hidden = true;
      box.classList.toggle("is-none", kind === "none");
      Array.prototype.forEach.call(grid.children, function (tile) {
        var lbl = tile.querySelector(".terminal-label");
        if (!tile.querySelector(".terminal-cost")) {   // Characters / Vehicles: an empty price bar, so every card looks the same
          var bar = document.createElement("span"); bar.className = "terminal-cost"; tile.insertBefore(bar, lbl);
        }
        var slot = tile.getAttribute("data-slot"), off = null;
        if (kind === "none") off = "";
        else if (slot === "vehicles" && kind === "vehicles-destroyed") off = "Destroyed";
        else if (slot === "vehicles" && kind === "no-vehicles") off = "Not on this map";
        else if (slot === "beacon" && noBeacons) off = "Not sold here";
        // The map's own changes (_data/purchase.yml maps:), e.g. the co-op maps' "Not for sale".
        var mapName = row.getAttribute("data-map");
        var own = (purchase.maps && purchase.maps[mapName] && purchase.maps[mapName][side]) || {};
        var num = Array.prototype.indexOf.call(grid.children, tile) + 1;
        if (off === null && (own.main_off || []).indexOf(num) >= 0) off = "Not for sale";
        if (off !== null) {
          tile.classList.add("is-off");
          tile.querySelector(".terminal-state").textContent = off;
        }
        // What used to be the note under the cards is now in each card's hover card.
        var why = kind === "none" ? TERMINAL_NOTES.none
          : slot === "vehicles" && off !== null ? TERMINAL_NOTES[kind]
          : slot === "beacon" && noBeacons ? "Beacons aren't sold on this server."
          : off === "Not for sale" ? "This map takes it off the terminal."
          : "";
        if (why) tile.setAttribute("data-tip-extra", why);
        // Characters and Vehicles open their page in the same box, like the game.
        var pageTpl = (slot === "characters" || slot === "vehicles") && off === null && pageTemplate(side, slot, mapName);
        if (pageTpl) {
          tile.classList.add("is-link");
          tile.tabIndex = 0;
          tile.setAttribute("role", "button");
          tile.setAttribute("data-tip-extra", "Click to see the " + slot +
            (slot === "vehicles" && !flyingMap ? ". No helicopters: this map doesn't allow flying units." : "."));
          var open = function () { openPage(box, pageTpl, slot === "characters" ? "Characters" : "Vehicles", row); };
          tile.addEventListener("click", open);
          tile.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
        }
      });
    });
    return !!kind;
  }
  // A small styled card with the unit's name (and price) above the card you point at.
  function terminalTip(box) {
    if (box._tip) return box._tip;
    var tip = box._tip = document.createElement("div");
    tip.className = "terminal-tip";
    tip.hidden = true;
    box.appendChild(tip);
    var grid = box;
    var ITEMS = ".terminal-tile, [data-tip-name]";
    function show(tile) {
      var label = tile.querySelector(".terminal-label");
      var name = { textContent: tile.getAttribute("data-tip-name") || (label ? label.textContent : "") };
      if (!name.textContent) { tip.hidden = true; return; }
      var cost = (tile.querySelector(".terminal-cost") || {}).textContent || "";
      var state = (tile.querySelector(".terminal-state") || {}).textContent || "";
      var extra = tile.getAttribute("data-tip-extra");
      tip.textContent = "";
      var n = document.createElement("strong"); n.textContent = name.textContent; tip.appendChild(n);
      if (cost) { var c = document.createElement("span"); c.className = "terminal-tip-cost"; c.textContent = cost === "0" ? "Free" : cost + " credits"; tip.appendChild(c); }
      if (state) { var st = document.createElement("span"); st.className = "terminal-tip-state"; st.textContent = state; tip.appendChild(st); }
      if (extra) { var e = document.createElement("span"); e.className = "terminal-tip-extra"; e.textContent = extra; tip.appendChild(e); }
      tip.hidden = false;
      var b = box.getBoundingClientRect(), r = tile.getBoundingClientRect();
      var left = r.left - b.left + r.width / 2 - tip.offsetWidth / 2;
      left = Math.max(0, Math.min(b.width - tip.offsetWidth, left));
      var top = r.top - b.top - tip.offsetHeight - 6;
      if (top < 0) top = r.bottom - b.top + 6;
      tip.style.left = left + "px"; tip.style.top = top + "px";
    }
    grid.addEventListener("mouseover", function (e) { var t = e.target.closest(ITEMS); if (t && box.contains(t)) show(t); else tip.hidden = true; });
    grid.addEventListener("mouseleave", function () { tip.hidden = true; });
    grid.addEventListener("focusin", function (e) { var t = e.target.closest(ITEMS); if (t) show(t); });
    grid.addEventListener("focusout", function () { tip.hidden = true; });
    return tip;
  }
  function openPage(box, pageTpl, title, row) {
    var grid = box.querySelector(".terminal-grid");
    var head = box.querySelector(".terminal-page-head");
    grid.textContent = "";
    grid.appendChild(pageTpl.content.cloneNode(true));
    // Helicopters only on maps that allow flying units.
    var flying = (purchase.flying || []).indexOf(row.getAttribute("data-map")) >= 0;
    Array.prototype.forEach.call(grid.querySelectorAll(".is-flying"), function (t) { if (!flying) t.remove(); });
    Array.prototype.forEach.call(grid.querySelectorAll(".terminal-label"), function (l) {
      var t = l.parentNode, looks = t.getAttribute("data-looks"), art = t.getAttribute("data-art");
      var extra = [];
      if (looks) extra.push(looks + " looks");
      if (art) extra.push("Card art: " + art);
      if (extra.length) t.setAttribute("data-tip-extra", extra.join(" · "));
    });
    box.classList.add("is-page");
    terminalTip(box).hidden = true;
    // The building icons: their name in the hover card; the Power Plant also says what losing it does.
    Array.prototype.forEach.call(grid.querySelectorAll(".terminal-building"), function (b, i) {
      var img = b.querySelector("img");
      b.setAttribute("data-tip-name", img ? img.alt : "");
      if (img) img.removeAttribute("title");
      b.setAttribute("data-tip-extra", i === 0 ? "Prices double while your Power Plant is down." : "Needed to buy from this page.");
    });
    if (title === "Vehicles" && !flying) {
      var firstCard = grid.querySelector(".terminal-tile");
      if (firstCard) Array.prototype.forEach.call(grid.querySelectorAll(".terminal-tile"), function (t) {
        if (!t.getAttribute("data-tip-extra")) t.setAttribute("data-tip-extra", "No helicopters on this map: it doesn't allow flying units.");
      });
    }
    if (head) {
      head.hidden = false;
      head.querySelector(".terminal-page-title").textContent = title;
      head.querySelector(".terminal-back").onclick = function () { showTerminal(row); };
    }
  }
  // Map / in-game photo switch (one button next to the name, like "Show Photo" / "Show In-Game Map").
  // Views of a map: its map image, the in-game photo, and the game's loading screen.
  // The one picked stays picked while stepping through the maps (when the map has it).
  var viewsBox = dialog.querySelector(".map-dialog-views");
  var viewButtons = viewsBox ? viewsBox.querySelectorAll("[data-view]") : [];
  var wantView = "map";
  // Quality: maps with a high-resolution copy (assets/images/maps/hd/) show the normal
  // picture by default, while the high one downloads and decodes in the background.
  // "Quality: High" shows it (with a progress bar while it's still coming in) drawn on a
  // canvas: only the part on screen is drawn, from the decoded picture, so zooming and
  // moving stay sharp straight away instead of waiting for the browser to redraw.
  // The choice is remembered in this browser.
  var qualityBtns = dialog.querySelectorAll("[data-quality]");
  var quality = "normal";
  try { if (localStorage.getItem("mapDetails") === "high") quality = "high"; } catch (e) {}
  var hdCanvas = dialog.querySelector(".map-dialog-hd");
  var hdCtx = hdCanvas && hdCanvas.getContext ? hdCanvas.getContext("2d") : null;
  var progressBox = dialog.querySelector(".map-dialog-progress");
  var hdState = {};      // url -> { loaded, total, ready, failed, pic }
  var hdUrl = null;      // the high-resolution picture of the map on screen (when Quality is High)
  var hdMap = false;     // the map on screen has a high-detail copy: zoom as far as High allows, on Low too
  function mb(n) { return (n / 1048576).toFixed(1); }
  function preloadHd(url) {
    if (hdState[url]) return;
    var st = hdState[url] = { loaded: 0, total: 0, ready: false, failed: false, pic: null };
    var decode = function (blob) {
      st.decoding = true; hdProgress();
      if (window.createImageBitmap) return createImageBitmap(blob);
      return new Promise(function (ok, bad) {
        var im = new Image(); im.onload = function () { ok(im); }; im.onerror = bad; im.src = URL.createObjectURL(blob);
      });
    };
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      st.total = +res.headers.get("content-length") || 0;
      if (!res.body || !res.body.getReader) return res.blob();
      var reader = res.body.getReader(), chunks = [];
      var pump = function () {
        return reader.read().then(function (r) {
          if (r.done) return new Blob(chunks, { type: "image/webp" });
          chunks.push(r.value); st.loaded += r.value.length; hdProgress();
          return pump();
        });
      };
      return pump();
    }).then(decode).then(function (pic) {
      st.pic = pic; st.ready = true; hdRefresh();
    }).catch(function () { st.failed = true; hdRefresh(); });
  }
  // The progress bar over the map while the high-resolution picture is on its way.
  function hdProgress() {
    if (!progressBox) return;
    var st = hdUrl && hdState[hdUrl];
    var show = !!(st && !st.ready);
    progressBox.hidden = !show;
    if (!show) return;
    var bar = progressBox.querySelector(".map-dialog-progress-bar span");
    var text = progressBox.querySelector(".map-dialog-progress-text");
    if (st.failed) { bar.style.width = "0"; text.textContent = "The high-quality map couldn't be loaded; showing the normal one."; return; }
    if (st.decoding) { bar.style.width = "100%"; text.textContent = "Preparing the high-quality map..."; return; }
    var pct = st.total ? Math.min(100, Math.round(st.loaded / st.total * 100)) : 0;
    bar.style.width = (st.total ? pct : 15) + "%";
    progressBox.classList.toggle("is-unknown", !st.total);
    text.textContent = "Loading the high-quality map... " + (st.total ? pct + "% (" + mb(st.loaded) + " / " + mb(st.total) + " MB)" : mb(st.loaded) + " MB");
  }
  // Canvas on or off for the map on screen, then draw.
  function hdRefresh() {
    var st = hdUrl && hdState[hdUrl];
    var on = !!(st && st.ready && hdCtx);
    if (hdCanvas) hdCanvas.hidden = !on;
    image.style.visibility = on ? "hidden" : "";
    // Low and High zoom just as far (Low gets blurry; that's the viewer's choice), so the
    // zoom level and position stay put when switching between them.
    zoom.setMax(hdMap ? 10 : 4);
    hdProgress();
    hdDraw();
  }
  function hdDraw() {
    var st = hdUrl && hdState[hdUrl];
    if (!hdCtx || !st || !st.ready || hdCanvas.hidden) return;
    var vw = viewport.clientWidth, vh = viewport.clientHeight, dpr = window.devicePixelRatio || 1;
    var cw = Math.round(vw * dpr), ch = Math.round(vh * dpr);
    if (hdCanvas.width !== cw || hdCanvas.height !== ch) { hdCanvas.width = cw; hdCanvas.height = ch; }
    hdCtx.setTransform(1, 0, 0, 1, 0, 0);
    hdCtx.clearRect(0, 0, cw, ch);
    var iw = image.naturalWidth, ih = image.naturalHeight;
    if (!iw || !ih || !vw || !vh) return;
    // Where the picture sits in the box (scaled to fit, centred), then the zoom on top.
    var fit = Math.min(vw / iw, vh / ih), w = iw * fit, h = ih * fit;
    var z = zoom.state();
    var dx = (z.tx + z.scale * (vw - w) / 2) * dpr, dy = (z.ty + z.scale * (vh - h) / 2) * dpr;
    var dw = z.scale * w * dpr, dh = z.scale * h * dpr;
    // Zoomed out, the normal picture is sharp enough (and quicker to draw).
    var pic = dw <= iw * 1.25 ? image : st.pic;
    var pw = pic.naturalWidth || pic.width, ph = pic.naturalHeight || pic.height;
    // Only the part that's on screen.
    var x0 = Math.max(0, dx), y0 = Math.max(0, dy), x1 = Math.min(cw, dx + dw), y1 = Math.min(ch, dy + dh);
    if (x1 <= x0 || y1 <= y0) return;
    var sx = (x0 - dx) / dw * pw, sy = (y0 - dy) / dh * ph, sw = (x1 - x0) / dw * pw, sh = (y1 - y0) / dh * ph;
    hdCtx.imageSmoothingEnabled = true;
    hdCtx.imageSmoothingQuality = "high";
    hdCtx.drawImage(pic, sx, sy, sw, sh, x0, y0, x1 - x0, y1 - y0);
  }
  Array.prototype.forEach.call(qualityBtns, function (b) { b.addEventListener("click", function () {
    if (b.disabled) return;
    quality = b.getAttribute("data-quality") === "high" ? "high" : "normal";
    try { localStorage.setItem("mapDetails", quality); } catch (e) {}
    show(current);
  }); });
  Array.prototype.forEach.call(viewButtons, function (b) {
    b.addEventListener("click", function () { wantView = b.getAttribute("data-view"); zoom.reset(); show(current); });
  });
  // Loading screens (_data/loadscreens.yml): picture + the text the game draws on it (640x480 grid).
  var screens = [];
  try { screens = JSON.parse((document.getElementById("loadscreens-data") || {}).textContent || "[]") || []; } catch (e) {}
  var screensBase = dialog.getAttribute("data-loadscreens-base") || "";
  var lsText = dialog.querySelector(".loadscreen-text");
  function screenFor(name) {
    return screens.find(function (sc) { return (sc.maps || []).indexOf(name) >= 0; }) || null;
  }
  function fileUrl(base, name) { return base + encodeURI(name).replace(/&/g, "%26"); }
  function fillLoadscreen(sc) {
    if (!lsText) return;
    lsText.textContent = "";
    lsText.hidden = !sc;
    if (!sc) return;
    (sc.lines || []).forEach(function (l) {
      var d = document.createElement("div");
      d.className = "ls-line" + (l.big ? " is-big" : "");
      d.style.left = (l.x / 640 * 100) + "%";
      d.style.top = (l.y / 480 * 100) + "%";
      d.style.color = l.color || "#fff";
      if (l.w) { d.style.width = (l.w / 640 * 100) + "%"; d.style.whiteSpace = "normal"; }
      d.textContent = l.text;
      lsText.appendChild(d);
    });
  }
  var navButtons = dialog.querySelectorAll("[data-map-step]");
  var current = 0;
  // The image and its marks sit on one "canvas" that zooms and pans as a whole.
  var canvas = dialog.querySelector(".map-dialog-canvas") || image;
  var zoom = makeZoom(dialog.querySelector(".map-dialog-viewport"), canvas, dialog.querySelector(".map-dialog-zoom-level"), function () { placePop(); hdDraw(); if (marksLayer) { MapMarks.spread(marksLayer); drawLines(); } });

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
  var drawLines = function () {};
  var shownMarks = [];       // the marks of the map on screen (for the cards' links)   // arrows and links of the marks on screen (set by showMarks)
  var marksFloor = "";       // marks of one floor only ("" = all floors); marks without a floor always show
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
    if (lsText) {
      lsText.style.left = marksLayer.style.left; lsText.style.top = marksLayer.style.top;
      lsText.style.width = marksLayer.style.width; lsText.style.height = marksLayer.style.height;
    }
    MapMarks.spread(marksLayer);
    drawLines();
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
    var pog = k === "objective" && mark.pog ? MapMarks.pogInfo(mark.pog) : null;
    var iconLabel = k !== "objective" && mark.icon ? MapMarks.iconName(mark.icon) : "";
    t.textContent = mark.label || (pog && pog.name) || iconLabel || info.label;
    head.appendChild(t);
    if (pog && !mark.label) {
      var pk = document.createElement("span");
      pk.className = "map-mark-pop-kind";
      pk.textContent = (pog.kind === "side" ? "Secondary" : "Primary") + " objective" + (pog.action ? " (" + pog.action + ")" : "");
      head.appendChild(pk);
    }
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
    var facts = [];
    if (MapMarks.COUNTED[k]) facts.push("Amount: " + MapMarks.countText(mark));
    if (mark.floor) facts.push("Floor " + mark.floor);
    // What it leads to (links:) and what leads to it.
    var here = shownMarks, to = [], from = [];
    (Array.isArray(mark.links) ? mark.links : []).forEach(function (id) { here.forEach(function (o) { if (o.id === id) to.push(MapMarks.name(o)); }); });
    if (mark.id) here.forEach(function (o) { if ((o.links || []).indexOf(mark.id) >= 0) from.push(MapMarks.name(o)); });
    if (to.length) facts.push("Leads to: " + to.join(", "));
    if (from.length) facts.push("From: " + from.join(", "));
    if (facts.length) {
      var fp = document.createElement("p"); fp.className = "map-mark-pop-facts"; fp.textContent = facts.join(" \u00b7 ");
      pop.appendChild(fp);
    }
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
    var visible = function (m) {
      return !hiddenKinds[MapMarks.kind(m.kind)] && !(marksFloor && m.floor && String(m.floor) !== marksFloor);
    };
    drawLines = function () { MapMarks.lines(marksLayer, marks, visible); };
    shownMarks = marks;
    marks.forEach(function (mark) {
      if (typeof mark.x !== "number" || typeof mark.y !== "number") return;
      var k = MapMarks.kind(mark.kind);
      counts[k] = (counts[k] || 0) + 1;
      if (MapMarks.LINES[k]) return;         // drawn as a line (drawLines)
      var btn = MapMarks.marker(mark);
      btn._mark = mark;
      btn.hidden = !!hiddenKinds[k] || !!(marksFloor && mark.floor && String(mark.floor) !== marksFloor);
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
      // Which floor's marks to show, when any mark here says its floor.
      var floors = {};
      marks.forEach(function (m) { if (m.floor) floors[m.floor] = 1; });
      var fl = Object.keys(floors).map(Number).sort(function (a, b) { return a - b; });
      if (fl.length) {
        var meta = layering.info[link.getAttribute("data-layers")];
        var names = {};
        ((meta && meta.floors) || []).forEach(function (f) { names[f.n] = f.name; });
        var lab = document.createElement("label"); lab.className = "map-mark-floor"; lab.textContent = "Floor ";
        var sel = document.createElement("select");
        sel.appendChild(new Option("All floors", ""));
        fl.forEach(function (n) { sel.appendChild(new Option(n + (names[n] ? ": " + names[n] : ""), String(n))); });
        if (marksFloor && !floors[marksFloor]) marksFloor = "";
        sel.value = marksFloor;
        sel.addEventListener("change", function () { marksFloor = sel.value; showMarks(link, noMarks); });
        lab.appendChild(sel);
        marksBar.appendChild(lab);
      }
      // Keeps its space (visibility) so the box doesn't change height between maps.
      marksBar.style.visibility = marksBar.children.length ? "" : "hidden";
    }
    layoutMarks();
  }
  if (pop) pop.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
  if (pop) pop.addEventListener("wheel", function (e) { e.stopPropagation(); });
  // Clicking the map (not a mark) closes a pinned card.
  canvas.addEventListener("click", function (e) { if (pinned && !e.target.closest(".map-mark")) hidePop(); });
  image.addEventListener("load", function () { layoutMarks(); hdDraw(); });
  dialog.querySelectorAll("[data-zoom]").forEach(function (b) {
    b.addEventListener("click", function () { zoom[b.getAttribute("data-zoom")](); });
  });

  navButtons.forEach(function (b) { b.hidden = links.length < 2; });

  // "Now playing" badge in the preview's top-right corner, when the map shown
  // is the one the live status says is being played.
  var nowBadge = dialog.querySelector(".map-dialog-now");
  // "Now playing" in the tags row, and the player count right after the map's name,
  // when the map on screen is the one the server is playing.
  var playersTag = document.createElement("span");
  playersTag.className = "now-playing map-dialog-players";
  // "New" right after the name, for maps new on the server (new: in _data/maps.yml).
  var newTag = document.createElement("span");
  newTag.className = "badge-pulse badge-new map-dialog-new";
  newTag.innerHTML = '<span class="badge-dot" aria-hidden="true"></span>New';
  // "Next" when the map on screen comes up after the one being played (see markCurrentMap).
  var nextTag = document.createElement("span");
  nextTag.className = "badge-pulse badge-next map-dialog-new";
  nextTag.innerHTML = '<span class="badge-dot" aria-hidden="true"></span>Next';
  nextTag.title = "Comes up after the map being played now";
  function updateNowPlaying() {
    var row = links[current] && links[current].closest("tr");
    var playing = !!(row && row.classList.contains("is-current"));
    nowBadge.hidden = !playing;
    dialog.classList.toggle("is-now-playing", playing);
    // Map name, then "5 / 36 players", then "Now playing".
    var headline = dialog.querySelector(".map-dialog-headline");
    var players = playing && row.getAttribute("data-players");
    playersTag.textContent = players ? players + " players" : "";
    playersTag.title = players && /nod/i.test(row.getAttribute("data-faction") || "") ? "On Nod maps the server can report 0 players while people are playing." : "";
    if (headline) {
      var isNew = links[current] && links[current].getAttribute("data-new");
      if (isNew) { newTag.title = "New on the server since " + ordinalDate(isNew); headline.appendChild(newTag); } else if (newTag.parentNode) newTag.remove();
      if (players) headline.appendChild(playersTag); else if (playersTag.parentNode) playersTag.remove();
      headline.appendChild(nowBadge);
      if (row && row.classList.contains("is-next") && !playing) headline.appendChild(nextTag); else if (nextTag.parentNode) nextTag.remove();
    }
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
    updateNowPlaying();
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
          zoom.refresh();
        }
      };
      probe.src = l.getAttribute("href");
    });
  }
  window.addEventListener("resize", function () { if (dialog.open) { measureTitles(); fitViewport(); zoom.refresh(); matchSideHeight(); layoutMarks(); } });

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
        // GDI / Nod show as the big logo behind the title (below); any other side as a badge.
        if (key === "other") {
          var b = document.createElement("span");
          b.className = "team-badge team-other";
          b.textContent = f;
          factionBox.appendChild(b);
        }
      }
      // The side's banner behind the title, and the preview in the side's colours.
      var banner = dialog.querySelector(".map-dialog-banner");
      var side = f && (/nod/i.test(f) ? "nod" : /gdi/i.test(f) ? "gdi" : null);
      dialog.classList.toggle("faction-nod", side === "nod");
      dialog.classList.toggle("faction-gdi", side === "gdi");
      if (banner) {
        var url = side && dialog.getAttribute("data-banner-" + side);
        banner.style.backgroundImage = url ? 'url("' + url + '")' : "none";
        banner.hidden = !url;
      }
      var emblem = dialog.querySelector(".map-dialog-emblem");
      if (emblem) {
        emblem.style.backgroundImage = url ? 'url("' + url + '")' : "none";
        emblem.hidden = !url;
        emblem.title = side ? (side === "nod" ? "Nod" : "GDI") + " map" : "";
      }
      if (link.closest("tr") && link.closest("tr").hasAttribute("data-scalable")) {
        var sd = document.createElement("span");
        sd.className = "map-tag";
        sd.textContent = "Scalable difficulty";
        factionBox.appendChild(sd);
      }
    }
    // Which views this map has, and which one to show.
    var photo = link.getAttribute("data-ingame");
    var sc = screenFor(mapName);
    var srcs = {
      map: hasImage(link) ? link.getAttribute("href") : null,
      photo: hasImage(link) && photo ? photo : null,
      loading: sc && sc.image ? fileUrl(screensBase, sc.image) : null
    };
    // The picked view when this map has it, else the map (a map without a map image shows
    // "No map data" until another view is picked).
    var view = srcs[wantView] ? wantView : (srcs.map ? "map" : null);
    var available = Object.keys(srcs).filter(function (k) { return srcs[k]; });
    if (viewsBox) {
      // Always the same buttons in the same place; the ones this map doesn't have are greyed out.
      viewsBox.hidden = false;
      Array.prototype.forEach.call(viewButtons, function (b) {
        var v = b.getAttribute("data-view");
        b.hidden = false;
        b.disabled = !srcs[v];
        b.title = srcs[v] ? "" : (v === "map" ? "No map picture for this map yet" : v === "photo" ? "No in-game photo for this map yet" : "No loading screen for this map");
        b.setAttribute("aria-pressed", String(v === view));
      });
    }
    var showPhoto = view === "photo";
    var hd = view === "map" && link.getAttribute("data-hd");
    Array.prototype.forEach.call(qualityBtns, function (b) {
      var high = b.getAttribute("data-quality") === "high";
      b.setAttribute("aria-pressed", String(hd ? high === (quality === "high") : !high));
      b.disabled = high && !hd;
    });
    var qBox = dialog.querySelector(".map-quality");
    if (qBox) qBox.title = hd ? "" : (view === "map" ? "There's no high-detail picture for this map yet." : "Details is for the map picture.");
    // The layering test needs Details: High.
    var tryBox = layerPanel && layerPanel.querySelector("[data-layer-try]");
    // The layering test works with Low and High (each has its own layer pictures).
    var canLayer = !!(view === "map" && link.getAttribute("data-layers"));
    if (tryBox) { tryBox.disabled = !canLayer; layerPanel.classList.toggle("is-disabled", !canLayer); }
    // The high-resolution picture: fetched in the background, drawn on the canvas once it's
    // ready when Quality is High (see hdRefresh).
    if (hd) preloadHd(hd);
    // The layering test only has normal-quality pictures; with everything on and all floors
    // it's the same as the finished map, so the high-quality picture is used then.
    var layersDefault = !layering.floor && layering.on.empty && layering.on.filled && layering.on.editor;
    // With everything on and all floors it's just the finished map, so that's shown instead.
    var layered = layering.wanted && canLayer && !layersDefault;
    hdUrl = hd && quality === "high" && !layered ? hd : null;
    hdMap = !!hd;
    var withImage = !!view;
    fillLoadscreen(view === "loading" ? sc : null);
    dialog.classList.toggle("is-loadscreen", view === "loading");
    if (withImage) {
      image.src = srcs[view];
      if (layered) applyLayers(link); else {
        clearLayers();
        if (layering.wanted && canLayer && view === "map" && link.getAttribute("data-layers")) layerOptions(link, function (l) { layerOptions(l, function () {}); });
      }
      updateFloorWidget(link, view);
      if (layerPanel) {
        layerPanel.hidden = !(view === "map" && link.getAttribute("data-layers"));
        layerPanel.querySelector(".layer-opts").hidden = !(layering.wanted && canLayer);
      }
      image.alt = (view === "photo" ? "In-game view of " : view === "loading" ? "Loading screen of " : "Overhead map of ") + mapName;
    } else {
      image.removeAttribute("src");
      image.alt = "";
      zoom.reset();
      floorWidget.set([]);
    }
    image.hidden = !withImage;
    if (!withImage) { clearLayers(); if (layerPanel) layerPanel.hidden = true; }
    showMarks(link, view !== "map");
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
    var secretLis = link.closest("tr") ? link.closest("tr").querySelectorAll(".map-secret-weapons li") : [];
    var cardSecret = dialog.querySelector(".mdw-secret-list");
    if (cardSecret) {
      cardSecret.textContent = "";
      Array.prototype.forEach.call(secretLis, function (li) { cardSecret.appendChild(li.cloneNode(true)); });
      dialog.querySelector(".mdw-secret-none").hidden = !!secretLis.length;
    }
    var cardOnmap = dialog.querySelector(".mdw-onmap-list");
    if (cardOnmap) {
      cardOnmap.textContent = "";
      Array.prototype.forEach.call(onmap, function (li) { cardOnmap.appendChild(li.cloneNode(true)); });
      dialog.querySelector(".mdw-onmap-none").hidden = !!onmap.length;
    }
    showWTab();
    var hasTerminal = showTerminal(link.closest("tr"));
    if (termFold) termFold.hidden = !hasTerminal;
    showBuildings(mapName);
    if (belowWeapons) belowWeapons.hidden = !weapons.length && !onmap.length && !hasTerminal;
    if (belowObjTitle) belowObjTitle.hidden = !steps.length;
    below.hidden = !steps.length && !weapons.length && !onmap.length && !hasTerminal;
    if (side) {
      sideList.textContent = "";
      Array.prototype.forEach.call(steps, function (li) { sideList.appendChild(li.cloneNode(true)); });
      sideList.hidden = !steps.length;
      sideNone.hidden = !!steps.length;
    }
    var url = view === "loading" ? null : link.getAttribute(showPhoto ? "data-ingame-credit-url" : "data-credit-url");
    var who = view === "loading" ? "the game's own files" : link.getAttribute(showPhoto ? "data-ingame-credit-name" : "data-credit-name");
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
    setUrl(mapName, view);
    // The zoom level and position carry over from map to map (Reset or 0 to undo).
    if (!dialog.open) {
      dialog.showModal();
      sizeToLargest();
    }
    fitViewport();
    zoom.refresh();
    matchSideHeight();
    layoutMarks();
    hdRefresh();
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
      var own = e.target.closest("a, button, details");     // links and the objectives toggle in the row handle their own clicks
      if (own && row.contains(own)) return;                  // (the table itself sits in a <details> panel)
      if (window.getSelection && String(window.getSelection())) return; // don't fight text selection
      show(i);
    });
  });

  dialog.querySelector(".map-dialog-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("close", hidePop);
  dialog.addEventListener("close", function () { setUrl(null); });

  // The address follows the preview (?map=M01&view=loading), so a copied link opens the
  // same map and view; closing the preview takes them out again.
  function setUrl(name, view) {
    try {
      var u = new URL(location.href);
      if (name) {
        u.searchParams.set("map", name);
        if (view && view !== "map") u.searchParams.set("view", view); else u.searchParams.delete("view");
      } else {
        u.searchParams.delete("map");
        u.searchParams.delete("view");
      }
      var next = u.pathname + u.search + u.hash;
      if (next !== location.pathname + location.search + location.hash) history.replaceState(history.state, "", next);
    } catch (e) {}
  }
  (function openFromUrl() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var name = (q.get("map") || "").toLowerCase();
    if (!name) return;
    var i = links.findIndex(function (l) { return (l.getAttribute("data-map-name") || "").toLowerCase() === name; });
    if (i < 0) { setUrl(null); return; }
    var v = q.get("view");
    if (v === "photo" || v === "loading" || v === "map") wantView = v;
    show(i);
  })();
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
    if (e.key === "PageUp" || e.key === "PageDown") { if (floorWidget.step(e.key === "PageUp" ? 1 : -1)) e.preventDefault(); }
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
  var MIN = 1, MAX = 4; // the map images are 512px, so more than 4x is just blurry (setMax for bigger ones)
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
    refresh: apply,
    setMax: function (m) { MAX = m; if (scale > MAX) { var c = center(); zoomAt(MAX, c.x, c.y); } },
    state: function () { return { scale: scale, tx: tx, ty: ty }; }
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

  function markCurrentMap(name, players) {
    document.querySelectorAll("tr.is-current").forEach(function (tr) { tr.classList.remove("is-current"); tr.removeAttribute("data-players"); });
    document.querySelectorAll("tr .now-playing, tr .badge-next").forEach(function (b) { b.remove(); });
    document.querySelectorAll("tr.is-next").forEach(function (tr) { tr.classList.remove("is-next"); });
    if (!name) return;
    // The map after it in the rotation (the first one again after the last).
    var rows = Array.prototype.slice.call(document.querySelectorAll(".map-table tbody tr[data-map]"));
    rows.forEach(function (tr, i) {
      if (!sameMap(tr.getAttribute("data-map"), name)) return;
      var nx = rows[(i + 1) % rows.length];
      if (!nx || nx.classList.contains("is-next")) return;
      nx.classList.add("is-next");
      var nb = document.createElement("span");
      nb.className = "badge-pulse badge-next";
      nb.innerHTML = '<span class="badge-dot" aria-hidden="true"></span>Next';
      nb.title = "Comes up after the map being played now";
      (nx.querySelector(".now-cell") || nx.cells[0]).appendChild(nb);
    });
    document.querySelectorAll("tr[data-map]").forEach(function (tr) {
      if (!sameMap(tr.getAttribute("data-map"), name)) return;
      tr.classList.add("is-current");
      if (players) tr.setAttribute("data-players", players);
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
    label.className = "map-chip";
    var code = document.createElement("code");
    code.textContent = preview ? preview.getAttribute("data-map-name") : name.replace(/^C&C_/, "");
    code.title = name;
    label.appendChild(code);
    if (preview) {
      label.href = preview.getAttribute("href");
      label.title = "Open the map preview";
      label.addEventListener("click", function (e) { e.preventDefault(); preview.click(); });
    }
    mapEl.appendChild(label);
    if (preview && preview.getAttribute("data-new")) {
      var nt = document.createElement("span");
      nt.className = "badge-pulse badge-new";
      nt.innerHTML = '<span class="badge-dot" aria-hidden="true"></span>New';
      nt.title = "New on the server since " + ordinalDate(preview.getAttribute("data-new"));
      mapEl.appendChild(nt);
    }
    showObjectives(row);
    showNext(name);
    if (row) {
      var note = document.createElement("span");
      note.className = "live-map-note";
      note.textContent = (row.querySelector(".map-desc") || row.cells[3]).textContent.trim();
      mapEl.appendChild(note);
      var extra = row.querySelector(".map-note-extra");
      if (extra) { var ex = el("span", "live-map-note live-map-note-extra"); ex.innerHTML = extra.innerHTML; mapEl.appendChild(ex); }
    }
  }

  // The next map in the rotation (both possibilities when the current one is in it twice).
  function showNext(name) {
    var wrap = box.querySelector(".live-next-wrap"), dd = box.querySelector(".live-next");
    if (!wrap) return;
    var rows = Array.prototype.slice.call(document.querySelectorAll(".map-table tbody tr[data-map]")), next = [];
    rows.forEach(function (tr, i) {
      if (!name || !sameMap(tr.getAttribute("data-map"), name)) return;
      var nx = rows[(i + 1) % rows.length];
      if (nx && next.indexOf(nx) < 0) next.push(nx);
    });
    dd.textContent = "";
    next.forEach(function (tr, k) {
      if (k) dd.appendChild(document.createTextNode(" or "));
      var link = tr.querySelector(".map-link"), a = document.createElement(link ? "a" : "span");
      a.className = "map-chip";
      var c = document.createElement("code"); c.textContent = tr.getAttribute("data-map"); a.appendChild(c);
      if (link) { a.href = link.getAttribute("href"); a.title = "Open the map preview"; a.addEventListener("click", function (e) { e.preventDefault(); link.click(); }); }
      dd.appendChild(a);
    });
    if (next.length) {
      var nb = document.createElement("span");
      nb.className = "badge-pulse badge-next live-next-badge";
      nb.innerHTML = '<span class="badge-dot" aria-hidden="true"></span>Next';
      nb.title = "Comes up after the map being played now";
      dd.appendChild(nb);
    }
    wrap.hidden = !next.length;
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
      source.appendChild(document.createTextNode("Live from the server itself · checked " + serverClock(when, box.getAttribute("data-utc-offset")) +
        (mins ? ", " + mins + " min ago" : ", just now") + " · new check every ~5 minutes"));
    } else {
      source.appendChild(document.createTextNode("Fallback: live data from "));
      var a = el("a", null, cncnetName); a.href = cncnetUrl;
      source.appendChild(a);
      source.appendChild(document.createTextNode(" · last checked " + serverClock(when, box.getAttribute("data-utc-offset")) + " · refreshes every minute"));
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
    markCurrentMap(server.mapname, playersEl.textContent);
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
              n.textContent = "The server didn't answer the last check (" + serverClock(d.checked, box.getAttribute("data-utc-offset")) + ").";
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
              n.textContent = "The server didn't answer the last check (" + serverClock(d.checked, box.getAttribute("data-utc-offset")) + ").";
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
