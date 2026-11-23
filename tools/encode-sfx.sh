#!/usr/bin/env bash
# Encodes the WAVs from tools/make-sfx.py (or your own, named <cue>.wav) into
# src/assets/sfx as OGG (played first) and MP3 (for browsers without OGG).
set -euo pipefail
src="${1:?usage: tools/encode-sfx.sh <folder of <cue>.wav files>}"
dst="$(dirname "$0")/../src/assets/sfx"
mkdir -p "$dst"
for f in "$src"/*.wav; do
  n="$(basename "$f" .wav)"
  ffmpeg -loglevel error -y -i "$f" -ac 1 -c:a libvorbis -q:a 4 "$dst/$n.ogg"
  ffmpeg -loglevel error -y -i "$f" -ac 1 -c:a libmp3lame -b:a 96k "$dst/$n.mp3"
done
ls "$dst" | wc -l
