# Animované logo FULky ako vektor (SVG + CSS animácia) namiesto trhaného WebP z GIFu (GIF má iba 31 snímok).
# Kreslí to isté ako GIF: na modrom pozadí sa nakreslí palica zhora k päte, potom čepeľ doľava (so svietiacim bodom na čele),
# potom sa rozsvieti loptička so žiarou a logo chvíľu ostane. Prehliadač to prehráva pri 60+ snímkach za sekundu → plynulé.
# Animujú sa iba posuny (transform) a priehľadnosť (opacity).
# Použitie: python3 tools/ful-anim.py   → assets/anim/ful-anim.svg (časti loga sa berú z assets/logos/ful_bez_pozadia.svg)
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "assets", "logos", "ful_bez_pozadia.svg")
OUT = os.path.join(ROOT, "assets", "anim", "ful-anim.svg")
NAVY = "#02235E"
GOLD = "#F0C146"
T = 4.8  # celá slučka v sekundách (ako doterajšie WebP: úvod 0,44 s, kreslenie, 2,5 s stojí)


# relatívna cesta (m/c/l/z) → zoznam absolútnych podciest (aby sa dala rozdeliť na časti loga)
def subpaths(d):
    tok = re.findall(r"[MmCcLlZz]|-?\d*\.?\d+(?:e-?\d+)?", d)
    i, cmd, x, y, sx, sy, out, cur = 0, None, 0.0, 0.0, 0.0, 0.0, [], []

    def num():
        nonlocal i
        i += 1
        return float(tok[i - 1])

    while i < len(tok):
        if re.match(r"[A-Za-z]", tok[i]):
            cmd = tok[i]
            i += 1
        if cmd in "Zz":
            cur.append("Z")
            x, y = sx, sy
            out.append(" ".join(cur))
            cur = []
            continue
        if cmd in "Mm":
            a, b = num(), num()
            if cmd == "m":
                a, b = a + x, b + y
            if cur:
                out.append(" ".join(cur))
                cur = []
            x, y, sx, sy = a, b, a, b
            cur.append(f"M{a:g} {b:g}")
            cmd = "l" if cmd == "m" else "L"
            continue
        if cmd in "Ll":
            a, b = num(), num()
            if cmd == "l":
                a, b = a + x, b + y
            x, y = a, b
            cur.append(f"L{a:g} {b:g}")
            continue
        if cmd in "Cc":
            p = [num() for _ in range(6)]
            if cmd == "c":
                p = [p[0] + x, p[1] + y, p[2] + x, p[3] + y, p[4] + x, p[5] + y]
            x, y = p[4], p[5]
            cur.append("C" + " ".join(f"{v:g}" for v in p))
    if cur:
        out.append(" ".join(cur))
    return out


# časti loga: 0 = palica s čepeľou (+ 15 dierok sieťky), 16 = loptička (+ jej vnútro)
def parts():
    s = re.sub(r"<metadata>.*?</metadata>", "", open(SRC, encoding="utf-8").read(), flags=re.S)
    subs = [p for d in re.findall(r'<path[^>]*\bd="([^"]*)"', s) for p in subpaths(d)]
    assert len(subs) == 22, f"čakám 22 podciest, je {len(subs)} – zmenilo sa logo?"
    return " ".join(subs[:16]), " ".join(subs[16:])


# % zo slučky
def pc(sec):
    return f"{sec / T * 100:.2f}%"


def svg(stick, ball):
    inner = 'transform="translate(0,2160) scale(0.1,-0.1)"'
    # časy (s): úvod prázdny, palica, čepeľ, loptička
    a, b, c, d = 0.44, 1.0, 1.45, 2.35
    css = f"""
.a {{ animation-duration: {T}s; animation-iteration-count: infinite; animation-timing-function: linear; }}
#m1 {{ animation-name: m1; }}
@keyframes m1 {{ 0%, {pc(a)} {{ transform: translateY(-1300px); }} {pc(b)}, 100% {{ transform: translateY(0); }} }}
#m2 {{ animation-name: m2; }}
@keyframes m2 {{ 0%, {pc(b)} {{ transform: translateX(1650px); animation-timing-function: cubic-bezier(.3,.1,.5,1); }} {pc(c)}, 100% {{ transform: translateX(250px); }} }}
#dot {{ animation-name: dot; }}
@keyframes dot {{
  0%, {pc(a)} {{ transform: translate(2028px, 192px); opacity: 0; }}
  {pc(a + 0.05)} {{ opacity: 1; }}
  {pc(b)} {{ transform: translate(1452px, 1296px); }}
  {pc(b + 0.12)} {{ transform: translate(1250px, 1560px); }}
  {pc(b + 0.28)} {{ transform: translate(800px, 1590px); }}
  {pc(c)} {{ transform: translate(350px, 1530px); opacity: 1; }}
  {pc(c + 0.15)}, 100% {{ transform: translate(350px, 1530px); opacity: 0; }}
}}
#ball {{ animation-name: ball; animation-timing-function: ease-out; }}
@keyframes ball {{ 0%, {pc(c)} {{ opacity: 0; }} {pc(c + 0.25)} {{ opacity: .4; }} {pc(c + 0.5)}, 100% {{ opacity: 1; }} }}
#glow {{ animation-name: glow; animation-timing-function: ease-in-out; }}
@keyframes glow {{ 0%, {pc(c + 0.05)} {{ opacity: 0; }} {pc(c + 0.45)} {{ opacity: .95; }} {pc(c + 0.7)} {{ opacity: .55; }} {pc(d + 0.3)}, 100% {{ opacity: 0; }} }}
@media (prefers-reduced-motion: reduce) {{ .a {{ animation: none; }} #m1, #m2 {{ transform: none; }} #m2 {{ transform: translateX(0); }} #dot, #glow {{ opacity: 0; }} }}
"""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2160 2160" width="512" height="512">
<!-- Vyrobené: python3 tools/ful-anim.py (z assets/logos/ful_bez_pozadia.svg) – ručne nemeniť -->
<style>{css}</style>
<defs>
  <mask id="mk" maskUnits="userSpaceOnUse" x="0" y="0" width="2160" height="2160">
    <g transform="translate(1452 1296) rotate(25.3)"><rect id="m1" class="a" x="-260" y="-2400" width="520" height="2400" fill="#fff"/></g>
    <rect id="m2" class="a" x="0" y="1150" width="2160" height="1010" fill="#fff"/>
  </mask>
  <radialGradient id="dg"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#FFF1C2" stop-opacity=".9"/><stop offset="1" stop-color="{GOLD}" stop-opacity="0"/></radialGradient>
  <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="45"/></filter>
</defs>
<rect width="2160" height="2160" fill="{NAVY}"/>
<g mask="url(#mk)"><g fill="{GOLD}" {inner}><path d="{stick}"/></g></g>
<g id="glow" class="a" opacity="0" filter="url(#blur)"><g fill="#FFE39A" {inner}><path d="{ball}"/></g></g>
<g id="ball" class="a"><g fill="{GOLD}" {inner}><path d="{ball}"/></g></g>
<circle id="dot" class="a" r="75" fill="url(#dg)" opacity="0"/>
</svg>
"""


if __name__ == "__main__":
    stick, ball = parts()
    open(OUT, "w", encoding="utf-8").write(svg(stick, ball))
    print(f"{OUT}: {os.path.getsize(OUT)} B")
