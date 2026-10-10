import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// ساعة حيّة (تتحدث كل ثانية)
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// عدّاد يتحرك بسلاسة من القيمة السابقة إلى الجديدة (easeOutCubic)
export function useCountUp(value, duration = 700) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target || prefersReducedMotion()) { fromRef.current = target; setShown(target); return undefined; }
    let raf;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - p) ** 3;
      const v = from + (target - from) * eased;
      setShown(v);
      fromRef.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return shown;
}

// لمعة الزجاج: تتبع موضع المؤشر داخل أي سطح زجاجي (متغيرات CSS ‎--mx/--my)
const SHINE_SELECTOR = '.card, .stat, .table-card, .menu-tile, .kds-card, .qr-card, .pub-item, .order-row, .window, .btn';
export function initGlassShine() {
  if (!window.matchMedia?.('(hover: hover)').matches) return;
  let last = null;
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.(SHINE_SELECTOR);
    if (last && last !== el) last.classList.remove('lit');
    last = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
    el.classList.add('lit');
  }, { passive: true });
  document.addEventListener('pointerleave', () => last?.classList.remove('lit'));
}
