#!/bin/sh
# يبني ../RMS-by-Starlight-explainer.mp4 من المصادر: التوقيت ← الموسيقى ← المزج ← التصيير ← الدمج
set -e
cd "$(dirname "$0")"
python3 mix.py --timing > /dev/null
python3 music.py
python3 mix.py
node render.js silent.mp4
ffmpeg -loglevel error -y -i silent.mp4 -i mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -shortest -movflags +faststart ../RMS-by-Starlight-explainer.mp4
# النسخة العمودية لإنستغرام (1080×1920) بالصوت نفسه
node render.js --vertical silent-vertical.mp4
ffmpeg -loglevel error -y -i silent-vertical.mp4 -i mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -shortest -movflags +faststart ../RMS-by-Starlight-explainer-vertical.mp4
echo "done: docs/RMS-by-Starlight-explainer.mp4 + docs/RMS-by-Starlight-explainer-vertical.mp4"
