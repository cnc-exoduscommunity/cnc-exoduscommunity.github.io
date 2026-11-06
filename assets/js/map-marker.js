// Map marker tool (/tools/map-marker/): place marks on the map images and get the
// text for _data/map_marks.yml. Everything stays in the browser: work in progress
// is kept in localStorage until the site's data catches up with it.
(function () {
  var $ = function (sel) { return document.querySelector(sel); };
  var mapSelect = $("[data-mm-map]");
  if (!mapSelect || typeof MapMarks === "undefined") return;

  var DRAFT_KEY = "map-marker-draft";
  var MAP_KEY = "map-marker-map";
  var base = window.MAP_MARKS_BASE || "/assets/images/marks/";
  var stage = $("[data-mm-stage]"), image = $("[data-mm-image]"), layer = $("[data-mm-marks]");
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
    var out = { kind: MapMarks.kind(m.kind), x: round(clamp(+m.x || 0)), y: round(clamp(+m.y || 0)) };
    if (out.kind === "objective" && m.pog) out.pog = String(m.pog);
    if (m.label && String(m.label).trim()) out.label = String(m.label).trim();
    if (m.note && String(m.note).trim()) out.note = String(m.note).trim();
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
    "#   kind:   objective | spawn | secret | vehicle | other",
    "#   pog:    objectives only: the game's objective picture (e.g. m01_1_02, see _data/objective_pogs.yml)",
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
        var parts = ["kind: " + m.kind, "x: " + num(m.x), "y: " + num(m.y)];
        if (m.pog) parts.push("pog: " + m.pog);
        if (m.label) parts.push("label: " + q(m.label));
        if (m.note) parts.push("note: " + q(m.note));
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
    b.addEventListener("click", function () { addKind = k; markKinds(); });
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

  // ---- Map ----
  var mapName = null, selected = -1;
  function marks() { return data[mapName] || (data[mapName] = []); }
  function setMap(name) {
    var opt = Array.prototype.find.call(mapSelect.options, function (o) { return o.value === name; }) || mapSelect.options[0];
    if (!opt) return;
    mapSelect.value = opt.value;
    mapName = opt.value;
    selected = -1;
    image.src = opt.getAttribute("data-image");
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
  function render() {
    var list = marks();
    layer.textContent = "";
    list.forEach(function (m, i) {
      var b = MapMarks.marker(m);
      b.classList.toggle("is-active", i === selected);
      b.title = (m.label || MapMarks.KINDS[MapMarks.kind(m.kind)].label) + " - drag to move";
      b.setAttribute("data-index", i);
      layer.appendChild(b);
    });
    // The list beside the map.
    listEl.textContent = "";
    list.forEach(function (m, i) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mm-list-item" + (i === selected ? " is-selected" : "");
      var k = MapMarks.kind(m.kind);
      b.innerHTML = '<span class="map-mark-dot map-mark-' + k + '">' + MapMarks.icon(k) + "</span>";
      var t = document.createElement("span");
      t.className = "mm-list-name";
      t.textContent = m.label || MapMarks.KINDS[k].label;
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
    renderEditor();
    optionLabels();
    save();
  }
  function select(i) { selected = i; render(); }

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
    renderPogs(m);
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
    marks().splice(selected, 1);
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
  function toPercent(e) {
    var r = stage.getBoundingClientRect();
    return { x: round(clamp((e.clientX - r.left) / r.width * 100)), y: round(clamp((e.clientY - r.top) / r.height * 100)) };
  }
  var drag = null;
  stage.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    var markEl = e.target.closest(".map-mark");
    stage.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false,
             index: markEl ? Number(markEl.getAttribute("data-index")) : -1, el: markEl };
    e.preventDefault();
  });
  stage.addEventListener("pointermove", function (e) {
    if (!drag || drag.id !== e.pointerId || drag.index < 0) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
    drag.moved = true;
    var p = toPercent(e), m = marks()[drag.index];
    m.x = p.x; m.y = p.y;
    drag.el.style.left = p.x + "%";
    drag.el.style.top = p.y + "%";
    if (drag.index === selected) posEl.textContent = "x " + num(p.x) + "%, y " + num(p.y) + "% (from the top left)";
  });
  stage.addEventListener("pointerup", function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var d = drag; drag = null;
    if (d.index >= 0) { selected = d.index; render(); return; }        // clicked or dragged a mark
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 4) return;     // not a click
    var p = toPercent(e);
    marks().push({ kind: addKind, x: p.x, y: p.y });
    selected = marks().length - 1;
    render();
    fields.label.focus();
  });
  stage.addEventListener("pointercancel", function () { drag = null; render(); });

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) {
      if (e.key === "Escape") t.blur();
      return;
    }
    var m = marks()[selected];
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
  setMap(start);
})();
