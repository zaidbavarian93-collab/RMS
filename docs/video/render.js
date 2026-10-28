// يصيّر صفحة الشرح الحركي إطارًا إطارًا إلى فيديو MP4 (أو لقطات معاينة عند تمرير --stills)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

// --vertical: النسخة العمودية 1080×1920 (إنستغرام) من explainer-vertical.html
// --reels: النسخة العمودية المختصرة (~86 ثانية) بتوقيت timing-reels.js
const reels = process.argv.includes('--reels');
const vertical = reels || process.argv.includes('--vertical');
const args = process.argv.slice(2).filter((a) => a !== '--vertical' && a !== '--reels');
const FPS = 30;
const html = 'file://' + path.join(__dirname, vertical ? 'explainer-vertical.html' : 'explainer.html') + (reels ? '?cut=reels' : '');
const viewport = vertical ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
  await page.goto(html, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });

  if (args[0] === '--stills') {
    for (const t of args.slice(1).map(Number)) {
      await page.evaluate((t) => window.seek(t), t);
      await page.screenshot({ path: path.join(__dirname, 'stills', `${reels ? 'r' : vertical ? 'v' : 's'}${String(t).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 80 });
    }
    await browser.close();
    return;
  }

  const out = args[0] || path.join(__dirname, 'silent.mp4');
  const total = await page.evaluate(() => window.TOTAL);
  const frames = Math.round(total * FPS);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.seek(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log(`frame ${f}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log('done', out);
})();
