"""Turn the game's sounds (RenegadeViewer export) into small files for the site's Sounds section.

Usage (from the site's folder):
    python tools/convert_sounds.py Sounds/renegade_sounds_10299 Renegade_Sounds.xlsx [--limit N]

Reads the sound list from the spreadsheet (the viewer's "Download CSV/Excel"), converts
each sound with ffmpeg to AAC (.m4a: mono 40 kbit/s, music 96 kbit/s stereo) into
assets/sounds/<group>/<name>.m4a (group = core, or the map the sound comes from), and
writes assets/sounds/index.json with the details the player shows. Files already
converted are skipped, so it can be run again (or stopped and restarted) any time.
Needs Python 3, openpyxl and ffmpeg.
"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import openpyxl

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, "assets", "sounds")

def main():
    src, xlsx = sys.argv[1], sys.argv[2]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    ws = openpyxl.load_workbook(xlsx, read_only=True)["Sounds"]
    rows = list(ws.iter_rows(values_only=True))
    head = [h for h in rows[0]]
    col = {h: i for i, h in enumerate(head)}
    items, jobs = [], []
    for r in rows[1:]:
        if not r[0]:
            continue
        g = lambda k: r[col[k]] if k in col else None
        path = g("Path") or ""
        parts = path.split("/")            # files/<group>/<name>
        group = parts[1] if len(parts) > 2 else "core"
        name = r[0]
        stem = os.path.splitext(name)[0]
        rel = f"{'core' if group == 'core' else group}/{stem}.m4a"
        inp = os.path.join(src, name) if group == "core" else os.path.join(src, group, name)
        if not os.path.exists(inp):
            inp = os.path.join(src, name)
        music = name.lower().endswith(".mp3")
        items.append({k: v for k, v in {
            "n": name, "c": [c.strip() for c in str(g("Category") or "").split(",") if c.strip()],
            "l": g("Length (s)"), "t": g("Line (transcript)"), "ts": g("Transcript source"),
            "s": g("Said by"), "m": g("Mission"), "id": g("String ID"), "cv": g("Conversation"),
            "u": g("Used by weapons and units"), "f": g("From"), "fm": g("Format"), "hz": g("Sample rate (Hz)"),
            "ch": g("Channels"), "kb": g("Size (KB)"), "a": rel,
        }.items() if v not in (None, "")})
        out = os.path.join(OUT, rel)
        if os.path.exists(inp) and not os.path.exists(out):
            jobs.append((inp, out, music))
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(items, fh, ensure_ascii=False, separators=(",", ":"))
    # Counts per category for the Index and the Sounds section (_data/sound_categories.yml).
    import collections
    cnt = collections.Counter(c for it in items for c in it.get("c", []))
    order = ["Dialogue", "Game subtitles", "No transcript", "EVA", "Voices", "Weapons", "Vehicles", "Music (mp3)", "Other"]
    lines = ["# The in-game sounds (assets/sounds/index.json, made by tools/convert_sounds.py).",
             "# Counts for the Index and the Sounds section; re-made when the sounds are converted again.",
             f"total: {len(items)}", f"minutes: {round(sum(it.get('l') or 0 for it in items) / 60)}", "categories:"]
    for n in order:
        if cnt[n]:
            slug = n.lower().replace(" (mp3)", "").replace(" ", "-")
            lines.append(f'  - {{ name: "{n}", slug: {slug}, count: {cnt[n]} }}')
    with open(os.path.join(SITE, "_data", "sound_categories.yml"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    if limit:
        jobs = jobs[:limit]
    print(f"{len(items)} sounds listed, converting {len(jobs)}", flush=True)
    def run(job):
        inp, out, music = job
        os.makedirs(os.path.dirname(out), exist_ok=True)
        tmp = out + ".part.m4a"
        args = ["ffmpeg", "-loglevel", "error", "-y", "-i", inp, "-vn", "-c:a", "aac"]
        args += ["-b:a", "96k"] if music else ["-ac", "1", "-b:a", "40k"]
        subprocess.run(args + [tmp], check=False)
        if os.path.exists(tmp):
            os.replace(tmp, out)
    with ThreadPoolExecutor(max_workers=os.cpu_count() or 2) as ex:
        for i, _ in enumerate(ex.map(run, jobs), 1):
            if i % 250 == 0:
                print(i, flush=True)
    print("done", flush=True)

if __name__ == "__main__":
    main()
