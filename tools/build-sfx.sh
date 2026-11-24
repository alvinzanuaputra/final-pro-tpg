#!/usr/bin/env bash
# Membangun assets/sfx/*.mp3 dari paket Kenney (CC0) + beberapa suara buatan ffmpeg.
# Pemakaian: tools/build-sfx.sh <folder berisi paket Kenney yang sudah di-unzip>
#   folder itu harus berisi: impact-sounds/ interface-sounds/ sci-fi-sounds/ digital-audio/ music-jingles/
# Semua file di-convert ke MP3 mono (didukung semua browser, termasuk Safari).
set -euo pipefail

SRC="${1:?folder sumber Kenney}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/sfx"
mkdir -p "$OUT"

find_one() { find "$SRC" -type f -name "$1" | head -1; }

conv() { # conv <nama-output> <file-sumber-kenney> [filter-tambahan]
  local src; src="$(find_one "$2")"
  if [ -z "$src" ]; then echo "TIDAK ADA: $2" >&2; exit 1; fi
  local af="silenceremove=start_periods=1:start_threshold=-50dB${3:+,$3}"
  ffmpeg -v error -y -i "$src" -ac 1 -ar 44100 -af "$af" -c:a libmp3lame -b:a 96k "$OUT/$1.mp3"
}

# ---- UI / menu
conv ui-cursor    select_001.ogg
conv ui-confirm   confirmation_001.ogg
conv ui-back      back_001.ogg
conv ui-pause     minimize_001.ogg
conv ui-resume    maximize_001.ogg
conv ui-toggle    toggle_001.ogg

# ---- gerak piece
conv move         tick_002.ogg   "volume=0.7"
conv rotate       switch_002.ogg
conv harddrop     impactPunch_heavy_000.ogg
conv tilt-fail    error_004.ogg

# ---- mendarat per material
conv land-sand-0  footstep_snow_000.ogg
conv land-sand-1  footstep_snow_001.ogg
conv land-sand-2  footstep_snow_002.ogg
conv land-stone-0 impactMining_000.ogg
conv land-stone-1 impactMining_001.ogg
conv land-gun     footstep_grass_000.ogg

# ---- clear, chain, ledakan
conv clear        powerUp2.ogg
conv chain        zapThreeToneUp.ogg
conv explode-0    explosionCrunch_000.ogg
conv explode-1    explosionCrunch_001.ogg
conv explode-2    explosionCrunch_002.ogg
conv explode-low  lowFrequency_explosion_000.ogg

# ---- event
conv quake-rumble spaceEngineLow_000.ogg "afade=t=in:d=0.15,atrim=0:2.2,afade=t=out:st=1.7:d=0.5"
conv force-creak  doorOpen_000.ogg
conv wind-push    impactSoft_medium_000.ogg "volume=0.8"
conv heartbeat    impactSoft_heavy_002.ogg

# ---- jingle 8-bit
conv jingle-level    jingles_NES12.ogg
conv jingle-gameover jingles_NES11.ogg
conv jingle-warn     jingles_NES10.ogg
conv jingle-material jingles_NES16.ogg
conv trophy-bronze   jingles_NES01.ogg
conv trophy-silver   jingles_NES03.ogg
conv trophy-gold     jingles_NES08.ogg
conv trophy-secret   jingles_NES09.ogg

# ---- suara buatan sendiri (ffmpeg): angin & pasir meluncur
ffmpeg -v error -y -f lavfi -i "anoisesrc=color=pink:duration=5.3:amplitude=0.7:seed=7" \
  -af "bandpass=f=520:width_type=h:w=420,tremolo=f=0.9:d=0.55,afade=t=in:d=0.5,afade=t=out:st=4.4:d=0.9,volume=2.2" \
  -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k "$OUT/wind.mp3"
ffmpeg -v error -y -f lavfi -i "anoisesrc=color=white:duration=0.7:amplitude=0.5:seed=3" \
  -af "highpass=f=900,lowpass=f=4200,tremolo=f=28:d=0.5,afade=t=in:d=0.06,afade=t=out:st=0.25:d=0.45,volume=0.9" \
  -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k "$OUT/tilt-slide.mp3"

echo "SFX selesai: $(ls "$OUT" | wc -l | tr -d ' ') file, $(du -sh "$OUT" | cut -f1)"
