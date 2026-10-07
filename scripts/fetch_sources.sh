#!/usr/bin/env bash
# Download the Carrier manuals listed in docs/sources/README.md.
# They are copyrighted, so they are gitignored rather than committed.
set -euo pipefail

dest="$(cd "$(dirname "$0")/.." && pwd)/docs/sources"
base="https://www.shareddocs.com/hvac/docs/1009/Public"

for path in 07/24-25-2SM 06/24ACB-CC-PB-10SI 03/24ACC6-3W 07/24ACC6-9PD; do
  file="$(basename "$path").pdf"
  if [[ -s "$dest/$file" ]]; then
    echo "have  $file"
    continue
  fi
  echo "fetch $file"
  curl -fsSL -A "Mozilla/5.0" -o "$dest/$file.part" "$base/$path.pdf"
  if [[ "$(head -c 5 "$dest/$file.part")" != "%PDF-" ]]; then
    rm -f "$dest/$file.part"
    echo "error: $file did not download as a PDF" >&2
    exit 1
  fi
  mv "$dest/$file.part" "$dest/$file"
done
