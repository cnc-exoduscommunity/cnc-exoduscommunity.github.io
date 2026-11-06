// In-game sounds player (Sounds section): a searchable list of every sound in the game
// (assets/sounds/index.json, made by tools/convert_sounds.py), a waveform, playback
// controls and the sound's details. Like RenegadeViewer's Sounds tab, without the
// selecting / downloading. The list loads when the section is first opened.
(function () {
  var box = document.querySelector(".snd");
  if (!box) return;
  var $ = function (s) { return box.querySelector(s); };
  var base = box.getAttribute("data-base");
  var all = [], shown = [], cat = "", query = "", sort = "name", current = null;
  var listEl = $(".snd-list"), inner = $(".snd-list-inner"), shownEl = $(".snd-shown");
  var ROW = 52;                 // row height (px), the list only draws the rows on screen
  var audio = new Audio();
  audio.preload = "auto";
  var opts = { loop: false, auto: true, vol: 0.5 };
  try {
    var saved = JSON.parse(localStorage.getItem("soundPlayer") || "{}");
    if (typeof saved.vol === "number") opts.vol = saved.vol;
    if (typeof saved.loop === "boolean") opts.loop = saved.loop;
    if (typeof saved.auto === "boolean") opts.auto = saved.auto;
  } catch (e) {}
  function saveOpts() { try { localStorage.setItem("soundPlayer", JSON.stringify(opts)); } catch (e) {} }

  // ---- Loading ----
  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    fetch(box.getAttribute("data-sounds")).then(function (r) { return r.json(); }).then(function (data) {
      all = data;
      all.forEach(function (s) {
        s._q = [s.n, s.t, s.s, s.m, s.id, s.cv, s.u].filter(Boolean).join(" ").toLowerCase();
      });
      filter();
      fromHash();
    }).catch(function () { shownEl.textContent = "The sound list couldn't be loaded."; });
  }
  var section = box.closest("details");
  if (section) {
    if (section.open) load();
    section.addEventListener("toggle", function () { if (section.open) load(); });
  } else load();

  // ---- Filtering and the list ----
  function fmt(t) {
    t = Math.max(0, t || 0);
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }
  function filter() {
    var words = query.toLowerCase().split(/\s+/).filter(Boolean);
    shown = all.filter(function (s) {
      if (cat && (s.c || []).indexOf(cat) < 0) return false;
      for (var i = 0; i < words.length; i++) if (s._q.indexOf(words[i]) < 0) return false;
      return true;
    });
    var by = {
      name: function (a, b) { return a.n.localeCompare(b.n); },
      len: function (a, b) { return (b.l || 0) - (a.l || 0); },
      short: function (a, b) { return (a.l || 0) - (b.l || 0); },
      said: function (a, b) { return (a.s || "~").localeCompare(b.s || "~") || a.n.localeCompare(b.n); }
    }[sort];
    shown.sort(by);
    shownEl.textContent = shown.length.toLocaleString() + " of " + all.length.toLocaleString();
    inner.style.height = shown.length * ROW + "px";
    listEl.scrollTop = 0;
    draw();
  }
  function draw() {
    var top = listEl.scrollTop, h = listEl.clientHeight;
    var from = Math.max(0, Math.floor(top / ROW) - 5), to = Math.min(shown.length, Math.ceil((top + h) / ROW) + 5);
    inner.textContent = "";
    for (var i = from; i < to; i++) {
      var s = shown[i];
      var row = document.createElement("div");
      row.className = "snd-row" + (s === current ? " is-current" : "");
      row.style.top = i * ROW + "px";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(s === current));
      row._s = s;
      var name = document.createElement("span"); name.className = "snd-name"; name.textContent = s.n; row.appendChild(name);
      var len = document.createElement("span"); len.className = "snd-len"; len.textContent = s.l != null ? s.l.toFixed(2) + "s" : ""; row.appendChild(len);
      if (s.t || s.s) {
        var line = document.createElement("span"); line.className = "snd-line";
        if (s.s) { var who = document.createElement("strong"); who.textContent = s.s + (s.t ? ": " : ""); line.appendChild(who); }
        if (s.t) line.appendChild(document.createTextNode(s.t));
        row.appendChild(line);
      }
      inner.appendChild(row);
    }
  }
  listEl.addEventListener("scroll", draw);
  window.addEventListener("resize", function () { if (loaded) draw(); });
  inner.addEventListener("click", function (e) {
    var row = e.target.closest(".snd-row");
    if (row) pick(row._s);
  });
  listEl.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    var i = shown.indexOf(current) + (e.key === "ArrowDown" ? 1 : -1);
    if (i < 0) i = 0;
    if (i >= shown.length) return;
    pick(shown[i]);
    var y = i * ROW;
    if (y < listEl.scrollTop) listEl.scrollTop = y;
    else if (y + ROW > listEl.scrollTop + listEl.clientHeight) listEl.scrollTop = y + ROW - listEl.clientHeight;
  });
  var searchTimer;
  $(".snd-search").addEventListener("input", function (e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { query = e.target.value; filter(); }, 150);
  });
  $(".snd-sort").addEventListener("change", function (e) { sort = e.target.value; filter(); });
  function setCat(c) {
    cat = c;
    Array.prototype.forEach.call(box.querySelectorAll(".snd-cat"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-cat") === c)); });
    filter();
  }
  Array.prototype.forEach.call(box.querySelectorAll(".snd-cat"), function (b) {
    b.addEventListener("click", function () { setCat(b.getAttribute("data-cat")); });
  });
  // A link to #sounds-<category> (the Index) picks that category.
  function fromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var b = id && document.getElementById(id);
    if (b && b.classList.contains("snd-cat") && loaded && all.length) setCat(b.getAttribute("data-cat"));
  }
  window.addEventListener("hashchange", function () { load(); fromHash(); });

  // ---- Playing ----
  var playBtn = box.querySelector('[data-snd="play"]'), timeEl = $(".snd-time");
  var canvas = $(".snd-wave canvas"), ctx = canvas.getContext("2d"), peaks = null;
  var actx = null, waveToken = 0;
  audio.volume = opts.vol;
  function pick(s) {
    current = s;
    draw();
    info(s);
    audio.src = base + s.a.split("/").map(encodeURIComponent).join("/");
    audio.loop = opts.loop;
    peaks = null; paint();
    wave(audio.src);
    if (opts.auto) audio.play().catch(function () {});
  }
  function wave(src) {
    var token = ++waveToken;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    fetch(src).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      return new Promise(function (ok, bad) { actx.decodeAudioData(buf, ok, bad); });
    }).then(function (ab) {
      if (token !== waveToken) return;
      var data = ab.getChannelData(0), n = 600, step = Math.max(1, Math.floor(data.length / n));
      peaks = [];
      for (var i = 0; i < n; i++) {
        var mx = 0;
        for (var j = i * step, e = Math.min(data.length, j + step); j < e; j++) { var v = Math.abs(data[j]); if (v > mx) mx = v; }
        peaks.push(mx);
      }
      paint();
    }).catch(function () {});
  }
  function paint() {
    var w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var css = getComputedStyle(box);
    var col = css.getPropertyValue("--snd-wave").trim() || "#4caf50", done = css.getPropertyValue("--snd-wave-done").trim() || "#9cff8a";
    var pos = audio.duration ? audio.currentTime / audio.duration : 0;
    if (!peaks) {
      ctx.fillStyle = col; ctx.globalAlpha = 0.35; ctx.fillRect(0, h / 2 - 0.5, w, 1); ctx.globalAlpha = 1;
    } else {
      var bw = w / peaks.length;
      for (var i = 0; i < peaks.length; i++) {
        var ph = Math.max(1, peaks[i] * (h - 8));
        ctx.fillStyle = i / peaks.length <= pos ? done : col;
        ctx.fillRect(i * bw, (h - ph) / 2, Math.max(1, bw - 0.4), ph);
      }
    }
    if (audio.duration) { ctx.fillStyle = "#fff"; ctx.fillRect(pos * w, 0, 1.5, h); }
    timeEl.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration || (current && current.l) || 0);
  }
  function tick() { paint(); if (!audio.paused) requestAnimationFrame(tick); }
  audio.addEventListener("play", function () { playBtn.textContent = "Pause"; playBtn.classList.add("is-playing"); tick(); });
  audio.addEventListener("pause", function () { playBtn.textContent = "Play"; playBtn.classList.remove("is-playing"); paint(); });
  audio.addEventListener("ended", function () { playBtn.textContent = "Play"; playBtn.classList.remove("is-playing"); paint(); });
  audio.addEventListener("loadedmetadata", paint);
  window.addEventListener("resize", paint);
  canvas.parentNode.addEventListener("click", function (e) {
    if (!audio.duration) return;
    var r = canvas.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration;
    paint();
  });
  box.querySelector(".snd-controls").addEventListener("click", function (e) {
    var b = e.target.closest("[data-snd]");
    if (!b || !current) return;
    var a = b.getAttribute("data-snd");
    if (a === "play") { if (audio.paused) audio.play().catch(function () {}); else audio.pause(); }
    else if (a === "stop") { audio.pause(); audio.currentTime = 0; paint(); }
    else if (a === "back") { audio.currentTime = Math.max(0, audio.currentTime - 2); paint(); }
    else if (a === "fwd") { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 2); paint(); }
  });
  var loopBox = box.querySelector('[data-snd-opt="loop"]'), autoBox = box.querySelector('[data-snd-opt="auto"]'), vol = box.querySelector('[data-snd-opt="vol"]');
  loopBox.checked = opts.loop; autoBox.checked = opts.auto; vol.value = Math.round(opts.vol * 100);
  $(".snd-volv").textContent = vol.value + "%";
  loopBox.addEventListener("change", function () { opts.loop = audio.loop = loopBox.checked; saveOpts(); });
  autoBox.addEventListener("change", function () { opts.auto = autoBox.checked; saveOpts(); });
  vol.addEventListener("input", function () { opts.vol = audio.volume = vol.value / 100; $(".snd-volv").textContent = vol.value + "%"; saveOpts(); });

  // ---- Details ----
  function info(s) {
    var el = $(".snd-info");
    el.textContent = "";
    var h = document.createElement("h4"); h.className = "snd-title"; h.textContent = s.n; el.appendChild(h);
    var dl = document.createElement("dl"); dl.className = "snd-dl";
    function add(k, v, cls) {
      if (v == null || v === "") return;
      var dt = document.createElement("dt"); dt.textContent = k;
      var dd = document.createElement("dd"); if (cls) dd.className = cls;
      if (v instanceof Node) dd.appendChild(v); else dd.textContent = v;
      dl.appendChild(dt); dl.appendChild(dd);
    }
    if (s.t) {
      var line = document.createElement("span");
      var q = document.createElement("em"); q.textContent = "“" + s.t + "”"; line.appendChild(q);
      if (s.ts) { var src = document.createElement("span"); src.className = "muted"; src.textContent = " - " + s.ts.toLowerCase(); line.appendChild(src); }
      add("Line", line);
    } else if ((s.c || []).some(function (c) { return c === "Voices" || c === "EVA" || c === "No transcript"; })) {
      add("Line", "No transcript yet (not in the game's subtitles)", "muted");
    }
    add("Said by", s.s);
    add("Mission", s.m);
    add("Conversation", s.cv);
    add("Used by", s.u);
    add("Categories", (s.c || []).map(function (c) { return c.replace(" (mp3)", ""); }).join(", "));
    add("String", s.id);
    add("From", s.f);
    add("Original", [s.fm, s.ch, s.hz ? s.hz + " Hz" : "", s.kb ? s.kb + " KB" : ""].filter(Boolean).join(", "));
    add("Length", s.l != null ? s.l.toFixed(2) + " s" : "");
    el.appendChild(dl);
  }
})();
