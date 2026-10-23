#!/usr/bin/env bash
# Pripraví lokálne testovanie: knižnice pre headless Chromium (bez sudo, do tools/.cache) a server na :8770.
# Použitie: bash tools/setup.sh   (potom web: http://127.0.0.1:8770/fulka/)
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
CACHE="$DIR/.cache"
mkdir -p "$CACHE/debs"
if [ ! -d "$CACHE/libroot/usr/lib/x86_64-linux-gnu" ]; then
  (cd "$CACHE/debs" && apt-get download libnspr4 libnss3 libasound2t64 >/dev/null 2>&1)
  for f in "$CACHE"/debs/*.deb; do dpkg -x "$f" "$CACHE/libroot"; done
fi
if ! ss -ltn | grep -q ':8770 '; then
  (cd "$DIR/../.." && nohup python3 -m http.server 8770 --bind 127.0.0.1 >/dev/null 2>&1 &)
  sleep 1
fi
ss -ltn | grep -q ':8770 ' && echo "OK: server beží na http://127.0.0.1:8770/fulka/"
