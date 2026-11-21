#!/usr/bin/env bash
# Nová verzia súborov pre prehliadač: v index.html, tabula.html a hra/index.html dá lokálnym .js/.css „?v=<dátum a čas>“.
# Prečo: Cloudflare (ful.upcba.sk) hovorí prehliadaču, aby si JS a CSS pamätal 4 hodiny; HTML iba 10 minút.
# S novou verziou v adrese prehliadač stiahne nové súbory hneď. Spusti pred commitom, keď sa zmenil JS alebo CSS.
# Použitie: bash tools/verzia.sh   (overenie: grep -o '?v=[0-9]*' index.html | sort -u)
set -e
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M)
for f in index.html tabula.html hra/index.html; do
  sed -E -i "s#((src|href)=\"(\.\./)?[a-z-]+\.(js|css))(\?v=[0-9]+)?\"#\1?v=$V\"#g" "$f"
done
echo "verzia $V: $(grep -o "?v=$V" index.html tabula.html hra/index.html | wc -l) odkazov"
