"""Turn the marks RenegadeViewer finds in a map (Data/Marks/marks_<map>.json in a map
export: objectives, spawns, secrets, vehicles, pickups, from the game files) into a guide
for the Map marker tool: assets/marks/<map>.json, with positions in percent of the site's
map picture. The Map marker shows them greyed out; click one to make it a real mark.

Usage (from the site's folder):
    python tools/convert_marks.py "08_11_2026_13_56_45-*"

Needs the "Picture edges" line in the export's layers.txt (RenegadeViewer writes it since
November 2026) and the map converted already (assets/images/maps/layers/<map>/layers.json,
for the box the site's picture was cut to).
"""
import glob, json, os, re, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, "assets", "marks")
KEEP = ("kind", "name", "icon", "pog", "count", "team", "type", "action", "text", "preset")



def map_name(folder):
    """The map file name from an export folder: "<date>-C&C_Mesa" (older exports) or
    "<date>/11_C&C_Mesa" (one folder per export, numbered map folders)."""
    base = os.path.basename(os.path.normpath(folder))
    return re.sub(r"^\d+_", "", base) if "-" not in base else re.sub(r"^.*?-", "", base, count=1)

def convert(folder):
    name = map_name(folder)
    site_name = re.sub(r"^C&C_", "", name)
    txt = open(os.path.join(folder, "layers.txt"), encoding="utf-8", errors="replace").read()
    size = re.search(r"Picture size: (\d+)x(\d+)", txt)
    edges = re.search(r"Picture edges \(game metres\): left x ([-\d.]+), right x ([-\d.]+), top y ([-\d.]+), bottom y ([-\d.]+)", txt)
    marks_file = (glob.glob(os.path.join(folder, "Data", "Marks", "marks_*.json")) or [None])[0]
    meta_path = os.path.join(SITE, "assets", "images", "maps", "layers", site_name, "layers.json")
    if not edges:
        print(f"! {site_name}: no 'Picture edges' line in layers.txt (export it again with the new viewer)"); return
    if not marks_file:
        print(f"! {site_name}: no Data/Marks/marks_*.json"); return
    if not os.path.exists(meta_path):
        print(f"! {site_name}: map not converted yet (tools/convert_maps.py)"); return
    W, H = int(size.group(1)), int(size.group(2))
    left, right, top, bottom = map(float, edges.groups())
    meta = json.load(open(meta_path, encoding="utf-8"))
    if meta.get("source_size") != [W, H]:
        print(f"! {site_name}: the export is {W}x{H} but the site's picture came from {meta.get('source_size')}; convert the map again"); return
    b = meta["box"]
    floors = {f["name"]: f["n"] for f in meta.get("floors", [])}
    out = []
    for m in json.load(open(marks_file, encoding="utf-8")):
        px = (left - m["x"]) / (left - right) * W
        py = (m["y"] - top) / (bottom - top) * H
        x = (px - b[0]) / (b[2] - b[0]) * 100
        y = (py - b[1]) / (b[3] - b[1]) * 100
        if not (-1 <= x <= 101 and -1 <= y <= 101):
            continue
        e = {k: m[k] for k in KEEP if m.get(k) not in (None, "")}
        e["x"], e["y"] = round(x, 2), round(y, 2)
        if m.get("floor") in floors:
            e["floor"] = floors[m["floor"]]
        out.append(e)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, site_name + ".json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{site_name}: {len(out)} marks")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:]]
    if not args:
        print(__doc__); sys.exit(1)
    for a in args:
        for f in (sorted(glob.glob(a)) if any(c in a for c in "*?[") else [a]):
            if os.path.isdir(f):
                convert(f)
