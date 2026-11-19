# Prevedie logo z obrázka (PNG) na vektor: rozdelí pixely na farby, oddelí pozadie a každú farbu obkreslí cez potrace.
# Použitie: python3 tools/trace-logo.py <obrázok.png> <x> <y> <šírka> <výška> <zväčšenie> <výstup.js> [premaľovanie.json]
#   napr. python3 tools/trace-logo.py design/ants/predloha/koncepty.png 40 105 280 310 3 design/ants/traced.js
#   x, y, šírka, výška = výrez s logom; zväčšenie = koľkokrát zväčšiť pred obkreslením (hladšie krivky).
#   premaľovanie.json = [{ "poly": [[x, y], …], "from": ["black"], "to": "mid" }] (súradnice výrezu po zväčšení).
#   Výstup: window.TRACED = { w, h, layers: [{ name, fill, d }] } – vrstvy idú odspodu (obrys → čierna → oranžové → odlesky).
# Potrebuje potrace v tools/.cache/webproot (apt-get download potrace libpotrace0 + dpkg -x, pozri CLAUDE.md).
import importlib.util
import json
import os
import re
import struct
import subprocess
import sys
import tempfile
import zlib
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, ".cache", "webproot", "usr")
ENV = dict(os.environ, LD_LIBRARY_PATH=os.path.join(TOOLS, "lib", "x86_64-linux-gnu"))
sys.dont_write_bytecode = True  # bez __pycache__ v tools/
_spec = importlib.util.spec_from_file_location("ws", os.path.join(HERE, "webp-smooth.py"))
ws = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ws)

# farby predlohy (Kuchynka Ants): meno → RGB; pixel dostane najbližšiu
PALETTE = {
    "black": (12, 10, 10), "white": (244, 242, 238),
    "brown": (104, 36, 6), "dark": (196, 70, 8), "mid": (234, 104, 18), "light": (246, 142, 52), "pale": (236, 200, 140),
}
# vrstvy odspodu: meno, farba výplne, ktoré triedy pixelov pokrýva (spodné vrstvy pokrývajú aj horné → bez medzier)
LAYERS = [
    ("obrys", "#FCF6E8", None),  # celé logo (všetko okrem pozadia)
    ("ciara", "#0A0A0A", "inner"),  # všetko okrem bieleho obrysu
    ("oranz", "#EE6A12", {"brown", "dark", "mid", "light", "pale"}),
    ("tmava", "#C9480A", {"brown", "dark"}),
    ("tien", "#6E2A05", {"brown"}),
    ("svetla", "#FF8A2E", {"light", "pale"}),
    ("odlesk", "#FFC98A", {"pale"}),
    ("lesk", "#FFFFFF", "glint"),  # biela vnútri (lesk oka)
]


# PNG (RGB alebo RGBA, 8 bit) → (šírka, výška, kanály, bajty)
def read_png(path):
    data = open(path, "rb").read()
    i, idat = 8, b""
    while i < len(data):
        n, kind = struct.unpack(">I4s", data[i:i + 8])
        body = data[i + 8:i + 8 + n]
        if kind == b"IHDR":
            w, h, depth, ctype = struct.unpack(">IIBB", body[:10])
            assert depth == 8 and ctype in (2, 6), "čakám 8-bit RGB/RGBA PNG"
        elif kind == b"IDAT":
            idat += body
        i += 12 + n
    ch = 3 if ctype == 2 else 4
    return w, h, ch, ws.unfilter(zlib.decompress(idat), w, h, ch)


# výrez a zväčšenie (bilineárne) → zoznam RGB n-tíc po riadkoch
def crop_scale(img, x0, y0, cw, chh, k):
    w, h, ch, px = img
    at = lambda x, y: px[(y * w + x) * ch:(y * w + x) * ch + 3]
    out = []
    for Y in range(chh * k):
        fy = y0 + (Y + 0.5) / k - 0.5
        y1 = int(fy); ty = fy - y1
        for X in range(cw * k):
            fx = x0 + (X + 0.5) / k - 0.5
            x1 = int(fx); tx = fx - x1
            a, b, c, d = at(x1, y1), at(x1 + 1, y1), at(x1, y1 + 1), at(x1 + 1, y1 + 1)
            out.append(tuple(round((a[j] * (1 - tx) + b[j] * tx) * (1 - ty) + (c[j] * (1 - tx) + d[j] * tx) * ty) for j in range(3)))
    return out


# každý pixel → meno najbližšej farby z palety
def classify(rgb, palette):
    names = list(palette)
    cols = [palette[n] for n in names]
    cache = {}
    def near(p):
        if p not in cache:
            cache[p] = names[min(range(len(cols)), key=lambda i: sum((p[j] - cols[i][j]) ** 2 for j in range(3)))]
        return cache[p]
    return [near(p) for p in rgb]


# vyhladenie: každý pixel dostane najčastejšiu triedu v okolí (odstráni fľaky z textúry predlohy)
def majority(cls, W, H, r=1):
    out = list(cls)
    for y in range(r, H - r):
        for x in range(r, W - r):
            cnt = {}
            for yy in range(y - r, y + r + 1):
                base = yy * W
                for xx in range(x - r, x + r + 1):
                    c = cls[base + xx]
                    cnt[c] = cnt.get(c, 0) + 1
            out[y * W + x] = max(cnt, key=cnt.get)
    return out


# premaľovanie: v mnohouholníku (súradnice výrezu po zväčšení) zmení triedy z „from“ na „to“ (napr. zlúčiť dielik = čierna medzera → oranžová)
def paint(cls, W, H, rules):
    for rule in rules:
        P = rule["poly"]
        ys = [p[1] for p in P]
        for y in range(max(0, int(min(ys))), min(H, int(max(ys)) + 1)):
            xs = []
            for (x1, y1), (x2, y2) in zip(P, P[1:] + P[:1]):
                if (y1 <= y < y2) or (y2 <= y < y1):
                    xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(max(0, int(a)), min(W, int(b) + 1)):
                    if cls[y * W + x] in rule["from"]:
                        cls[y * W + x] = rule["to"]
    return cls


# zaplavenie od okraja cez pixely, ktoré prejdú test ok → množina indexov
def flood(cls, W, H, ok, start):
    seen = bytearray(W * H)
    q = deque(i for i in start if ok(cls[i]))
    for i in q:
        seen[i] = 1
    while q:
        i = q.popleft()
        x, y = i % W, i // W
        for j in ((i - 1) if x else -1, (i + 1) if x < W - 1 else -1, i - W, i + W):
            if 0 <= j < W * H and not seen[j] and ok(cls[j]):
                seen[j] = 1
                q.append(j)
    return seen


# masky vrstiev: pozadie = čierna spojená s okrajom, obrys = biela spojená s pozadím, lesk = ostatná biela
def masks(cls, W, H):
    border = [i for i in range(W)] + [i + (H - 1) * W for i in range(W)] + [y * W for y in range(H)] + [y * W + W - 1 for y in range(H)]
    bg = flood(cls, W, H, lambda c: c != "white", border)  # všetko mimo bieleho obrysu (aj prechody farieb na okraji)
    touch = [i for i in range(W * H) if cls[i] == "white" and any(0 <= j < W * H and bg[j] for j in (i - 1, i + 1, i - W, i + W))]
    outline = flood(cls, W, H, lambda c: c == "white", touch)
    out = []
    for name, fill, rule in LAYERS:
        if rule is None:
            m = [not bg[i] for i in range(W * H)]
        elif rule == "inner":
            m = [not bg[i] and not outline[i] for i in range(W * H)]
        elif rule == "glint":
            m = [cls[i] == "white" and not outline[i] for i in range(W * H)]
        else:
            m = [cls[i] in rule and not bg[i] and not outline[i] for i in range(W * H)]
        out.append((name, fill, m))
    return out


# maska → cesta SVG cez potrace (súradnice v pixeloch výrezu po zväčšení)
def trace(mask, W, H, tmp):
    pbm = os.path.join(tmp, "m.pbm")
    rows = []
    for y in range(H):
        row = bytearray((W + 7) // 8)
        for x in range(W):
            if mask[y * W + x]:
                row[x >> 3] |= 0x80 >> (x & 7)
        rows.append(bytes(row))
    open(pbm, "wb").write(b"P4\n%d %d\n" % (W, H) + b"".join(rows))
    svg = os.path.join(tmp, "m.svg")
    subprocess.run([os.path.join(TOOLS, "bin", "potrace"), "-s", "--flat", "-t", "40", "-a", "1.0", "-O", "0.3", "-o", svg, pbm], env=ENV, check=True)
    text = open(svg).read()
    tr = re.search(r'<g transform="([^"]+)"', text).group(1)
    d = " ".join(re.findall(r'\sd="([^"]+)"', text))
    return tr, d


if __name__ == "__main__":
    src, x0, y0, cw, chh, k, out = sys.argv[1], *map(int, sys.argv[2:7]), sys.argv[7]
    img = read_png(src)
    W, H = cw * k, chh * k
    cls = classify(crop_scale(img, x0, y0, cw, chh, k), PALETTE)
    cls = majority(majority(cls, W, H, 2), W, H, 1)
    if len(sys.argv) > 8:
        cls = paint(cls, W, H, json.load(open(sys.argv[8])))
    tmp = tempfile.mkdtemp()
    layers = []
    for name, fill, m in masks(cls, W, H):
        if any(m):
            tr, d = trace(m, W, H, tmp)
            layers.append({"name": name, "fill": fill, "transform": tr, "d": d})
    open(out, "w").write("// vygenerované: python3 tools/trace-logo.py " + " ".join(sys.argv[1:]) + "\nwindow.TRACED = " + json.dumps({"w": W, "h": H, "layers": layers}) + ";\n")
    print(f"{out}: {W}×{H}, vrstvy: {', '.join(l['name'] for l in layers)}, {os.path.getsize(out) // 1024} kB")
