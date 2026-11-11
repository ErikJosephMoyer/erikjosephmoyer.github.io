#!/bin/bash
# Convert images to WebP (quality 90) next to the originals. Needs: brew install webp
# usage: tools/to-webp.sh photo.png other.jpg
for f in "$@"; do cwebp -q 90 "$f" -o "${f%.*}.webp" && echo "wrote ${f%.*}.webp"; done
