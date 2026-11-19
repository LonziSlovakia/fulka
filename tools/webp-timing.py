# Prepíše časy snímok v animovanom WebP (bez prekódovania, kvalita ostáva rovnaká).
# Použitie: python3 tools/webp-timing.py <súbor.webp> <prvá ms> <ostatné ms> <posledná ms>
#   napr. python3 tools/webp-timing.py assets/anim/ful.webp 440 64 2500
#   prvá = úvodná snímka, ostatné = rýchlosť animácie (väčšie = pomalšie), posledná = ako dlho logo ostane pred opakovaním
# Bez čísel iba vypíše aktuálne časy.
import struct
import sys


# zoznam (pozícia poľa s časom, čas v ms) pre každú snímku (chunk ANMF)
def frames(data):
    out = []
    i = 12
    while i < len(data):
        kind = data[i:i + 4]
        size = struct.unpack("<I", data[i + 4:i + 8])[0]
        if kind == b"ANMF":
            pos = i + 8 + 12  # X, Y, šírka, výška (po 3 bajty), potom čas (3 bajty)
            out.append((pos, int.from_bytes(data[pos:pos + 3], "little")))
        i += 8 + size + (size & 1)
    return out


# nové časy: prvá, prostredné, posledná snímka
def timings(n, first, middle, last):
    return [first] + [middle] * (n - 2) + [last] if n > 1 else [last]


# zapíše časy do kópie dát
def with_timings(data, positions, durations):
    out = bytearray(data)
    for pos, ms in zip(positions, durations):
        out[pos:pos + 3] = int(ms).to_bytes(3, "little")
    return bytes(out)


if __name__ == "__main__":
    path = sys.argv[1]
    data = open(path, "rb").read()
    fr = frames(data)
    if len(sys.argv) < 5:
        print(len(fr), "snímok:", [ms for _, ms in fr], "spolu", sum(ms for _, ms in fr), "ms")
        sys.exit(0)
    new = timings(len(fr), *map(int, sys.argv[2:5]))
    open(path, "wb").write(with_timings(data, [p for p, _ in fr], new))
    print("nové časy:", new, "spolu", sum(new), "ms")
