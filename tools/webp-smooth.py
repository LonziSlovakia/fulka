# Plynulejšie animované WebP: medzi každé dve snímky dopočíta medzisnímky (prelínanie), aby spomalená animácia nebola trhaná.
# Použitie: python3 tools/webp-smooth.py <vstup.webp> <výstup.webp> <medzisnímky> <ms na snímku> <úvod ms> <koniec ms>
#   napr. python3 tools/webp-smooth.py assets/gif/ful-zdroj.webp assets/anim/ful.webp 2 22 440 2500
#   medzisnímky 2 = medzi pôvodné snímky A a B pribudne zmes 1/3 a 2/3; ms na snímku = trvanie každej snímky animácie;
#   úvod = prvá snímka, koniec = ako dlho ostane posledná pred opakovaním.
# Potrebuje anim_dump a img2webp v tools/.cache/webproot (apt-get download webp … + dpkg -x, pozri CLAUDE.md).
import os
import struct
import subprocess
import sys
import tempfile
import zlib

TOOLS = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cache", "webproot", "usr")
ENV = dict(os.environ, LD_LIBRARY_PATH=os.path.join(TOOLS, "lib", "x86_64-linux-gnu"))


# PNG → (šírka, výška, bajty RGBA); iba 8-bit RGBA bez prekladania (to vyrába anim_dump)
def read_png(path):
    data = open(path, "rb").read()
    i, idat, w, h = 8, b"", 0, 0
    while i < len(data):
        n, kind = struct.unpack(">I4s", data[i:i + 8])
        body = data[i + 8:i + 8 + n]
        if kind == b"IHDR":
            w, h, depth, ctype = struct.unpack(">IIBB", body[:10])
            assert depth == 8 and ctype == 6, "čakám 8-bit RGBA PNG"
        elif kind == b"IDAT":
            idat += body
        i += 12 + n
    return w, h, unfilter(zlib.decompress(idat), w, h, 4)


# zruší PNG filtre riadkov (None, Sub, Up, Average, Paeth)
def unfilter(raw, w, h, bpp):
    stride = w * bpp
    out = bytearray(stride * h)
    prev = bytearray(stride)
    for y in range(h):
        f = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + ((a + b) >> 1)) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return bytes(out)


# bajty RGBA → PNG súbor
def write_png(path, w, h, rgba):
    stride = w * 4
    raw = b"".join(b"\x00" + rgba[y * stride:(y + 1) * stride] for y in range(h))
    chunk = lambda k, d: struct.pack(">I", len(d)) + k + d + struct.pack(">I", zlib.crc32(k + d) & 0xFFFFFFFF)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
                           + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


# zmes dvoch snímok: k = 0 → a, k = 1 → b
def blend(a, b, k):
    return bytes(round(x + (y - x) * k) for x, y in zip(a, b))


# zoznam snímok [pixely, ms, je_pôvodná]: pôvodné snímky + medzisnímky; prvá a posledná s vlastným časom
def smooth(frames, between, ms, first, last):
    out = []
    for i, f in enumerate(frames):
        out.append([f, ms, True])
        if i + 1 < len(frames):
            out += [[blend(f, frames[i + 1], j / (between + 1)), ms, False] for j in range(1, between + 1)]
    out[0][1], out[-1][1] = first, last
    return out


if __name__ == "__main__":
    src, dst, between, ms, first, last = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7])
    tmp = tempfile.mkdtemp()
    subprocess.run([os.path.join(TOOLS, "bin", "anim_dump"), "-folder", tmp, "-prefix", "f", src], env=ENV, check=True, stdout=subprocess.DEVNULL)
    names = sorted(n for n in os.listdir(tmp) if n.endswith(".png"))
    loaded = [read_png(os.path.join(tmp, n)) for n in names]
    w, h = loaded[0][:2]
    frames = smooth([px for _, _, px in loaded], between, ms, first, last)
    # pôvodné snímky bezstratovo (posledná ostane dlho, chyby by bolo vidno), medzisnímky stratovo (bliknú na pár ms, súbor je ~3× menší)
    args = [os.path.join(TOOLS, "bin", "img2webp"), "-loop", "0", "-m", "4"]
    for i, (px, d, orig) in enumerate(frames):
        p = os.path.join(tmp, f"s{i:04d}.png")
        write_png(p, w, h, px)
        args += ["-d", str(d)] + (["-lossless"] if orig else ["-lossy", "-q", "80"]) + [p]
    subprocess.run(args + ["-o", dst], env=ENV, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{len(names)} snímok → {len(frames)}, spolu {sum(d for _, d, _ in frames)} ms, {os.path.getsize(dst) // 1024} kB")
