#!/usr/bin/env bash
# Re-encodes the soundtrack for the web build.
# Usage: tools/encode-music.sh <folder with the original .mp3 files>
# Tracks missing from the folder are skipped, so new ones can arrive a few at a time.
# Each track is levelled to about -16 LUFS, loops lose their fade-out tail (the
# game crossfades them instead), the UR stinger is cut to ~5.5 s, and every track
# is written as OGG Vorbis (~96 kbps) plus an MP3 fallback for Safari.
set -euo pipefail
SRC="$1"
OUT="$(dirname "$0")/../src/assets/audio"
mkdir -p "$OUT"

# name | source file | trim end (seconds, 0 = keep) | fade-out seconds
TRACKS="
sanctum|Sanctum_Theme.mp3|146|2
altar|Altar.mp3|86|2
crypt|Crypt_map.mp3|144|2
battle|Battle.mp3|145.5|1.5
boss|Boss_battle.mp3|0|1
victory|Victory.mp3|0|0
defeat|Defeat.mp3|0|0
ur-stinger|UR_Stinger.mp3|5.5|1.5
armory|Saints_Armory.mp3|0|2
chapter|Chapter_House.mp3|0|2
tower|Bell_Tower.mp3|0|2
deep-crypt|Deep_Crypts.mp3|0|2
deep-battle|Deep_Battle.mp3|0|1.5
deep-boss|Deep_Boss.mp3|0|1
hunt|Hallowed_Hunt.mp3|0|1
heretic|First_Heretic.mp3|0|1
"

for row in $TRACKS; do
  IFS='|' read -r name file end fade <<<"$row"
  in=$(ls "$SRC"/*"$file" 2>/dev/null | head -1 || true)
  if [ -z "$in" ]; then echo "$name: no $file, skipped"; continue; fi
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
  [ "$end" = 0 ] && end=$dur
  filt="atrim=0:$end"
  if [ "$fade" != 0 ]; then filt="$filt,afade=t=out:st=$(echo "$end - $fade" | bc):d=$fade"; fi
  lufs=$(ffmpeg -hide_banner -i "$in" -af "$filt,ebur128" -f null - 2>&1 | grep -E '^\s+I:' | tail -1 | awk '{print $2}')
  gain=$(echo "-16 - ($lufs)" | bc)
  filt="$filt,volume=${gain}dB,alimiter=limit=0.89:level=false"
  echo "$name: $lufs LUFS, gain ${gain} dB, length $end s"
  ffmpeg -v error -y -i "$in" -vn -map_metadata -1 -af "$filt" -ar 44100 -ac 2 -c:a libvorbis -q:a 2 "$OUT/$name.ogg"
  ffmpeg -v error -y -i "$in" -vn -map_metadata -1 -af "$filt" -ar 44100 -ac 2 -c:a libmp3lame -b:a 96k "$OUT/$name.mp3"
done
du -ch "$OUT"/* | tail -1
