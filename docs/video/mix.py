# يحسب توقيت المشاهد من طول مقاطع التعليق الصوتي (voice/01..13.mp3) ويكتبه في timing.json وtiming.js
# (تقرؤهما explainer.html وmusic.py)، ثم يمزج التعليق فوق music.wav مع خفض الموسيقى 14dB أثناء الكلام. الناتج: mix.wav
#   python3 mix.py --timing && python3 music.py && python3 mix.py && node render.js silent.mp4
#   ffmpeg -i silent.mp4 -i mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p \
#          -c:a aac -b:a 160k -shortest -movflags +faststart ../RMS-by-Starlight-explainer.mp4
# المقطع الناقص يُعامل كصمت بطوله التقديري (EST) إلى أن يُضاف ملفه، فيبقى الفيديو قابلًا للتصيير.
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np

SR = 44100
HERE = Path(__file__).parent
N_SCENES = 13
LEAD, TAIL, OVER = 0.55, 0.9, 0.8  # بداية الكلام بعد دخول المشهد، الهدوء بعده، ومدة انتقال الكاروسيل بين المشهدين
EST = {5: 11.4, 8: 12.6}  # أطوال تقديرية (ثوانٍ) للمقاطع غير المتوفرة بعد


def load_voice(i):
    f = HERE / 'voice' / f'{i:02d}.mp3'
    if not f.exists():
        print(f'تنبيه: voice/{f.name} غير موجود — صمت بطول {EST.get(i, 8)} ث', file=sys.stderr)
        return np.zeros(int(EST.get(i, 8) * SR), np.float32)
    # فك المقطع مع قصّ الصمت في أوله وآخره
    raw = subprocess.check_output(['ffmpeg', '-loglevel', 'error', '-i', str(f), '-af',
        'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse',
        '-ar', str(SR), '-ac', '1', '-f', 's16le', '-'])
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


clips = [load_voice(i) for i in range(1, N_SCENES + 1)]
rows, t = [], 0.0
for i, c in enumerate(clips):
    lead = 0.6 if i == 0 else LEAD
    dur = lead + len(c) / SR + TAIL + (2.6 if i == N_SCENES - 1 else 0)  # الختام يبقى أطول ليُقرأ رقم واتساب
    rows.append(dict(start=round(t, 2), dur=round(dur, 2), voice=round(t + lead, 2)))
    t += dur - OVER
total = round(rows[-1]['start'] + rows[-1]['dur'], 2)
timing = dict(rows=rows, total=total, over=OVER)
(HERE / 'timing.json').write_text(json.dumps(timing, indent=1))
(HERE / 'timing.js').write_text('window.TIMING = ' + json.dumps(timing) + ';\n')

if '--timing' in sys.argv:
    print(json.dumps(timing, indent=1))
    sys.exit()

w = wave.open(str(HERE / 'music.wav'))
music = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, 2) / 32768
N = int(SR * total)
music = np.pad(music[:N], ((0, max(0, N - len(music))), (0, 0)))
voice = np.zeros(N, np.float32)
duck = np.zeros(N, np.float32)  # 1 = أثناء الكلام
for r, v in zip(rows, clips):
    a = int(r['voice'] * SR); voice[a:a + len(v)] += v
    duck[max(0, a - int(.25 * SR)):a + len(v) + int(.15 * SR)] = 1
# تنعيم منحنى الخفض بمتوسط متحرك ~0.25ث
k = int(.25 * SR); c = np.cumsum(np.pad(duck, (k // 2, k - k // 2))); duck = ((c[k:] - c[:-k]) / k)[:N].astype(np.float32)
rms = lambda x: np.sqrt(np.mean(x[np.abs(x) > 1e-4] ** 2))
g = rms(voice) / rms(music.mean(1)) * 10 ** (-8 / 20)  # الموسيقى خارج الكلام: أخفض من الصوت بـ 8dB
mix = music * (g * 10 ** (-14 * duck / 20))[:, None] + voice[:, None]
mix /= np.max(np.abs(mix)) / 0.89
with wave.open(str(HERE / 'mix.wav'), 'wb') as o:
    o.setnchannels(2); o.setsampwidth(2); o.setframerate(SR)
    o.writeframes((mix * 32767).astype(np.int16).tobytes())
print('ok', total)
