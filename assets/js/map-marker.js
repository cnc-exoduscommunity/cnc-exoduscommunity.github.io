// Map marker tool (/tools/map-marker/): place marks on the map images and get the
// text for _data/map_marks.yml. Everything stays in the browser: work in progress
// is kept in localStorage until the site's data catches up with it.
(function () {
  var $ = function (sel) { return document.querySelector(sel); };
  var mapSelect = $("[data-mm-map]");
  if (!mapSelect || typeof MapMarks === "undefined" || typeof makeZoom === "undefined") return;

  var DRAFT_KEY = "map-marker-draft";
  var MAP_KEY = "map-marker-map";
  var base = window.MAP_MARKS_BASE || "/assets/images/marks/";
  var stage = $("[data-mm-stage]"), image = $("[data-mm-image]"), layer = $("[data-mm-marks]");
  var viewport = $("[data-mm-viewport]"), canvas = $("[data-mm-canvas]");
  var editor = $("[data-mm-editor]"), noSelect = $("[data-mm-noselect]");
  var listEl = $("[data-mm-list]"), countEl = $("[data-mm-count]");
  var imagesEl = $("[data-mm-images]"), posEl = $("[data-mm-pos]");
  var output = $("[data-mm-output]");
  var fields = {};
  document.querySelectorAll("[data-mm-f]").forEach(function (f) { fields[f.getAttribute("data-mm-f")] = f; });

  // ---- Data ----
  var siteData = {};
  try { siteData = JSON.parse($("#map-marks-data").textContent || "{}") || {}; } catch (e) {}
  if (typeof siteData !== "object" || Array.isArray(siteData)) siteData = {};
  var data = clone(siteData);
  try {
    var draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (draft && typeof draft === "object" && !Array.isArray(draft)) data = draft;
  } catch (e) {}
  var localFiles = {};   // pictures picked in this visit: file name -> preview URL

  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function round(n) { return Math.round(n * 10) / 10; }
  function clamp(n) { return Math.max(0, Math.min(100, n)); }

  // Only the fields the site uses, in a fixed order, without empty ones.
  function tidy(m) {
    var out = { kind: MapMarks.kind(m.kind) };
    if (m.id && String(m.id).trim()) out.id = String(m.id).trim();
    out.x = round(clamp(+m.x || 0)); out.y = round(clamp(+m.y || 0));
    if (out.kind === "arrow") { out.x2 = round(clamp(+m.x2 || 0)); out.y2 = round(clamp(+m.y2 || 0)); }
    if (out.kind === "objective" && m.pog) out.pog = String(m.pog);
    if (out.kind !== "objective" && m.icon) out.icon = String(m.icon);
    if (+m.floor > 0) out.floor = Math.round(+m.floor);
    if (MapMarks.COUNTED[out.kind] && +m.count > 0) out.count = Math.round(+m.count);
    if (m.label && String(m.label).trim()) out.label = String(m.label).trim();
    if (m.note && String(m.note).trim()) out.note = String(m.note).trim();
    var links = (Array.isArray(m.links) ? m.links : []).map(function (s) { return String(s).trim(); }).filter(Boolean);
    if (links.length && out.kind !== "arrow") out.links = links;
    var imgs = (Array.isArray(m.images) ? m.images : []).map(function (s) { return String(s).trim(); }).filter(Boolean);
    if (imgs.length) out.images = imgs;
    return out;
  }
  function tidyAll(d) {
    var out = {};
    Object.keys(d).forEach(function (k) {
      if (Array.isArray(d[k]) && d[k].length) out[k] = d[k].map(tidy);
    });
    return out;
  }
  function same(a, b) { return JSON.stringify(sortKeys(tidyAll(a))) === JSON.stringify(sortKeys(tidyAll(b))); }
  function sortKeys(o) { var r = {}; Object.keys(o).sort().forEach(function (k) { r[k] = o[k]; }); return r; }

  function save() {
    var changed = !same(data, siteData);
    try {
      if (changed) localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    var box = $("[data-mm-draft]");
    box.hidden = !changed;
    if (changed) $("[data-mm-draft-text]").textContent =
      "You have changes that aren't on the site yet (kept in this browser). Copy the text at the bottom into _data/map_marks.yml to add them.";
    writeOutput();
  }

  // ---- YAML out ----
  var HEADER = [
    "# Map marks: spots shown on a map's overhead image in the map preview.",
    "# Made with the Map marker tool (/tools/map-marker/ on the site): place the marks",
    "# there, then copy its text over this whole file.",
    "#",
    "# One entry per map (the map's name, as in _data/maps.yml), with a list of marks:",
    "#   kind:   objective | spawn | secret | vehicle | pickup | other | note | arrow",
    "#   pog:    objectives only: the game's objective picture (e.g. m01_1_02, see _data/objective_pogs.yml)",
    "#   icon:   other kinds, optional: a HUD icon shown instead of the symbol: a pickup or the",
    "#           GDI / Nod logo (e.g. hud_cd_rom, hud_health3, hud_c&c_gdilogo; see _data/pickups.yml)",
    "#   floor:  optional, the floor it's on (1 = the top, as in the layering); without it, every floor",
    "#   count:  secrets, vehicles, pickups, other: how many it gives; without it (or 0), infinite",
    "#   id:     optional, a short name other marks can link to (e.g. keycard-1)",
    "#   links:  optional, the ids of marks this one leads to, drawn as a dash-dot line",
    "#           (e.g. an objective that gives a keycard: links: [keycard-1])",
    "#   x2, y2: arrows only: where the arrow points to (x, y is where it starts)",
    "#   x, y:   where on the image, in percent (0-100) from the left / top edge",
    "#   label:  optional, a short name shown on hover (e.g. \"GDI start\")",
    "#   note:   optional, a longer text shown under the label",
    "#   images: optional, pictures shown on hover / click, in this order; files in",
    "#           assets/images/marks/ (e.g. Islands_secret_1.webp)",
    "#",
    "# Example:",
    "#   Islands:",
    "#     - { kind: spawn, x: 18.5, y: 72.0, label: \"GDI start\" }",
    "#     - { kind: secret, x: 61.2, y: 33.4, label: \"Hidden crate\", images: [\"Islands_crate_1.webp\"] }"
  ].join("\n");
  function q(s) { return JSON.stringify(String(s)); }   // a JSON string is a valid YAML string
  function key(s) { return /^[A-Za-z0-9_.-]+$/.test(s) ? s : q(s); }
  function num(n) { return n.toFixed(1); }
  function yaml() {
    var d = tidyAll(data);
    // Rotation order first (as in the tool's list), then anything else.
    var order = Array.prototype.map.call(mapSelect.options, function (o) { return o.value; });
    var keys = order.filter(function (k) { return d[k]; })
      .concat(Object.keys(d).filter(function (k) { return order.indexOf(k) < 0; }).sort());
    if (!keys.length) return HEADER + "\n{}\n";
    return HEADER + "\n\n" + keys.map(function (k) {
      return key(k) + ":\n" + d[k].map(function (m) {
        var parts = ["kind: " + m.kind];
        if (m.id) parts.push("id: " + key(m.id));
        parts.push("x: " + num(m.x), "y: " + num(m.y));
        if (m.kind === "arrow") parts.push("x2: " + num(m.x2), "y2: " + num(m.y2));
        if (m.pog) parts.push("pog: " + m.pog);
        if (m.icon) parts.push("icon: " + q(m.icon));
        if (m.floor) parts.push("floor: " + m.floor);
        if (m.count) parts.push("count: " + m.count);
        if (m.label) parts.push("label: " + q(m.label));
        if (m.note) parts.push("note: " + q(m.note));
        if (m.links) parts.push("links: [" + m.links.map(key).join(", ") + "]");
        if (m.images) parts.push("images: [" + m.images.map(q).join(", ") + "]");
        return "  - { " + parts.join(", ") + " }";
      }).join("\n");
    }).join("\n\n") + "\n";
  }
  function writeOutput() { output.value = yaml(); }

  // ---- Kinds ----
  var addKind = "spawn";
  var kindsBox = $("[data-mm-kinds]");
  MapMarks.ORDER.forEach(function (k) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "map-mark-chip mm-kind";
    b.setAttribute("data-kind", k);
    b.innerHTML = '<span class="map-mark-dot map-mark-' + k + '">' + MapMarks.icon(k) + "</span>";
    b.appendChild(document.createTextNode(MapMarks.KINDS[k].label));
    b.addEventListener("click", function () { addKind = k; if (mode !== "place") setMode("place"); markKinds(); renderPlace(); });
    kindsBox.appendChild(b);
    var o = document.createElement("option");
    o.value = k; o.textContent = MapMarks.KINDS[k].label;
    fields.kind.appendChild(o);
  });
  function markKinds() {
    kindsBox.querySelectorAll(".mm-kind").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-kind") === addKind));
    });
  }
  markKinds();

  // ---- Mode: Select (clicks pick marks) or Place (clicks add the chosen kind) ----
  var mode = "place";
  try { if (localStorage.getItem("map-marker-mode") === "select") mode = "select"; } catch (e) {}
  var placeField = $("[data-mm-placefield]"), placeOpts = $("[data-mm-placeopts]");
  function setMode(m) {
    mode = m;
    try { localStorage.setItem("map-marker-mode", m); } catch (e) {}
    document.querySelectorAll("[data-mm-mode]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mm-mode") === m)); });
    // Hidden but keeping their space, so the map doesn't jump.
    placeField.style.visibility = placeOpts.style.visibility = m === "place" ? "" : "hidden";
    stage.classList.toggle("is-select", m === "select");
  }
  document.querySelectorAll("[data-mm-mode]").forEach(function (b) {
    b.addEventListener("click", function () { setMode(b.getAttribute("data-mm-mode")); });
  });

  // What the next mark of each kind will be: an objective picture or an icon (none = plain).
  var placeChoice = {};
  try { placeChoice = JSON.parse(localStorage.getItem("map-marker-place") || "{}") || {}; } catch (e) {}
  var placeNow = $("[data-mm-placenow]"), placePick = $("[data-mm-placepick]");
  function placeGroups(k) {
    if (k === "arrow" || k === "note") return [];
    if (k === "objective") {
      var keys = Object.keys(pogData);
      keys.sort(function (a, b) { return (a === mapName ? -1 : 0) - (b === mapName ? -1 : 0); });
      return keys.map(function (mk) {
        return { title: mk + " - " + (pogData[mk].title || ""), items: (pogData[mk].pogs || []).map(function (p) {
          return { key: p.file.replace(/^pog_/, ""), name: p.name + (p.kind === "side" ? " (secondary)" : ""), src: MapMarks.POG_BASE + p.file + ".png", side: p.kind === "side" };
        }) };
      });
    }
    var groups = MapMarks.icons().filter(function (g) { return k === "pickup" ? g.title !== "Sides" : g.title === "Sides"; });
    return groups.map(function (g) {
      return { title: g.title, items: g.items.map(function (it) { return { key: it.hud, name: it.name, src: MapMarks.iconUrl(it.hud) }; }) };
    });
  }
  function placeName(k, key) {
    if (!key) return "";
    if (k === "objective") { var pi = MapMarks.pogInfo(key); return pi ? pi.name : key; }
    return MapMarks.iconName(key) || key;
  }
  var placeShownFor = null;
  function renderPlace() {
    var k = addKind, cur = placeChoice[k] || "";
    var keepScroll = placeShownFor === k + "|" + mapName ? placePick.scrollTop : 0;
    placeShownFor = k + "|" + mapName;
    var label = MapMarks.KINDS[k].label;
    placeNow.textContent = label + (k === "arrow" ? " (drag on the map from where it starts to where it points)" : k === "note" ? " (a small dot; write the note after placing it)" : cur ? ": " + placeName(k, cur) : k === "pickup" ? " (pick what it is below)" : " (plain symbol)");
    placePick.textContent = "";
    var none = document.createElement("button");
    none.type = "button"; none.className = "mm-place-none"; none.title = "Plain " + label.toLowerCase() + " symbol";
    none.setAttribute("aria-pressed", String(!cur));
    none.innerHTML = '<span class="map-mark-dot map-mark-' + k + '">' + MapMarks.icon(k) + "</span>";
    none.addEventListener("click", function () { delete placeChoice[k]; savePlace(); renderPlace(); });
    placePick.appendChild(none);
    placeGroups(k).forEach(function (g) {
      var h = document.createElement("p"); h.className = "mm-pog-group"; h.textContent = g.title;
      placePick.appendChild(h);
      g.items.forEach(function (it) {
        var b = document.createElement("button");
        b.type = "button"; b.title = it.name;
        b.setAttribute("aria-pressed", String(it.key === cur));
        var img = document.createElement("img"); img.alt = it.name; img.src = it.src;
        b.appendChild(img);
        if (it.side) { var s2 = document.createElement("span"); s2.className = "mm-pog-side"; s2.textContent = "2nd"; b.appendChild(s2); }
        b.addEventListener("click", function () { placeChoice[k] = it.key; savePlace(); renderPlace(); });
        placePick.appendChild(b);
      });
    });
    placePick.scrollTop = keepScroll;
  }
  function savePlace() { try { localStorage.setItem("map-marker-place", JSON.stringify(placeChoice)); } catch (e) {} }

  // ---- Map ----
  var mapName = null, selected = -1, mapOpt = null;
  function marks() { return data[mapName] || (data[mapName] = []); }
  function setMap(name) {
    var opt = Array.prototype.find.call(mapSelect.options, function (o) { return o.value === name; }) || mapSelect.options[0];
    if (!opt) return;
    mapSelect.value = opt.value;
    mapName = opt.value;
    selected = -1;
    mapOpt = opt;
    if (opt.getAttribute("data-layers")) layerMeta(opt.getAttribute("data-layers"));   // its floors
    showFloor = "";
    view();
    renderPlace();
    // The map's side: its GDI / Nod logo next to the list.
    var logo = document.querySelector("[data-mm-side]"), side = opt.getAttribute("data-faction");
    if (logo) {
      var src = side && logo.getAttribute("data-logo-" + side);
      logo.hidden = !src;
      if (src) { logo.src = src; logo.alt = side === "nod" ? "Nod" : "GDI"; logo.title = (side === "nod" ? "Nod" : "GDI") + " map"; }
    }
    image.alt = "Overhead map of " + mapName;
    try { localStorage.setItem(MAP_KEY, mapName); } catch (e) {}
    try {
      var u = new URL(location.href);
      u.searchParams.set("map", mapName);
      history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    } catch (e) {}
    render();
  }
  function optionLabels() {
    Array.prototype.forEach.call(mapSelect.options, function (o) {
      var n = (data[o.value] || []).length;
      var f = o.getAttribute("data-faction");
      o.textContent = o.value + (f === "gdi" ? " [GDI]" : f === "nod" ? " [Nod]" : "") + " - " + o.getAttribute("data-description") + (n ? "  (" + n + " mark" + (n === 1 ? "" : "s") + ")" : "");
    });
  }
  mapSelect.addEventListener("change", function () { setMap(mapSelect.value); });

  // ---- Drawing ----
  var showFloor = "";   // marks of one floor only ("" = all); marks without a floor always show
  function floorHidden(m) { return !!(showFloor && m.floor && String(m.floor) !== showFloor); }
  function render() {
    var list = marks();
    layer.textContent = "";
    list.forEach(function (m, i) {
      if (MapMarks.kind(m.kind) === "arrow") {
        if (i === selected) ["", "2"].forEach(function (end) {   // handles to move each end
          var hd = document.createElement("span");
          hd.className = "mm-handle"; hd.setAttribute("data-end", end); hd.setAttribute("data-index", i);
          hd.style.left = (end ? m.x2 : m.x) + "%"; hd.style.top = (end ? m.y2 : m.y) + "%";
          hd.title = end ? "Drag to move the point" : "Drag to move the start";
          layer.appendChild(hd);
        });
        return;
      }
      var b = MapMarks.marker(m);
      b.hidden = floorHidden(m) && i !== selected;
      b.classList.toggle("is-active", i === selected);
      b.title = MapMarks.name(m) + (linkPick ? " - click to link to it" : " - drag to move");
      b.setAttribute("data-index", i);
      layer.appendChild(b);
    });
    MapMarks.spread(layer);
    var svg = MapMarks.lines(layer, list, function (m) { return !floorHidden(m) || list[selected] === m; });
    var act = svg.querySelector('.map-arrow-hit[data-index="' + selected + '"]');
    if (act) act.classList.add("is-active");
    stage.classList.toggle("is-linking", !!linkPick);
    // The list beside the map: top of the list = drawn last (on top), like layers in an
    // image editor. Drag an item to move it.
    listEl.textContent = "";
    list.map(function (m, i) { return i; }).reverse().forEach(function (i) {
      var m = list[i];
      var li = document.createElement("li");
      li.draggable = true;
      li.setAttribute("data-index", i);
      if (floorHidden(m)) li.classList.add("is-other-floor");
      li.addEventListener("dragstart", function (e) { dragFrom = i; li.classList.add("is-dragging"); try { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; } catch (x) {} });
      li.addEventListener("dragend", function () { dragFrom = -1; li.classList.remove("is-dragging"); });
      li.addEventListener("dragover", function (e) { if (dragFrom < 0) return; e.preventDefault(); li.classList.add("is-drop"); });
      li.addEventListener("dragleave", function () { li.classList.remove("is-drop"); });
      li.addEventListener("drop", function (e) { e.preventDefault(); li.classList.remove("is-drop"); moveMark(dragFrom, i); });
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mm-list-item" + (i === selected ? " is-selected" : "");
      var k = MapMarks.kind(m.kind);
      b.innerHTML = '<span class="map-mark-dot map-mark-' + k + '">' + MapMarks.icon(k) + "</span>";
      var t = document.createElement("span");
      t.className = "mm-list-name";
      t.textContent = MapMarks.name(m);
      b.appendChild(t);
      var meta = document.createElement("span");
      meta.className = "mm-list-meta";
      var n = (m.images || []).length;
      meta.textContent = num(+m.x) + ", " + num(+m.y) + (n ? " · " + n + " picture" + (n === 1 ? "" : "s") : "");
      b.appendChild(meta);
      b.addEventListener("click", function () { select(i); });
      li.appendChild(b);
      listEl.appendChild(li);
    });
    countEl.textContent = list.length ? "(" + list.length + ")" : "";
    if (!list.length) {
      var li = document.createElement("li");
      li.className = "hint mm-list-empty";
      li.textContent = "None yet.";
      listEl.appendChild(li);
    }
    fillFloors(showSel, "All floors");
    showSel.value = showFloor;
    renderEditor();
    optionLabels();
    save();
  }
  function select(i) { selected = i; render(); }
  var dragFrom = -1;
  function moveMark(from, to) {
    var list = marks();
    if (from < 0 || from === to || !list[from]) return;
    var sel = list[selected];
    var m = list.splice(from, 1)[0];
    list.splice(to, 0, m);
    selected = sel ? list.indexOf(sel) : -1;
    render();
  }

  var shown = null;   // the mark the editor shows
  function renderEditor() {
    var m = marks()[selected];
    editor.hidden = !m;
    noSelect.hidden = !!m;
    if (!m) { shown = null; return; }
    // Leave a field alone while it's being typed in, unless another mark was picked.
    var fresh = shown !== m;
    shown = m;
    if (fresh || document.activeElement !== fields.kind) fields.kind.value = MapMarks.kind(m.kind);
    if (fresh || document.activeElement !== fields.label) fields.label.value = m.label || "";
    if (fresh || document.activeElement !== fields.note) fields.note.value = m.note || "";
    posEl.textContent = "x " + num(+m.x) + "%, y " + num(+m.y) + "% (from the top left)";
    fillFloors(floorField, "Every floor (not set)");
    floorField.value = m.floor ? String(m.floor) : "";
    countField.hidden = !MapMarks.COUNTED[MapMarks.kind(m.kind)];
    if (fresh || document.activeElement !== countInput) countInput.value = +m.count > 0 ? String(+m.count) : "";
    renderPogs(m);
    renderIcons(m);
    renderLinks(m);
    // Pictures, with a preview: a picked file, or the file on the site.
    imagesEl.textContent = "";
    (m.images || []).forEach(function (name, i, all) {
      var li = document.createElement("li");
      li.className = "mm-image";
      var img = document.createElement("img");
      img.alt = "";
      img.src = localFiles[name] || MapMarks.imageUrl(base, name);
      img.onerror = function () { li.classList.add("is-missing"); img.removeAttribute("src"); };
      li.appendChild(img);
      var nm = document.createElement("span");
      nm.className = "mm-image-file";
      nm.textContent = name;
      nm.title = localFiles[name] ? "Picked from your computer - copy it into assets/images/marks/" : "assets/images/marks/" + name;
      li.appendChild(nm);
      var tools = document.createElement("span");
      tools.className = "mm-image-tools";
      [["&#8593;", "Move up", -1], ["&#8595;", "Move down", 1], ["&#10005;", "Remove", 0]].forEach(function (t) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "btn btn-small"; b.innerHTML = t[0]; b.title = t[1]; b.setAttribute("aria-label", t[1]);
        if ((t[2] < 0 && i === 0) || (t[2] > 0 && i === all.length - 1)) b.disabled = true;
        b.addEventListener("click", function () {
          var list = m.images;
          if (t[2] === 0) list.splice(i, 1);
          else { var j = i + t[2]; var tmp = list[i]; list[i] = list[j]; list[j] = tmp; }
          if (!list.length) delete m.images;
          render();
        });
        tools.appendChild(b);
      });
      li.appendChild(tools);
      imagesEl.appendChild(li);
    });
  }

  // ---- Objective pictures ----
  var pogData = {};
  try { pogData = JSON.parse((document.getElementById("objective-pogs-data") || {}).textContent || "{}") || {}; } catch (e) {}
  var pogField = document.querySelector("[data-mm-pogfield]"), pogBox = document.querySelector("[data-mm-pogs]"), pogName = document.querySelector("[data-mm-pogname]");
  var pogShownFor = null;
  function renderPogs(m) {
    if (!pogField) return;
    var isObj = MapMarks.kind(m.kind) === "objective";
    pogField.hidden = !isObj;
    if (!isObj) return;
    var key = m.pog || "";
    var info = key && MapMarks.pogInfo(key);
    pogName.textContent = info ? info.name + " - " + (info.kind === "side" ? "secondary" : "primary") + (info.action ? " (" + info.action + ")" : "") + (info.note ? " · " + info.note : "") : "Pick a picture (or leave it as a plain objective mark).";
    if (pogShownFor === mapName + "|" + key) return;
    pogShownFor = mapName + "|" + key;
    pogBox.textContent = "";
    // This map's pictures first, then the other missions'.
    var keys = Object.keys(pogData);
    keys.sort(function (a, b) { return (a === mapName ? -1 : 0) - (b === mapName ? -1 : 0); });
    keys.forEach(function (mk) {
      var g = document.createElement("p"); g.className = "mm-pog-group";
      g.textContent = mk + " - " + (pogData[mk].title || "");
      pogBox.appendChild(g);
      (pogData[mk].pogs || []).forEach(function (p) {
        var k = p.file.replace(/^pog_/, "");
        var b = document.createElement("button");
        b.type = "button"; b.title = p.name + (p.kind === "side" ? " (secondary)" : "");
        b.setAttribute("aria-pressed", String(k === key));
        b.innerHTML = '<img alt="" src="' + MapMarks.POG_BASE + p.file + '.png">' + (p.kind === "side" ? '<span class="mm-pog-side">2nd</span>' : "");
        b.addEventListener("click", function () { var mm = marks()[selected]; if (!mm) return; mm.pog = (mm.pog === k ? undefined : k); if (!mm.pog) delete mm.pog; render(); });
        pogBox.appendChild(b);
      });
    });
  }

  // ---- Icons (pickups, GDI / Nod) for the other kinds ----
  var iconField = document.querySelector("[data-mm-iconfield]"), iconBox = document.querySelector("[data-mm-icons]"), iconNameEl = document.querySelector("[data-mm-iconname]");
  var iconShownFor = null;
  function renderIcons(m) {
    if (!iconField) return;
    var show = MapMarks.kind(m.kind) !== "objective" && MapMarks.kind(m.kind) !== "arrow";
    iconField.hidden = !show;
    if (!show) return;
    var key = m.icon || "";
    iconNameEl.textContent = key ? MapMarks.iconName(key) || key : "None: the mark shows its kind's symbol.";
    if (iconShownFor === key && iconBox.children.length) return;
    iconShownFor = key;
    iconBox.textContent = "";
    MapMarks.icons().forEach(function (g) {
      var h = document.createElement("p"); h.className = "mm-pog-group"; h.textContent = g.title;
      iconBox.appendChild(h);
      g.items.forEach(function (it) {
        var b = document.createElement("button");
        b.type = "button"; b.title = it.name;
        b.setAttribute("aria-pressed", String(it.hud === key));
        var img = document.createElement("img"); img.alt = it.name; img.src = MapMarks.iconUrl(it.hud);
        b.appendChild(img);
        b.addEventListener("click", function () {
          var mm = marks()[selected]; if (!mm) return;
          if (mm.icon === it.hud) delete mm.icon; else mm.icon = it.hud;
          render();
        });
        iconBox.appendChild(b);
      });
    });
  }

  // ---- Links (this mark leads to another one) and ids ----
  var linkPick = false;
  var linksField = $("[data-mm-linksfield]"), linksList = $("[data-mm-links]"), linkBtn = $("[data-mm-linkadd]"), linkHint = $("[data-mm-linkhint]"), idInput = $("[data-mm-id]");
  function slug(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "mark"; }
  function ensureId(m) {
    if (m.id) return m.id;
    var base = slug(MapMarks.name(m)), id = base, n = 2;
    while (marks().some(function (o) { return o.id === id; })) id = base + "-" + n++;
    m.id = id;
    return id;
  }
  function addLink(targetIndex) {
    var m = marks()[selected], t = marks()[targetIndex];
    linkPick = false;
    if (!m || !t || t === m || MapMarks.kind(t.kind) === "arrow") { render(); return; }
    var id = ensureId(t);
    m.links = (m.links || []).filter(function (x) { return x !== id; }).concat([id]);
    render();
  }
  function renderLinks(m) {
    var isArrow = MapMarks.kind(m.kind) === "arrow";
    linksField.hidden = isArrow;
    if (document.activeElement !== idInput) idInput.value = m.id || "";
    if (isArrow) return;
    linksList.textContent = "";
    (m.links || []).forEach(function (id) {
      var t = marks().filter(function (o) { return o.id === id; })[0];
      var li = document.createElement("li");
      var nm = document.createElement("span"); nm.textContent = t ? MapMarks.name(t) : id + " (not on this map)"; if (!t) li.classList.add("is-missing");
      var x = document.createElement("button"); x.type = "button"; x.className = "btn btn-small"; x.innerHTML = "&#10005;"; x.title = "Remove this link"; x.setAttribute("aria-label", "Remove this link");
      x.addEventListener("click", function () { m.links = m.links.filter(function (v) { return v !== id; }); if (!m.links.length) delete m.links; render(); });
      li.appendChild(nm); li.appendChild(x); linksList.appendChild(li);
    });
    linkBtn.textContent = linkPick ? "Cancel" : "Link to a mark…";
    linkHint.hidden = !linkPick;
  }
  linkBtn.addEventListener("click", function () { linkPick = !linkPick; render(); });
  idInput.addEventListener("change", function () {
    var m = marks()[selected]; if (!m) return;
    var old = m.id, v = idInput.value.trim() ? slug(idInput.value) : "";
    if (v && marks().some(function (o) { return o !== m && o.id === v; })) { idInput.value = old || ""; return; }
    if (v) m.id = v; else delete m.id;
    if (old) marks().forEach(function (o) { if (o.links) { o.links = o.links.map(function (x) { return x === old ? v : x; }).filter(Boolean); if (!o.links.length) delete o.links; } });
    render();
  });

  // ---- Floor and amount ----
  var floorField = $("[data-mm-floor]"), countField = $("[data-mm-countfield]"), countInput = $("[data-mm-amount]"), showSel = $("[data-mm-showfloor]");
  // The map's floors, from its layers.json (or 1-8 when it has none).
  function floorList() {
    var lay = mapOpt && mapOpt.getAttribute("data-layers"), meta = lay && layering.info[lay];
    if (meta && meta !== "loading" && (meta.floors || []).length) return meta.floors;
    return [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return { n: n, name: "" }; });
  }
  function fillFloors(sel, first) {
    var want = JSON.stringify(floorList()) + first;
    if (sel._for === want) return;
    sel._for = want;
    var keep = sel.value;
    sel.textContent = "";
    sel.appendChild(new Option(first, ""));
    floorList().forEach(function (f) { sel.appendChild(new Option(f.n + (f.name ? ": " + f.name : ""), String(f.n))); });
    sel.value = keep;
  }
  floorField.addEventListener("change", function () {
    var m = marks()[selected]; if (!m) return;
    if (floorField.value) m.floor = +floorField.value; else delete m.floor;
    render();
  });
  countInput.addEventListener("input", function () {
    var m = marks()[selected]; if (!m) return;
    var v = Math.round(+countInput.value);
    if (v > 0) m.count = v; else delete m.count;
    render();
  });
  showSel.addEventListener("change", function () { showFloor = showSel.value; render(); });

  // ---- Editing the selected mark ----
  ["kind", "label", "note"].forEach(function (f) {
    fields[f].addEventListener("input", function () {
      var m = marks()[selected];
      if (!m) return;
      m[f] = fields[f].value;
      if (f !== "kind" && !m[f]) delete m[f];
      render();
    });
  });
  $("[data-mm-delete]").addEventListener("click", function () { removeSelected(); });
  function removeSelected() {
    if (selected < 0) return;
    var gone = marks().splice(selected, 1)[0];
    if (gone && gone.id) marks().forEach(function (o) {
      if (o.links) { o.links = o.links.filter(function (id) { return id !== gone.id; }); if (!o.links.length) delete o.links; }
    });
    selected = -1;
    render();
  }
  function addImages(names) {
    var m = marks()[selected];
    if (!m || !names.length) return;
    m.images = (m.images || []).concat(names);
    render();
  }
  $("[data-mm-pick]").addEventListener("change", function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    files.forEach(function (f) { localFiles[f.name] = URL.createObjectURL(f); });
    addImages(files.map(function (f) { return f.name; }));
    e.target.value = "";
  });
  var nameInput = $("[data-mm-image-name]");
  function addByName() {
    var v = nameInput.value.trim();
    if (!v) return;
    nameInput.value = "";
    addImages([v]);
  }
  $("[data-mm-image-add]").addEventListener("click", addByName);
  nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addByName(); } });

  // ---- Placing and dragging on the map ----
  // The map box zooms and pans like the map preview (makeZoom in site.js): scroll or pinch
  // to zoom, drag the map to move it. A click (no drag) adds a mark; dragging a mark moves it.
  function toPercent(e) {
    var r = stage.getBoundingClientRect();
    return { x: round(clamp((e.clientX - r.left) / r.width * 100)), y: round(clamp((e.clientY - r.top) / r.height * 100)) };
  }
  var drag = null, touching = 0;
  viewport.addEventListener("pointerdown", function () { touching++; if (touching > 1 && drag && drag.index < 0) drag.cancel = true; }, true);
  stage.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    var markEl = e.target.closest(".map-mark"), hit = e.target.closest(".map-arrow-hit"), handle = e.target.closest(".mm-handle");
    // Picking the mark a link goes to.
    if (linkPick) {
      e.stopPropagation(); e.preventDefault();
      if (markEl) addLink(Number(markEl.getAttribute("data-index")));
      return;
    }
    var p = toPercent(e);
    if (handle || hit || markEl) {
      e.stopPropagation();                    // a mark: move it, don't move the map
      viewport.setPointerCapture(e.pointerId);
    }
    var index = markEl ? Number(markEl.getAttribute("data-index")) : hit ? Number(hit.getAttribute("data-index")) : handle ? Number(handle.getAttribute("data-index")) : -1;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, index: index, el: markEl, start: p,
             end: handle ? handle.getAttribute("data-end") : null };
    if (index >= 0) { var m0 = marks()[index]; drag.orig = { x: +m0.x, y: +m0.y, x2: +m0.x2, y2: +m0.y2 }; }
    // Place mode with Arrow: drag on the map to draw one.
    if (index < 0 && mode === "place" && addKind === "arrow") {
      e.stopPropagation();
      viewport.setPointerCapture(e.pointerId);
      drag.draw = true;
    }
    e.preventDefault();
  });
  stage.addEventListener("dblclick", function (e) { e.stopPropagation(); });   // two clicks are two marks, not a zoom
  viewport.addEventListener("pointermove", function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.draw && drag.index < 0) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
    drag.moved = true;
    var p = toPercent(e);
    if (drag.draw) {                      // the arrow being drawn
      if (!drag.temp) { drag.temp = { kind: "arrow", x: drag.start.x, y: drag.start.y }; marks().push(drag.temp); selected = marks().length - 1; }
      drag.temp.x2 = p.x; drag.temp.y2 = p.y;
      render();
      return;
    }
    var m = marks()[drag.index], o = drag.orig;
    if (MapMarks.kind(m.kind) === "arrow") {
      if (drag.end === "") { m.x = p.x; m.y = p.y; }
      else if (drag.end === "2") { m.x2 = p.x; m.y2 = p.y; }
      else {                              // the whole arrow
        var dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        m.x = round(clamp(o.x + dx)); m.y = round(clamp(o.y + dy)); m.x2 = round(clamp(o.x2 + dx)); m.y2 = round(clamp(o.y2 + dy));
      }
      selected = drag.index;
      render();
      return;
    }
    m.x = p.x; m.y = p.y;
    drag.el.style.left = p.x + "%";
    drag.el.style.top = p.y + "%";
    MapMarks.lines(layer, marks(), function (mm) { return !floorHidden(mm) || marks()[selected] === mm; });
    if (drag.index === selected) posEl.textContent = "x " + num(p.x) + "%, y " + num(p.y) + "% (from the top left)";
  });
  function release(e) {
    touching = Math.max(0, touching - 1);
    if (!drag || drag.id !== e.pointerId) return;
    var d = drag; drag = null;
    if (e.type === "pointercancel") { render(); return; }
    if (d.draw) {
      if (d.temp) { render(); fields.label.focus({ preventScroll: true }); }
      return;
    }
    if (d.index >= 0) { selected = d.index; render(); return; }        // clicked or dragged a mark
    if (d.cancel || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 4) return;     // moved the map, not a click
    if (mode === "select") { if (selected >= 0) { selected = -1; render(); } return; }   // Select: a click on the map only deselects
    var r = stage.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    var p = toPercent(e);
    var nm = { kind: addKind, x: p.x, y: p.y }, pick = placeChoice[addKind];
    if (pick && addKind !== "note") { if (addKind === "objective") nm.pog = pick; else nm.icon = pick; }
    marks().push(nm);
    selected = marks().length - 1;
    render();
    fields.label.focus({ preventScroll: true });
  }
  viewport.addEventListener("pointerup", release);
  viewport.addEventListener("pointercancel", release);

  // ---- Zoom, Details (Low / High) and the layering test: as in the map preview ----
  // Remembered with the same settings as the preview (mapDetails, mapLayering).
  var zoom = makeZoom(viewport, canvas, $("[data-mm-zoom-level]"), function () { MapMarks.spread(layer); });
  document.querySelectorAll("[data-mm-zoom]").forEach(function (b) {
    b.addEventListener("click", function () { zoom[b.getAttribute("data-mm-zoom")](); });
  });
  // The map sits in the square box scaled to fit and centred; the marks go on the map itself.
  function fitStage() {
    var iw = image.naturalWidth, ih = image.naturalHeight;
    if (!iw || !ih) return;
    var w = iw >= ih ? 100 : iw / ih * 100, h = iw >= ih ? ih / iw * 100 : 100;
    stage.style.width = w + "%"; stage.style.height = h + "%";
    stage.style.left = (100 - w) / 2 + "%"; stage.style.top = (100 - h) / 2 + "%";
  }
  image.addEventListener("load", fitStage);

  var quality = "normal";
  try { if (localStorage.getItem("mapDetails") === "high") quality = "high"; } catch (e) {}
  var qBtns = document.querySelectorAll("[data-mm-quality]");
  qBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.disabled) return;
      quality = b.getAttribute("data-mm-quality") === "high" ? "high" : "normal";
      try { localStorage.setItem("mapDetails", quality); } catch (e) {}
      view();
    });
  });

  // The high-detail picture: downloaded once per map (with progress), then shown.
  var hdCache = {};
  var hdBox = $("[data-mm-hd-progress]"), hdBar = $("[data-mm-hd-bar]"), hdText = $("[data-mm-hd-text]");
  function mb(n) { return (n / 1048576).toFixed(1); }
  function loadHd(url) {
    if (hdCache[url]) return hdCache[url];
    var st = hdCache[url] = { loaded: 0, total: 0, src: null, failed: false };
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      st.total = +r.headers.get("content-length") || 0;
      if (!r.body || !r.body.getReader) return r.blob();
      var reader = r.body.getReader(), parts = [];
      return (function pump() {
        return reader.read().then(function (x) {
          if (x.done) return new Blob(parts, { type: "image/webp" });
          parts.push(x.value); st.loaded += x.value.length; hdProgress();
          return pump();
        });
      })();
    }).then(function (blob) {
      st.src = URL.createObjectURL(blob);
      if (mapOpt && mapOpt.getAttribute("data-hd") === url) view();
    }).catch(function () { st.failed = true; hdProgress(); });
    return st;
  }
  var hdWaiting = null;
  function hdProgress() {
    var st = hdWaiting && hdCache[hdWaiting];
    hdBox.hidden = !st || !!st.src;
    if (hdBox.hidden) return;
    if (st.failed) { hdBar.style.width = "0"; hdText.textContent = "The high-detail map couldn't be loaded; showing the normal one."; return; }
    var pct = st.total ? Math.min(100, Math.round(st.loaded / st.total * 100)) : 0;
    hdBar.style.width = pct + "%";
    hdText.textContent = "Loading the high-detail map... " + (st.total ? pct + "% (" + mb(st.loaded) + " / " + mb(st.total) + " MB)" : mb(st.loaded) + " MB");
  }

  var layerPanel = $("[data-mm-layers]"), layerImgs = stage.querySelectorAll(".mm-layer-img");
  var tryBox = layerPanel.querySelector("[data-layer-try]"), layerOpts = layerPanel.querySelector(".layer-opts");
  var layering = { wanted: false, info: {}, on: { empty: true, filled: true, editor: true }, floor: "" };
  try { layering.wanted = localStorage.getItem("mapLayering") === "1"; } catch (e) {}
  tryBox.checked = layering.wanted;
  tryBox.addEventListener("change", function () {
    layering.wanted = tryBox.checked;
    try { localStorage.setItem("mapLayering", layering.wanted ? "1" : "0"); } catch (e) {}
    view();
  });
  layerPanel.querySelectorAll("[data-layer-toggle]").forEach(function (c) {
    c.addEventListener("change", function () { layering.on[c.getAttribute("data-layer-toggle")] = c.checked; view(); });
  });
  var floorSel = layerPanel.querySelector("[data-layer-floor]");
  // Looking at one floor also shows only that floor's marks.
  floorSel.addEventListener("change", function () { layering.floor = showFloor = floorSel.value; view(); render(); });
  // A map's layers.json (once): its floors and whether it has the editor layer.
  function layerMeta(url) {
    if (layering.info[url]) return layering.info[url];
    layering.info[url] = "loading";
    fetch(url).then(function (r) { return r.json(); }).then(function (m) {
      layering.info[url] = m;
      if (mapOpt && mapOpt.getAttribute("data-layers") === url) { view(); render(); }
    }).catch(function () { delete layering.info[url]; });
    return null;
  }
  var floorsFor = null;
  function layerOptions(url, meta) {
    if (floorsFor !== url) {
      floorsFor = url;
      floorSel.textContent = "";
      floorSel.appendChild(new Option("All floors", ""));
      (meta.floors || []).forEach(function (f) { floorSel.appendChild(new Option(f.n + ": " + f.name, String(f.n))); });
    }
    if (!(meta.floors || []).some(function (f) { return String(f.n) === layering.floor; })) layering.floor = "";
    floorSel.value = layering.floor;
    layerPanel.querySelector('[data-layer-has="editor"]').hidden = (meta.layers || []).indexOf("editor") < 0;
  }
  function clearLayers() {
    layerImgs.forEach(function (im) { im.hidden = true; im.removeAttribute("src"); });
    image.style.visibility = "";
  }
  function setSrc(src) { if (image.getAttribute("src") !== src) image.src = src; }

  // Shows the chosen map as asked: Low / High, layered or not.
  function view() {
    if (!mapOpt) return;
    var normal = mapOpt.getAttribute("data-image"), hd = mapOpt.getAttribute("data-hd"), lay = mapOpt.getAttribute("data-layers");
    var high = quality === "high" && !!hd;
    qBtns.forEach(function (b) {
      var isHigh = b.getAttribute("data-mm-quality") === "high";
      b.disabled = isHigh && !hd;
      b.setAttribute("aria-pressed", String(isHigh === high));
    });
    var qBox = document.querySelector(".mm-zoom .map-quality");
    if (qBox) qBox.title = hd ? "" : "There's no high-detail picture for this map yet.";
    // Low and High zoom just as far (Low gets blurry; that's your choice), so the zoom
    // stays put when you switch.
    zoom.setMax(hd ? 10 : 4);
    var canLayer = !!lay;   // Low and High each have their own layer pictures
    tryBox.disabled = !canLayer;
    layerPanel.classList.toggle("is-disabled", !canLayer);
    layerPanel.title = lay ? "" : "No layers for this map yet.";
    var meta = canLayer && layering.wanted ? layerMeta(lay) : null;
    layerOpts.hidden = !(layering.wanted && canLayer && meta && meta !== "loading");
    if (!layerOpts.hidden) layerOptions(lay, meta);
    // The layers are normal quality; with everything on and all floors that's just the
    // finished map, so the high-detail picture is shown instead.
    var defaults = !layering.floor && layering.on.empty && layering.on.filled && layering.on.editor;
    var layered = !layerOpts.hidden && !defaults;
    layerPanel.querySelectorAll("[data-layer-toggle]").forEach(function (c) { c.disabled = !!layering.floor; });
    hdWaiting = null;
    if (layered) {
      var base = lay.replace(/layers\.json(\?.*)?$/, ""), floor = layering.floor;
      var src = function (key) { return base + (high && (meta.hd_layers || []).indexOf(key) >= 0 ? "hd/" : "") + key + ".webp"; };
      setSrc(src(floor ? "floor-" + floor : "empty"));
      image.style.visibility = floor || layering.on.empty ? "" : "hidden";
      layerImgs.forEach(function (im) {
        var key = im.getAttribute("data-layer");
        var show = !floor && layering.on[key] && (meta.layers || []).indexOf(key) >= 0;
        im.hidden = !show;
        if (show) { if (im.getAttribute("src") !== src(key)) im.src = src(key); } else im.removeAttribute("src");
      });
    } else {
      clearLayers();
      var st = high ? loadHd(hd) : null;
      if (st && st.src) setSrc(st.src);
      else { setSrc(normal); if (st) hdWaiting = hd; }
    }
    hdProgress();
  }

  // A click outside the map and the side panel clears the selection.
  document.addEventListener("pointerdown", function (e) {
    if (selected < 0) return;
    if (e.target.closest(".mm-stage-wrap, .mm-side, .mm-toolbar, .mm-place-opts, .mm-draft, .mm-out-actions, .mm-output")) return;
    selected = -1; render();
  });

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) {
      if (e.key === "Escape") t.blur();
      return;
    }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoom.in(); return; }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); zoom.out(); return; }
    if (e.key === "0") { e.preventDefault(); zoom.reset(); return; }
    var m = marks()[selected];
    if (e.key === "Escape" && linkPick) { linkPick = false; render(); return; }
    if (e.key === "Escape" && selected >= 0) { selected = -1; render(); return; }
    if (!m) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); return; }
    var step = e.shiftKey ? 1 : 0.2, dx = 0, dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    m.x = round(clamp(+m.x + dx)); m.y = round(clamp(+m.y + dy));
    if (MapMarks.kind(m.kind) === "arrow") { m.x2 = round(clamp(+m.x2 + dx)); m.y2 = round(clamp(+m.y2 + dy)); }
    render();
  });

  // ---- Output ----
  $("[data-mm-copy]").addEventListener("click", function () {
    var done = function () { $("[data-mm-copied]").textContent = "Copied."; setTimeout(function () { $("[data-mm-copied]").textContent = ""; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(output.value).then(done, function () { output.select(); document.execCommand("copy"); done(); });
    } else { output.select(); document.execCommand("copy"); done(); }
  });
  $("[data-mm-download]").addEventListener("click", function () {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([output.value], { type: "text/yaml" }));
    a.download = "map_marks.yml";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $("[data-mm-discard]").addEventListener("click", function () {
    if (!window.confirm("Throw away the changes kept in this browser and start again from the site's marks?")) return;
    data = clone(siteData);
    selected = -1;
    render();
  });

  // Start on ?map=Name, else the last map used, else the first.
  var start = null;
  try { start = new URLSearchParams(location.search).get("map") || localStorage.getItem(MAP_KEY); } catch (e) {}
  setMode(mode);
  setMap(start);
})();
