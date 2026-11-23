#!/usr/bin/env bash
# Re-encodes the soundtrack for the web build.
# Usage: tools/encode-music.sh <folder with the original .mp3 files>
# Tracks missing from the folder are skipped, so new ones can arrive a few at a time.
# Each track is levelled to about -16 LUFS, loops lose their fade-out tail (the
# game crossfades them instead), cues keep their natural ending, and every track
# is written as OGG Vorbis (~96 kbps) plus an MP3 fallback for Safari.
set -euo pipefail
SRC="$1"
OUT="$(dirname "$0")/../src/assets/audio"
mkdir -p "$OUT"

# name | source file | trim end (seconds, 0 = keep) | fade-out seconds | trim start (seconds)
# Trim ends are set per take: loops end just before Suno's fade-out (the game
# crossfades each loop into itself over 3 s); cues keep their natural ending.
# Current takes: Aaron's 16-bit remakes and round 9 loops (2026-11-23).
TRACKS="
sanctum|Sanctum_Theme.mp3|145|1|0
altar|Altar.mp3|145.5|1|0
crypt|Crypt_map.mp3|144.75|1|0
battle|Battle.mp3|146.75|1|0
boss|Boss_battle.mp3|148|1|0
victory|Victory.mp3|9.4|0.4|0
defeat|Defeat.mp3|11.9|0.4|0
ur-stinger|UR_Stinger.mp3|7|0.6|0
armory|Saints_Armory.mp3|80.75|1|0
chapter|Chapter_House.mp3|148.75|1|0
tower|Bell_Tower.mp3|146.75|1|0
deep-crypt|Deep_Crypts.mp3|146|1|0
deep-battle|Deep_Battle.mp3|149|1|0
deep-boss|Deep_Boss.mp3|145.5|1|0.3
hunt|Hallowed_Hunt.mp3|148|1|0
heretic|First_Heretic.mp3|149|1|0
"

for row in $TRACKS; do
  IFS='|' read -r name file end fade start <<<"$row"
  # Case-insensitive, and allows a prefix (uploads arrive as 1234-Crypt_Map.mp3).
  in=$(find "$SRC" -maxdepth 1 -iname "*$file" | head -1)
  if [ -z "$in" ]; then echo "$name: no $file, skipped"; continue; fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
  [ "$end" = 0 ] && end=$dur
  filt="atrim=${start:-0}:$end,asetpts=PTS-STARTPTS"
  if [ "$fade" != 0 ]; then filt="$filt,afade=t=out:st=$(echo "$end - ${start:-0} - $fade" | bc):d=$fade"; fi
  lufs=$(ffmpeg -hide_banner -i "$in" -af "$filt,ebur128" -f null - 2>&1 | grep -E '^\s+I:' | tail -1 | awk '{print $2}')
  gain=$(echo "-16 - ($lufs)" | bc)
  filt="$filt,volume=${gain}dB,alimiter=limit=0.89:level=false"
  echo "$name: $lufs LUFS, gain ${gain} dB, length $end s"
  ffmpeg -v error -y -i "$in" -vn -map_metadata -1 -af "$filt" -ar 44100 -ac 2 -c:a libvorbis -q:a 2 "$OUT/$name.ogg"
  ffmpeg -v error -y -i "$in" -vn -map_metadata -1 -af "$filt" -ar 44100 -ac 2 -c:a libmp3lame -b:a 96k "$OUT/$name.mp3"
done
du -ch "$OUT"/* | tail -1
