#!/usr/bin/env bash
# Ručná obnova kalendára UPeCe z tohto počítača (GitHub Action dostáva od Cloudflare na upcba.sk 403, domáca IP prejde):
# stiahne iCal (odkaz z .github/workflows/kalendar.yml), prerobí ho na data/upece-kalendar.json a ak sa zmenil, commitne a pushne.
# Použitie: bash tools/kalendar.sh      (overenie: na webe sekcia „Čo sa najbližšie deje v UPeCe“, alebo git log -1)
set -e
cd "$(dirname "$0")/.."
URL=$(grep -oP 'ICAL: "\K[^"]+' .github/workflows/kalendar.yml)
UA=$(grep -oP 'UA: "\K[^"]+' .github/workflows/kalendar.yml) # rovnaký User-Agent ako GitHub Action
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
curl -fsSL --retry 2 --max-time 60 -A "$UA" "$URL" -o "$TMP"
node tools/kalendar.js "$TMP" data/upece-kalendar.json
if git diff --quiet -- data/upece-kalendar.json; then echo "Kalendár sa nezmenil – nič na commit."; exit 0; fi
git diff --stat -- data/upece-kalendar.json
git add data/upece-kalendar.json
git -c user.email=72870876+LonziSlovakia@users.noreply.github.com commit -q -m "Kalendár UPeCe: ručná obnova z upcba.sk"
git push -q
echo "Uložené a pushnuté – web sa obnoví o 1–2 minúty."
