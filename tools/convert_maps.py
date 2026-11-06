"""Turn RenegadeViewer map exports into the site's map pictures.

Usage (from the site's folder):
    python tools/convert_maps.py <export folder> [<export folder> ...]
    python tools/convert_maps.py "05_11_2026_23_12_44-*"      (a pattern works too)

An export folder is what the viewer's "Save PNG" export makes, named
"<date>-<map file>" (e.g. 05_11_2026_23_12_44-C&C_Mesa) with World/, Empty/,
Filled/, Floors/ and layers.txt. Every picture in it is the same size and lines up
pixel for pixel. For each one this writes, named after the map ("C&C_" left off):

  assets/images/maps/<map>.webp           World, up to 1600 px (the normal picture)
  assets/images/maps/hd/<map>.webp        World, up to 9104 px (Quality: High)
  assets/images/maps/layers/<map>/        the "Try out layering" test, up to 1600 px:
      empty.webp   the map itself (terrain, buildings, props)
      filled.webp  units and objects, to lay over empty
      editor.webp  waypaths and zones (only when the export has them)
      floor-1.webp, floor-2.webp ...   one storey each, 1 = the top
      layers.json  what's there, the floor names and the metres per pixel

All pictures are cut to the same box: the visible part of World plus a small margin,
so they keep lining up. WebP quality is the same as the other map pictures.
Needs Python 3 and Pillow (pip install pillow). A 16384 px picture takes about 1 GB of
memory while it's being converted.
"""
import glob
import json
import os
import re
import sys

from PIL import Image

Image.MAX_IMAGE_PIXELS = None  # the exports are 16384 px wide

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_MAPS = os.path.join(SITE, "assets", "images", "maps")
NORMAL_MAX = 1600     # the normal map picture (as before)
HD_MAX = 9104         # the high-quality one (like the first M01)
NORMAL_Q = 85
HD_Q = 82
MARGIN = 0.02         # extra room around the visible part, as a share of its size


def one(folder, sub):
    """The all_*.png in a sub folder, or None."""
    found = sorted(glob.glob(os.path.join(folder, sub, "all_*.png")))
    return found[0] if found else None


def fit(im, longest):
    w, h = im.size
    s = min(1.0, longest / max(w, h))
    if s >= 1.0:
        return im
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def save(im, path, quality):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=4)
    print("   ", os.path.relpath(path, SITE), im.size, f"{os.path.getsize(path) / 1e6:.2f} MB", flush=True)


def read_layers(folder):
    info = {"floors": [], "m_per_px": None}
    try:
        text = open(os.path.join(folder, "layers.txt"), encoding="utf-8", errors="replace").read()
    except OSError:
        return info
    m = re.search(r"([\d.]+)\s*m per pixel", text)
    if m:
        info["m_per_px"] = float(m.group(1))
    part = text.split("Floors", 1)[1] if "Floors" in text else ""
    for line in part.splitlines():
        m = re.match(r"\s*(\d+)\s+(.+?)\s*(\(\d+ spots.*)?$", line)
        if m:
            info["floors"].append({"n": int(m.group(1)), "name": m.group(2).strip()})
    return info


def convert(folder, layers=True):
    name = re.sub(r"^.*?-", "", os.path.basename(os.path.normpath(folder)), count=1)
    site_name = re.sub(r"^C&C_", "", name)
    # World is the finished map; a map with no units has only Empty (the same picture).
    world = one(folder, "World") or one(folder, "Empty")
    if not world:
        print(f"! {folder}: no World/ or Empty/ all_*.png, skipped")
        return
    print(f"{site_name}  ({folder})", flush=True)
    im = Image.open(world)
    im.load()
    w, h = im.size
    box = im.getchannel("A").getbbox() if im.mode == "RGBA" else None
    box = box or (0, 0, w, h)
    mx, my = round((box[2] - box[0]) * MARGIN), round((box[3] - box[1]) * MARGIN)
    box = (max(0, box[0] - mx), max(0, box[1] - my), min(w, box[2] + mx), min(h, box[3] + my))
    im = im.crop(box)
    save(fit(im, HD_MAX), os.path.join(OUT_MAPS, "hd", site_name + ".webp"), HD_Q)
    save(fit(im, NORMAL_MAX), os.path.join(OUT_MAPS, site_name + ".webp"), NORMAL_Q)
    del im
    if not layers:
        return
    out = os.path.join(OUT_MAPS, "layers", site_name)
    info = read_layers(folder)
    meta = {"map": site_name, "box": box, "source_size": [w, h], "m_per_px": info["m_per_px"], "layers": [], "floors": []}
    for key, sub in (("empty", "Empty"), ("filled", "Filled"), ("editor", "Editor")):
        f = one(folder, sub)
        if not f:
            continue
        layer = Image.open(f)
        layer.load()
        save(fit(layer.crop(box), NORMAL_MAX), os.path.join(out, key + ".webp"), NORMAL_Q)
        del layer
        meta["layers"].append(key)
    names = {fl["n"]: fl["name"] for fl in info["floors"]}
    for f in sorted(glob.glob(os.path.join(folder, "Floors", "*.png")),
                    key=lambda p: int(re.match(r"(\d+)", os.path.basename(p)).group(1))):
        n = int(re.match(r"(\d+)", os.path.basename(f)).group(1))
        layer = Image.open(f)
        layer.load()
        save(fit(layer.crop(box), NORMAL_MAX), os.path.join(out, f"floor-{n}.webp"), NORMAL_Q)
        del layer
        meta["floors"].append({"n": n, "name": names.get(n, f"Floor {n}")})
    with open(os.path.join(out, "layers.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)
    print("   ", os.path.relpath(os.path.join(out, "layers.json"), SITE), flush=True)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print(__doc__)
        sys.exit(1)
    folders = []
    for a in args:
        folders += sorted(glob.glob(a)) if any(c in a for c in "*?[") else [a]
    for f in folders:
        if os.path.isdir(f):
            convert(f, layers="--no-layers" not in sys.argv)
