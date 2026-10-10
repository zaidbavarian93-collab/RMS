import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

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
      const v = from + (target - from) * (1 - (1 - p) ** 3);
      setShown(v);
      fromRef.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return shown;
}
