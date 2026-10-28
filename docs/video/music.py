# موسيقى خلفية هادئة مولّدة برمجيًا: وسادة أوتار + نبض خفيف + رنين نجمي ناعم عند كل انتقال مشهد
import sys
import wave
import json
from pathlib import Path
import numpy as np

SR = 44100
SUF = '-' + sys.argv[sys.argv.index('--cut') + 1] if '--cut' in sys.argv else ''
TIMING = json.loads((Path(__file__).parent / f"timing{SUF}.json").read_text())  # من mix.py --timing
TOTAL = TIMING["total"]
# بدايات المشاهد 2–13 (من timing.json، مطابقة لـ explainer.html)
CUTS = [r["start"] for r in TIMING["rows"][1:]]
N = int(SR * TOTAL)
t = np.arange(N) / SR
rng = np.random.default_rng(7)

def note(f):
    return 440.0 * 2 ** ((f - 69) / 12)

# تتابع هارموني (كل 8 ثوانٍ): Am - F - C - G
chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
pad = np.zeros(N)
seg = 8.0
for i in range(int(np.ceil(TOTAL / seg))):
    a, b = int(i * seg * SR), min(N, int((i + 1) * seg * SR + 2 * SR))
    tt = t[a:b] - i * seg
    env = np.clip(tt / 2.0, 0, 1) * np.clip((seg + 2 - tt) / 2.0, 0, 1)
    for m in chords[i % 4]:
        f = note(m)
        for det in (-0.12, 0.0, 0.12):  # تكثيف بسيط
            ph = rng.uniform(0, 2 * np.pi)
            pad[a:b] += env * (np.sin(2 * np.pi * f * (1 + det / 100) * tt + ph) + 0.25 * np.sin(4 * np.pi * f * tt + ph)) / 12
pad *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.25 * t)  # تموّج بطيء

# جهير ونبض كل نصف ثانية بعد المقدمة
bass = np.zeros(N)
roots = [45, 41, 36, 43]
for i in range(int(TOTAL / 0.5)):
    st = i * 0.5
    if st < CUTS[0] or st > TOTAL - 4:
        continue
    a = int(st * SR); b = min(N, a + int(0.45 * SR))
    tt = t[a:b] - st
    f = note(roots[int(st // seg) % 4])
    bass[a:b] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 5) * 0.35
    kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 14)
    bass[a:b] += kick * (0.45 if i % 2 == 0 else 0.18)

# رنين نجمي عند الانتقالات: نغمات من وتر اللحظة بأوكتافين أعلى تتتابع بسرعة وتخبو (بدل صوت "ووش")
chime = np.zeros(N)
for s in CUTS:
    tones = chords[int(s // seg) % 4]
    for j, m in enumerate(tones):
        on = s + 0.05 + j * 0.075
        a = int(on * SR); b = min(N, a + int(1.6 * SR))
        tt = t[a:b] - on
        f = note(m + 24)
        env = np.minimum(tt / 0.006, 1) * np.exp(-tt * 4.5)
        chime[a:b] += (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 9)) * env * (0.32 - j * 0.04)

mix = 0.55 * pad + 0.5 * bass + 0.4 * chime
fade = np.clip(t / 1.5, 0, 1) * np.clip((TOTAL - t) / 3.0, 0, 1)
mix *= fade
mix /= np.max(np.abs(mix)) * 1.15
stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1)
with wave.open(str(Path(__file__).parent / f'music{SUF}.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
print('ok')
